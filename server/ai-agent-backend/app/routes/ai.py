from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends

from app.ai.sales_agent import SalesAgent
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
            "checkout_failures": 0,
            "catalogue_embeddings": 0,
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
            "checkout_failures": {"$sum": {"$cond": ["$checkout_failure", 1, 0]}},
            "average_latency_ms": {"$avg": "$latency_ms"},
        }},
    ]).to_list(length=1)
    summary = rows[0] if rows else {}
    summary.pop("_id", None)
    summary["period_hours"] = 24
    summary["catalogue_embeddings"] = await get_ecommerce_database().ai_product_search_index.count_documents(
        {"embedding_model": settings.gemini_embedding_model}
    )
    return summary
