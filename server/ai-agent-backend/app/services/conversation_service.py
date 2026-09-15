import asyncio
import logging
from datetime import datetime, timezone

from fastapi import HTTPException, status

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
from app.services.whatsapp_service import WhatsAppClient
from app.utils.object_id import object_id_to_str

logger = logging.getLogger(__name__)


class ConversationService:
    def __init__(
        self,
        business_repository: BusinessRepository,
        conversation_repository: ConversationRepository,
        message_repository: MessageRepository,
    ):
        self.business_repository = business_repository
        self.conversation_repository = conversation_repository
        self.message_repository = message_repository

    async def _get_owned_business(self, current_user: UserPublic) -> dict:
        business = await self.business_repository.find_by_owner_id(current_user.id)
        if business is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Create a business before starting conversations",
            )
        return business

    async def create_conversation(self, payload: ConversationCreate, current_user: UserPublic) -> ConversationPublic:
        business = await self._get_owned_business(current_user)
        conversation = await self.conversation_repository.create_conversation(
            business_id=str(business["_id"]),
            payload=payload.model_dump(),
        )
        logger.info("Created conversation %s for business %s", conversation["_id"], business["_id"])
        return ConversationPublic.model_validate(object_id_to_str(conversation))

    async def list_conversations(self, current_user: UserPublic) -> list[ConversationPublic]:
        business = await self._get_owned_business(current_user)
        conversations = await self.conversation_repository.list_conversations(str(business["_id"]))
        return [ConversationPublic.model_validate(object_id_to_str(conversation)) for conversation in conversations]

    async def list_handoffs(self, current_user: UserPublic) -> list[dict]:
        business = await self._get_owned_business(current_user)
        alerts = await self.conversation_repository.collection.database.whatsapp_handoff_alerts.find(
            {"business_id": business["_id"], "status": {"$in": ["open", "assigned"]}}
        ).sort("created_at", -1).limit(100).to_list(100)
        return [object_id_to_str(alert) for alert in alerts]

    async def operation_status(self, current_user: UserPublic) -> dict:
        business = await self._get_owned_business(current_user)
        database = self.conversation_repository.collection.database
        job_scope = {"business_id": business["_id"]}
        ready, processing, failed, handoffs = await asyncio.gather(
            database.whatsapp_jobs.count_documents({**job_scope, "status": "ready"}),
            database.whatsapp_jobs.count_documents({**job_scope, "status": "processing"}),
            database.whatsapp_jobs.count_documents({**job_scope, "status": "failed"}),
            database.whatsapp_handoff_alerts.count_documents({"business_id": business["_id"], "status": {"$in": ["open", "assigned"]}}),
        )
        return {"ready": ready, "processing": processing, "failed": failed, "open_handoffs": handoffs}

    async def retry_failed_jobs(self, current_user: UserPublic) -> dict:
        business = await self._get_owned_business(current_user)
        database = self.conversation_repository.collection.database
        result = await database.whatsapp_jobs.update_many(
            {"business_id": business["_id"], "status": "failed"},
            {"$set": {"status": "ready", "attempts": 0, "available_at": datetime.now(timezone.utc)}, "$unset": {"error_type": ""}},
        )
        return {"retried": result.modified_count}

    async def get_conversation(self, conversation_id: str, current_user: UserPublic) -> ConversationDetail:
        business = await self._get_owned_business(current_user)
        conversation = await self.conversation_repository.find_by_id(conversation_id, str(business["_id"]))
        if conversation is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

        messages = await self.message_repository.list_by_conversation(str(business["_id"]), conversation_id)
        serialized_conversation = object_id_to_str(conversation)
        serialized_messages = [MessagePublic.model_validate(object_id_to_str(message)) for message in messages]
        return ConversationDetail.model_validate({**serialized_conversation, "messages": serialized_messages})

    async def add_message(
        self,
        conversation_id: str,
        payload: MessageCreate,
        current_user: UserPublic,
    ) -> MessagePublic:
        business = await self._get_owned_business(current_user)
        conversation = await self.conversation_repository.find_by_id(conversation_id, str(business["_id"]))
        if conversation is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

        message = await self.message_repository.create_message(
            business_id=str(business["_id"]),
            conversation_id=conversation_id,
            customer_id=str(conversation["customer_id"]) if conversation.get("customer_id") else None,
            payload=payload.model_dump(),
        )
        await self.conversation_repository.touch_last_message(conversation_id, str(business["_id"]))
        logger.info("Stored %s message %s in conversation %s", message["sender"], message["_id"], conversation_id)
        return MessagePublic.model_validate(object_id_to_str(message))

    async def update_status(
        self,
        conversation_id: str,
        payload: ConversationStatusUpdate,
        current_user: UserPublic,
    ) -> ConversationPublic:
        business = await self._get_owned_business(current_user)
        conversation = await self.conversation_repository.update_status(
            conversation_id=conversation_id,
            business_id=str(business["_id"]),
            status=payload.status,
        )
        if conversation is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

        if payload.status == "open":
            state = dict(conversation.get("conversation_state") or {})
            state.pop("handoff_requested", None)
            await self.conversation_repository.collection.update_one(
                {"_id": conversation["_id"], "business_id": business["_id"]},
                {"$set": {"conversation_state": state}},
            )
            await self.conversation_repository.collection.database.whatsapp_handoff_alerts.update_many(
                {"conversation_id": conversation["_id"], "status": {"$in": ["open", "assigned"]}},
                {"$set": {"status": "resumed", "resolved_at": conversation.get("updated_at")}},
            )
            conversation = await self.conversation_repository.find_by_id(conversation_id, str(business["_id"]))
        logger.info("Updated conversation %s status to %s", conversation_id, payload.status)
        return ConversationPublic.model_validate(object_id_to_str(conversation))

    async def send_human_reply(
        self,
        conversation_id: str,
        payload: HumanReplyCreate,
        current_user: UserPublic,
    ) -> MessagePublic:
        business = await self._get_owned_business(current_user)
        conversation = await self.conversation_repository.find_by_id(conversation_id, str(business["_id"]))
        if conversation is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

        if conversation.get("channel") == "whatsapp" and not conversation.get("external_customer_ref"):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="WhatsApp customer reference is missing")

        message = await self.message_repository.create_message(
            business_id=str(business["_id"]),
            conversation_id=conversation_id,
            customer_id=str(conversation["customer_id"]) if conversation.get("customer_id") else None,
            payload={
                "sender": "human",
                "content": payload.content,
                "message_type": "text",
                "metadata": {"source": "admin_inbox"},
            },
        )
        await self.conversation_repository.update_status(conversation_id, str(business["_id"]), "handoff")
        await self.conversation_repository.touch_last_message(conversation_id, str(business["_id"]))
        await self.conversation_repository.collection.database.whatsapp_handoff_alerts.update_many(
            {"conversation_id": conversation["_id"], "status": {"$in": ["open", "assigned"]}},
            {"$set": {"status": "assigned", "last_human_reply_at": message["created_at"], "updated_at": message["created_at"]}},
        )

        if conversation.get("channel") == "whatsapp":
            try:
                await WhatsAppClient().send_text(str(conversation["external_customer_ref"]), payload.content)
            except Exception as exc:
                logger.exception("Human WhatsApp reply failed")
                raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Could not send WhatsApp reply") from exc

        logger.info("Stored human message %s in conversation %s", message["_id"], conversation_id)
        return MessagePublic.model_validate(object_id_to_str(message))
