import asyncio
from datetime import datetime, timedelta, timezone
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from bson import ObjectId

from app.ai.product_image_analyzer import ProductImageAnalyzer
from app.ai.sales_agent import SalesAgent
from app.repositories.ecommerce_product_repository import EcommerceProductRepository
from app.schemas.ai import IntentResult
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

    def test_image_availability_question_reuses_image_context(self):
        self.assertTrue(self.agent._is_image_reference_question("Do u have this"))
        self.assertTrue(self.agent._is_image_reference_question("U have this one"))
        self.assertTrue(self.agent._is_image_reference_question("Is it available?"))
        self.assertFalse(self.agent._is_image_reference_question("show this one"))

    async def test_image_analyzer_uses_live_catalogue_categories(self):
        client = SimpleNamespace(
            is_configured=True,
            generate_with_image=AsyncMock(
                return_value='{"category":"Mens Hoodies","product_type":"hoodie","confidence":0.96}'
            ),
        )
        analyzer = ProductImageAnalyzer(client)

        result = await analyzer.analyze(
            image_data="encoded",
            mime_type="image/jpeg",
            catalog_categories=["Mens Hoodies", "Women Crop Tops"],
        )

        prompt = client.generate_with_image.await_args.kwargs["prompt"]
        self.assertIn('"Mens Hoodies"', prompt)
        self.assertIn('"Women Crop Tops"', prompt)
        self.assertEqual(result["category"], "Mens Hoodies")

    async def test_catalogue_categories_only_include_active_product_categories(self):
        cursor = SimpleNamespace(to_list=AsyncMock(return_value=[{"name": "Mens Hoodies"}, {"name": "T-Shirts"}]))
        database = SimpleNamespace(
            readymadeproducts=SimpleNamespace(distinct=AsyncMock(return_value=["hoodie-id", "shirt-id"])),
            categories=SimpleNamespace(find=Mock(return_value=cursor)),
        )
        agent = SalesAgent(None, None, None, self.agent.product_tools, commerce=SimpleNamespace(db=database))

        categories = await agent._catalog_category_names()

        self.assertEqual(categories, ["Mens Hoodies", "T-Shirts"])

    async def test_image_search_does_not_fall_back_to_unrelated_categories(self):
        search_products = AsyncMock(side_effect=[[], [], self.products])
        agent = SalesAgent(None, None, None, SimpleNamespace(search_products=search_products))

        products, _ = await agent._search_relaxed_options(
            "business",
            IntentResult(intent="product_search", category="hoodie", color="black"),
            allow_other_categories=False,
        )

        self.assertEqual(products, [])
        self.assertEqual(search_products.await_count, 2)

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

    def test_drop_product_is_normalized_into_searchable_catalogue(self):
        repo = EcommerceProductRepository.__new__(EcommerceProductRepository)
        document = {
            "_id": ObjectId(),
            "name": "Limited Black Hoodie",
            "category": "Hoodies",
            "subCategory": "Limited Drop",
            "images": [{"url": "drop.jpg"}],
            "variants": [{"size": "M", "price": 1299, "stock": 4, "sku": "DROP-M"}],
            "minPrice": 1299,
        }
        with patch(
            "app.repositories.ecommerce_product_repository.settings",
            SimpleNamespace(
                ecommerce_public_url="https://shop.example/api/outputs",
                ecommerce_storefront_url="https://shop.example",
            ),
        ):
            product = repo._normalize_drop(document, str(ObjectId()))

        self.assertEqual(product["attributes"]["source_type"], "drop")
        self.assertEqual(product["attributes"]["product_url"], f"https://shop.example/dropproducts/{document['_id']}")
        self.assertTrue(repo._matches(product, {"category": "hoodie", "attributes": {"catalog_type": "drop product"}}))

    def test_customization_product_contains_designer_details(self):
        repo = EcommerceProductRepository.__new__(EcommerceProductRepository)
        document = {
            "_id": ObjectId(),
            "name": "Custom Oversized T-Shirt",
            "slug": "custom-oversized-t-shirt",
            "category": "apparel",
            "subCategory": "T-Shirts",
            "basePrice": 699,
            "currency": "INR",
            "colors": [{"label": "Black", "value": "#000000"}],
            "sizePricing": [{"size": "M", "price": 799, "stock": 8}],
            "views": [{"mockupUrl": "custom-front.png"}],
        }
        with patch(
            "app.repositories.ecommerce_product_repository.settings",
            SimpleNamespace(
                ecommerce_public_url="https://shop.example/api/outputs",
                ecommerce_storefront_url="https://shop.example",
            ),
        ):
            product = repo._normalize_customization(document, str(ObjectId()))

        self.assertTrue(product["attributes"]["customizable"])
        self.assertIn("add your own images and text", product["description"])
        self.assertEqual(
            product["attributes"]["product_url"],
            "https://shop.example/products/custom-oversized-t-shirt/customize",
        )
        self.assertTrue(repo._matches(product, {"attributes": {"catalog_type": "customization"}}))


if __name__ == "__main__":
    unittest.main()
