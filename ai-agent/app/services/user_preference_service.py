import httpx

from app.config import settings


def build_preference_text(preferences: dict | None) -> str:
    if not preferences:
        return ""

    parts = []
    if preferences.get("preferred_sizes"):
        parts.append(f"Preferred sizes: {', '.join(preferences['preferred_sizes'])}")
    if preferences.get("preferred_categories"):
        parts.append(f"Preferred categories: {', '.join(preferences['preferred_categories'])}")
    if preferences.get("preferred_subcategories"):
        parts.append(f"Preferred subcategories: {', '.join(preferences['preferred_subcategories'])}")
    if preferences.get("preferred_colors"):
        parts.append(f"Preferred colors: {', '.join(preferences['preferred_colors'])}")
    if preferences.get("liked_product_names"):
        parts.append(f"Previously liked products: {', '.join(preferences['liked_product_names'])}")
    if preferences.get("average_price"):
        parts.append(f"Typical price: around Rs {preferences['average_price']}")

    return " | ".join(parts)


def build_behavior_text(behavior: dict | None) -> str:
    if not behavior:
        return ""

    parts = []
    if behavior.get("viewed_categories"):
        parts.append(f"Recently viewed categories: {', '.join(behavior['viewed_categories'])}")
    if behavior.get("viewed_subcategories"):
        parts.append(f"Recently viewed subcategories: {', '.join(behavior['viewed_subcategories'])}")
    if behavior.get("viewed_product_names"):
        parts.append(f"Recently viewed products: {', '.join(behavior['viewed_product_names'])}")
    if behavior.get("long_viewed_products"):
        parts.append(f"Spent more time on: {', '.join(behavior['long_viewed_products'])}")

    return " | ".join(parts)


async def fetch_user_preferences(auth_token: str | None) -> dict | None:
    if not auth_token:
        return None

    token = auth_token.replace("Bearer ", "").strip()
    if not token:
        return None

    url = f"{settings.MERN_API_URL}/ai/user-preferences"
    headers = {"Authorization": f"Bearer {token}"}

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            payload = response.json()
    except Exception:
        return None

    data = payload.get("data")
    return data if isinstance(data, dict) else None


async def fetch_behavior_summary(auth_token: str | None, session_id: str | None) -> dict | None:
    headers = {}

    if auth_token:
        token = auth_token.replace("Bearer ", "").strip()
        if token:
            headers["Authorization"] = f"Bearer {token}"

    if session_id:
        headers["x-ai-session-id"] = session_id

    if not headers:
        return None

    url = f"{settings.MERN_API_URL}/ai/behavior-summary"

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            payload = response.json()
    except Exception:
        return None

    data = payload.get("data")
    return data if isinstance(data, dict) else None
