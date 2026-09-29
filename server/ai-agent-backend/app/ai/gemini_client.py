import asyncio
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
        logger.info(
            "Gemini client configured=%s model=%s",
            bool(self.api_key),
            self.model,
        )

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    async def generate_text(self, prompt: str) -> str:
        if not self.api_key:
            raise RuntimeError("Gemini API key is not configured")

        return await self._create_interaction(prompt, "text")

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

        resolved_mime_type, resolved_image_data = await self._resolve_image(
            image_url, image_data, mime_type
        )

        return await self._create_interaction(
            [
                {"type": "text", "text": prompt},
                {"type": "image", "mime_type": resolved_mime_type, "data": resolved_image_data},
            ],
            "vision",
        )

    async def _create_interaction(self, input_data: str | list[dict[str, Any]], operation: str) -> str:
        """Use Google's current stateless API for text and multimodal understanding."""
        url = "https://generativelanguage.googleapis.com/v1beta/interactions"
        models = list(dict.fromkeys([self.model, "gemini-3.1-flash-lite", "gemini-3.8-flash"]))
        async with httpx.AsyncClient(timeout=45) as client:
            for model_index, model in enumerate(models):
                payload = {"model": model, "input": input_data, "store": False}
                for attempt in range(2):
                    try:
                        response = await client.post(
                            url,
                            headers={"Content-Type": "application/json", "x-goog-api-key": self.api_key},
                            json=payload,
                        )
                    except httpx.TransportError:
                        if attempt or model_index == len(models) - 1:
                            raise
                        await asyncio.sleep(1)
                        break
                    if response.status_code in {429, 500, 502, 503, 504} and not attempt:
                        await asyncio.sleep(1)
                        continue
                    break
                if not response.is_error or response.status_code not in {404, 429, 500, 502, 503, 504}:
                    break
                if model_index < len(models) - 1:
                    logger.info("Gemini %s model %s unavailable; trying fallback", operation, model)
        if response.is_error:
            self._log_api_error(response, operation, model)
        response.raise_for_status()
        data = response.json()
        text = data.get("output_text") or "".join(
            content.get("text", "")
            for step in data.get("steps", [])
            if step.get("type") == "model_output"
            for content in step.get("content", [])
            if content.get("type") == "text"
        )
        if not isinstance(text, str) or not text.strip():
            logger.warning("Unexpected Gemini %s interaction response shape", operation)
            raise RuntimeError(f"Invalid Gemini {operation} response")
        return text.strip()

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
        if image_url and not resolved_image_data:
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
    def _log_api_error(response: httpx.Response, operation: str, model: str | None = None) -> None:
        try:
            error = response.json().get("error", {})
            reason = error.get("status") or "unknown"
        except (ValueError, AttributeError):
            reason = "non_json_response"
        # Never log the API key, response URL query, or provider response body.
        logger.warning(
            "Gemini %s request rejected: HTTP %s (%s), model=%s",
            operation,
            response.status_code,
            reason,
            model or "unknown",
        )
