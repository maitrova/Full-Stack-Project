import argparse
import asyncio
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.database.mongodb import close_mongo_connection, connect_to_mongo, get_database
from app.utils.datetime import utc_now


COLORS = [
    "black",
    "white",
    "dark blue",
    "navy blue",
    "red",
    "maroon",
    "green",
    "emerald",
    "pink",
    "purple",
    "yellow",
    "gold",
    "cream",
    "orange",
    "grey",
    "teal",
    "peach",
    "brown",
    "silver",
    "magenta",
]

FABRICS = [
    "silk",
    "cotton",
    "georgette",
    "chiffon",
    "linen",
    "organza",
    "crepe",
    "banarasi silk",
    "kanjivaram silk",
    "tussar silk",
]

OCCASIONS = [
    "wedding",
    "party",
    "festival",
    "daily",
    "office",
    "engagement",
    "reception",
    "traditional",
]

WORK_TYPES = [
    "zari",
    "embroidery",
    "printed",
    "stone work",
    "border work",
    "plain",
    "sequence",
    "woven",
]

STYLES = [
    "traditional",
    "designer",
    "party wear",
    "lightweight",
    "bridal",
    "casual",
    "premium",
    "classic",
]


def build_product(index: int, business_id):
    color = COLORS[index % len(COLORS)]
    fabric = FABRICS[index % len(FABRICS)]
    occasion = OCCASIONS[index % len(OCCASIONS)]
    work = WORK_TYPES[index % len(WORK_TYPES)]
    style = STYLES[index % len(STYLES)]
    base_price = 899 + ((index * 137) % 4200)
    sale_price = base_price - 100 if index % 3 == 0 else None
    stock = (index * 7) % 24
    now = utc_now()

    display_color = color.title()
    display_fabric = fabric.title()
    sku = f"SEED-SAR-{index + 1:03d}"

    return {
        "business_id": business_id,
        "name": f"{display_color} {display_fabric} Saree",
        "description": f"{style.title()} {fabric} saree suitable for {occasion} occasions with {work}.",
        "category": "saree",
        "price": float(base_price),
        "sale_price": float(sale_price) if sale_price else None,
        "currency": "INR",
        "stock": stock,
        "sku": sku,
        "images": [
            f"https://placehold.co/800x1000?text={display_color.replace(' ', '+')}+Saree",
        ],
        "attributes": {
            "color": color,
            "fabric": fabric,
            "occasion": occasion,
            "work": work,
            "style": style,
            "blouse_piece": index % 2 == 0,
        },
        "status": "active",
        "tags": [color, fabric, occasion, work, style],
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
                "sku": {"$regex": "^SEED-SAR-"},
            },
        )
    )

    products = [
        build_product(index, business["_id"])
        for index in range(count)
        if f"SEED-SAR-{index + 1:03d}" not in existing_skus
    ]

    if not products:
        print(f"No products inserted. {count} seeded SKUs already exist.")
    else:
        result = await db.products.insert_many(products)
        print(f"Inserted {len(result.inserted_ids)} products for business {business['_id']}.")

    total = await db.products.count_documents({"business_id": business["_id"]})
    print(f"Total products for this business: {total}")
    await close_mongo_connection()


def main():
    parser = argparse.ArgumentParser(description="Seed saree products for local AI sales testing.")
    parser.add_argument("--count", type=int, default=100)
    args = parser.parse_args()

    if args.count < 1:
        raise ValueError("--count must be at least 1")

    asyncio.run(seed_products(args.count))


if __name__ == "__main__":
    main()
