import json
import logging
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
- When the product clearly belongs to one of the store catalogue categories, copy that category exactly into category.
- If it does not match any listed store category, set category to null. Never force it into an unrelated category.
- Put the general object type (for example hoodie, shoe, phone, chair, or handbag) in product_type even when category is null.
- Extract a short searchable product description into product_name_hint.
- Extract useful readable product/brand/design text into visible_text. Ignore prices, discounts, timestamps, buttons, and website navigation.
- Distinguish hoodies (hood attached), sweatshirts (no hood), and t-shirts. Do not classify a hoodie as a t-shirt.
- For screenshots or advertisements, ignore surrounding website/chat UI and analyze the main advertised product.
- Set product_count to the number of distinct purchasable products visible. If there is more than one, include a short products array with each item's position, product_type, color, and description.
- If unsure, use null and lower confidence.
- Do not identify a real person.
- Do not invent exact brand, price, stock, or availability.

Customer text:
{customer_message or ""}
"""
        try:
            text = await self.gemini_client.generate_with_image(
                prompt=prompt,
                image_url=image_url,
                image_data=image_data,
                mime_type=mime_type,
            )
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
            return await self.gemini_client.embed_content(
                image_url=image_url,
                image_data=image_data,
                mime_type=mime_type,
            )
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
        return parsed if isinstance(parsed, dict) else {}
