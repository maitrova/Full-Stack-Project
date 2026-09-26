import json
import unittest
from unittest.mock import patch

import httpx

from app.ai.gemini_client import GeminiClient


class ImageClientTests(unittest.IsolatedAsyncioTestCase):
    async def generate(self, handler, **kwargs):
        client = httpx.AsyncClient(transport=httpx.MockTransport(handler), follow_redirects=True)
        with patch("app.ai.gemini_client.httpx.AsyncClient", return_value=client):
            return await GeminiClient(api_key="test-key").generate_with_image("Identify product", **kwargs)

    @staticmethod
    def success():
        return httpx.Response(200, json={"candidates": [{"finishReason": "STOP", "content": {"parts": [
            {"thought": True, "text": "internal reasoning"},
            {"text": '{"product_type":'}, {"text": '"hoodie"}'},
        ]}}]})

    async def test_data_uri_takes_priority_over_url_and_collects_answer_parts(self):
        def handler(request):
            self.assertEqual(request.method, "POST")
            payload = json.loads(request.content)
            image = payload["contents"][0]["parts"][1]["inline_data"]
            self.assertEqual(image, {"mime_type": "image/png", "data": "aGVsbG8="})
            self.assertEqual(payload["generationConfig"]["responseMimeType"], "application/json")
            self.assertGreaterEqual(payload["generationConfig"]["maxOutputTokens"], 4096)
            return self.success()

        result = await self.generate(handler, image_data="data:image/png;base64,aGVsbG8=", image_url="https://expired.example/image")
        self.assertEqual(json.loads(result), {"product_type": "hoodie"})

    async def test_redirected_image_download(self):
        requests = []

        def handler(request):
            requests.append(request.url.path)
            if request.url.path == "/image":
                return httpx.Response(302, headers={"location": "/actual.png"})
            return httpx.Response(200, content=b"image bytes", headers={"content-type": "image/png; charset=binary"})

        client = httpx.AsyncClient(transport=httpx.MockTransport(handler), follow_redirects=True)
        with patch("app.ai.gemini_client.httpx.AsyncClient", return_value=client):
            mime, data = await GeminiClient(api_key="test")._resolve_image("https://images.example/image", None, None)
        self.assertEqual(mime, "image/png")
        self.assertTrue(data)
        self.assertEqual(requests, ["/image", "/actual.png"])

    async def test_transient_failure_retried(self):
        calls = []

        def handler(request):
            calls.append(request)
            return httpx.Response(503) if len(calls) == 1 else self.success()

        self.assertTrue(await self.generate(handler, image_data="aGVsbG8="))
        self.assertEqual(len(calls), 2)

    async def test_invalid_key_not_retried(self):
        calls = []

        def handler(request):
            calls.append(request)
            return httpx.Response(403, json={"error": {"status": "PERMISSION_DENIED"}})

        with self.assertRaises(httpx.HTTPStatusError):
            await self.generate(handler, image_data="aGVsbG8=")
        self.assertEqual(len(calls), 1)

    async def test_truncated_json_is_not_used(self):
        with self.assertRaisesRegex(RuntimeError, "token limit"):
            await self.generate(lambda request: httpx.Response(200, json={"candidates": [
                {"finishReason": "MAX_TOKENS", "content": {"parts": [{"text": '{"product_type":'}]}}
            ]}), image_data="aGVsbG8=")


if __name__ == "__main__":
    unittest.main()
