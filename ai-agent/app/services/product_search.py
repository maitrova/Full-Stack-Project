import re
from difflib import SequenceMatcher

from app.services.backend_product_service import fetch_backend_products
from app.services.embedding_service import rank_products_by_embedding
from app.services.product_context import SAMPLE_PRODUCTS


KNOWN_COLORS = [
    "black",
    "white",
    "blue",
    "red",
    "green",
    "yellow",
    "pink",
    "purple",
    "brown",
    "grey",
    "gray",
]

CATEGORY_ALIASES = {
    "dress": ["dress", "dresses", "gown", "one piece", "party outfit", "western wear"],
    "kurti": ["kurti", "kurtis", "ethnic top", "indian top"],
    "t-shirt": ["t-shirt", "tshirt", "tee", "t shirt", "round neck", "oversized tee"],
    "jacket": ["jacket", "jackets", "denim jacket", "outerwear", "layering"],
    "inners": ["inners", "inner", "innerwear", "inside wear", "vest", "undergarment"],
}

SIZE_ALIASES = {
    "XS": ["xs", "extra small"],
    "S": ["s", "small"],
    "M": ["m", "medium"],
    "L": ["l", "large"],
    "XL": ["xl", "extra large"],
    "XXL": ["xxl", "double xl", "2xl"],
}

STOP_WORDS = {
    "a",
    "an",
    "and",
    "are",
    "below",
    "for",
    "have",
    "i",
    "in",
    "is",
    "me",
    "need",
    "of",
    "or",
    "please",
    "rs",
    "show",
    "than",
    "the",
    "to",
    "under",
    "want",
    "with",
    "you",
}


def _normalize_text(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def _tokenize(value: str) -> list[str]:
    normalized_value = _normalize_text(value)
    return [
        token
        for token in normalized_value.split()
        if len(token) > 1 and token not in STOP_WORDS
    ]


def _parse_price_number(value: str) -> int:
    normalized_value = value.replace(",", "").strip().lower()
    multiplier = 1000 if normalized_value.endswith("k") else 1
    numeric_text = normalized_value[:-1] if normalized_value.endswith("k") else normalized_value

    return int(float(numeric_text) * multiplier)


def _extract_max_price(message: str) -> int | None:
    # Step 6: Handles "under 2000", "below rs 1500", "within 1k", and "less than 2.5k".
    price_match = re.search(
        r"(?:under|below|less than|within|upto|up to)\s+(?:rs\.?|inr)?\s*(\d+(?:\.\d+)?k?)",
        message,
    )
    if price_match:
        return _parse_price_number(price_match.group(1))

    rupee_match = re.search(r"(?:rs\.?|inr)\s*(\d+(?:\.\d+)?k?)", message)
    if rupee_match:
        return _parse_price_number(rupee_match.group(1))

    return None


def _extract_requested_categories(message: str) -> list[str]:
    requested_categories = []

    for category, aliases in CATEGORY_ALIASES.items():
        if any(_normalize_text(alias) in message for alias in aliases):
            requested_categories.append(category)

    return requested_categories


def _extract_requested_sizes(message: str) -> list[str]:
    requested_sizes = []
    padded_message = f" {message} "

    for size, aliases in SIZE_ALIASES.items():
        if any(f" {_normalize_text(alias)} " in padded_message for alias in aliases):
            requested_sizes.append(size)

    return requested_sizes


def _is_similar(left: str, right: str) -> bool:
    if len(left) < 4 or len(right) < 4:
        return False

    return SequenceMatcher(None, left, right).ratio() >= 0.82


def _build_search_text(product: dict) -> str:
    return _normalize_text(
        " ".join(
            [
                str(product.get("name") or ""),
                str(product.get("category") or ""),
                str(product.get("color") or ""),
                str(product.get("description") or ""),
            ]
        )
    )


def _score_product(
    product: dict,
    user_tokens: list[str],
    requested_colors: list[str],
    requested_categories: list[str],
    requested_sizes: list[str],
    max_price: int | None,
) -> int:
    product_color = str(product.get("color") or "").lower()
    product_category = str(product.get("category") or "").lower()
    searchable_text = _build_search_text(product)
    product_tokens = _tokenize(searchable_text)
    score = 0
    has_product_signal = False

    if max_price is not None:
        if int(product.get("price") or 0) > max_price:
            return 0
        score += 2

    if requested_colors:
        color_matched = any(color in searchable_text or color == product_color for color in requested_colors)
        if not color_matched:
            return 0
        score += 3
        has_product_signal = True

    if requested_categories:
        category_matched = any(
            category in searchable_text or category in product_category
            for category in requested_categories
        )
        if not category_matched:
            return 0
        score += 4
        has_product_signal = True

    if requested_sizes:
        product_sizes = [
            str(size).upper()
            for size in product.get("sizes", [])
        ]
        if not any(size in product_sizes for size in requested_sizes):
            return 0
        score += 3
        has_product_signal = True

    for user_token in user_tokens:
        if user_token in searchable_text:
            score += 2
            has_product_signal = True
            continue

        if any(_is_similar(user_token, product_token) for product_token in product_tokens):
            score += 1
            has_product_signal = True

    if user_tokens and not has_product_signal:
        return 0

    return score


def _filter_products(products: list[dict], user_message: str) -> list[dict]:
    normalized_message = _normalize_text(user_message)
    user_tokens = _tokenize(normalized_message)
    requested_colors = [
        color for color in KNOWN_COLORS if color in normalized_message
    ]
    requested_categories = _extract_requested_categories(normalized_message)
    requested_sizes = _extract_requested_sizes(normalized_message)
    max_price = _extract_max_price(normalized_message)

    scored_products = []

    for product in products:
        score = _score_product(
            product,
            user_tokens,
            requested_colors,
            requested_categories,
            requested_sizes,
            max_price,
        )
        if score > 0:
            scored_products.append((score, product))

    scored_products.sort(
        key=lambda item: (item[0], -(item[1].get("price") or 0)),
        reverse=True,
    )

    return [product for score, product in scored_products]


async def search_products(user_message: str, preference_text: str = "") -> list[dict]:
    # Step 6: Try real products from the MERN API first, then run smarter Python matching.
    try:
        products = await fetch_backend_products()
    except Exception:
        products = []

    if products:
        filtered_products = _filter_products(products, user_message)
        ranking_query = f"{user_message}\n{preference_text}".strip()
        return (await rank_products_by_embedding(ranking_query, filtered_products))[:10]

    # Fallback keeps the AI service usable while the MERN backend is stopped.
    fallback_products = _filter_products(SAMPLE_PRODUCTS, user_message)
    ranking_query = f"{user_message}\n{preference_text}".strip()
    return (await rank_products_by_embedding(ranking_query, fallback_products))[:10]
