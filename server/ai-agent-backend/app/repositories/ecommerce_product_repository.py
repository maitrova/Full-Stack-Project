from datetime import datetime, timezone
from typing import Any
import re
from urllib.parse import urljoin, urlsplit

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config.settings import settings
from app.utils.object_id import parse_object_id


class EcommerceProductRepository:
    """Read-only adapter for the MERN store's live ReadymadeProduct catalogue."""

    def __init__(self, database: AsyncIOMotorDatabase):
        self.database = database
        self.collection = database.readymadeproducts

    async def search_products(self, business_id: str, filters: dict, limit: int = 5) -> list[dict]:
        products = await self._load_catalogue(business_id)
        matches = [product for product in products if self._matches(product, filters)]
        matches.sort(key=lambda item: (-item["stock"], self._display_price(item)))
        return matches[:limit]

    async def find_by_id(self, product_id: str, business_id: str) -> dict | None:
        document = await self.collection.find_one({"_id": parse_object_id(product_id), "isActive": {"$ne": False}})
        if document is None:
            return None
        names = await self._lookup_names([document])
        return self._normalize(document, business_id, names)

    async def find_similar_products(
        self,
        business_id: str,
        product: dict,
        max_price: float | None = None,
        limit: int = 5,
    ) -> list[dict]:
        products = await self._load_catalogue(business_id)
        category = str(product.get("category") or "").lower()
        source_id = str(product.get("_id"))
        matches = [
            item for item in products
            if str(item.get("_id")) != source_id
            and str(item.get("category") or "").lower() == category
            and (max_price is None or self._display_price(item) <= max_price)
        ]
        matches.sort(key=lambda item: (-item["stock"], self._display_price(item)))
        return matches[:limit]

    async def _load_catalogue(self, business_id: str) -> list[dict]:
        documents = await self.collection.find({"isActive": {"$ne": False}}).limit(2000).to_list(length=2000)
        names = await self._lookup_names(documents)
        return [self._normalize(document, business_id, names) for document in documents]

    async def _lookup_names(self, documents: list[dict]) -> dict[str, dict[str, str]]:
        specs = [
            ("category", self.database.categories),
            ("subCategory", self.database.subcategories),
            ("brand", self.database.brands),
        ]
        result: dict[str, dict[str, str]] = {}
        for field, collection in specs:
            ids = list({document.get(field) for document in documents if document.get(field)})
            if not ids:
                result[field] = {}
                continue
            values = await collection.find({"_id": {"$in": ids}}).to_list(length=len(ids))
            result[field] = {str(value["_id"]): str(value.get("name") or "") for value in values}
        return result

    def _normalize(self, document: dict, business_id: str, names: dict[str, dict[str, str]]) -> dict:
        variants = document.get("variants") or []
        variant_prices = [float(item["price"]) for item in variants if item.get("price") is not None]
        price = float(document.get("price") or (min(variant_prices) if variant_prices else 0))
        sale_price = self._active_sale_price(document)
        images = [item.get("url") if isinstance(item, dict) else item for item in document.get("images", [])]
        images = [self._public_image_url(str(item)) for item in images if item]
        images = [item for item in images if item]
        thumbnail = document.get("thumbnail")
        public_thumbnail = self._public_image_url(str(thumbnail)) if thumbnail else None
        if public_thumbnail and public_thumbnail not in images:
            images.insert(0, public_thumbnail)

        category = names["category"].get(str(document.get("category")), str(document.get("category") or "Product"))
        subcategory = names["subCategory"].get(str(document.get("subCategory")), str(document.get("subCategory") or ""))
        brand = names["brand"].get(str(document.get("brand")), str(document.get("brand") or ""))
        sizes = [str(item.get("size")) for item in variants if item.get("size") and int(item.get("stock") or 0) > 0]
        stock = sum(int(item.get("stock") or 0) for item in variants) if variants else int(document.get("stock") or 0)
        now = datetime.now(timezone.utc)

        return {
            "_id": document["_id"],
            "business_id": parse_object_id(business_id),
            "name": str(document.get("title") or "Product"),
            "description": document.get("description") or None,
            "category": category,
            "price": price,
            "sale_price": sale_price,
            "currency": str(document.get("currency") or "INR"),
            "stock": max(stock, 0),
            "sku": next((str(item.get("sku")) for item in variants if item.get("sku")), None),
            "images": images,
            "attributes": {
                "sub_category": subcategory,
                "brand": brand,
                "sizes": sizes,
                "variants": [{"size": str(v.get("size")), "stock": int(v.get("stock") or 0), "effective_price": round(float(v.get("price") or price) * (sale_price / price if sale_price is not None and price else 1), 2)} for v in variants],
                "payment_options": document.get("paymentOptions") or [],
                "product_url": self._product_url(document, category, subcategory),
            },
            "status": "active",
            "tags": [value for value in [category, subcategory, brand, *sizes] if value],
            "created_at": document.get("createdAt") or now,
            "updated_at": document.get("updatedAt") or now,
        }

    def _matches(self, product: dict, filters: dict) -> bool:
        searchable = " ".join([
            product.get("name") or "",
            product.get("description") or "",
            product.get("category") or "",
            " ".join(product.get("tags") or []),
        ]).lower()
        query = str(filters.get("query") or "").strip().lower()
        if query and not all(token in searchable for token in query.split()):
            return False
        category = str(filters.get("category") or "").strip().lower()
        if category and category not in searchable:
            return False
        for key in ["color", "occasion", "brand"]:
            value = str(filters.get(key) or "").strip().lower()
            if value and value not in searchable:
                return False
        size = str(filters.get("size") or "").strip().upper()
        if size and size not in product.get("attributes", {}).get("sizes", []):
            return False
        for value in (filters.get("attributes") or {}).values():
            if value and str(value).lower() not in searchable:
                return False
        price = self._display_price(product)
        if filters.get("min_price") is not None and price < float(filters["min_price"]):
            return False
        if filters.get("max_price") is not None and price > float(filters["max_price"]):
            return False
        return True

    def _display_price(self, product: dict) -> float:
        value = product.get("sale_price") if product.get("sale_price") is not None else product.get("price")
        return float(value or 0)

    def _active_sale_price(self, document: dict) -> float | None:
        value = document.get("salePrice")
        if value is None or not 0 < float(value) < float(document.get("price") or 0):
            return None
        now = datetime.now(timezone.utc)
        start = self._aware(document.get("saleStartAt"))
        end = self._aware(document.get("saleEndAt"))
        if start and start > now:
            return None
        if end and end < now:
            return None
        return float(value)

    def _aware(self, value: Any) -> datetime | None:
        if not isinstance(value, datetime):
            return None
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)

    def _public_image_url(self, value: str) -> str | None:
        if value.lower().startswith(("http://", "https://")):
            return value
        if not settings.ecommerce_public_url:
            return None
        base = settings.ecommerce_public_url.rstrip("/")
        parts = urlsplit(base)
        relative = value.lstrip("/")
        base_path = parts.path.strip("/")
        if base_path and relative.startswith(base_path + "/"):
            relative = relative[len(base_path) + 1:]
        elif base_path.endswith("outputs") and relative.startswith("outputs/"):
            relative = relative[len("outputs/"):]
        return urljoin(base + "/", relative)

    def _product_url(self, document: dict, category: str, subcategory: str) -> str | None:
        origin = settings.ecommerce_storefront_url
        if not origin or not origin.startswith("https://"):
            return None
        def slug(value):
            return re.sub(r"[^a-z0-9]+", "-", value.lower().replace("&", " and ")).strip("-")
        parts = [slug(category), slug(subcategory), slug(str(document.get("title") or ""))]
        path = "products/" + "/".join(parts) if all(parts) else "readymade/" + str(document["_id"])
        return origin.rstrip("/") + "/" + path
