from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING
from pymongo.errors import DuplicateKeyError

from app.utils.datetime import utc_now
from app.utils.object_id import parse_object_id


class UserRepository:
    def __init__(self, database: AsyncIOMotorDatabase):
        self.collection = database.users

    async def ensure_indexes(self) -> None:
        # The ecommerce server owns this shared collection and may create the
        # same unique index with extra options such as sparse/background.
        # Reuse that compatible index instead of asking MongoDB to recreate
        # `email_1` with a conflicting specification.
        existing = (await self.collection.index_information()).get("email_1")
        if existing is not None:
            if existing.get("key") == [("email", ASCENDING)] and existing.get("unique") is True:
                return
            raise RuntimeError("The existing users.email index is incompatible with the AI agent")
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
