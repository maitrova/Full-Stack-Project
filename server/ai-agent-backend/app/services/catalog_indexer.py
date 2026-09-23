import asyncio
import hashlib
import json
import logging
from datetime import datetime, timedelta, timezone

from pymongo import ReturnDocument
from pymongo.errors import PyMongoError

from app.ai.gemini_client import GeminiClient
from app.ai.product_image_analyzer import ProductImageAnalyzer
from app.config.settings import settings
from app.repositories.ecommerce_product_repository import EcommerceProductRepository

logger = logging.getLogger(__name__)


class CatalogIndexer:
    """Incrementally indexes public product metadata/images; never customer media."""

    def __init__(self, database, gemini_client: GeminiClient | None = None):
        self.database = database
        self.repository = EcommerceProductRepository(database)
        self.gemini_client = gemini_client or GeminiClient()
        self.image_analyzer = ProductImageAnalyzer(self.gemini_client)
        self.index = database.ai_product_search_index
        self.locks = database.ai_background_locks

    async def ensure_indexes(self) -> None:
        await self.index.create_index([("product_id", 1), ("embedding_model", 1)], unique=True)
        await self.index.create_index("updated_at")

    async def run_once(self, limit: int | None = None) -> int:
        if not self.gemini_client.is_configured:
            return 0
        if not await self._acquire_lease():
            return 0

        products = await self.repository._load_catalogue("000000000000000000000000")
        catalog_categories = await self.repository.catalog_categories()
        active_ids = [str(product["_id"]) for product in products]
        indexed = 0
        attempted = 0
        for product in products:
            if attempted >= (limit or settings.catalogue_index_batch_size):
                break
            fingerprint = self._fingerprint(product)
            existing = await self.index.find_one(
                {
                    "product_id": str(product["_id"]),
                    "embedding_model": settings.gemini_embedding_model,
                    "fingerprint": fingerprint,
                },
                {"_id": 1},
            )
            if existing:
                continue
            attempted += 1
            try:
                image_url = product.get("images", [None])[0] if product.get("images") else None
                extracted_attributes = {}
                if image_url:
                    extracted_attributes = await self.image_analyzer.analyze(
                        image_url=image_url,
                        catalog_categories=catalog_categories,
                        customer_message=product.get("name"),
                    )
                embedding = await self.gemini_client.embed_content(
                    text=self._index_text(product),
                    image_url=image_url,
                )
                await self.index.update_one(
                    {
                        "product_id": str(product["_id"]),
                        "embedding_model": settings.gemini_embedding_model,
                    },
                    {
                        "$set": {
                            "source_type": product.get("attributes", {}).get("source_type"),
                            "fingerprint": fingerprint,
                            "embedding": embedding,
                            "search_attributes": self._safe_attributes(extracted_attributes),
                            "dimensions": len(embedding),
                            "updated_at": datetime.now(timezone.utc),
                        }
                    },
                    upsert=True,
                )
                indexed += 1
            except Exception as exc:
                logger.warning("Catalogue embedding failed for one product: %s", exc.__class__.__name__)

        if active_ids:
            await self.index.delete_many({"product_id": {"$nin": active_ids}})
        await self.locks.delete_one({"_id": "catalog-indexer"})
        return indexed

    def _safe_attributes(self, attributes: dict) -> dict:
        allowed = {
            "category", "product_type", "product_name_hint", "visible_text", "brand", "color",
            "material", "fabric", "occasion", "style", "pattern", "work", "gender", "description",
        }
        return {
            key: value for key, value in attributes.items()
            if key in allowed and isinstance(value, (str, int, float, bool, type(None)))
        }

    async def _acquire_lease(self) -> bool:
        now = datetime.now(timezone.utc)
        try:
            lease = await self.locks.find_one_and_update(
                {
                    "_id": "catalog-indexer",
                    "$or": [{"expires_at": {"$lte": now}}, {"expires_at": {"$exists": False}}],
                },
                {"$set": {"expires_at": now + timedelta(minutes=4), "updated_at": now}},
                upsert=True,
                return_document=ReturnDocument.AFTER,
            )
            return bool(lease)
        except PyMongoError:
            return False

    def _fingerprint(self, product: dict) -> str:
        payload = {
            "name": product.get("name"),
            "description": product.get("description"),
            "category": product.get("category"),
            "tags": product.get("tags"),
            "attributes": {
                key: value
                for key, value in product.get("attributes", {}).items()
                if key not in {"variants", "product_url", "match_components", "match_score"}
            },
            "image": product.get("images", [None])[0] if product.get("images") else None,
            "updated_at": str(product.get("updated_at")),
        }
        return hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()

    def _index_text(self, product: dict) -> str:
        attributes = product.get("attributes") or {}
        values = [
            product.get("name"), product.get("description"), product.get("category"),
            attributes.get("sub_category"), attributes.get("brand"), attributes.get("source_type"),
            " ".join(product.get("tags") or []), " ".join(attributes.get("colors") or []),
        ]
        return "Product for visual commerce search: " + ". ".join(str(value) for value in values if value)


async def catalog_index_worker(database) -> None:
    indexer = CatalogIndexer(database)
    await indexer.ensure_indexes()
    while True:
        delay = max(60, settings.catalogue_index_interval_seconds)
        try:
            count = await indexer.run_once()
            if count:
                logger.info("Updated %s catalogue search embeddings", count)
            else:
                delay *= 5
        except Exception as exc:
            logger.warning("Catalogue index pass failed: %s", exc.__class__.__name__)
            delay *= 5
        await asyncio.sleep(delay)
