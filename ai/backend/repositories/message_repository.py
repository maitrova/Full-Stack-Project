from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING

from app.utils.datetime import utc_now
from app.utils.object_id import parse_object_id


class MessageRepository:
    def __init__(self, database: AsyncIOMotorDatabase):
        self.collection = database.messages

    async def ensure_indexes(self) -> None:
        await self.collection.create_index([("business_id", ASCENDING), ("conversation_id", ASCENDING), ("created_at", ASCENDING)])
        await self.collection.create_index([("business_id", ASCENDING), ("metadata.whatsapp_message_id", ASCENDING)])

    async def list_by_conversation(self, business_id: str, conversation_id: str, limit: int = 100) -> list[dict]:
        cursor = (
            self.collection.find(
                {
                    "business_id": parse_object_id(business_id),
                    "conversation_id": parse_object_id(conversation_id),
                }
            )
            .sort("created_at", ASCENDING)
            .limit(limit)
        )
        return await cursor.to_list(length=limit)

    async def create_message(self, business_id: str, conversation_id: str, customer_id: str | None, payload: dict) -> dict:
        document = {
            "business_id": parse_object_id(business_id),
            "conversation_id": parse_object_id(conversation_id),
            "customer_id": parse_object_id(customer_id) if customer_id else None,
            "sender": payload["sender"],
            "content": payload["content"],
            "message_type": payload.get("message_type", "text"),
            "metadata": payload.get("metadata", {}),
            "created_at": utc_now(),
        }
        result = await self.collection.insert_one(document)
        created = await self.collection.find_one({"_id": result.inserted_id})
        if created is None:
            raise RuntimeError("Created message could not be loaded")
        return created
