import httpx

from app.config import settings


def _to_int(value) -> int:
    try:
        return int(float(value or 0))
    except (TypeError, ValueError):
        return 0


def normalize_combo_offer(combo: dict) -> dict:
    slug = combo.get("slug") or ""
    return {
        "_id": str(combo.get("_id") or ""),
        "name": combo.get("name") or "Combo offer",
        "description": combo.get("shortDescription") or combo.get("fullDescription") or "",
        "price": _to_int(combo.get("comboPrice")),
        "discountPercent": _to_int(combo.get("discountPercentage")),
        "image": combo.get("featuredImage") or combo.get("bannerImage"),
        "path": f"/combo-packs/{slug}" if slug else "/combo-packs",
        "source": "combo_offer",
    }


async def fetch_combo_offers(limit: int = 8) -> list[dict]:
    url = f"{settings.MERN_API_URL}/combo-packs/public"
    params = {"limit": limit}

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            payload = response.json()
    except Exception:
        return []

    raw_combos = payload.get("data", [])
    if isinstance(raw_combos, dict):
        raw_combos = raw_combos.get("items") or raw_combos.get("combos") or []
    if not isinstance(raw_combos, list):
        return []

    return [normalize_combo_offer(combo) for combo in raw_combos[:limit]]
