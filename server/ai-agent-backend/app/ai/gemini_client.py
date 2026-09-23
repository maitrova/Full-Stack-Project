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
                "temperature": 0.2,
                "topP": 0.8,
            },
        }

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                url,
                headers={
                    "Content-Type": "application/json",
                    "x-goog-api-key": self.api_key,
                },
                json=payload,
            )
            if response.is_error:
                self._log_api_error(response, "text")
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
                "temperature": 0.2,
                "topP": 0.8,
            },
        }

        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(
                url,
                headers={"Content-Type": "application/json", "x-goog-api-key": self.api_key},
                json=payload,
            )
            if response.is_error:
                self._log_api_error(response, "vision")
            response.raise_for_status()
            data = response.json()

        try:
            return data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError, TypeError) as exc:
            logger.warning("Unexpected Gemini vision response shape")
            raise RuntimeError("Invalid Gemini vision response") from exc

    async def embed_content(
        self,
        text: str | None = None,
        image_url: str | None = None,
        image_data: str | None = None,
        mime_type: str | None = None,
    ) -> list[float]:
        """Create a shared text/image embedding without logging customer content."""
        if not self.api_key:
            raise RuntimeError("Gemini API key is not configured")
        if not text and not image_url and not image_data:
            raise ValueError("text or image is required")

        parts: list[dict[str, Any]] = []
        if text:
            parts.append({"text": text[:8000]})
        if image_url or image_data:
            resolved_mime_type, resolved_image_data = await self._resolve_image(
                image_url=image_url,
                image_data=image_data,
                mime_type=mime_type,
            )
            parts.append({"inline_data": {"mime_type": resolved_mime_type, "data": resolved_image_data}})

        model = settings.gemini_embedding_model
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent"
        payload = {
            "model": f"models/{model}",
            "content": {"parts": parts},
            "output_dimensionality": settings.gemini_embedding_dimensions,
        }
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                url,
                headers={"Content-Type": "application/json", "x-goog-api-key": self.api_key},
                json=payload,
            )
            if response.is_error:
                self._log_api_error(response, "embedding")
            response.raise_for_status()
            data = response.json()

        values = (data.get("embedding") or {}).get("values")
        if not values:
            embeddings = data.get("embeddings") or []
            values = embeddings[0].get("values") if embeddings else None
        if not isinstance(values, list) or not values:
            raise RuntimeError("Invalid Gemini embedding response")
        return [float(value) for value in values]

    async def _resolve_image(
        self,
        image_url: str | None,
        image_data: str | None,
        mime_type: str | None,
    ) -> tuple[str, str]:
        resolved_mime_type = mime_type or "image/jpeg"
        resolved_image_data = image_data
        if image_url:
            async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
                response = await client.get(image_url)
                response.raise_for_status()
                resolved_mime_type = response.headers.get("content-type", resolved_mime_type).split(";")[0]
                resolved_image_data = base64.b64encode(response.content).decode("ascii")
        if resolved_image_data and resolved_image_data.startswith("data:"):
            header, resolved_image_data = resolved_image_data.split(",", 1)
            if ";base64" in header:
                resolved_mime_type = header.removeprefix("data:").split(";")[0] or resolved_mime_type
        if not resolved_image_data:
            raise ValueError("image data could not be resolved")
        return resolved_mime_type, resolved_image_data

    @staticmethod
    def _log_api_error(response: httpx.Response, operation: str) -> None:
        try:
            error = response.json().get("error", {})
            reason = error.get("status") or "unknown"
        except (ValueError, AttributeError):
            reason = "non_json_response"
        # Never log the API key, response URL query, or provider response body.
        logger.warning("Gemini %s request rejected: HTTP %s (%s)", operation, response.status_code, reason)
