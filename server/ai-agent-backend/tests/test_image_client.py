import unittest
from unittest.mock import AsyncMock, patch

import httpx

from app.ai.gemini_client import GeminiClient
from tests.claude_fakes import OVERLOADED, FakeClaude, message, text, thinking


class ImageClientTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        patcher = patch.multiple(
            "app.ai.anthropic_provider.settings",
            anthropic_model="claude-haiku-5-5",
            anthropic_fallback_models="",
            anthropic_effort="low",
        )
        patcher.start()
        self.addCleanup(patcher.stop)
        # No secondary provider, so Claude errors surface directly.
        openai = patch("app.ai.gemini_client.settings.openai_api_key", "")
        openai.start()
        self.addCleanup(openai.stop)

    async def generate(self, fake, **kwargs):
        with patch("app.ai.gemini_client.make_client", fake.make_client), \
                patch("app.ai.anthropic_provider.asyncio.sleep", AsyncMock()):
            client = GeminiClient(api_key="", anthropic_api_key="test-key")
            return await client.generate_with_image("Identify product", **kwargs)

    @staticmethod
    def success():
        return 200, message([thinking(), text('{"product_type":'), text('"hoodie"}')])

    async def test_data_uri_takes_priority_over_url_and_collects_answer_parts(self):
        fake = FakeClaude({"claude-haiku-5-5": [self.success()]})
        result = await self.generate(fake, image_data="data:image/png;base64,aGVsbG8=", image_url="https://expired.example/image")
        self.assertEqual(result, '{"product_type":"hoodie"}')
        image, prompt = fake.bodies[0]["messages"][0]["content"]
        self.assertEqual(image, {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": "aGVsbG8="}})
        self.assertEqual(prompt, {"type": "text", "text": "Identify product"})
        self.assertEqual(fake.bodies[0]["output_config"], {"effort": "low"})
        self.assertNotIn("temperature", fake.bodies[0])

    async def test_redirected_image_download(self):
        requests = []

        def handler(request):
            requests.append(request.url.path)
            if request.url.path == "/image":
                return httpx.Response(302, headers={"location": "/actual.png"})
            return httpx.Response(200, content=b"image bytes", headers={"content-type": "image/png; charset=binary"})

        client = httpx.AsyncClient(transport=httpx.MockTransport(handler), follow_redirects=True)
        with patch("app.services.remote_media.validate_remote_image_url", new=AsyncMock(side_effect=lambda url: url)), \
             patch("app.services.remote_media.httpx.AsyncClient", return_value=client):
            mime, data = await GeminiClient(api_key="test")._resolve_image("https://images.example/image", None, None)
        self.assertEqual(mime, "image/png")
        self.assertTrue(data)
        self.assertEqual(requests, ["/image", "/actual.png"])

    async def test_transient_failure_retried(self):
        fake = FakeClaude({"claude-haiku-5-5": [OVERLOADED, self.success()]})
        self.assertTrue(await self.generate(fake, image_data="aGVsbG8="))
        self.assertEqual(len(fake.bodies), 2)

    async def test_invalid_key_not_retried(self):
        import anthropic

        fake = FakeClaude({"claude-haiku-5-5": [(403, {"type": "error", "error": {"type": "permission_error", "message": "x"}})]})
        with self.assertRaises(anthropic.PermissionDeniedError):
            await self.generate(fake, image_data="aGVsbG8=")
        self.assertEqual(len(fake.bodies), 1)

    async def test_missing_model_output_is_not_used(self):
        fake = FakeClaude({"claude-haiku-5-5": [(200, message([thinking()]))]})
        with self.assertRaisesRegex(RuntimeError, "Invalid Claude vision response"):
            await self.generate(fake, image_data="aGVsbG8=")

    async def test_vision_falls_back_to_openai_when_claude_fails(self):
        fake = FakeClaude({"claude-haiku-5-5": [OVERLOADED, OVERLOADED]})
        with patch("app.ai.gemini_client.settings.openai_api_key", "sk-test"), \
                patch.object(GeminiClient, "_create_openai_response", AsyncMock(return_value="openai answer")) as openai:
            result = await self.generate(fake, image_data="aGVsbG8=")
        self.assertEqual(result, "openai answer")
        self.assertEqual(openai.await_args.args[1], "vision")

    async def test_text_generation_uses_claude(self):
        fake = FakeClaude({"claude-haiku-5-5": [(200, message([text("  parsed  ")]))]})
        with patch("app.ai.gemini_client.make_client", fake.make_client):
            result = await GeminiClient(api_key="", anthropic_api_key="k").generate_text("Parse this")
        self.assertEqual(result, "parsed")
        self.assertEqual(fake.bodies[0]["messages"], [{"role": "user", "content": [{"type": "text", "text": "Parse this"}]}])

    def test_embeddings_depend_only_on_the_gemini_key(self):
        self.assertFalse(GeminiClient(api_key="", anthropic_api_key="k").supports_embeddings)
        self.assertTrue(GeminiClient(api_key="g", anthropic_api_key="").supports_embeddings)


if __name__ == "__main__":
    unittest.main()
