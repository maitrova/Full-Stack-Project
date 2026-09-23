import asyncio
from datetime import datetime, timedelta, timezone
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.ai.sales_agent import SalesAgent
from app.repositories.ecommerce_product_repository import EcommerceProductRepository
from app.services.whatsapp_service import WhatsAppService


class ProductActions(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.products = [SimpleNamespace(id=str(i), name=f"Shirt {i}", images=[f"https://images.example/{i}/a.jpg", f"https://images.example/{i}/b.jpg"], attributes={"product_url": f"https://store.example/readymade/{i}"}) for i in range(1, 4)]
        self.agent = SalesAgent(None, None, None, SimpleNamespace(get_product_details=AsyncMock(side_effect=lambda b, p: next(x for x in self.products if x.id == p))))
        self.conversation = {"recommended_product_ids": ["1", "2", "3"]}

    async def test_link_clarification_then_selection(self):
        state = {}
        first = await self.agent._presentation_request("business", "send link", self.conversation, state)
        self.assertIn("Which product", first[0])
        second = await self.agent._presentation_request("business", "2", self.conversation, state)
        self.assertIn("https://store.example/readymade/2", second[0])
        self.assertEqual(state["selected_product_id"], "2")
        self.assertEqual(second[2], "none")

    async def test_gallery_selected_by_name(self):
        result = await self.agent._presentation_request("business", "photos of Shirt 2", self.conversation, {})
        self.assertEqual(result[1][0].id, "2")
        self.assertEqual(result[2], "gallery")

    async def test_new_photo_search_continues(self):
        result = await self.agent._presentation_request("business", "photos of black shirts", {}, {})
        self.assertIsNone(result)

    async def test_photo_request_does_not_claim_images_when_catalogue_has_none(self):
        products_without_images = [
            SimpleNamespace(id="1", name="Shirt 1", images=[], attributes={}),
            SimpleNamespace(id="2", name="Shirt 2", images=[], attributes={}),
        ]
        agent = SalesAgent(
            None,
            None,
            None,
            SimpleNamespace(
                get_product_details=AsyncMock(
                    side_effect=lambda business_id, product_id: next(
                        product for product in products_without_images if product.id == product_id
                    )
                )
            ),
        )

        result = await agent._presentation_request(
            "business",
            "show photos",
            {"recommended_product_ids": ["1", "2"]},
            {},
        )

        self.assertIn("don't have publicly accessible photos", result[0])
        self.assertEqual(result[1], [])
        self.assertEqual(result[2], "none")

    def test_uploaded_image_search_uses_visual_attributes(self):
        analysis = {"category": "shirt", "color": "blue", "fabric": "cotton"}
        search_text = self.agent._image_analysis_to_search_text(analysis)

        self.assertIn("shirt", search_text)
        self.assertIn("blue", search_text)
        self.assertIn("cotton", search_text)

    def test_captionless_whatsapp_image_is_processed(self):
        service = WhatsAppService.__new__(WhatsAppService)
        self.assertEqual(
            service._message_text({"type": "image", "image": {"id": "media-1", "mime_type": "image/jpeg"}}),
            "Photo enquiry",
        )

    async def test_whatsapp_image_media_is_downloaded(self):
        service = WhatsAppService.__new__(WhatsAppService)
        service.client = SimpleNamespace(
            get_media_as_base64=AsyncMock(return_value={"image_data": "encoded", "mime_type": "image/png"})
        )

        result = await service._message_image_payload(
            {"type": "image", "image": {"id": "media-1", "mime_type": "image/png"}}
        )

        self.assertEqual(result, {"image_data": "encoded", "mime_type": "image/png"})
        service.client.get_media_as_base64.assert_awaited_once_with("media-1", "image/png")

    async def test_numbered_images_and_gallery(self):
        service = WhatsAppService.__new__(WhatsAppService)
        service.client = SimpleNamespace(send_image=AsyncMock())
        service._product_image_caption = lambda p: p.name
        await service._send_recommended_product_images("test", self.products)
        self.assertEqual(service.client.send_image.await_count, 3)
        self.assertTrue(service.client.send_image.await_args_list[1].args[2].startswith("Option 2"))
        service.client.send_image.reset_mock()
        await service._send_recommended_product_images("test", self.products[1:2], gallery=True)
        self.assertEqual(service.client.send_image.await_count, 2)

    async def test_outbound_image_reply_resolves_exact_product(self):
        records = {}
        async def update_one(query, update, upsert=False):
            records[query["_id"]] = update["$set"]
        async def find_one(query):
            value = records.get(query["_id"])
            if value and value["recipient_hash"] == query["recipient_hash"] and value["expires_at"] > datetime.now(timezone.utc):
                return value
            return None
        service = WhatsAppService.__new__(WhatsAppService)
        service.outbound_context = SimpleNamespace(update_one=update_one, find_one=find_one)
        await service._remember_outbound_context({"messages": [{"id": "wamid.product"}]}, "91999", ["product-2"], "product_image")
        self.assertEqual(await service._quoted_product_id("wamid.product", "91999"), "product-2")
        self.assertIsNone(await service._quoted_product_id("wamid.product", "91888"))

    async def test_text_with_many_products_is_not_guessed(self):
        service = WhatsAppService.__new__(WhatsAppService)
        response = SimpleNamespace(
            ai_message=SimpleNamespace(content="Here are several good options."),
            recommended_products=self.products,
        )
        self.assertEqual(service._product_ids_mentioned(response), ["1", "2", "3"])

    def test_real_frontend_route(self):
        repo = EcommerceProductRepository.__new__(EcommerceProductRepository)
        with patch("app.repositories.ecommerce_product_repository.settings", SimpleNamespace(ecommerce_storefront_url="https://shop.example")):
            url = repo._product_url({"_id": "123", "title": "Blue & White Shirt"}, "Men", "Casual Shirts")
        self.assertEqual(url, "https://shop.example/products/men/casual-shirts/blue-and-white-shirt")


if __name__ == "__main__":
    unittest.main()
