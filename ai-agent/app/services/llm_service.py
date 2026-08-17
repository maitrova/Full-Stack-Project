from google import genai
from google.genai import types
import re

from app.config import settings
from app.services.product_context import build_product_context
from app.services.product_search import search_products
from app.services.recommendation_reason_service import add_recommendation_reasons
from app.services.shopping_context_service import (
    build_cart_text,
    build_order_cancel_eligibility_response,
    build_order_tracking_response,
    cancel_order,
    fetch_cart_summary,
    fetch_recent_orders,
    find_order_for_message,
    is_order_cancellable,
)
from app.services.user_preference_service import build_preference_text, fetch_user_preferences
from app.services.user_preference_service import build_behavior_text, fetch_behavior_summary


# 3. The system instruction tells the LLM how it should behave in this app.
SYSTEM_INSTRUCTION = (
    "You are an AI shopping assistant for an e-commerce fashion website. "
    "Help customers understand and find products from the product context when it is relevant. "
    "You can use recent conversation history to understand follow-up messages. "
    "When the customer asks to add an item to cart, the website UI may perform that action from structured data. "
    "If no matching products are provided, say that no matching products were found and ask a useful follow-up."
)

ADD_TO_CART_KEYWORDS = [
    "add to cart",
    "add it to cart",
    "add this to cart",
    "add them to cart",
    "put in cart",
    "put it in cart",
    "cart this",
    "buy this",
]

CART_WORDS = {"cart", "car", "crt", "kart", "card"}
CART_ACTION_WORDS = {"add", "put", "move", "buy", "cart"}

ORDER_TRACKING_KEYWORDS = [
    "track order",
    "track my order",
    "order status",
    "where is my order",
    "latest order",
    "my order",
    "delivery status",
    "when will it arrive",
]

ORDER_CANCEL_KEYWORDS = [
    "cancel order",
    "cancel my order",
    "cancel latest order",
    "cancel my latest order",
    "please cancel",
]

ORDER_CANCEL_QUESTION_KEYWORDS = [
    "can i cancel",
    "can we cancel",
    "is my order cancellable",
    "eligible to cancel",
    "can the order be cancelled",
]

COMPARISON_KEYWORDS = [
    "compare",
    "which is better",
    "which one is better",
    "which should i buy",
    "best option",
    "better option",
    "choose one",
    "help me decide",
]


def _format_history(history: list[dict[str, str]]) -> str:
    if not history:
        return "No previous messages."

    return "\n".join(
        f"{message['role']}: {message['content']}"
        for message in history[-6:]
    )


def _build_search_query(user_message: str, history: list[dict[str, str]]) -> str:
    recent_user_messages = [
        message["content"]
        for message in history[-6:]
        if message.get("role") == "user"
    ]

    return "\n".join([*recent_user_messages, user_message])


def _build_page_context_text(page_context: dict | None) -> str:
    if not page_context:
        return ""

    parts = []
    if page_context.get("page_type") or page_context.get("pageType"):
        parts.append(f"Current page type: {page_context.get('page_type') or page_context.get('pageType')}")
    if page_context.get("productName"):
        parts.append(f"Current product name from page URL: {page_context.get('productName')}")
    if page_context.get("product_id") or page_context.get("productId"):
        parts.append(f"Current product id: {page_context.get('product_id') or page_context.get('productId')}")
    if page_context.get("category"):
        parts.append(f"Current category: {page_context.get('category')}")
    if page_context.get("subCategory") or page_context.get("sub_category"):
        parts.append(f"Current subcategory: {page_context.get('subCategory') or page_context.get('sub_category')}")
    if page_context.get("path"):
        parts.append(f"Current page path: {page_context.get('path')}")

    return "\n".join(parts)


def _build_fallback_response(matching_products: list[dict]) -> str:
    if not matching_products:
        return (
            "I could not reach the AI model right now, and I did not find matching products. "
            "Try a different product name, category, size, or budget."
        )

    product_names = ", ".join(
        product.get("name", "a matching product")
        for product in matching_products[:3]
    )
    return (
        "I could not reach the AI model right now, but Python search found matching products: "
        f"{product_names}."
    )


def _is_add_to_cart_request(message: str) -> bool:
    normalized_message = message.lower()
    tokens = re.findall(r"[a-z0-9]+", normalized_message)
    return (
        any(keyword in normalized_message for keyword in ADD_TO_CART_KEYWORDS)
        or re.search(r"\badd\b.+\bcart\b", normalized_message) is not None
        or re.search(r"\bcart\b.+\b(add|item|product)\b", normalized_message) is not None
        or (
            any(token in CART_ACTION_WORDS for token in tokens)
            and any(token in CART_WORDS for token in tokens)
        )
    )


def _is_order_tracking_request(message: str) -> bool:
    normalized_message = message.lower()
    return any(keyword in normalized_message for keyword in ORDER_TRACKING_KEYWORDS)


def _is_order_cancel_question(message: str) -> bool:
    normalized_message = message.lower()
    return any(keyword in normalized_message for keyword in ORDER_CANCEL_QUESTION_KEYWORDS)


def _is_order_cancel_request(message: str) -> bool:
    normalized_message = message.lower()
    if "cancel" not in normalized_message or "order" not in normalized_message:
        return False
    if _is_order_cancel_question(normalized_message):
        return False
    return (
        any(keyword in normalized_message for keyword in ORDER_CANCEL_KEYWORDS)
        or re.search(r"\bcancel\b.+\border\b", normalized_message) is not None
        or re.search(r"\border\b.+\bcancel\b", normalized_message) is not None
    )


def _is_comparison_request(message: str) -> bool:
    normalized_message = message.lower()
    return any(keyword in normalized_message for keyword in COMPARISON_KEYWORDS)


def _get_default_size(product: dict) -> str:
    for size in product.get("sizes", []):
        normalized_size = str(size).upper()
        if normalized_size in {"XS", "S", "M", "L", "XL", "XXL"}:
            return normalized_size

    return "M"


async def get_llm_response(
    user_message: str,
    history: list[dict[str, str]] | None = None,
    auth_token: str | None = None,
    page_context: dict | None = None,
    session_id: str | None = None,
) -> dict:
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is missing. Add it to your .env file.")

    history = history or []
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    user_preferences = await fetch_user_preferences(auth_token)
    behavior_summary = await fetch_behavior_summary(auth_token, session_id)
    cart_summary = await fetch_cart_summary(auth_token)
    preference_text = build_preference_text(user_preferences)
    behavior_text = build_behavior_text(behavior_summary)
    cart_text = build_cart_text(cart_summary)

    if _is_order_cancel_question(user_message):
        orders = await fetch_recent_orders(auth_token)
        order = find_order_for_message(orders, user_message)
        return {
            "response": build_order_cancel_eligibility_response(order),
            "products": [],
            "action": None,
        }

    if _is_order_cancel_request(user_message):
        orders = await fetch_recent_orders(auth_token)
        order = find_order_for_message(orders, user_message)
        if not order:
            return {
                "response": "I could not find a recent order to cancel. Please make sure you are logged in, or open My Orders.",
                "products": [],
                "action": None,
            }

        if not is_order_cancellable(order):
            return {
                "response": build_order_cancel_eligibility_response(order),
                "products": [],
                "action": None,
            }

        cancel_result = await cancel_order(auth_token, order.get("order_id") or "")
        return {
            "response": cancel_result.get("message") or "Order cancellation request completed.",
            "products": [],
            "action": None,
        }

    if _is_order_tracking_request(user_message):
        orders = await fetch_recent_orders(auth_token)
        return {
            "response": build_order_tracking_response(orders),
            "products": [],
            "action": None,
        }

    search_query = _build_search_query(user_message, history)
    page_context_text = _build_page_context_text(page_context)
    personalized_query = f"{search_query}\n{page_context_text}\n{preference_text}\n{behavior_text}\n{cart_text}".strip()
    matching_products = await search_products(
        personalized_query,
        f"{page_context_text}\n{preference_text}\n{behavior_text}\n{cart_text}".strip(),
    )
    matching_products = add_recommendation_reasons(
        matching_products,
        page_context,
        user_preferences,
        behavior_summary,
        cart_summary,
    )

    if _is_add_to_cart_request(user_message):
        if not matching_products:
            return {
                "response": "I could not find the product you want to add. Please mention the product name or ask me to search again.",
                "products": [],
                "action": None,
            }

        product = matching_products[0]
        selected_size = _get_default_size(product)

        return {
            "response": f"I found {product.get('name', 'that product')} and will add size {selected_size} to your cart.",
            "products": [product],
            "action": {
                "type": "add_to_cart",
                "product": product,
                "size": selected_size,
                "qty": 1,
            },
        }

    product_context = build_product_context(matching_products)
    decision_instruction = ""
    if _is_comparison_request(user_message):
        decision_instruction = (
            "\nDecision task:\n"
            "The customer is trying to decide. Compare the matching products briefly, "
            "choose one best option when possible, and explain the reason using price, offer, size, category, "
            "cart fit, and user preference signals. Do not invent product facts.\n\n"
        )

    prompt = (
        "Recent conversation:\n"
        f"{_format_history(history)}\n\n"
        "User preference summary:\n"
        f"{preference_text or 'No logged-in preference summary available.'}\n\n"
        "Current page context:\n"
        f"{page_context_text or page_context or 'No page context provided.'}\n\n"
        "Recent browsing behavior:\n"
        f"{behavior_text or 'No browsing behavior available yet.'}\n\n"
        "Current cart summary:\n"
        f"{cart_text or 'No cart summary available.'}\n\n"
        "Matching products from Python search:\n"
        f"{product_context or 'No matching products found.'}\n\n"
        "If the customer asks about fabric, material, making, wash care, size, stock, price, offer, or product details, "
        "answer only from the matching product context. If that exact detail is missing, say it is not available in the product data and offer to help with similar products.\n\n"
        f"{decision_instruction}"
        "Latest customer message:\n"
        f"{user_message}"
    )

    try:
        # 2. This is where we call the Gemini LLM API.
        response = await client.aio.models.generate_content(
            model=settings.GEMINI_MODEL,
            # 4. The user message is sent with products matched by simple Python search.
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
            ),
        )
        response_text = response.text or ""
    except Exception:
        # If Gemini is unreachable, keep the chat usable with Python search results.
        response_text = _build_fallback_response(matching_products)

    # 5. The LLM response comes back from Gemini in response.text.
    return {
        "response": response_text,
        "products": matching_products,
        "action": None,
    }
