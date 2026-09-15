from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING

from app.utils.datetime import utc_now
from app.utils.object_id import parse_object_id


class ConversationRepository:
    def __init__(self, database: AsyncIOMotorDatabase):
        self.collection = database.conversations

    async def ensure_indexes(self) -> None:
        await self.collection.create_index([("business_id", ASCENDING), ("last_message_at", DESCENDING)])
        await self.collection.create_index([("business_id", ASCENDING), ("channel", ASCENDING)])
        await self.collection.create_index([("business_id", ASCENDING), ("status", ASCENDING)])
        await self.collection.create_index(
            [("business_id", ASCENDING), ("channel", ASCENDING), ("external_customer_ref", ASCENDING)]
        )

    async def create_conversation(self, business_id: str, payload: dict) -> dict:
        now = utc_now()
        customer_id = payload.get("customer_id")
        document = {
            "business_id": parse_object_id(business_id),
            "customer_id": parse_object_id(customer_id) if customer_id else None,
            "channel": payload.get("channel", "web"),
            "external_customer_ref": payload.get("external_customer_ref"),
            "customer_name": payload.get("customer_name"),
            "status": "open",
            "current_intent": None,
            "conversation_state": {},
            "recommended_product_ids": [],
            "selected_product_id": None,
            "created_at": now,
            "updated_at": now,
            "last_message_at": None,
        }
        result = await self.collection.insert_one(document)
        created = await self.collection.find_one({"_id": result.inserted_id})
        if created is None:
            raise RuntimeError("Created conversation could not be loaded")
        return created

    async def list_conversations(self, business_id: str, limit: int = 50) -> list[dict]:
        cursor = (
            self.collection.find({"business_id": parse_object_id(business_id)})
            .sort([("last_message_at", DESCENDING), ("created_at", DESCENDING)])
            .limit(limit)
        )
        return await cursor.to_list(length=limit)

    async def find_by_id(self, conversation_id: str, business_id: str) -> dict | None:
        return await self.collection.find_one(
            {
                "_id": parse_object_id(conversation_id),
                "business_id": parse_object_id(business_id),
            }
        )

    async def find_by_external_customer_ref(self, business_id: str, channel: str, external_customer_ref: str) -> dict | None:
        return await self.collection.find_one(
            {
                "business_id": parse_object_id(business_id),
                "channel": channel,
                "external_customer_ref": external_customer_ref,
            }
        )

    async def touch_last_message(self, conversation_id: str, business_id: str) -> None:
        now = utc_now()
        await self.collection.update_one(
            {
                "_id": parse_object_id(conversation_id),
                "business_id": parse_object_id(business_id),
            },
            {"$set": {"last_message_at": now, "updated_at": now}},
        )

    async def update_status(self, conversation_id: str, business_id: str, status: str) -> dict | None:
        now = utc_now()
        await self.collection.update_one(
            {
                "_id": parse_object_id(conversation_id),
                "business_id": parse_object_id(business_id),
            },
            {"$set": {"status": status, "updated_at": now}},
        )
        return await self.find_by_id(conversation_id, business_id)
