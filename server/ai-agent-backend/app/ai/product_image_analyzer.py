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
    ) -> dict[str, Any]:
        if not self.gemini_client.is_configured:
            return {}

        prompt = f"""
You analyze customer-uploaded product photos for an online fashion seller.
Extract searchable product attributes from the image and optional customer text.
Return valid JSON only. Do not include markdown.

Allowed JSON keys:
category, color, material, fabric, occasion, style, pattern, work, gender, confidence, description

Rules:
- Use simple English values.
- category should be a store category like saree, shirt, t-shirt, jeans, kurti, dress, shoe, bag, watch, jacket, accessory.
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
