from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING

from app.utils.datetime import utc_now
from app.utils.object_id import parse_object_id


class ProductRepository:
    def __init__(self, database: AsyncIOMotorDatabase):
        self.collection = database.products

    async def ensure_indexes(self) -> None:
        await self.collection.create_index([("business_id", ASCENDING), ("created_at", DESCENDING)])
        await self.collection.create_index([("business_id", ASCENDING), ("category", ASCENDING)])
        await self.collection.create_index([("business_id", ASCENDING), ("status", ASCENDING)])
        await self.collection.create_index([("business_id", ASCENDING), ("sku", ASCENDING)])

    async def list_products(self, business_id: str, limit: int = 100, skip: int = 0) -> list[dict]:
        cursor = (
            self.collection.find({"business_id": parse_object_id(business_id)})
            .sort("created_at", DESCENDING)
            .skip(skip)
            .limit(limit)
        )
        return await cursor.to_list(length=limit)

    async def search_products(self, business_id: str, filters: dict, limit: int = 5) -> list[dict]:
        query = {
            "business_id": parse_object_id(business_id),
            "status": "active",
        }
        and_conditions = []

        if filters.get("query"):
            and_conditions.append(
                {
                    "$or": [
                        {"name": {"$regex": filters["query"], "$options": "i"}},
                        {"description": {"$regex": filters["query"], "$options": "i"}},
                        {"tags": {"$regex": filters["query"], "$options": "i"}},
                    ]
                }
            )

        if filters.get("category"):
            query["category"] = {"$regex": f"^{filters['category']}$", "$options": "i"}

        price_conditions = []
        if filters.get("min_price") is not None or filters.get("max_price") is not None:
            price_filter = {}
            sale_price_filter = {}
            if filters.get("min_price") is not None:
                price_filter["$gte"] = filters["min_price"]
                sale_price_filter["$gte"] = filters["min_price"]
            if filters.get("max_price") is not None:
                price_filter["$lte"] = filters["max_price"]
                sale_price_filter["$lte"] = filters["max_price"]
            price_conditions = [{"price": price_filter}, {"sale_price": sale_price_filter}]

        if price_conditions:
            and_conditions.append({"$or": price_conditions})

        simple_attribute_keys = ["color", "size", "occasion", "brand"]
        for key in simple_attribute_keys:
            if filters.get(key):
                and_conditions.append(
                    {
                        "$or": [
                            {f"attributes.{key}": {"$regex": f"^{filters[key]}$", "$options": "i"}},
                            {"tags": {"$regex": f"^{filters[key]}$", "$options": "i"}},
                            {"name": {"$regex": filters[key], "$options": "i"}},
                            {"description": {"$regex": filters[key], "$options": "i"}},
                        ]
                    }
                )

        for key, value in filters.get("attributes", {}).items():
            if value is not None and value != "":
                and_conditions.append(
                    {
                        "$or": [
                            {f"attributes.{key}": {"$regex": f"^{value}$", "$options": "i"}},
                            {"tags": {"$regex": f"^{value}$", "$options": "i"}},
                            {"name": {"$regex": str(value), "$options": "i"}},
                            {"description": {"$regex": str(value), "$options": "i"}},
                        ]
                    }
                )

        if and_conditions:
            query["$and"] = and_conditions

        cursor = self.collection.find(query).sort([("stock", DESCENDING), ("price", ASCENDING)]).limit(limit)
        return await cursor.to_list(length=limit)

    async def find_similar_products(
        self,
        business_id: str,
        product: dict,
        max_price: float | None = None,
        limit: int = 5,
    ) -> list[dict]:
        query = {
            "business_id": parse_object_id(business_id),
            "status": "active",
            "_id": {"$ne": product["_id"]},
            "category": {"$regex": f"^{product['category']}$", "$options": "i"},
        }
        and_conditions = []

        if max_price is not None:
            and_conditions.append({"$or": [{"price": {"$lte": max_price}}, {"sale_price": {"$lte": max_price}}]})

        product_attributes = product.get("attributes", {})
        similarity_conditions = []
        for key in ["fabric", "occasion", "style", "work"]:
            if product_attributes.get(key):
                similarity_conditions.append({f"attributes.{key}": {"$regex": f"^{product_attributes[key]}$", "$options": "i"}})

        if similarity_conditions:
            and_conditions.append({"$or": similarity_conditions})

        if and_conditions:
            query["$and"] = and_conditions

        cursor = self.collection.find(query).sort([("stock", DESCENDING), ("price", ASCENDING)]).limit(limit)
        return await cursor.to_list(length=limit)

    async def find_by_id(self, product_id: str, business_id: str) -> dict | None:
        return await self.collection.find_one(
            {
                "_id": parse_object_id(product_id),
                "business_id": parse_object_id(business_id),
            }
        )

    async def create_product(self, business_id: str, payload: dict) -> dict:
        now = utc_now()
        document = {
            **payload,
            "business_id": parse_object_id(business_id),
            "created_at": now,
            "updated_at": now,
        }
        result = await self.collection.insert_one(document)
        created = await self.collection.find_one({"_id": result.inserted_id})
        if created is None:
            raise RuntimeError("Created product could not be loaded")
        return created

    async def update_product(self, product_id: str, business_id: str, payload: dict) -> dict | None:
        update = dict(payload)
        update["updated_at"] = utc_now()

        await self.collection.update_one(
            {
                "_id": parse_object_id(product_id),
                "business_id": parse_object_id(business_id),
            },
            {"$set": update},
        )
        return await self.find_by_id(product_id, business_id)

    async def decrement_stock(self, product_id: str, business_id: str, quantity: int) -> bool:
        result = await self.collection.update_one(
            {
                "_id": parse_object_id(product_id),
                "business_id": parse_object_id(business_id),
                "stock": {"$gte": quantity},
            },
            {
                "$inc": {"stock": -quantity},
                "$set": {"updated_at": utc_now()},
            },
        )
        return result.modified_count == 1

    async def delete_product(self, product_id: str, business_id: str) -> bool:
        result = await self.collection.delete_one(
            {
                "_id": parse_object_id(product_id),
                "business_id": parse_object_id(business_id),
            }
        )
        return result.deleted_count == 1
