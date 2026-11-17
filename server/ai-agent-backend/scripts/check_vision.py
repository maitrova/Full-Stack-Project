"""Run a real Claude vision/text request (or a Gemini embedding) without printing secrets.

Usage:
  python scripts/check_vision.py --config-only
  python scripts/check_vision.py --list-models
  python scripts/check_vision.py --text-only
  python scripts/check_vision.py path/to/image.jpg [--model claude-haiku-5-5]
  python scripts/check_vision.py path/to/image.jpg --full-analysis
  python scripts/check_vision.py path/to/image.jpg --embed      (Gemini embeddings)
"""
import asyncio
import base64
import os
import sys
from pathlib import Path

import anthropic
import httpx
from dotenv import dotenv_values

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.ai.gemini_client import GeminiClient
from app.ai.product_image_analyzer import ProductImageAnalyzer
from app.config.settings import settings


def image_args(path: Path) -> dict:
    mime = "image/webp" if path.suffix == ".webp" else "image/png" if path.suffix == ".png" else "image/jpeg"
    return {"image_data": base64.b64encode(path.read_bytes()).decode(), "mime_type": mime}


async def main():
    if "--model" in sys.argv:
        # Requests read the model from settings, so override it there.
        settings.anthropic_model = sys.argv[sys.argv.index("--model") + 1]
    client = GeminiClient()
    print("Claude model:", settings.anthropic_model, "Claude key configured:", bool(client.anthropic_api_key))
    print("Embeddings (Gemini) key configured:", client.supports_embeddings)
    print("Process key override:", bool(os.environ.get("ANTHROPIC_API_KEY")))
    key = client.anthropic_api_key
    print("Key contains surrounding whitespace:", bool(key and key != key.strip()))
    root = Path(__file__).resolve().parents[1]
    for path in (root.parent / ".env", root / ".env"):
        file_key = dotenv_values(path).get("ANTHROPIC_API_KEY")
        print(path.parent.name + "/.env", "key present:", bool(file_key), "matches active:", bool(file_key and file_key == key))
    if "--config-only" in sys.argv:
        return 0
    try:
        if "--list-models" in sys.argv:
            async with anthropic.AsyncAnthropic(api_key=key) as api:
                async for model in api.models.list():
                    print(model.id)
            return 0
        if "--embed" in sys.argv:
            result = await client.embed_content(**image_args(Path(sys.argv[1])))
            print("Embedding dimensions:", len(result))
            return 0
        if "--full-analysis" in sys.argv:
            result = await ProductImageAnalyzer(client).analyze(
                **image_args(Path(sys.argv[1])),
                customer_message="Do you have this product?",
                catalog_categories=["T-Shirts", "Hoodies"],
            )
            print(result)
            return 0 if result else 1
        if "--text-only" in sys.argv:
            result = await client.generate_text("Reply with the word OK.")
        else:
            result = await client.generate_with_image(
                "Identify this product. Return JSON with product_type and color.",
                **image_args(Path(sys.argv[1])),
            )
        print(result)
    except anthropic.APIStatusError as exc:
        error = (exc.body or {}).get("error", {}) if isinstance(exc.body, dict) else {}
        print("Claude HTTP:", exc.status_code, "Type:", error.get("type"), "Request id:", getattr(exc, "request_id", None))
        return 1
    except httpx.HTTPStatusError as exc:
        # Gemini embedding errors; never print the key.
        message = str(exc.response.json().get("error", {}).get("message", ""))
        if client.api_key:
            message = message.replace(client.api_key, "[redacted]")
        print("Gemini HTTP:", exc.response.status_code, "Message:", message[:1500])
        return 1
    except Exception as exc:
        print("Failure:", type(exc).__name__)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
