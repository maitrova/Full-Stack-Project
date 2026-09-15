import argparse
import asyncio
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.database.mongodb import close_mongo_connection, connect_to_mongo, get_database
from app.utils.datetime import utc_now


CATALOGUE = [
    {
        "category": "shirt",
        "items": ["Oxford Shirt", "Linen Shirt", "Formal Shirt", "Casual Check Shirt", "Denim Shirt"],
        "materials": ["cotton", "linen", "poplin", "denim"],
        "styles": ["formal", "casual", "slim fit", "regular fit"],
        "price_range": (799, 2499),
    },
    {
        "category": "t-shirt",
        "items": ["Crew Neck T-Shirt", "Polo T-Shirt", "Graphic T-Shirt", "Oversized T-Shirt", "V-Neck T-Shirt"],
        "materials": ["cotton", "poly cotton", "jersey", "pique"],
        "styles": ["casual", "sports", "streetwear", "regular fit"],
        "price_range": (399, 1499),
    },
    {
        "category": "jeans",
        "items": ["Slim Fit Jeans", "Straight Fit Jeans", "Relaxed Jeans", "Bootcut Jeans", "Denim Jogger Jeans"],
        "materials": ["denim", "stretch denim", "cotton denim"],
        "styles": ["casual", "slim fit", "regular fit", "relaxed fit"],
        "price_range": (999, 3299),
    },
    {
        "category": "kurti",
        "items": ["Printed Kurti", "Cotton Kurti", "A-Line Kurti", "Straight Kurti", "Embroidered Kurti"],
        "materials": ["cotton", "rayon", "georgette", "silk blend"],
        "styles": ["daily", "office", "festival", "ethnic"],
        "price_range": (699, 2699),
    },
    {
        "category": "dress",
        "items": ["Floral Dress", "Maxi Dress", "Bodycon Dress", "A-Line Dress", "Evening Dress"],
        "materials": ["crepe", "chiffon", "cotton", "satin"],
        "styles": ["party", "casual", "evening", "summer"],
        "price_range": (899, 3999),
    },
    {
        "category": "shoe",
        "items": ["Running Shoes", "Formal Shoes", "Sneakers", "Loafers", "Sandals"],
        "materials": ["mesh", "synthetic", "leather", "canvas"],
        "styles": ["sports", "formal", "casual", "comfort"],
        "price_range": (899, 4499),
    },
    {
        "category": "bag",
        "items": ["Tote Bag", "Handbag", "Backpack", "Sling Bag", "Laptop Bag"],
        "materials": ["canvas", "vegan leather", "nylon", "leatherette"],
        "styles": ["office", "travel", "casual", "party"],
        "price_range": (599, 3499),
    },
    {
        "category": "watch",
        "items": ["Analog Watch", "Smart Watch", "Minimal Watch", "Sports Watch", "Metal Strap Watch"],
        "materials": ["stainless steel", "silicone", "leather strap", "alloy"],
        "styles": ["formal", "sports", "casual", "premium"],
        "price_range": (999, 5999),
    },
    {
        "category": "jacket",
        "items": ["Denim Jacket", "Bomber Jacket", "Puffer Jacket", "Leather Jacket", "Windcheater"],
        "materials": ["denim", "polyester", "faux leather", "nylon"],
        "styles": ["winter", "casual", "travel", "streetwear"],
        "price_range": (1299, 4999),
    },
    {
        "category": "accessory",
        "items": ["Scarf", "Belt", "Wallet", "Sunglasses", "Cap"],
        "materials": ["cotton", "leatherette", "polycarbonate", "canvas"],
        "styles": ["casual", "formal", "travel", "daily"],
        "price_range": (299, 1999),
    },
]

COLORS = [
    "black",
    "white",
    "navy blue",
    "red",
    "green",
    "pink",
    "yellow",
    "grey",
    "brown",
    "cream",
    "maroon",
    "teal",
]

SIZES = ["XS", "S", "M", "L", "XL", "XXL"]
BRANDS = ["Urban Loom", "Nova Street", "Classic Yard", "Blue Thread", "Metro Mode"]


def build_product(index: int, business_id):
    group = CATALOGUE[index % len(CATALOGUE)]
    item_name = group["items"][(index // len(CATALOGUE)) % len(group["items"])]
    color = COLORS[index % len(COLORS)]
    material = group["materials"][index % len(group["materials"])]
    style = group["styles"][index % len(group["styles"])]
    brand = BRANDS[index % len(BRANDS)]
    low, high = group["price_range"]
    price = low + ((index * 173) % (high - low + 1))
    sale_price = price - 150 if index % 4 == 0 and price > 600 else None
    stock = 2 + ((index * 5) % 31)
    size = SIZES[index % len(SIZES)]
    now = utc_now()
    sku = f"SEED-MIX-{index + 1:03d}"

    display_color = color.title()
    product_name = f"{display_color} {item_name}"
    image_text = product_name.replace(" ", "+").replace("-", "")

    return {
        "business_id": business_id,
        "name": product_name,
        "description": f"{brand} {item_name.lower()} in {material}, suitable for {style} use.",
        "category": group["category"],
        "price": float(price),
        "sale_price": float(sale_price) if sale_price else None,
        "currency": "INR",
        "stock": stock,
        "sku": sku,
        "images": [f"https://placehold.co/800x1000?text={image_text}"],
        "attributes": {
            "color": color,
            "size": size,
            "brand": brand,
            "material": material,
            "fabric": material,
            "occasion": style,
            "style": style,
        },
        "status": "active",
        "tags": [group["category"], color, size.lower(), brand.lower(), material, style, item_name.lower()],
        "created_at": now,
        "updated_at": now,
    }


async def seed_products(count: int) -> None:
    await connect_to_mongo()
    db = get_database()

    business = await db.businesses.find_one({})
    if business is None:
        await close_mongo_connection()
        raise RuntimeError("No business found. Create Business Setup before seeding products.")

    existing_skus = set(
        await db.products.distinct(
            "sku",
            {
                "business_id": business["_id"],
                "sku": {"$regex": "^SEED-MIX-"},
            },
        )
    )

    products = [
        build_product(index, business["_id"])
        for index in range(count)
        if f"SEED-MIX-{index + 1:03d}" not in existing_skus
    ]

    if not products:
        print(f"No products inserted. {count} mixed seeded SKUs already exist.")
    else:
        result = await db.products.insert_many(products)
        print(f"Inserted {len(result.inserted_ids)} mixed products for business {business['_id']}.")

    total = await db.products.count_documents({"business_id": business["_id"]})
    category_counts = await db.products.aggregate(
        [
            {"$match": {"business_id": business["_id"]}},
            {"$group": {"_id": "$category", "count": {"$sum": 1}}},
            {"$sort": {"_id": 1}},
        ]
    ).to_list(length=100)

    print(f"Total products for this business: {total}")
    for item in category_counts:
        print(f"{item['_id']}: {item['count']}")

    await close_mongo_connection()


def main():
    parser = argparse.ArgumentParser(description="Seed mixed fashion products for local AI sales testing.")
    parser.add_argument("--count", type=int, default=120)
    args = parser.parse_args()

    if args.count < 1:
        raise ValueError("--count must be at least 1")

    asyncio.run(seed_products(args.count))


if __name__ == "__main__":
    main()
