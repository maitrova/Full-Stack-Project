import unittest
from unittest.mock import AsyncMock, patch
import httpx
from app.services.whatsapp_service import WhatsAppClient


class MediaDownloadTests(unittest.IsolatedAsyncioTestCase):
    async def test_retries_both_metadata_and_image_without_losing_image_bytes(self):
        calls = []
        def handler(request):
            calls.append(request.url.path)
            count = calls.count(request.url.path)
            if count == 1:
                return httpx.Response(503)
            if request.url.path.endswith("/media"):
                return httpx.Response(200, json={"url": "https://media.example/photo", "mime_type": "image/png"})
            return httpx.Response(200, content=b"photo")
        client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        with patch("app.services.whatsapp_service.httpx.AsyncClient", return_value=client), patch("app.services.whatsapp_service.asyncio.sleep", new_callable=AsyncMock):
            result = await WhatsAppClient(access_token="test").get_media_as_base64("media")
        self.assertEqual(result, {"image_data": "cGhvdG8=", "mime_type": "image/png"})
        self.assertEqual(len(calls), 4)

    async def test_timeout_retries_but_auth_failure_does_not(self):
        response = httpx.Response(401)
        client = AsyncMock()
        client.get.side_effect = [httpx.ReadTimeout("timeout"), response]
        with patch("app.services.whatsapp_service.asyncio.sleep", new_callable=AsyncMock):
            result = await WhatsAppClient._get_media_with_retry(client, "https://media.example", {})
        self.assertIs(result, response)
        self.assertEqual(client.get.await_count, 2)
        client.get.reset_mock(side_effect=True)
        client.get.return_value = response
        self.assertIs(await WhatsAppClient._get_media_with_retry(client, "https://media.example", {}), response)
        self.assertEqual(client.get.await_count, 1)

    async def test_exhausted_transport_retries_raise(self):
        client = AsyncMock()
        client.get.side_effect = httpx.ReadTimeout("timeout")
        with patch("app.services.whatsapp_service.asyncio.sleep", new_callable=AsyncMock):
            with self.assertRaises(httpx.ReadTimeout):
                await WhatsAppClient._get_media_with_retry(client, "https://media.example", {})
        self.assertEqual(client.get.await_count, 2)
