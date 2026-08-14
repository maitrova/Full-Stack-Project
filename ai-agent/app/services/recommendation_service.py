from google import genai
from google.genai import types

from app.config import settings
from app.services.backend_product_service import fetch_backend_products
from app.services.embedding_service import rank_products_by_embedding
from app.services.offer_service import fetch_combo_offers
from app.services.user_preference_service import (
    build_behavior_text,
    build_preference_text,
    fetch_behavior_summary,
    fetch_user_preferences,
)


RECOMMENDATION_SYSTEM_INSTRUCTION = (
    "You are an AI shopping assistant for a fashion e-commerce website. "
    "Suggest relevant products and offers based on the current page and user taste signals. "
    "Be helpful and persuasive, but do not pressure, trick, or claim that the user must buy anything."
)


def _text(value) -> str:
    return str(value or "").strip().lower()


def _matches_page(product: dict, page_context: dict) -> bool:
    page_type = _text(page_context.get("page_type") or page_context.get("pageType"))
    path = _text(page_context.get("path"))
    category = _text(page_context.get("category"))
    sub_category = _text(page_context.get("subCategory") or page_context.get("sub_category"))
    product_id = _text(page_context.get("product_id") or page_context.get("productId"))

    product_category = _text(product.get("category"))
    product_sub_category = _text(product.get("subCategory"))

    if product_id and product_id == _text(product.get("_id")):
        return True
    if category and category in product_category:
        return True
    if sub_category and sub_category in product_sub_category:
        return True
    if page_type in {"product_detail", "category", "subcategory"}:
        return category in product_category or sub_category in product_sub_category
    return any(token and token in path for token in [product_category, product_sub_category])


def _score_recommendation(product: dict, page_context: dict, preference_text: str, behavior_text: str) -> int:
    searchable = _text(
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
    taste_text = _text(f"{preference_text} {behavior_text}")
    score = 0

    if product.get("hasOffer"):
        score += 8
    if _matches_page(product, page_context):
        score += 6
    for token in taste_text.split():
        if len(token) > 2 and token in searchable:
            score += 1

    return score


async def get_page_recommendations(
    page_context: dict,
    session_id: str,
    auth_token: str | None = None,
) -> dict:
    products = await fetch_backend_products()
    offers = await fetch_combo_offers()
    preferences = await fetch_user_preferences(auth_token)
    behavior = await fetch_behavior_summary(auth_token, session_id)
    preference_text = build_preference_text(preferences)
    behavior_text = build_behavior_text(behavior)

    scored_products = [
        (_score_recommendation(product, page_context, preference_text, behavior_text), product)
        for product in products
    ]
    scored_products = [(score, product) for score, product in scored_products if score > 0]
    scored_products.sort(key=lambda item: (item[0], item[1].get("hasOffer", False)), reverse=True)
    recommended_products = [product for score, product in scored_products[:10]]

    if not recommended_products:
        recommended_products = sorted(
            products,
            key=lambda product: (product.get("hasOffer", False), -(product.get("price") or 0)),
            reverse=True,
        )[:10]

    ranking_query = "\n".join(
        [
            str(page_context),
            preference_text,
            behavior_text,
            "prefer products with offers and products similar to the current page",
        ]
    ).strip()
    recommended_products = await rank_products_by_embedding(ranking_query, recommended_products)

    prompt = (
        "Current page context:\n"
        f"{page_context}\n\n"
        "User preference summary:\n"
        f"{preference_text or 'No order/cart preferences available.'}\n\n"
        "Recent browsing behavior:\n"
        f"{behavior_text or 'No browsing behavior available yet.'}\n\n"
        "Available combo offers:\n"
        f"{offers[:3]}\n\n"
        "Recommended products:\n"
        f"{recommended_products[:4]}\n\n"
        "Write one short helpful proactive shopping suggestion."
    )

    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        response = await client.aio.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=RECOMMENDATION_SYSTEM_INSTRUCTION,
            ),
        )
        response_text = response.text or ""
    except Exception:
        if offers:
            response_text = "You may like these current combo offers and matching products."
        elif recommended_products:
            response_text = "These products match this page and your recent shopping signals."
        else:
            response_text = "I can suggest products once you start exploring the store."

    return {
        "response": response_text,
        "products": recommended_products[:6],
        "offers": offers[:3],
    }
