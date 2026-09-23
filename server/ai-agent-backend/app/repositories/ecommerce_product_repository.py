import asyncio
from datetime import datetime, timezone
import math
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
        self.drop_collection = database.dropproducts
        self.customization_collection = database.products

    async def search_products(self, business_id: str, filters: dict, limit: int = 5) -> list[dict]:
        products = await self._load_catalogue(business_id)
        matches = [product for product in products if self._matches(product, filters)]
        matches.sort(key=lambda item: (-item["stock"], self._display_price(item)))
        return matches[:limit]

    async def search_ranked_products(
        self,
        business_id: str,
        filters: dict,
        image_analysis: dict,
        image_embedding: list[float] | None = None,
        limit: int = 5,
    ) -> list[dict]:
        """Hybrid image/metadata ranking with conservative relevance gates."""
        products = await self._load_catalogue(business_id)
        product_ids = [str(product["_id"]) for product in products]
        index_documents = await self.database.ai_product_search_index.find(
            {"product_id": {"$in": product_ids}, "embedding_model": settings.gemini_embedding_model},
            {"product_id": 1, "embedding": 1, "search_attributes": 1},
        ).to_list(length=len(product_ids)) if product_ids else []
        search_index = {str(item["product_id"]): item for item in index_documents}

        ranked: list[tuple[float, dict]] = []
        for product in products:
            indexed = search_index.get(str(product["_id"])) or {}
            searchable_product = {
                **product,
                "attributes": {
                    **product.get("attributes", {}),
                    "search_attributes": indexed.get("search_attributes") or {},
                },
            }
            score, components = self._hybrid_score(
                searchable_product,
                filters,
                image_analysis,
                image_embedding,
                indexed.get("embedding"),
            )
            category_score = components["category"]
            visual_score = components["visual"]
            # Avoid showing an unrelated product just because it is in stock.
            if category_score <= 0 and visual_score < 0.55:
                continue
            if score < 0.24:
                continue
            enriched = {**product, "attributes": {**product.get("attributes", {})}}
            enriched["attributes"]["match_score"] = round(score, 4)
            enriched["attributes"]["match_components"] = components
            ranked.append((score, enriched))

        ranked.sort(key=lambda item: (-item[0], -item[1]["stock"], self._display_price(item[1])))
        return [product for _, product in ranked[:limit]]

    def _hybrid_score(
        self,
        product: dict,
        filters: dict,
        analysis: dict,
        query_embedding: list[float] | None,
        product_embedding: list[float] | None,
    ) -> tuple[float, dict[str, float]]:
        searchable = self._searchable_text(product)
        requested_category = str(analysis.get("category") or analysis.get("product_type") or filters.get("category") or "")
        category_score = self._term_overlap(requested_category, searchable)
        name_text = " ".join(
            str(analysis.get(key) or "")
            for key in ["product_name_hint", "visible_text", "brand", "description"]
        )
        text_score = self._term_overlap(name_text, searchable)
        style_text = " ".join(
            str(analysis.get(key) or filters.get(key) or "")
            for key in ["color", "style", "pattern", "fabric", "material"]
        )
        style_score = self._term_overlap(style_text, searchable)
        visual_score = self._cosine(query_embedding, product_embedding)
        availability_score = 1.0 if int(product.get("stock") or 0) > 0 else 0.0
        price_score = 1.0
        price = self._display_price(product)
        if filters.get("min_price") is not None and price < float(filters["min_price"]):
            price_score = 0.0
        if filters.get("max_price") is not None and price > float(filters["max_price"]):
            price_score = 0.0
        requested_source = str((filters.get("attributes") or {}).get("catalog_type") or "").lower()
        source = str(product.get("attributes", {}).get("source_type") or "").lower()
        if requested_source and requested_source not in {source, f"{source} product"}:
            return 0.0, {"visual": visual_score, "category": 0.0, "text": 0.0, "style": 0.0, "availability": availability_score, "price": price_score}

        components = {
            "visual": round(visual_score, 4),
            "category": round(category_score, 4),
            "text": round(text_score, 4),
            "style": round(style_score, 4),
            "availability": availability_score,
            "price": price_score,
        }
        score = (
            visual_score * 0.45
            + category_score * 0.20
            + text_score * 0.15
            + style_score * 0.10
            + availability_score * 0.05
            + price_score * 0.05
        )
        return score, components

    def _searchable_text(self, product: dict) -> str:
        attributes = product.get("attributes") or {}
        search_attributes = attributes.get("search_attributes") or {}
        values = [
            product.get("name"), product.get("description"), product.get("category"),
            attributes.get("sub_category"), attributes.get("brand"), attributes.get("source_type"),
            *product.get("tags", []), *attributes.get("colors", []),
            *search_attributes.values(),
        ]
        return " ".join(str(value) for value in values if value).lower()

    def _term_overlap(self, requested: str, searchable: str) -> float:
        stop_words = {"a", "an", "and", "for", "of", "the", "this", "with", "product"}
        tokens = {
            token for token in re.findall(r"[a-z0-9]+", requested.lower())
            if len(token) > 1 and token not in stop_words
        }
        if not tokens:
            return 0.0
        hits = sum(1 for token in tokens if token in searchable)
        return hits / len(tokens)

    def _cosine(self, left: list[float] | None, right: list[float] | None) -> float:
        if not left or not right or len(left) != len(right):
            return 0.0
        dot = sum(a * b for a, b in zip(left, right))
        left_norm = math.sqrt(sum(value * value for value in left))
        right_norm = math.sqrt(sum(value * value for value in right))
        if not left_norm or not right_norm:
            return 0.0
        return max(0.0, min(1.0, dot / (left_norm * right_norm)))

    async def find_by_id(self, product_id: str, business_id: str) -> dict | None:
        object_id = parse_object_id(product_id)
        readymade, drop, customization = await asyncio.gather(
            self.collection.find_one({"_id": object_id, "isActive": {"$ne": False}}),
            self.drop_collection.find_one({"_id": object_id, "isActive": {"$ne": False}}),
            self.customization_collection.find_one({"_id": object_id}),
        )
        if readymade is not None:
            names = await self._lookup_names([readymade])
            return self._normalize_readymade(readymade, business_id, names)
        if drop is not None:
            return self._normalize_drop(drop, business_id)
        if customization is not None:
            return self._normalize_customization(customization, business_id)
        return None

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
        readymade, drops, customization = await asyncio.gather(
            self.collection.find({"isActive": {"$ne": False}}).limit(2000).to_list(length=2000),
            self.drop_collection.find({"isActive": {"$ne": False}}).limit(2000).to_list(length=2000),
            self.customization_collection.find({}).limit(500).to_list(length=500),
        )
        names = await self._lookup_names(readymade)
        return [
            *[self._normalize_readymade(document, business_id, names) for document in readymade],
            *[self._normalize_drop(document, business_id) for document in drops],
            *[self._normalize_customization(document, business_id) for document in customization],
        ]

    async def catalog_categories(self) -> list[str]:
        readymade_ids, drop_categories, customization_categories = await asyncio.gather(
            self.collection.distinct("category", {"isActive": {"$ne": False}}),
            self.drop_collection.distinct("category", {"isActive": {"$ne": False}}),
            self.customization_collection.distinct("category", {}),
        )
        readymade_names = []
        if readymade_ids:
            documents = await self.database.categories.find(
                {"_id": {"$in": readymade_ids}}, {"name": 1}
            ).to_list(length=len(readymade_ids))
            readymade_names = [document.get("name") for document in documents]
        return sorted(
            {
                str(value).strip()
                for value in [*readymade_names, *drop_categories, *customization_categories]
                if value and str(value).strip()
            }
        )

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

    def _normalize_readymade(self, document: dict, business_id: str, names: dict[str, dict[str, str]]) -> dict:
        variants = document.get("variants") or []
        variant_prices = [float(item["price"]) for item in variants if item.get("price") is not None]
        price = float(document.get("price") or (min(variant_prices) if variant_prices else 0))
        sale_price = self._active_sale_price(document, price)
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
                "source_type": "readymade",
                "customizable": False,
            },
            "status": "active",
            "tags": [value for value in [category, subcategory, brand, "readymade", *sizes] if value],
            "created_at": document.get("createdAt") or now,
            "updated_at": document.get("updatedAt") or now,
        }

    def _normalize_drop(self, document: dict, business_id: str) -> dict:
        variants = document.get("variants") or []
        variant_prices = [float(item.get("price") or 0) for item in variants if item.get("price") is not None]
        price = float(document.get("minPrice") or (min(variant_prices) if variant_prices else 0))
        sale_price = self._active_sale_price(document, price)
        images = self._image_urls(document.get("images") or [])
        category = str(document.get("category") or "Drop Product")
        subcategory = str(document.get("subCategory") or "")
        sizes = [str(item.get("size")) for item in variants if item.get("size") and int(item.get("stock") or 0) > 0]
        stock = sum(int(item.get("stock") or 0) for item in variants)
        now = datetime.now(timezone.utc)
        effective_price = sale_price if sale_price is not None else price
        return {
            "_id": document["_id"],
            "business_id": parse_object_id(business_id),
            "name": str(document.get("name") or "Drop Product"),
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
                "sizes": sizes,
                "variants": [
                    {
                        "size": str(item.get("size")),
                        "stock": int(item.get("stock") or 0),
                        "effective_price": float(sale_price if sale_price is not None else item.get("price") or effective_price),
                    }
                    for item in variants
                ],
                "payment_options": document.get("paymentOptions") or [],
                "product_url": self._drop_product_url(document),
                "source_type": "drop",
                "customizable": False,
            },
            "status": "active",
            "tags": [value for value in [category, subcategory, "drop product"] if value],
            "created_at": document.get("createdAt") or now,
            "updated_at": document.get("updatedAt") or now,
        }

    def _normalize_customization(self, document: dict, business_id: str) -> dict:
        size_pricing = document.get("sizePricing") or []
        price = float(document.get("basePrice") or 0)
        sizes = [str(item.get("size")) for item in size_pricing if item.get("size") and int(item.get("stock") or 0) > 0]
        variants = [
            {
                "size": str(item.get("size")),
                "stock": int(item.get("stock") or 0),
                "effective_price": float(item.get("price") or price),
            }
            for item in size_pricing
            if item.get("size")
        ]
        views = document.get("views") or []
        images = self._image_urls([view.get("mockupUrl") for view in views if view.get("mockupUrl")])
        colors = [str(item.get("label")) for item in document.get("colors") or [] if item.get("label")]
        category = str(document.get("category") or "Customization")
        subcategory = str(document.get("subCategory") or "")
        now = datetime.now(timezone.utc)
        description = self._customization_description(document, colors, sizes)
        return {
            "_id": document["_id"],
            "business_id": parse_object_id(business_id),
            "name": str(document.get("name") or "Custom Product"),
            "description": description,
            "category": category,
            "price": price,
            "sale_price": None,
            "currency": str(document.get("currency") or "INR"),
            "stock": sum(item["stock"] for item in variants),
            "sku": None,
            "images": images,
            "attributes": {
                "sub_category": subcategory,
                "colors": colors,
                "sizes": sizes,
                "variants": variants,
                "pricing_mode": document.get("pricingMode") or "normal",
                "product_url": self._customization_product_url(document),
                "source_type": "customization",
                "customizable": True,
            },
            "status": "active",
            "tags": [value for value in [category, subcategory, "custom", "customization", *colors] if value],
            "created_at": document.get("createdAt") or now,
            "updated_at": document.get("updatedAt") or now,
        }

    def _matches(self, product: dict, filters: dict) -> bool:
        searchable = self._searchable_text(product)
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

    def _active_sale_price(self, document: dict, regular_price: float | None = None) -> float | None:
        regular_price = float(regular_price if regular_price is not None else document.get("price") or 0)
        value = document.get("salePrice")
        if value is None or not 0 < float(value) < float(regular_price or 0):
            return None
        now = datetime.now(timezone.utc)
        start = self._aware(document.get("saleStartAt"))
        end = self._aware(document.get("saleEndAt"))
        if start and start > now:
            return None
        if end and end < now:
            return None
        return float(value)

    def _image_urls(self, values: list) -> list[str]:
        images = [item.get("url") if isinstance(item, dict) else item for item in values]
        public_images = [self._public_image_url(str(item)) for item in images if item]
        return [item for item in public_images if item]

    def _customization_description(self, document: dict, colors: list[str], sizes: list[str]) -> str:
        parts = ["Customizable product: add your own images and text in the online designer."]
        if colors:
            parts.append("Colors: " + ", ".join(colors) + ".")
        if sizes:
            parts.append("Sizes currently available: " + ", ".join(sizes) + ".")
        if document.get("pricingMode") == "unlimited":
            unlimited = document.get("unlimitedPricing") or {}
            if unlimited.get("enabled"):
                parts.append(str(unlimited.get("description") or "Unlimited design pricing is available."))
        else:
            parts.append("The final price depends on product size and the selected design elements.")
        return " ".join(parts)

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

    def _drop_product_url(self, document: dict) -> str | None:
        origin = settings.ecommerce_storefront_url
        if not origin or not origin.startswith("https://"):
            return None
        return f"{origin.rstrip('/')}/dropproducts/{document['_id']}"

    def _customization_product_url(self, document: dict) -> str | None:
        origin = settings.ecommerce_storefront_url
        slug = str(document.get("slug") or "").strip()
        if not origin or not origin.startswith("https://") or not slug:
            return None
        return f"{origin.rstrip('/')}/products/{slug}/customize"
