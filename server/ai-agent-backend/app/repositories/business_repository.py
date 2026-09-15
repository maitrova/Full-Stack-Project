from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING
from pymongo.errors import DuplicateKeyError

from app.utils.datetime import utc_now
from app.utils.object_id import parse_object_id


class BusinessRepository:
    def __init__(self, database: AsyncIOMotorDatabase):
        self.collection = database.businesses

    async def ensure_indexes(self) -> None:
        await self.collection.create_index([("owner_id", ASCENDING)], unique=True)

    async def find_by_owner_id(self, owner_id: str) -> dict | None:
        return await self.collection.find_one({"owner_id": parse_object_id(owner_id)})

    async def find_by_id_and_owner_id(self, business_id: str, owner_id: str) -> dict | None:
        return await self.collection.find_one(
            {
                "_id": parse_object_id(business_id),
                "owner_id": parse_object_id(owner_id),
            }
        )

    async def create_business(self, owner_id: str, payload: dict) -> dict:
        now = utc_now()
        document = {
            **payload,
            "owner_id": parse_object_id(owner_id),
            "created_at": now,
            "updated_at": now,
        }

        try:
            result = await self.collection.insert_one(document)
        except DuplicateKeyError:
            raise

        created = await self.collection.find_one({"_id": result.inserted_id})
        if created is None:
            raise RuntimeError("Created business could not be loaded")
        return created

    async def update_business(self, business_id: str, owner_id: str, payload: dict) -> dict | None:
        update = {key: value for key, value in payload.items() if value is not None}
        update["updated_at"] = utc_now()

        await self.collection.update_one(
            {
                "_id": parse_object_id(business_id),
                "owner_id": parse_object_id(owner_id),
            },
            {"$set": update},
        )
        return await self.find_by_id_and_owner_id(business_id, owner_id)
