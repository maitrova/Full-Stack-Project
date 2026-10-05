from dataclasses import dataclass, field
import logging
from typing import Any

from pydantic import ValidationError

from app.repositories.product_repository import ProductRepository
from app.ai.gemini_client import GeminiClient
from app.services.catalogue_quality import validate_catalogue_record
from app.schemas.ai import IntentResult
from app.schemas.product import ProductPublic
from app.utils.object_id import object_id_to_str

logger = logging.getLogger(__name__)


@dataclass
class ProductSearchParams:
    business_id: str
    query: str | None = None
    category: str | None = None
    min_price: float | None = None
    max_price: float | None = None
    color: str | None = None
    size: str | None = None
    occasion: str | None = None
    brand: str | None = None
    attributes: dict[str, Any] = field(default_factory=dict)
    exclude_ids: list[str] = field(default_factory=list)
    limit: int = 5


class ProductTools:
    def __init__(self, product_repository: ProductRepository, gemini_client: GeminiClient | None = None):
        self.product_repository = product_repository
        self.gemini_client = gemini_client or GeminiClient()

    @staticmethod
    def _validated_product(product: dict) -> ProductPublic | None:
        try:
            quality = validate_catalogue_record(product)
        except Exception as exc:
            logger.warning(
                "Skipping catalogue product because quality validation failed (%s)",
                exc.__class__.__name__,
            )
            return None
        if quality.errors:
            logger.warning(
                "Skipping catalogue product %s due to quality errors: %s",
                quality.product_id,
                ",".join(quality.errors),
            )
            return None
        if quality.warnings:
            logger.info(
                "Catalogue product %s has quality warnings: %s",
                quality.product_id,
                ",".join(quality.warnings),
            )
        try:
            return ProductPublic.model_validate(object_id_to_str(product))
        except ValidationError as exc:
            logger.warning(
                "Skipping invalid catalogue product %s (%s validation issue%s)",
                str(product.get("_id") or "unknown"),
                exc.error_count(),
                "s" if exc.error_count() != 1 else "",
            )
            return None
        except Exception as exc:
            logger.warning(
                "Skipping catalogue product %s because normalization failed (%s)",
                str(product.get("_id") or "unknown"),
                exc.__class__.__name__,
            )
            return None

    @classmethod
    def _validated_products(cls, products: list[dict]) -> list[ProductPublic]:
        validated = []
        for product in products or []:
            if not isinstance(product, dict):
                logger.warning("Skipping non-object catalogue result")
                continue
            try:
                validated.append(cls._validated_product(product))
            except Exception as exc:
                logger.warning(
                    "Skipping catalogue result after validation failure (%s)",
                    exc.__class__.__name__,
                )
        unique: list[ProductPublic] = []
        seen: set[tuple[str, str, str, str]] = set()
        for product in validated:
            if product is None:
                continue
            price = product.sale_price if product.sale_price is not None else product.price
            key = (
                product.name.strip().casefold(),
                str(price),
                product.currency,
                product.category.strip().casefold(),
            )
            if key in seen:
                continue
            seen.add(key)
            unique.append(product)
        return unique

    async def search_products(self, params: ProductSearchParams) -> list[ProductPublic]:
        filters = {
            "query": params.query,
            "category": params.category,
            "min_price": params.min_price,
            "max_price": params.max_price,
            "color": params.color,
            "size": params.size,
            "occasion": params.occasion,
            "brand": params.brand,
            "attributes": params.attributes,
            "exclude_ids": params.exclude_ids,
        }
        products = await self.product_repository.search_products(
            business_id=params.business_id,
            filters=filters,
            limit=params.limit,
        )
        return self._validated_products(products)

    async def search_from_intent(
        self,
        business_id: str,
        intent: IntentResult,
        query: str | None = None,
        exclude_ids: list[str] | None = None,
        limit: int = 5,
    ) -> list[ProductPublic]:
        has_structured_filters = any(
            [
                intent.category,
                intent.min_price is not None,
                intent.max_price is not None,
                intent.color,
                intent.size,
                intent.occasion,
                intent.brand,
                intent.attributes,
            ]
        )
        filters = {
            "business_id": business_id,
            "query": None if has_structured_filters else query,
            "category": intent.category,
            "min_price": intent.min_price,
            "max_price": intent.max_price,
            "color": intent.color,
            "size": intent.size,
            "occasion": intent.occasion,
            "brand": intent.brand,
            "attributes": intent.attributes,
            "exclude_ids": exclude_ids or [],
            "limit": limit,
        }
        products = []
        if query and self.gemini_client.supports_embeddings:
            try:
                query_embedding = await self.gemini_client.embed_content(text=query)
                products = await self.product_repository.search_semantic_products(
                    business_id=business_id,
                    filters=filters,
                    query=query,
                    query_embedding=query_embedding,
                    limit=limit,
                )
            except Exception as exc:
                logger.warning("Semantic product search unavailable; using lexical search: %s", exc.__class__.__name__)
        if not products:
            products = await self.search_products(ProductSearchParams(**filters))
        return [product for product in products if self._matches_intent(product, intent)]

    @staticmethod
    def _matches_intent(product: ProductPublic, intent: IntentResult) -> bool:
        """Final safety gate for exact searches before products reach the agent."""
        attributes = {str(key).lower(): value for key, value in (product.attributes or {}).items()}
        searchable = " ".join(
            str(value or "")
            for value in [product.name, product.description, product.category, *product.tags, *attributes.values()]
        ).lower()

        def normalized(value: Any) -> str:
            return (
                str(value or "")
                .lower()
                .replace("t-shirts", "tshirt")
                .replace("t-shirt", "tshirt")
                .replace("t shirts", "tshirt")
                .replace("t shirt", "tshirt")
            )

        requested_category = normalized(intent.category)
        if requested_category:
            if "tshirt" in requested_category and "tshirt" not in normalized(searchable):
                return False
            if requested_category == "shirt" and "tshirt" in normalized(searchable):
                return False
            category_tokens = [token for token in requested_category.split() if token not in {"tshirt", "shirt"}]
            if any(token not in normalized(searchable) for token in category_tokens):
                return False

        effective_price = product.sale_price if product.sale_price is not None else product.price
        if intent.min_price is not None and effective_price < intent.min_price:
            return False
        if intent.max_price is not None and effective_price > intent.max_price:
            return False
        if intent.color and normalized(intent.color) not in normalized(searchable):
            return False
        if intent.occasion and normalized(intent.occasion) not in normalized(searchable):
            return False
        if intent.brand and normalized(intent.brand) not in normalized(searchable):
            return False
        if intent.size:
            sizes = {str(size).upper() for size in attributes.get("sizes", [])}
            if str(intent.size).upper() not in sizes:
                return False

        for key, requested in (intent.attributes or {}).items():
            if key == "catalog_type":
                source = normalized(attributes.get("source_type"))
                wanted = normalized(requested).replace(" ", "")
                if wanted == "readymade" and source != "readymade":
                    return False
                if wanted in {"dropproduct", "dropproducts"} and source != "drop":
                    return False
                if wanted == "customization" and source != "customization":
                    return False
                continue
            wanted = normalized(requested)
            actual = normalized(attributes.get(key))
            if wanted:
                if actual:
                    if wanted not in actual:
                        return False
                elif wanted not in normalized(searchable):
                    return False
        return True

    async def search_from_image(
        self,
        business_id: str,
        intent: IntentResult,
        image_analysis: dict,
        image_embedding: list[float] | None,
    ) -> list[ProductPublic]:
        ranked_search = getattr(self.product_repository, "search_ranked_products", None)
        if ranked_search is None:
            return await self.search_from_intent(business_id, intent)
        filters = {
            "category": intent.category,
            "min_price": intent.min_price,
            "max_price": intent.max_price,
            "color": intent.color,
            "size": intent.size,
            "occasion": intent.occasion,
            "brand": intent.brand,
            "attributes": intent.attributes,
        }
        products = await ranked_search(
            business_id=business_id,
            filters=filters,
            image_analysis=image_analysis,
            image_embedding=image_embedding,
            limit=5,
        )
        validated = self._validated_products(products)
        return [product for product in validated if self._matches_intent(product, intent)]

    async def get_product_details(self, business_id: str, product_id: str) -> ProductPublic | None:
        product = await self.product_repository.find_by_id(product_id, business_id)
        if product is None:
            return None
        return self._validated_product(product)

    async def check_stock(self, business_id: str, product_id: str) -> dict:
        product = await self.get_product_details(business_id, product_id)
        if product is None:
            return {"available": False, "stock": 0, "product": None}
        return {
            "available": product.stock > 0,
            "stock": product.stock,
            "product": product,
        }

    async def get_product_variants(self, business_id: str, product_id: str, variant_filters: dict[str, Any] | None = None) -> list[ProductPublic]:
        product = await self.get_product_details(business_id, product_id)
        if product is None:
            return []

        filters = {
            "category": product.category,
            "max_price": None,
            "attributes": {},
        }
        variant_filters = variant_filters or {}
        for key in ["color", "size", "occasion", "brand"]:
            if variant_filters.get(key):
                filters[key] = variant_filters[key]
        for key, value in variant_filters.get("attributes", {}).items():
            if value:
                filters["attributes"][key] = value

        variants = await self.product_repository.search_products(
            business_id=business_id,
            filters=filters,
            limit=10,
        )
        return self._validated_products([
            variant for variant in variants if str(variant["_id"]) != product_id
        ])

    async def recommend_alternatives(
        self,
        business_id: str,
        product_id: str,
        cheaper: bool = False,
    ) -> list[ProductPublic]:
        product = await self.product_repository.find_by_id(product_id, business_id)
        if product is None:
            return []

        current_price = product.get("sale_price") or product.get("price")
        max_price = float(current_price) - 1 if cheaper and current_price is not None else None
        alternatives = await self.product_repository.find_similar_products(
            business_id=business_id,
            product=product,
            max_price=max_price,
            limit=5,
        )
        return self._validated_products(alternatives)
