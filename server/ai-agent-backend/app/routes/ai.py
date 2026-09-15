from fastapi import APIRouter, Depends

from app.ai.sales_agent import SalesAgent
from app.database.mongodb import get_database
from app.dependencies.auth import get_current_user
from app.repositories.business_repository import BusinessRepository
from app.repositories.conversation_repository import ConversationRepository
from app.repositories.message_repository import MessageRepository
from app.repositories.product_repository import ProductRepository
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
        product_tools=ProductTools(ProductRepository(database)),
    )


@router.post("/chat", response_model=AiChatResponse, response_model_by_alias=False)
async def chat(
    payload: AiChatRequest,
    current_user: UserPublic = Depends(get_current_user),
    sales_agent: SalesAgent = Depends(get_sales_agent),
):
    return await sales_agent.handle_chat(payload, current_user)
