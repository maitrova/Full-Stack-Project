from dataclasses import dataclass, field
import logging
from typing import Any

from pydantic import ValidationError

from app.repositories.product_repository import ProductRepository
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
    def __init__(self, product_repository: ProductRepository):
        self.product_repository = product_repository

    @staticmethod
    def _validated_product(product: dict) -> ProductPublic | None:
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

    @classmethod
    def _validated_products(cls, products: list[dict]) -> list[ProductPublic]:
        validated = [cls._validated_product(product) for product in products]
        return [product for product in validated if product is not None]

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
        return await self.search_products(
            ProductSearchParams(
                business_id=business_id,
                query=None if has_structured_filters else query,
                category=intent.category,
                min_price=intent.min_price,
                max_price=intent.max_price,
                color=intent.color,
                size=intent.size,
                occasion=intent.occasion,
                brand=intent.brand,
                attributes=intent.attributes,
                exclude_ids=exclude_ids or [],
                limit=limit,
            )
        )

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
        return self._validated_products(products)

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
