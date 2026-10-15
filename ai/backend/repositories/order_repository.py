from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING

from app.utils.datetime import utc_now
from app.utils.object_id import parse_object_id


class OrderRepository:
    def __init__(self, database: AsyncIOMotorDatabase):
        self.collection = database.orders

    async def ensure_indexes(self) -> None:
        await self.collection.create_index([("business_id", ASCENDING), ("created_at", DESCENDING)])
        await self.collection.create_index([("business_id", ASCENDING), ("status", ASCENDING)])
        await self.collection.create_index([("business_id", ASCENDING), ("conversation_id", ASCENDING)])

    async def list_orders(self, business_id: str, limit: int = 100) -> list[dict]:
        cursor = (
            self.collection.find({"business_id": parse_object_id(business_id)})
            .sort("created_at", DESCENDING)
            .limit(limit)
        )
        return await cursor.to_list(length=limit)

    async def find_by_id(self, order_id: str, business_id: str) -> dict | None:
        return await self.collection.find_one(
            {
                "_id": parse_object_id(order_id),
                "business_id": parse_object_id(business_id),
            }
        )

    async def create_order(self, business_id: str, payload: dict) -> dict:
        now = utc_now()
        conversation_id = payload.get("conversation_id")
        document = {
            **payload,
            "business_id": parse_object_id(business_id),
            "conversation_id": parse_object_id(conversation_id) if conversation_id else None,
            "created_at": now,
            "updated_at": now,
        }
        result = await self.collection.insert_one(document)
        created = await self.collection.find_one({"_id": result.inserted_id})
        if created is None:
            raise RuntimeError("Created order could not be loaded")
        return created

    async def update_order(self, order_id: str, business_id: str, payload: dict) -> dict | None:
        update = {key: value for key, value in payload.items() if value is not None}
        update["updated_at"] = utc_now()
        await self.collection.update_one(
            {
                "_id": parse_object_id(order_id),
                "business_id": parse_object_id(business_id),
            },
            {"$set": update},
        )
        return await self.find_by_id(order_id, business_id)
