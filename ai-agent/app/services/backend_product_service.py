import httpx

from app.config import settings


def _detect_color(product: dict) -> str:
    text = " ".join(
        [
            str(product.get("title") or ""),
            str(product.get("description") or ""),
            str(product.get("category") or ""),
            str(product.get("subCategory") or ""), 
        ]
    ).lower()

    for color in ["black", "white", "blue", "red", "green", "yellow", "pink", "purple", "brown", "grey", "gray"]:
        if color in text:
            return color.title()

    return ""


def _get_product_price(product: dict) -> int:
    price = (
        product.get("finalPrice")
        or product.get("effectivePrice")
        or product.get("offerPrice")
        or product.get("salePrice")
        or product.get("price")
        or 0
    )

    try:
        return int(float(price))
    except (TypeError, ValueError):
        return 0


def _get_product_sizes(product: dict) -> list[str]:
    variants = product.get("variants") or []
    sizes = [
        str(variant.get("size")).upper()
        for variant in variants
        if variant.get("size")
    ]

    return sizes or ["Size details unavailable"]


def _get_product_image(product: dict):
    images = product.get("images") or []
    first_image = images[0] if images else None

    return product.get("thumbnail") or first_image


def normalize_backend_product(product: dict) -> dict:
    # Step 5: Convert the MERN backend product shape into the simple AI product shape.
    price = _get_product_price(product)
    discount_percent = int(product.get("discountPercent") or product.get("discountPercentage") or 0)
    original_price = product.get("mrp") or product.get("originalPrice") or product.get("compareAtPrice")

    return {
        "_id": str(product.get("_id") or ""),
        "title": product.get("title") or "Untitled product",
        "name": product.get("title") or "Untitled product",
        "category": product.get("category") or product.get("subCategory") or "Product",
        "subCategory": product.get("subCategory") or "",
        "color": _detect_color(product),
        "price": price,
        "originalPrice": original_price,
        "discountPercent": discount_percent,
        "hasOffer": bool(
            product.get("offerPrice")
            or product.get("salePrice")
            or product.get("saleActive")
            or product.get("offerActive")
            or discount_percent > 0
        ),
        "sizes": _get_product_sizes(product),
        "description": product.get("description") or "No description available.",
        "thumbnail": product.get("thumbnail"),
        "image": _get_product_image(product),
        "source": "mern_backend",
    }


async def fetch_backend_products() -> list[dict]:
    # Step 5: Python calls the existing Node/Express API instead of MongoDB directly.
    url = f"{settings.MERN_API_URL}/readymadeproducts/public"
    params = {"limit": settings.MERN_PRODUCTS_LIMIT}

    async with httpx.AsyncClient(timeout=8.0) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        payload = response.json()

    products = payload.get("data", [])
    if not isinstance(products, list):
        return []

    return [normalize_backend_product(product) for product in products]
