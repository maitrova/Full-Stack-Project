import logging
import base64
from typing import Any

import httpx

from app.config.settings import settings

logger = logging.getLogger(__name__)


class GeminiClient:
    def __init__(self, api_key: str | None = None, model: str | None = None):
        self.api_key = settings.gemini_api_key if api_key is None else api_key
        self.model = settings.gemini_model if model is None else model

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    async def generate_text(self, prompt: str) -> str:
        if not self.api_key:
            raise RuntimeError("Gemini API key is not configured")

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"
        payload: dict[str, Any] = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": prompt}],
                }
            ],
            "generationConfig": {
                "maxOutputTokens": 500,
            },
        }

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                url,
                params={"key": self.api_key},
                headers={
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            response.raise_for_status()
            data = response.json()

        try:
            return data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError, TypeError) as exc:
            logger.warning("Unexpected Gemini response shape")
            raise RuntimeError("Invalid Gemini response") from exc

    async def generate_with_image(
        self,
        prompt: str,
        image_url: str | None = None,
        image_data: str | None = None,
        mime_type: str | None = None,
    ) -> str:
        if not self.api_key:
            raise RuntimeError("Gemini API key is not configured")
        if not image_url and not image_data:
            raise ValueError("image_url or image_data is required")

        resolved_mime_type = mime_type or "image/jpeg"
        resolved_image_data = image_data

        if image_url:
            async with httpx.AsyncClient(timeout=30) as client:
                image_response = await client.get(image_url)
                image_response.raise_for_status()
                resolved_mime_type = image_response.headers.get("content-type", resolved_mime_type).split(";")[0]
                resolved_image_data = base64.b64encode(image_response.content).decode("ascii")

        if resolved_image_data and resolved_image_data.startswith("data:"):
            header, encoded = resolved_image_data.split(",", 1)
            resolved_image_data = encoded
            if ";base64" in header:
                resolved_mime_type = header.removeprefix("data:").split(";")[0] or resolved_mime_type

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"
        payload: dict[str, Any] = {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {"text": prompt},
                        {
                            "inline_data": {
                                "mime_type": resolved_mime_type,
                                "data": resolved_image_data,
                            }
                        },
                    ],
                }
            ],
            "generationConfig": {
                "maxOutputTokens": 500,
            },
        }

        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(
                url,
                params={"key": self.api_key},
                headers={"Content-Type": "application/json"},
                json=payload,
            )
            response.raise_for_status()
            data = response.json()

        try:
            return data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError, TypeError) as exc:
            logger.warning("Unexpected Gemini vision response shape")
            raise RuntimeError("Invalid Gemini vision response") from exc
