import asyncio
import json
import logging
import math
import re
from typing import Any

from app.ai.gemini_client import GeminiClient

logger = logging.getLogger(__name__)


class ProductImageAnalyzer:
    def __init__(self, gemini_client: GeminiClient | None = None):
        self.gemini_client = gemini_client or GeminiClient()

    async def analyze(
        self,
        image_url: str | None = None,
        image_data: str | None = None,
        mime_type: str | None = None,
        customer_message: str | None = None,
        catalog_categories: list[str] | None = None,
    ) -> dict[str, Any]:
        if not self.gemini_client.is_configured:
            return {}

        category_options = json.dumps(catalog_categories or [], ensure_ascii=False)
        prompt = f"""
You analyze customer-uploaded product photos for an online fashion seller.
Extract searchable product attributes from the image and optional customer text.
Return valid JSON only. Do not include markdown.

Allowed JSON keys:
category, product_type, product_name_hint, visible_text, brand, color, material, fabric, occasion, style, pattern, work, gender, confidence, description, product_count, products

Store catalogue categories:
{category_options}

Rules:
- Use simple English values.
- Attribute values must be strings or null, never arrays or objects. confidence must be a number from 0 to 1.
- When the product clearly belongs to one of the store catalogue categories, copy that category exactly into category.
- If it does not match any listed store category, set category to null. Never force it into an unrelated category.
- Put the general object type (for example hoodie, shoe, phone, chair, or handbag) in product_type even when category is null.
- Extract a short searchable product description into product_name_hint.
- Extract useful readable product/brand/design text into visible_text. Ignore prices, discounts, timestamps, buttons, and website navigation.
- Distinguish hoodies (hood attached), sweatshirts (no hood), and t-shirts. Do not classify a hoodie as a t-shirt.
- For screenshots or advertisements, ignore surrounding website/chat UI and analyze the main advertised product.
- Gallery thumbnails and front/back views of the same item are one product, not multiple purchasable products.
- Set product_count to the number of distinct purchasable products visible. If there is more than one, include a short products array with each item's position, product_type, color, and description.
- If unsure, use null and lower confidence.
- Do not identify a real person.
- Do not invent exact brand, price, stock, or availability.

Customer text:
{customer_message or ""}
"""
        try:
            text = await asyncio.wait_for(self.gemini_client.generate_with_image(
                prompt=prompt,
                image_url=image_url,
                image_data=image_data,
                mime_type=mime_type,
            ), timeout=35)
            return self._load_json(text)
        except Exception as exc:
            logger.warning("Gemini image analysis failed; continuing without image attributes: %s", exc.__class__.__name__)
            return {}

    async def embed(
        self,
        image_url: str | None = None,
        image_data: str | None = None,
        mime_type: str | None = None,
    ) -> list[float] | None:
        if not self.gemini_client.is_configured:
            return None
        try:
            return await asyncio.wait_for(self.gemini_client.embed_content(
                image_url=image_url,
                image_data=image_data,
                mime_type=mime_type,
            ), timeout=8)
        except Exception as exc:
            logger.warning("Gemini image embedding failed; using attribute search: %s", exc.__class__.__name__)
            return None

    def _load_json(self, text: str) -> dict[str, Any]:
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
            cleaned = re.sub(r"```$", "", cleaned).strip()

        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if not match:
            raise ValueError("No JSON object found in image analysis response")
        parsed = json.loads(match.group(0))
        if not isinstance(parsed, dict) or not parsed:
            return {}
        return self._normalize_analysis(parsed)

    @staticmethod
    def _normalize_analysis(parsed: dict) -> dict[str, Any]:
        # Provider JSON is untrusted: arrays/objects cannot be passed to the
        # string fields in IntentResult, and malformed confidence must not crash chat.
        fields = (
            "category", "product_type", "product_name_hint", "visible_text", "brand",
            "color", "material", "fabric", "occasion", "style", "pattern", "work",
            "gender", "description", "position",
        )
        result = {}
        for key in fields:
            value = parsed.get(key)
            if isinstance(value, list):
                value = ", ".join(item.strip() for item in value if isinstance(item, str) and item.strip())
            result[key] = value.strip()[:1000] if isinstance(value, str) and value.strip() else None
        try:
            confidence = float(parsed.get("confidence") or 0)
        except (TypeError, ValueError):
            confidence = 0.0
        result["confidence"] = max(0.0, min(1.0, confidence)) if math.isfinite(confidence) else 0.0
        products = parsed.get("products")
        result["products"] = [
            {key: item[key].strip()[:1000] for key in fields if isinstance(item.get(key), str)}
            for item in (products if isinstance(products, list) else [])[:5]
            if isinstance(item, dict) and any(isinstance(item.get(key), str) and item[key].strip() for key in fields)
        ]
        try:
            result["product_count"] = max(1, int(parsed.get("product_count") or 1))
        except (TypeError, ValueError, OverflowError):
            result["product_count"] = max(1, len(result["products"]))
        return result
