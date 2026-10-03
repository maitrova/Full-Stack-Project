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
from app.schemas.user import UserPublic
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
