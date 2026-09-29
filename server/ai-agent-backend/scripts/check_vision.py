"""Run a real vision request against the configured provider without printing secrets."""
import asyncio
import base64
import os
import sys
from pathlib import Path

import httpx
from dotenv import dotenv_values

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.ai.gemini_client import GeminiClient
from app.ai.product_image_analyzer import ProductImageAnalyzer


async def main():
    model = sys.argv[sys.argv.index("--model") + 1] if "--model" in sys.argv else None
    client = GeminiClient(model=model)
    print("Model:", client.model, "Key configured:", client.is_configured)
    print("Process key override:", bool(os.environ.get("GEMINI_API_KEY")))
    print("Key contains surrounding whitespace:", bool(client.api_key and client.api_key != client.api_key.strip()))
    root = Path(__file__).resolve().parents[1]
    for path in (root.parent / ".env", root / ".env"):
        key = dotenv_values(path).get("GEMINI_API_KEY")
        print(path.parent.name + "/.env", "key present:", bool(key), "matches active:", bool(key and key == client.api_key))
    if "--config-only" in sys.argv:
        return 0
    if "--list-models" in sys.argv:
        async with httpx.AsyncClient(timeout=20) as transport:
            response = await transport.get(
                "https://generativelanguage.googleapis.com/v1beta/models",
                headers={"x-goog-api-key": client.api_key},
            )
            print("Model listing HTTP:", response.status_code)
            if response.is_error:
                return 1
            for item in response.json().get("models", []):
                if "generateContent" in item.get("supportedGenerationMethods", []):
                    print(item["name"])
        return 0
    if "--interactions" in sys.argv:
        interaction_input = "Reply with the word OK."
        if len(sys.argv) > 1 and not sys.argv[1].startswith("--"):
            path = Path(sys.argv[1])
            mime = "image/webp" if path.suffix == ".webp" else "image/png" if path.suffix == ".png" else "image/jpeg"
            interaction_input = [
                {"type": "text", "text": "Identify this product. Return JSON with product_type and color."},
                {"type": "image", "data": base64.b64encode(path.read_bytes()).decode(), "mime_type": mime},
            ]
        async with httpx.AsyncClient(timeout=30) as transport:
            response = await transport.post(
                "https://generativelanguage.googleapis.com/v1beta/interactions",
                headers={"Content-Type": "application/json", "x-goog-api-key": client.api_key},
                json={"model": client.model, "input": interaction_input, "store": False},
            )
            print("Interactions HTTP:", response.status_code)
            if response.is_error:
                error = response.json().get("error", {})
                print("Status:", error.get("status"), "Message:", str(error.get("message", ""))[:1500])
                return 1
            data = response.json()
            text = data.get("output_text") or "".join(
                content.get("text", "")
                for step in data.get("steps", []) if step.get("type") == "model_output"
                for content in step.get("content", []) if content.get("type") == "text"
            )
            print("Interactions request succeeded:", text[:1500])
        return 0
    try:
        if "--embed" in sys.argv:
            path = Path(sys.argv[1])
            mime = "image/webp" if path.suffix == ".webp" else "image/png" if path.suffix == ".png" else "image/jpeg"
            result = await client.embed_content(
                image_data=base64.b64encode(path.read_bytes()).decode(), mime_type=mime,
            )
            print("Embedding dimensions:", len(result))
            return 0
        if "--full-analysis" in sys.argv:
            path = Path(sys.argv[1])
            mime = "image/webp" if path.suffix == ".webp" else "image/png" if path.suffix == ".png" else "image/jpeg"
            result = await ProductImageAnalyzer(client).analyze(
                image_data=base64.b64encode(path.read_bytes()).decode(),
                mime_type=mime,
                customer_message="Do you have this product?",
                catalog_categories=["T-Shirts", "Hoodies"],
            )
            print(result)
            return 0 if result else 1
        if "--text-only" in sys.argv:
            result = await client.generate_text("Reply with the word OK.")
        else:
            path = Path(sys.argv[1])
            mime = "image/webp" if path.suffix == ".webp" else "image/png" if path.suffix == ".png" else "image/jpeg"
            result = await client.generate_with_image(
                "Identify this product. Return JSON with product_type and color.",
                image_data=base64.b64encode(path.read_bytes()).decode(), mime_type=mime,
            )
        print(result)
    except httpx.HTTPStatusError as exc:
        error = exc.response.json().get("error", {})
        message = str(error.get("message", ""))
        if client.api_key:
            message = message.replace(client.api_key, "[redacted]")
        print("HTTP:", exc.response.status_code, "Status:", error.get("status"), "Message:", message[:1500])
        return 1
    except Exception as exc:
        print("Failure:", type(exc).__name__)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
