"""Run one catalogue image-index pass and report safe aggregate results."""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from motor.motor_asyncio import AsyncIOMotorClient

from app.config.settings import settings
from app.services.catalog_indexer import CatalogIndexer


async def main():
    url = settings.ecommerce_mongodb_url or settings.mongoose_url or settings.primary_mongodb_url
    client = AsyncIOMotorClient(url, serverSelectionTimeoutMS=5000)
    try:
        await client.admin.command("ping")
        db = client[settings.ecommerce_mongodb_db_name]
        indexer = CatalogIndexer(db)
        await indexer.ensure_indexes()
        count = await indexer.run_once(limit=100)
        total = await db.ai_product_search_index.count_documents({})
        print("Indexed this run:", count, "Total indexed:", total)
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
