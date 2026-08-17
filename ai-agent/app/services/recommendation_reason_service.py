import re


def _normalize(value) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def _contains_any(text: str, values: list[str]) -> bool:
    return any(_normalize(value) and _normalize(value) in text for value in values)


def build_recommendation_reasons(
    product: dict,
    page_context: dict | None = None,
    preferences: dict | None = None,
    behavior: dict | None = None,
    cart: dict | None = None,
) -> list[str]:
    page_context = page_context or {}
    preferences = preferences or {}
    behavior = behavior or {}
    cart = cart or {}

    reasons = []
    product_text = _normalize(
        " ".join(
            [
                product.get("name", ""),
                product.get("category", ""),
                product.get("subCategory", ""),
                product.get("color", ""),
                product.get("description", ""),
            ]
        )
    )

    page_category = page_context.get("category") or ""
    page_subcategory = page_context.get("subCategory") or page_context.get("sub_category") or ""
    if page_category and _normalize(page_category) in product_text:
        reasons.append(f"Matches the {page_category} category you are browsing")
    elif page_subcategory and _normalize(page_subcategory) in product_text:
        reasons.append(f"Matches the {page_subcategory} section you are viewing")

    preferred_sizes = [str(size).upper() for size in preferences.get("preferred_sizes", [])]
    product_sizes = [str(size).upper() for size in product.get("sizes", [])]
    matching_sizes = [size for size in preferred_sizes if size in product_sizes]
    if matching_sizes:
        reasons.append(f"Available in your usual size {matching_sizes[0]}")

    if _contains_any(product_text, preferences.get("preferred_colors", [])):
        reasons.append("Matches colors you usually like")

    if _contains_any(product_text, preferences.get("preferred_categories", [])):
        reasons.append("Similar to categories you have shown interest in")

    if _contains_any(product_text, behavior.get("viewed_categories", [])):
        reasons.append("Related to products you recently viewed")

    if _contains_any(product_text, behavior.get("long_viewed_products", [])):
        reasons.append("Similar to products you spent more time viewing")

    average_price = preferences.get("average_price")
    price = product.get("price") or 0
    if average_price and price:
        try:
            average_price = float(average_price)
            price = float(price)
            if average_price * 0.7 <= price <= average_price * 1.3:
                reasons.append("Close to your usual price range")
        except (TypeError, ValueError):
            pass

    if product.get("hasOffer") or int(product.get("discountPercent") or 0) > 0:
        discount = int(product.get("discountPercent") or 0)
        if discount > 0:
            reasons.append(f"Currently has {discount}% off")
        else:
            reasons.append("Currently has an offer")

    cart_items = cart.get("items") or []
    if cart_items:
        cart_categories = [item.get("category") for item in cart_items if item.get("category")]
        if _contains_any(product_text, cart_categories):
            reasons.append("Pairs with items already in your cart")

    if not reasons:
        reasons.append("Good match based on your current shopping context")

    return reasons[:3]


def add_recommendation_reasons(
    products: list[dict],
    page_context: dict | None = None,
    preferences: dict | None = None,
    behavior: dict | None = None,
    cart: dict | None = None,
) -> list[dict]:
    return [
        {
            **product,
            "recommendationReasons": build_recommendation_reasons(
                product,
                page_context,
                preferences,
                behavior,
                cart,
            ),
        }
        for product in products
    ]
