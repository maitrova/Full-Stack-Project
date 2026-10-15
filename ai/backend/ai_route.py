from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
import hmac
import re
import time

from app.ai.sales_agent import SalesAgent
from app.config.settings import settings
from app.database.mongodb import get_database, get_ecommerce_database
from app.dependencies.auth import get_current_user
from app.repositories.business_repository import BusinessRepository
from app.repositories.conversation_repository import ConversationRepository
from app.repositories.message_repository import MessageRepository
from app.repositories.ecommerce_product_repository import EcommerceProductRepository
from app.schemas.ai import AiChatRequest, AiChatResponse, AiRecommendationRequest
from app.schemas.evaluation import EvaluationRequest
from app.schemas.user import UserPublic
from app.services.agent_evaluation import AgentEvaluator
from app.services.catalogue_quality import validate_catalogue_record
from app.services.quality_monitor import build_quality_alerts
from app.services.website_knowledge import WebsiteKnowledgeSync
from app.ai.gemini_client import GeminiClient
from app.tools.product_tools import ProductTools

router = APIRouter(prefix="/ai", tags=["ai"])
_evaluation_hits: dict[str, list[float]] = {}


def get_sales_agent() -> SalesAgent:
    database = get_database()
    return SalesAgent(
        business_repository=BusinessRepository(database),
        conversation_repository=ConversationRepository(database),
        message_repository=MessageRepository(database),
        product_tools=ProductTools(EcommerceProductRepository(get_ecommerce_database())),
    )


@router.get("/workflow")
async def ai_workflow(current_user: UserPublic = Depends(get_current_user)):
    """Return the read-only AI workflow map for the admin web UI.

    This exposes architecture metadata only. It never returns prompts, API
    keys, customer messages, catalogue records, or provider credentials.
    """
    return {
        "version": "1.0",
        "title": "AI Sales Agent Workflow",
        "entrypoints": [
            {"id": "web_chat", "label": "Web chat", "endpoint": "/api/ai/chat"},
            {"id": "whatsapp", "label": "WhatsApp webhook", "endpoint": "/api/whatsapp/webhook"},
        ],
        "nodes": [
            {"id": "input", "label": "Customer message or image", "type": "input"},
            {"id": "state", "label": "Load conversation state", "type": "state", "file": "app/ai/sales_agent.py"},
            {"id": "language", "label": "Language and text normalization", "type": "parser", "file": "app/ai/language.py"},
            {"id": "intent", "label": "Intent and entity extraction", "type": "parser", "file": "app/ai/intent_parser.py"},
            {"id": "model", "label": "Gemini / OpenAI fallback", "type": "model", "file": "app/ai/gemini_client.py"},
            {"id": "route", "label": "Route classification", "type": "router", "file": "app/ai/tool_router.py"},
            {"id": "policy", "label": "Action authorization", "type": "guard", "file": "app/ai/action_policy.py"},
            {"id": "catalogue", "label": "Catalogue search", "type": "tool", "file": "app/tools/product_tools.py"},
            {"id": "filters", "label": "Hard product filters", "type": "tool", "file": "app/repositories/ecommerce_product_repository.py"},
            {"id": "embeddings", "label": "Semantic / visual ranking", "type": "embedding", "file": "app/services/catalog_indexer.py"},
            {"id": "knowledge", "label": "Website/store knowledge", "type": "knowledge", "file": "app/services/website_knowledge.py"},
            {"id": "commerce", "label": "Cart, checkout, tracking, handoff", "type": "action", "file": "app/ai/sales_agent.py"},
            {"id": "fallback", "label": "Clarification or safe fallback", "type": "fallback", "file": "app/ai/response_generator.py"},
            {"id": "response", "label": "Verified response and state update", "type": "output", "file": "app/ai/sales_agent.py"},
        ],
        "edges": [
            {"from": "input", "to": "state"},
            {"from": "state", "to": "language"},
            {"from": "language", "to": "intent"},
            {"from": "intent", "to": "model", "condition": "ambiguous or rules insufficient"},
            {"from": "model", "to": "intent", "condition": "structured model result"},
            {"from": "intent", "to": "route"},
            {"from": "route", "to": "policy"},
            {"from": "policy", "to": "fallback", "condition": "unsafe or incomplete action"},
            {"from": "policy", "to": "catalogue", "condition": "product route"},
            {"from": "catalogue", "to": "filters"},
            {"from": "filters", "to": "embeddings", "condition": "semantic or image query"},
            {"from": "policy", "to": "knowledge", "condition": "store question"},
            {"from": "policy", "to": "commerce", "condition": "authorized action"},
            {"from": "catalogue", "to": "response"},
            {"from": "embeddings", "to": "response"},
            {"from": "knowledge", "to": "response"},
            {"from": "commerce", "to": "response"},
            {"from": "fallback", "to": "response"},
        ],
        "models": {
            "primary_text_and_vision": "GEMINI_MODEL",
            "secondary_text_and_vision": "OPENAI_MODEL",
            "embedding": "GEMINI_EMBEDDING_MODEL",
            "fallback_policy": "deterministic rules and verified catalogue facts",
        },
        "routes": [
            "product_search", "product_selection", "product_details", "product_recommendation",
            "customization", "design_library", "store_question", "cart", "checkout",
            "order_tracking", "human_handoff", "unsupported",
        ],
        "fallbacks": [
            "Gemini unavailable -> deterministic parser",
            "No product match -> no-match response plus similar/custom option",
            "Missing product selection -> ask for option or product name",
            "Unsafe cart action -> block and ask for required details",
            "Unsupported request -> safe capability clarification",
        ],
    }


@router.post("/chat", response_model=AiChatResponse, response_model_by_alias=False)
async def chat(
    payload: AiChatRequest,
    current_user: UserPublic = Depends(get_current_user),
    sales_agent: SalesAgent = Depends(get_sales_agent),
):
    if payload.page_context:
        context = payload.page_context
        page_type = context.get("page_type", "")
        product_name = context.get("product_name") or context.get("productName")
        product_id = context.get("product_id")
        user_message = payload.message.strip().lower()
        is_greeting = user_message in {
            "hi", "hello", "hey", "hiya", "good morning", "good afternoon", "good evening"
        }
        if (page_type == "product_detail" or product_name or product_id) and not is_greeting:
            product_context = ", ".join(
                value for value in [
                    f"name: {product_name}" if product_name else "",
                    f"id: {product_id}" if product_id else "",
                    f"path: {context.get('path')}" if context.get("path") else "",
                ] if value
            )
            payload = payload.model_copy(update={
                "message": (
                    f"Customer question: {payload.message}. "
                    f"Product currently open on screen: {product_context}. "
                    "Use this product as the primary context for the answer."
                )[:4000]
            })
    return await sales_agent.handle_chat(payload, current_user)


@router.post("/recommendations")
async def recommendations(
    payload: AiRecommendationRequest,
    current_user: UserPublic = Depends(get_current_user),
    sales_agent: SalesAgent = Depends(get_sales_agent),
):
    """Return page-aware recommendations for the storefront recommendations tab.

    Recommendations use the same verified catalogue and conversation handling as
    chat, while keeping the response shape expected by the web client.
    """
    context = payload.page_context
    page_type = context.get("page_type", "")
    page_path = context.get("path", "")
    product_name = context.get("product_name") or context.get("productName")
    prompt = "Recommend products relevant to the page I am viewing."
    if product_name:
        prompt = f"Recommend products similar to or useful with {product_name}."
    elif page_type:
        prompt = f"Recommend products relevant to this {page_type} page."
    if page_path:
        prompt += f" Page: {page_path}."

    result = await sales_agent.handle_chat(
        AiChatRequest(
            message=prompt,
            conversation_id=(
                payload.session_id
                if payload.session_id and re.fullmatch(r"[a-fA-F0-9]{24}", payload.session_id)
                else None
            ),
        ),
        current_user,
    )
    return {
        "session_id": result.conversation.id,
        "response": result.ai_message.content,
        "products": result.recommended_products,
        "offers": result.ai_message.metadata.get("offers", []),
    }


@router.post("/evaluate")
async def evaluate_agent(
    payload: EvaluationRequest,
    request: Request,
    x_evaluation_key: str | None = Header(default=None),
):
    """Run read-only test messages and persist an evaluation report.

    This endpoint never sends WhatsApp messages and does not execute cart,
    checkout, order, or human-handoff mutations.
    """
    configured_key = settings.ai_evaluation_key.strip()
    if not configured_key or not x_evaluation_key or not hmac.compare_digest(x_evaluation_key, configured_key):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid evaluation key")

    now = time.monotonic()
    client_key = request.client.host if request.client else "unknown"
    recent = [timestamp for timestamp in _evaluation_hits.get(client_key, []) if now - timestamp < 60]
    if len(recent) >= settings.ai_evaluation_rate_limit_per_minute:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Evaluation rate limit exceeded")
    recent.append(now)
    _evaluation_hits[client_key] = recent

    database = get_database()
    business = None
    if payload.business_id:
        from app.utils.object_id import parse_object_id
        business = await BusinessRepository(database).collection.find_one({"_id": parse_object_id(payload.business_id)})
    if business is None:
        # This deployment currently serves one merchant storefront. The
        # optional business_id keeps the endpoint ready for multi-tenant use.
        business = await BusinessRepository(database).collection.find_one({})
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
