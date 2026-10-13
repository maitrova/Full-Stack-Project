"""Canonical product taxonomy shared by parsing, indexing, and search."""

import re
from typing import Any


CANONICAL_CATEGORIES = {
    "shirt",
    "t-shirt",
    "hoodie",
    "sweatshirt",
    "crop top",
    "saree",
    "dress",
    "jeans",
    "shoe",
    "bag",
    "accessory",
}

_ALIASES = {
    "shirts": "shirt", "men shirt": "shirt", "mens shirt": "shirt",
    "men shirts": "shirt", "formal shirt": "shirt", "formal shirts": "shirt",
    "t shirt": "t-shirt", "t shirts": "t-shirt", "t-shirt": "t-shirt",
    "t-shirts": "t-shirt", "tee": "t-shirt", "tees": "t-shirt",
    "tshirt": "t-shirt", "tshirts": "t-shirt", "oversized t shirt": "t-shirt",
    "oversized t shirts": "t-shirt", "oversized t-shirt": "t-shirt",
    "oversized t-shirts": "t-shirt", "oversized tshirt": "t-shirt",
    "oversized tshirts": "t-shirt", "hoodies": "hoodie",
    "sweatshirts": "sweatshirt", "crop tops": "crop top", "shoes": "shoe",
    "handbag": "bag", "handbags": "bag", "backpack": "bag",
    "backpacks": "bag", "accessories": "accessory", "belts": "accessory",
    "belt": "accessory", "wallet": "accessory", "sunglasses": "accessory",
    "cap": "accessory", "caps": "accessory",
}


def normalize_category(value: Any) -> str | None:
    if value is None:
        return None
    text = re.sub(r"\s+", " ", str(value).lower().replace("_", " ").replace("-", " ")).strip()
    if not text:
        return None
    if "polo" in text and ("shirt" in text or "tee" in text or "tshirt" in text):
        return "t-shirt"
    if text in _ALIASES:
        return _ALIASES[text]
    for alias, category in sorted(_ALIASES.items(), key=lambda item: -len(item[0])):
        if text == alias or text.endswith(f" {alias}"):
            return category
    return text if text in CANONICAL_CATEGORIES else None


def infer_canonical_attributes(name: Any, category: Any, attributes: dict | None = None) -> dict:
    """Return canonical category plus style facts without overwriting merchant data."""
    attrs = dict(attributes or {})
    text = " ".join(str(value or "") for value in (name, category, attrs.get("sub_category"))).lower()
    canonical = normalize_category(category) or normalize_category(attrs.get("product_type"))
    if not canonical:
        for candidate in CANONICAL_CATEGORIES:
            if re.search(rf"\b{re.escape(candidate).replace('\\-', '[- ]')}s?\b", text):
                canonical = candidate
                break
    result = {"canonical_category": canonical} if canonical else {}
    if "oversized" in text:
        result["style"] = "oversized"
    elif "polo" in text:
        result["style"] = "polo"
    return result
