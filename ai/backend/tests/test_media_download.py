import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
import httpx
from PIL import Image
from app.services.whatsapp_service import WhatsAppClient


class MediaDownloadTests(unittest.IsolatedAsyncioTestCase):
    async def test_local_product_image_is_uploaded_and_sent_by_media_id(self):
        requests = []

        def handler(request):
            requests.append(request)
            return httpx.Response(200, json={"messages": [{"id": "sent"}]})

        transport = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        client = WhatsAppClient(access_token="test", phone_number_id="phone")
        with (
            patch.object(client, "_local_product_image", return_value=Path("product.webp")),
            patch.object(client, "_upload_local_image", new=AsyncMock(return_value="media-id")),
            patch("app.services.whatsapp_service.httpx.AsyncClient", return_value=transport),
        ):
            await client.send_image("customer", "http://127.0.0.1:5000/api/outputs/product.webp")

        payload = __import__("json").loads(requests[0].content)
        self.assertEqual(payload["image"], {"id": "media-id"})

    async def test_production_webp_is_uploaded_and_sent_by_media_id(self):
        requests = []

        def handler(request):
            requests.append(request)
            return httpx.Response(200, json={"messages": [{"id": "sent"}]})

        transport = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        client = WhatsAppClient(access_token="test", phone_number_id="phone")
        with (
            patch.object(client, "_local_product_image", return_value=None),
            patch.object(client, "_upload_remote_image", new=AsyncMock(return_value="remote-media-id")),
            patch("app.services.whatsapp_service.httpx.AsyncClient", return_value=transport),
        ):
            await client.send_image("customer", "https://maitrova.in/api/outputs/product.webp")

        payload = __import__("json").loads(requests[0].content)
        self.assertEqual(payload["image"], {"id": "remote-media-id"})

    async def test_webp_catalogue_image_is_converted_to_jpeg_for_meta_upload(self):
        with TemporaryDirectory() as directory:
            image_path = Path(directory) / "product.webp"
            Image.new("RGBA", (20, 20), (255, 0, 0, 128)).save(image_path, "WEBP")

            def handler(request):
                self.assertIn("multipart/form-data", request.headers["content-type"])
                self.assertIn(b"image/jpeg", request.content)
                return httpx.Response(200, json={"id": "uploaded-media"})

            transport = httpx.AsyncClient(transport=httpx.MockTransport(handler))
            with patch("app.services.whatsapp_service.httpx.AsyncClient", return_value=transport):
                media_id = await WhatsAppClient(access_token="test", phone_number_id="phone")._upload_local_image(image_path)
            self.assertEqual(media_id, "uploaded-media")

    def test_local_output_path_cannot_escape_configured_directory(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            image = root / "products" / "item.png"
            image.parent.mkdir()
            image.write_bytes(b"image")
            client = WhatsAppClient(access_token="test", phone_number_id="phone")
            with patch("app.services.whatsapp_service.settings", SimpleNamespace(ecommerce_outputs_path=str(root))):
                resolved = client._local_product_image("http://localhost/api/outputs/products/item.png")
                escaped = client._local_product_image("http://localhost/api/outputs/../secret.txt")
            self.assertEqual(resolved, image.resolve())
            self.assertIsNone(escaped)

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
