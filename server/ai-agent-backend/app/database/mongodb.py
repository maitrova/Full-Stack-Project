import logging

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo.errors import PyMongoError

from app.config.settings import settings

logger = logging.getLogger(__name__)

mongo_client: AsyncIOMotorClient | None = None
database: AsyncIOMotorDatabase | None = None
ecommerce_mongo_client: AsyncIOMotorClient | None = None
ecommerce_database: AsyncIOMotorDatabase | None = None


async def connect_to_mongo() -> None:
    global mongo_client, database, ecommerce_mongo_client, ecommerce_database

    primary_url = settings.primary_mongodb_url
    mongo_client = AsyncIOMotorClient(primary_url, serverSelectionTimeoutMS=5000)
    database = mongo_client[settings.mongodb_db_name]

    try:
        await mongo_client.admin.command("ping")
        logger.info("Connected to MongoDB database '%s'", settings.mongodb_db_name)
    except PyMongoError:
        logger.exception("MongoDB connection failed")
        raise

    ecommerce_url = settings.ecommerce_mongodb_url or settings.mongoose_url or primary_url
    ecommerce_db_name = settings.ecommerce_mongodb_db_name
    if ecommerce_url == primary_url:
        ecommerce_mongo_client = mongo_client
    else:
        ecommerce_mongo_client = AsyncIOMotorClient(ecommerce_url, serverSelectionTimeoutMS=5000)
    ecommerce_database = ecommerce_mongo_client[ecommerce_db_name]
    try:
        await ecommerce_mongo_client.admin.command("ping")
        logger.info("Connected to ecommerce MongoDB database '%s'", ecommerce_db_name)
    except PyMongoError:
        logger.exception("Ecommerce MongoDB connection failed")
        raise


async def close_mongo_connection() -> None:
    global mongo_client, database, ecommerce_mongo_client, ecommerce_database

    if mongo_client is not None:
        mongo_client.close()
        logger.info("MongoDB connection closed")

    if ecommerce_mongo_client is not None and ecommerce_mongo_client is not mongo_client:
        ecommerce_mongo_client.close()
        logger.info("Ecommerce MongoDB connection closed")

    mongo_client = None
    database = None
    ecommerce_mongo_client = None
    ecommerce_database = None


def get_database() -> AsyncIOMotorDatabase:
    if database is None:
        raise RuntimeError("MongoDB connection is not initialized")
    return database


def get_ecommerce_database() -> AsyncIOMotorDatabase:
    if ecommerce_database is None:
        raise RuntimeError("Ecommerce MongoDB connection is not initialized")
    return ecommerce_database
