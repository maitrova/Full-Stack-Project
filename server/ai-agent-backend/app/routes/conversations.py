from fastapi import APIRouter, Depends, status

from app.database.mongodb import get_database
from app.dependencies.auth import get_current_user
from app.repositories.business_repository import BusinessRepository
from app.repositories.conversation_repository import ConversationRepository
from app.repositories.message_repository import MessageRepository
from app.schemas.conversation import (
    ConversationCreate,
    ConversationDetail,
    ConversationPublic,
    ConversationStatusUpdate,
    HumanReplyCreate,
    MessageCreate,
    MessagePublic,
)
from app.schemas.user import UserPublic
from app.services.conversation_service import ConversationService

router = APIRouter(prefix="/conversations", tags=["conversations"])


def get_conversation_service() -> ConversationService:
    database = get_database()
    return ConversationService(
        business_repository=BusinessRepository(database),
        conversation_repository=ConversationRepository(database),
        message_repository=MessageRepository(database),
    )


@router.post(
    "",
    response_model=ConversationPublic,
    response_model_by_alias=False,
    status_code=status.HTTP_201_CREATED,
)
async def create_conversation(
    payload: ConversationCreate,
    current_user: UserPublic = Depends(get_current_user),
    conversation_service: ConversationService = Depends(get_conversation_service),
):
    return await conversation_service.create_conversation(payload, current_user)


@router.get("", response_model=list[ConversationPublic], response_model_by_alias=False)
async def list_conversations(
    current_user: UserPublic = Depends(get_current_user),
    conversation_service: ConversationService = Depends(get_conversation_service),
):
    return await conversation_service.list_conversations(current_user)


@router.get("/handoffs")
async def list_handoffs(
    current_user: UserPublic = Depends(get_current_user),
    conversation_service: ConversationService = Depends(get_conversation_service),
):
    return await conversation_service.list_handoffs(current_user)


@router.get("/operations")
async def operation_status(
    current_user: UserPublic = Depends(get_current_user),
    conversation_service: ConversationService = Depends(get_conversation_service),
):
    return await conversation_service.operation_status(current_user)


@router.post("/operations/retry-failed")
async def retry_failed_jobs(
    current_user: UserPublic = Depends(get_current_user),
    conversation_service: ConversationService = Depends(get_conversation_service),
):
    return await conversation_service.retry_failed_jobs(current_user)


@router.get("/{conversation_id}", response_model=ConversationDetail, response_model_by_alias=False)
async def get_conversation(
    conversation_id: str,
    current_user: UserPublic = Depends(get_current_user),
    conversation_service: ConversationService = Depends(get_conversation_service),
):
    return await conversation_service.get_conversation(conversation_id, current_user)


@router.post("/{conversation_id}/messages", response_model=MessagePublic, response_model_by_alias=False, status_code=status.HTTP_201_CREATED)
async def add_message(
    conversation_id: str,
    payload: MessageCreate,
    current_user: UserPublic = Depends(get_current_user),
    conversation_service: ConversationService = Depends(get_conversation_service),
):
    return await conversation_service.add_message(conversation_id, payload, current_user)


@router.patch("/{conversation_id}/status", response_model=ConversationPublic, response_model_by_alias=False)
async def update_conversation_status(
    conversation_id: str,
    payload: ConversationStatusUpdate,
    current_user: UserPublic = Depends(get_current_user),
    conversation_service: ConversationService = Depends(get_conversation_service),
):
    return await conversation_service.update_status(conversation_id, payload, current_user)


@router.post("/{conversation_id}/human-reply", response_model=MessagePublic, response_model_by_alias=False, status_code=status.HTTP_201_CREATED)
async def send_human_reply(
    conversation_id: str,
    payload: HumanReplyCreate,
    current_user: UserPublic = Depends(get_current_user),
    conversation_service: ConversationService = Depends(get_conversation_service),
):
    return await conversation_service.send_human_reply(conversation_id, payload, current_user)
