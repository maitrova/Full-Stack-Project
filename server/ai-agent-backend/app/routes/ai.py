from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends

from app.ai.sales_agent import SalesAgent
from app.config.settings import settings
from app.database.mongodb import get_database, get_ecommerce_database
from app.dependencies.auth import get_current_user
from app.repositories.business_repository import BusinessRepository
from app.repositories.conversation_repository import ConversationRepository
from app.repositories.message_repository import MessageRepository
from app.repositories.ecommerce_product_repository import EcommerceProductRepository
from app.schemas.ai import AiChatRequest, AiChatResponse
from app.schemas.evaluation import EvaluationRequest
from app.schemas.user import UserPublic
from app.services.agent_evaluation import AgentEvaluator
from app.services.catalogue_quality import validate_catalogue_record
from app.services.quality_monitor import build_quality_alerts
from app.services.website_knowledge import WebsiteKnowledgeSync
from app.ai.gemini_client import GeminiClient
from app.tools.product_tools import ProductTools

router = APIRouter(prefix="/ai", tags=["ai"])


def get_sales_agent() -> SalesAgent:
    database = get_database()
    return SalesAgent(
        business_repository=BusinessRepository(database),
        conversation_repository=ConversationRepository(database),
        message_repository=MessageRepository(database),
        product_tools=ProductTools(EcommerceProductRepository(get_ecommerce_database())),
    )


@router.post("/chat", response_model=AiChatResponse, response_model_by_alias=False)
async def chat(
    payload: AiChatRequest,
    current_user: UserPublic = Depends(get_current_user),
    sales_agent: SalesAgent = Depends(get_sales_agent),
):
    return await sales_agent.handle_chat(payload, current_user)


@router.post("/evaluate")
async def evaluate_agent(
    payload: EvaluationRequest,
    current_user: UserPublic = Depends(get_current_user),
):
    """Run read-only test messages and persist an evaluation report.

    This endpoint never sends WhatsApp messages and does not execute cart,
    checkout, order, or human-handoff mutations.
    """
    database = get_database()
    business = await BusinessRepository(database).find_by_owner_id(current_user.id)
    if business is None:
        return {"found": False, "message": "Create a business before running evaluations."}

    sales_agent = get_sales_agent()
    categories = await sales_agent._catalog_category_names()
    report = await AgentEvaluator(
        product_tools=sales_agent.product_tools,
        intent_parser=sales_agent.intent_parser,
    ).run(
        business_id=str(business["_id"]),
        cases=payload.cases,
        catalog_categories=categories,
    )
    report.update({
        "business_id": business["_id"],
        "name": payload.name,
    })
    insert_result = await database.ai_agent_evaluations.insert_one(report)
    report["run_id"] = str(insert_result.inserted_id)
    report.pop("_id", None)
    report["business_id"] = str(report["business_id"])
    return report


@router.get("/evaluations")
async def list_evaluations(
    limit: int = 20,
    current_user: UserPublic = Depends(get_current_user),
):
    """List recent evaluation summaries for the signed-in merchant."""
    database = get_database()
    business = await BusinessRepository(database).find_by_owner_id(current_user.id)
    if business is None:
        return {"runs": []}
    limit = max(1, min(limit, 100))
    rows = await database.ai_agent_evaluations.find(
        {"business_id": business["_id"]},
        {"_id": 1, "name": 1, "created_at": 1, "total_cases": 1, "passed_cases": 1,
         "failed_cases": 1, "pass_rate": 1, "average_latency_ms": 1},
    ).sort("created_at", -1).to_list(length=limit)
    return {
        "runs": [
            {**row, "run_id": str(row.pop("_id")), "business_id": str(business["_id"])}
            for row in rows
        ]
    }


@router.get("/evaluations/{run_id}")
async def get_evaluation(
    run_id: str,
    current_user: UserPublic = Depends(get_current_user),
):
    """Return one complete evaluation report."""
    from bson import ObjectId

    database = get_database()
    business = await BusinessRepository(database).find_by_owner_id(current_user.id)
    if business is None or not ObjectId.is_valid(run_id):
        return {"found": False}
    report = await database.ai_agent_evaluations.find_one({
        "_id": ObjectId(run_id),
        "business_id": business["_id"],
    })
    if report is None:
        return {"found": False}
    report["run_id"] = str(report.pop("_id"))
    report["business_id"] = str(report["business_id"])
    return {"found": True, "report": report}


@router.get("/metrics")
async def ai_metrics(
    current_user: UserPublic = Depends(get_current_user),
):
    """Privacy-safe 24-hour quality/latency summary for the business owner."""
    database = get_database()
    business = await BusinessRepository(database).find_by_owner_id(current_user.id)
    if business is None:
        return {
            "period_hours": 24,
            "requests": 0,
            "empty_searches": 0,
            "image_requests": 0,
            "image_analysis_failures": 0,
            "image_embedding_failures": 0,
            "handoff_requests": 0,
            "clarification_requests": 0,
            "checkout_failures": 0,
            "policy_blocks": 0,
            "catalogue_embeddings": 0,
            "input_tokens": 0,
            "output_tokens": 0,
            "total_tokens": 0,
            "estimated_cost_usd": 0,
            "whatsapp_inbound_messages": 0,
            "whatsapp_outbound_messages": 0,
        }
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    rows = await database.ai_agent_metrics.aggregate([
        {"$match": {"business_id": business["_id"], "created_at": {"$gte": since}}},
        {"$group": {
            "_id": None,
            "requests": {"$sum": 1},
            "empty_searches": {"$sum": {"$cond": ["$empty_result", 1, 0]}},
            "image_requests": {"$sum": {"$cond": ["$had_image", 1, 0]}},
            "image_analysis_failures": {"$sum": {"$cond": ["$image_analysis_failed", 1, 0]}},
            "image_embedding_failures": {"$sum": {"$cond": [
                {"$and": ["$had_image", {"$eq": ["$image_embedding_available", False]}]}, 1, 0
            ]}},
            "handoff_requests": {"$sum": {"$cond": ["$handoff_requested", 1, 0]}},
            "clarification_requests": {"$sum": {"$cond": [
                {"$eq": ["$response_goal", "ask for clarification because intent confidence is low"]}, 1, 0
            ]}},
            "checkout_failures": {"$sum": {"$cond": ["$checkout_failure", 1, 0]}},
            "policy_blocks": {"$sum": {"$cond": ["$policy_blocked", 1, 0]}},
            "average_latency_ms": {"$avg": "$latency_ms"},
            "input_tokens": {"$sum": "$input_tokens"},
            "output_tokens": {"$sum": "$output_tokens"},
            "total_tokens": {"$sum": "$total_tokens"},
            "estimated_cost_usd": {"$sum": "$estimated_cost_usd"},
        }},
    ]).to_list(length=1)
    summary = rows[0] if rows else {}
    summary.pop("_id", None)
    summary["period_hours"] = 24
    summary["catalogue_embeddings"] = await get_ecommerce_database().ai_product_search_index.count_documents(
        {"embedding_model": settings.gemini_embedding_model}
    )
    message_rows = await database.whatsapp_deliveries.aggregate([
        {"$match": {"business_id": business["_id"], "created_at": {"$gte": since}}},
        {"$group": {
            "_id": None,
            "whatsapp_inbound_messages": {"$sum": "$inbound_messages"},
            "whatsapp_outbound_messages": {"$sum": "$outbound_messages"},
        }},
    ]).to_list(length=1)
    summary.update({
        "whatsapp_inbound_messages": (message_rows[0] if message_rows else {}).get("whatsapp_inbound_messages", 0),
        "whatsapp_outbound_messages": (message_rows[0] if message_rows else {}).get("whatsapp_outbound_messages", 0),
    })
    summary["quality"] = {
        "clarification_rate": round(
            summary.get("clarification_requests", 0) / summary.get("requests", 1), 4
        ) if summary.get("requests") else 0,
        "empty_search_rate": round(
            summary.get("empty_searches", 0) / summary.get("requests", 1), 4
        ) if summary.get("requests") else 0,
        "handoff_rate": round(
            summary.get("handoff_requests", 0) / summary.get("requests", 1), 4
        ) if summary.get("requests") else 0,
    }
    summary["alerts"] = build_quality_alerts(summary)
    return summary


@router.get("/metrics/trace/{request_id}")
async def ai_trace(
    request_id: str,
    current_user: UserPublic = Depends(get_current_user),
):
    """Return a privacy-safe trace for one AI request owned by this merchant."""
    database = get_database()
    business = await BusinessRepository(database).find_by_owner_id(current_user.id)
    if business is None:
        return {"request_id": request_id, "found": False}
    metric = await database.ai_agent_metrics.find_one(
        {"business_id": business["_id"], "request_id": request_id},
        {"_id": 0},
    )
    audits = await database.ai_action_audit.find(
        {"business_id": business["_id"], "request_id": request_id},
        {"_id": 0},
    ).sort("created_at", 1).to_list(length=50)
    if metric is None and not audits:
        return {"request_id": request_id, "found": False}
    return {
        "request_id": request_id,
        "found": True,
        "metric": metric,
        "actions": audits,
    }


@router.get("/catalogue/health")
async def catalogue_health(
    current_user: UserPublic = Depends(get_current_user),
):
    """Return a read-only quality report for the merchant's live AI catalogue."""
    database = get_database()
    business = await BusinessRepository(database).find_by_owner_id(current_user.id)
    if business is None:
        return {"found": False, "total_products": 0, "error_products": 0, "warning_products": 0}

    repository = EcommerceProductRepository(get_ecommerce_database())
    products = await repository._load_catalogue(str(business["_id"]))
    reports = [validate_catalogue_record(product) for product in products]

    def issue_counts(attribute: str) -> dict[str, int]:
        counts: dict[str, int] = {}
        for report in reports:
            for issue in getattr(report, attribute):
                counts[issue] = counts.get(issue, 0) + 1
        return dict(sorted(counts.items(), key=lambda item: (-item[1], item[0])))

    return {
        "found": True,
        "business_id": str(business["_id"]),
        "total_products": len(reports),
        "searchable_products": sum(report.is_searchable for report in reports),
        "error_products": sum(bool(report.errors) for report in reports),
        "warning_products": sum(bool(report.warnings) for report in reports),
        "errors_by_type": issue_counts("errors"),
        "warnings_by_type": issue_counts("warnings"),
        "products": [
            {
                "product_id": report.product_id,
                "errors": report.errors,
                "warnings": report.warnings,
            }
            for report in reports
            if report.errors or report.warnings
        ][:100],
    }


@router.get("/knowledge/health")
async def knowledge_health(
    current_user: UserPublic = Depends(get_current_user),
):
    """Show website knowledge freshness and source coverage for the merchant."""
    database = get_database()
    business = await BusinessRepository(database).find_by_owner_id(current_user.id)
    if business is None:
        return {"found": False, "configured_urls": 0, "active_chunks": 0}
    ecommerce_database = get_ecommerce_database()
    collection = ecommerce_database.ai_website_knowledge
    active_chunks = await collection.count_documents({"status": "active"})
    stale_chunks = await collection.count_documents({"status": "stale"})
    embedded_chunks = await collection.count_documents({
        "status": "active",
        "embedding": {"$exists": True, "$ne": []},
    })
    embedding_error_chunks = await collection.count_documents({
        "status": "active",
        "embedding_status": "unavailable",
    })
    latest_embedding_error = await collection.find_one(
        {"status": "active", "embedding_status": "unavailable"},
        {"_id": 0, "embedding_error": 1, "updated_at": 1},
        sort=[("updated_at", -1)],
    )
    latest = await collection.find_one({"status": "active"}, {"_id": 0, "updated_at": 1}, sort=[("updated_at", -1)])
    sources = await collection.aggregate([
        {"$match": {"status": "active"}},
        {"$group": {"_id": "$source_url", "chunks": {"$sum": 1}, "updated_at": {"$max": "$updated_at"}}},
        {"$sort": {"updated_at": -1}},
    ]).to_list(length=100)
    return {
        "found": True,
        "configured_urls": len(WebsiteKnowledgeSync.configured_urls()),
        "active_chunks": active_chunks,
        "stale_chunks": stale_chunks,
        "embeddings": {
            "configured": GeminiClient().supports_embeddings,
            "model": settings.gemini_embedding_model,
            "active_embedded_chunks": embedded_chunks,
            "active_unembedded_chunks": max(0, active_chunks - embedded_chunks),
            "chunks_with_errors": embedding_error_chunks,
            "latest_error": latest_embedding_error.get("embedding_error") if latest_embedding_error else None,
            "latest_error_at": latest_embedding_error.get("updated_at") if latest_embedding_error else None,
        },
        "latest_updated_at": latest.get("updated_at") if latest else None,
        "sources": [
            {"url": item.get("_id"), "chunks": item.get("chunks", 0), "updated_at": item.get("updated_at")}
            for item in sources
        ],
    }
