"""Read-only catalogue diagnostics for image search; prints no customer data."""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from motor.motor_asyncio import AsyncIOMotorClient

from app.config.settings import settings
from app.repositories.ecommerce_product_repository import EcommerceProductRepository


async def main():
    url = settings.ecommerce_mongodb_url or settings.mongoose_url or settings.primary_mongodb_url
    client = AsyncIOMotorClient(url, serverSelectionTimeoutMS=5000)
    try:
        await client.admin.command("ping")
        db = client[settings.ecommerce_mongodb_db_name]
        repository = EcommerceProductRepository(db)
        products = await repository._load_catalogue("000000000000000000000000")
        index_count = await db.ai_product_search_index.count_documents({})
        print("Catalogue products:", len(products), "Indexed products:", index_count)
        indexed_documents = await db.ai_product_search_index.find(
            {}, {"_id": 0, "product_id": 1, "dimensions": 1, "search_attributes": 1}
        ).to_list(length=100)
        print("Index records:", indexed_documents)
        analyses = [
            {"category": "T-Shirts", "product_type": "t-shirt", "color": "beige", "confidence": 0.95},
            {"category": "T-Shirts", "product_type": "t-shirt", "color": "maroon", "style": "graphic", "confidence": 0.98},
        ]
        for product in products:
            searchable = repository._searchable_text(product)
            print({
                "id": str(product["_id"]),
                "name": product["name"],
                "category": product["category"],
                "stock": product["stock"],
                "source": product.get("attributes", {}).get("source_type"),
                "colors": product.get("attributes", {}).get("colors", []),
                "image": Path(product["images"][0]).name if product.get("images") else None,
                "scores": [repository._hybrid_score(product, {}, analysis, None, None)[1] for analysis in analyses],
            })
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
