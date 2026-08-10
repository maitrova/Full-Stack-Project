import re

from app.services.product_context import SAMPLE_PRODUCTS
from app.services.backend_product_service import fetch_backend_products


KNOWN_COLORS = ["black", "white", "blue", "red", "green", "yellow", "pink", "purple", "brown", "grey", "gray"]
KNOWN_CATEGORIES = {
    "dress": "dress",
    "dresses": "dress",
    "kurti": "kurti",
    "kurtis": "kurti",
    "t-shirt": "t-shirt",
    "tshirt": "t-shirt",
    "tee": "t-shirt",
    "jacket": "jacket",
    "jackets": "jacket",
}


def _extract_max_price(message: str) -> int | None:
    # Step 4: Basic price parsing for messages like "under 2000" or "below 1500".
    price_match = re.search(r"(?:under|below|less than|within)\s+(?:rs\.?|₹)?\s*(\d+)", message)
    if not price_match:
        return None

    return int(price_match.group(1))


def _product_matches(product: dict, requested_colors: list[str], requested_categories: list[str], max_price: int | None) -> bool:
    product_color = str(product.get("color") or "").lower()
    product_category = str(product.get("category") or "").lower()
    product_name = str(product.get("name") or "").lower()
    product_description = str(product.get("description") or "").lower()
    searchable_text = f"{product_name} {product_category} {product_description}"

    if requested_colors and not any(color in searchable_text or color == product_color for color in requested_colors):
        return False

    if requested_categories and not any(category in searchable_text for category in requested_categories):
        return False

    if max_price is not None and int(product.get("price") or 0) > max_price:
        return False

    return True


def _filter_products(products: list[dict], user_message: str) -> list[dict]:
    normalized_message = user_message.lower()
    requested_colors = [
        color for color in KNOWN_COLORS if color in normalized_message
    ]
    requested_categories = [
        category
        for keyword, category in KNOWN_CATEGORIES.items()
        if keyword in normalized_message
    ]
    max_price = _extract_max_price(normalized_message)

    return [
        product
        for product in products
        if _product_matches(product, requested_colors, requested_categories, max_price)
    ]


async def search_products(user_message: str) -> list[dict]:
    # Step 5: Try real products from the MERN API first.
    try:
        products = await fetch_backend_products()
    except Exception:
        products = []

    if products:
        return _filter_products(products, user_message)[:10]

    # Fallback keeps the AI service usable while the MERN backend is stopped.
    return _filter_products(SAMPLE_PRODUCTS, user_message)[:10]
