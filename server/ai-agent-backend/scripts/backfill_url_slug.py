"""Backfill deterministic URL slugs for readymade products."""

import asyncio

from app.database.mongodb import get_ecommerce_database
from app.repositories.ecommerce_product_repository import EcommerceProductRepository


async def main() -> None:
    database = get_ecommerce_database()
    repository = EcommerceProductRepository(database)
    cursor = repository.collection.find({}, {"_id": 1, "title": 1})
    async for product in cursor:
        url_slug = repository._slugify(product.get("title"))
        if url_slug:
            await repository.collection.update_one(
                {"_id": product["_id"]},
                {"$set": {"urlSlug": url_slug}},
            )
    await repository.collection.create_index("urlSlug", name="urlSlug_lookup")


if __name__ == "__main__":
    asyncio.run(main())
