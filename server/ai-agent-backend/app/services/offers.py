"""Active combo packs, shaped for the chat's offer cards and the agent."""

from bson import ObjectId

from app.config.settings import settings


def _combo_image(combo: dict) -> str | None:
    gallery = combo.get("galleryImages") or []
    first = gallery[0].get("url") if gallery and isinstance(gallery[0], dict) else None
    return combo.get("featuredImage") or first or combo.get("bannerImage")


def combo_offer(combo: dict) -> dict:
    storefront = str(settings.ecommerce_storefront_url or "").rstrip("/")
    slug = str(combo.get("slug") or "")
    discount = float(combo.get("discountPercentage") or 0)
    offer = {
        "_id": str(combo["_id"]),
        "name": combo.get("name"),
        "description": combo.get("shortDescription") or "",
        "price": combo.get("comboPrice"),
        "currency": combo.get("currency") or "INR",
        "discountPercent": round(discount) if discount else 0,
        "image": _combo_image(combo),
        "path": f"/combo-packs/{slug}" if slug else "/combo-packs",
        "url": f"{storefront}/combo-packs/{slug}" if storefront.startswith("https://") and slug else None,
    }
    if combo.get("originalPriceOverride"):
        offer["original_price"] = combo["originalPriceOverride"]
    return {key: value for key, value in offer.items() if value not in (None, "")}


async def active_combo_offers(database, product_id: str | None = None, limit: int = 3) -> list[dict]:
    """Active combos, preferring ones that include the given product."""
    if database is None:
        return []
    combos = await database.combopacks.find({"status": "ACTIVE"}).sort("createdAt", -1).limit(50).to_list(50)
    if product_id and ObjectId.is_valid(product_id):
        wanted = ObjectId(product_id)

        def includes(combo: dict) -> bool:
            items = [item.get("product") for item in combo.get("items") or []]
            eligible = [product for group in combo.get("selectionGroups") or [] for product in group.get("eligibleProducts") or []]
            return wanted in items or wanted in eligible

        combos.sort(key=lambda combo: not includes(combo))
    return [combo_offer(combo) for combo in combos[:limit]]
