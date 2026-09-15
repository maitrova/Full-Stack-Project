from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING
from pymongo.errors import DuplicateKeyError

from app.utils.datetime import utc_now
from app.utils.object_id import parse_object_id


class UserRepository:
    def __init__(self, database: AsyncIOMotorDatabase):
        self.collection = database.users

    async def ensure_indexes(self) -> None:
        await self.collection.create_index([("email", ASCENDING)], unique=True)

    async def find_by_email(self, email: str) -> dict | None:
        return await self.collection.find_one({"email": email.lower()})

    async def find_by_id(self, user_id: str) -> dict | None:
        return await self.collection.find_one({"_id": parse_object_id(user_id)})

    async def create_user(self, name: str, email: str, password_hash: str) -> dict:
        now = utc_now()
        document = {
            "name": name.strip(),
            "email": email.lower(),
            "password_hash": password_hash,
            "created_at": now,
            "updated_at": now,
        }

        try:
            result = await self.collection.insert_one(document)
        except DuplicateKeyError:
            raise

        created = await self.collection.find_one({"_id": result.inserted_id})
        if created is None:
            raise RuntimeError("Created user could not be loaded")
        return created
