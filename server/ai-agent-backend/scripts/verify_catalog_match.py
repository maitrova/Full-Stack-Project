"""Verify uploaded product images resolve to stocked catalogue records."""
import asyncio
import base64
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from motor.motor_asyncio import AsyncIOMotorClient

from app.ai.product_image_analyzer import ProductImageAnalyzer
from app.config.settings import settings
from app.repositories.ecommerce_product_repository import EcommerceProductRepository


async def main():
    url = settings.ecommerce_mongodb_url or settings.mongoose_url or settings.primary_mongodb_url
    client = AsyncIOMotorClient(url, serverSelectionTimeoutMS=5000)
    try:
        db = client[settings.ecommerce_mongodb_db_name]
        repository = EcommerceProductRepository(db)
        analyzer = ProductImageAnalyzer()
        categories = await repository.catalog_categories()
        paths = [
            Path("../outputs/readymade-products/images/pngtree-drop-shoulder-t-shirt-transparent-background-png-image_14825545-1790601123750-md.webp"),
            Path("../outputs/readymade-products/images/shopping-1790601233949-md.webp"),
        ]
        for path in paths:
            encoded = base64.b64encode(path.read_bytes()).decode()
            analysis, embedding = await asyncio.gather(
                analyzer.analyze(image_data=encoded, mime_type="image/webp", catalog_categories=categories),
                analyzer.embed(image_data=encoded, mime_type="image/webp"),
            )
            results = await repository.search_ranked_products(
                "000000000000000000000000",
                {"category": analysis.get("category") or analysis.get("product_type"), "attributes": {}},
                analysis,
                embedding,
                limit=5,
            )
            print(path.name, "analysis:", analysis.get("product_type"), analysis.get("color"))
            print("matches:", [(item["name"], item["stock"], item["attributes"]["match_score"]) for item in results])
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
