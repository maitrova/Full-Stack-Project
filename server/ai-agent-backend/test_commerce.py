import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from datetime import datetime, timezone, timedelta

from app.services.whatsapp_commerce import WhatsAppCommerce
from app.repositories.ecommerce_product_repository import EcommerceProductRepository
from app.services.whatsapp_queue import enqueue


class CommerceTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.link_requests = SimpleNamespace(delete_many=AsyncMock(), insert_one=AsyncMock())
        self.link_rate_limits = SimpleNamespace(find_one_and_update=AsyncMock(return_value={"count": 1}))
        self.subscriptions = SimpleNamespace(update_many=AsyncMock())
        self.account_links = SimpleNamespace(delete_one=AsyncMock())
        self.service = WhatsAppCommerce(SimpleNamespace(
            whatsapp_link_requests=self.link_requests,
            whatsapp_link_rate_limits=self.link_rate_limits,
            whatsapp_order_subscriptions=self.subscriptions,
            whatsapp_account_links=self.account_links,
        ))
        self.service._linked = AsyncMock(return_value={"user": "customer"})
        self.service._request = AsyncMock(return_value=(201, {}))
        self.product = SimpleNamespace(id="p", name="White Shirt", currency="INR", attributes={"sizes": ["M"], "variants": [{"size": "M", "stock": 3, "effective_price": 120.0}]})
        self.tools = SimpleNamespace(get_product_details=AsyncMock(return_value=self.product))
        self.conv = {"external_customer_ref": "test", "selected_product_id": "p"}
        self.settings = patch("app.services.whatsapp_commerce.settings", SimpleNamespace(
            ecommerce_storefront_url="https://shop.example",
            whatsapp_checkout_links_per_hour=10,
        ))
        self.settings.start()
        self.addCleanup(self.settings.stop)

    async def test_cart_requires_explicit_confirmation(self):
        state = {}
        reply = await self.service.handle("buy size M quantity 2", self.conv, state, self.tools, "b")
        self.assertIn("Would you like me to add it", reply[0])
        self.service._request.assert_not_awaited()
        reply = await self.service.handle("confirm", self.conv, state, self.tools, "b")
        self.assertIn("it’s in your cart", reply[0])
        self.assertEqual(self.service._request.await_args.args[3]["quantity"], 2)
        self.assertNotIn("purchase", state)

    async def test_unlinked_order_does_not_query_orders(self):
        self.service._linked.return_value = None
        reply = await self.service.handle("my order status", self.conv, {}, self.tools, "b")
        self.assertIn("whatsapp-connect", reply[0])
        self.assertIn("token=", reply[0])
        self.link_requests.insert_one.assert_awaited_once()
        self.service._request.assert_not_awaited()

    async def test_unlinked_confirm_creates_one_tap_cart_handoff(self):
        self.service._linked.return_value = None
        state = {}
        await self.service.handle("buy M quantity 1", self.conv, state, self.tools, "b")

        reply = await self.service.handle("confirm", self.conv, state, self.tools, "b")

        self.assertIn("whatsapp-connect?token=", reply[0])
        request = self.link_requests.insert_one.await_args.args[0]
        self.assertEqual(request["purchase"]["product_id"], "p")
        self.assertEqual(request["purchase"]["quantity"], 1)
        self.assertEqual(request["return_path"], "/checkout")
        self.assertNotIn("purchase", state)
        self.service._request.assert_not_awaited()

    async def test_changed_price_requires_reconfirmation(self):
        state = {}
        await self.service.handle("buy M quantity 1", self.conv, state, self.tools, "b")
        self.product.attributes["variants"][0]["effective_price"] = 150
        reply = await self.service.handle("confirm", self.conv, state, self.tools, "b")
        self.assertIn("150", reply[0])
        self.service._request.assert_not_awaited()

    async def test_stock_limit(self):
        reply = await self.service.handle("buy M quantity 5", self.conv, {}, self.tools, "b")
        self.assertIn("available together", reply[0])
        self.service._request.assert_not_awaited()

    async def test_quantity_does_not_change_selected_product(self):
        self.conv["recommended_product_ids"] = ["p", "other"]
        state = {}
        await self.service.handle("buy M quantity 2", self.conv, state, self.tools, "b")
        self.assertEqual(state["purchase"]["product_id"], "p")

    async def test_bare_number_is_accepted_after_quantity_prompt(self):
        state = {}
        reply = await self.service.handle("buy M", self.conv, state, self.tools, "b")
        self.assertIn("How many would you like?", reply[0])

        reply = await self.service.handle("1", self.conv, state, self.tools, "b")

        self.assertIn("1 × White Shirt", reply[0])
        self.assertEqual(state["purchase"]["quantity"], 1)

    async def test_natural_language_quantity_is_accepted(self):
        for answer, expected in [
            ("I need only one", 1),
            ("two please", 2),
            ("a couple", 2),
            ("rendu kavali", 2),
            ("mujhe teen chahiye", 3),
            ("రెండు కావాలి", 2),
        ]:
            with self.subTest(answer=answer):
                state = {}
                await self.service.handle("buy M", self.conv, state, self.tools, "b")

                reply = await self.service.handle(answer, self.conv, state, self.tools, "b")

                self.assertIn(f"{expected} × White Shirt", reply[0])
                self.assertEqual(state["purchase"]["quantity"], expected)

    async def test_telugu_purchase_and_confirmation_use_secure_checkout(self):
        self.service._linked.return_value = None
        state = {}

        reply = await self.service.handle("Okay naku idi kavali", self.conv, state, self.tools, "b")
        self.assertIn("which size would you like?", reply[0])
        await self.service.handle("Yes M size", self.conv, state, self.tools, "b")
        await self.service.handle("one", self.conv, state, self.tools, "b")
        reply = await self.service.handle("Confirm chey", self.conv, state, self.tools, "b")

        self.assertIn("whatsapp-connect?token=", reply[0])
        self.assertNotIn("delivery", reply[0].lower())

    async def test_product_option_number_is_not_mistaken_for_quantity(self):
        self.conv.pop("selected_product_id", None)
        self.conv["recommended_product_ids"] = ["p", "other"]
        state = {}

        reply = await self.service.handle("buy option 1", self.conv, state, self.tools, "b")

        self.assertIn("which size would you like?", reply[0])
        self.assertNotIn("quantity", state["purchase"])

    def test_public_image_prefix_is_not_duplicated(self):
        repo = EcommerceProductRepository.__new__(EcommerceProductRepository)
        with patch("app.repositories.ecommerce_product_repository.settings", SimpleNamespace(ecommerce_public_url="https://maitrova.in/api/outputs")):
            for path in ["shirt.jpg", "/api/outputs/shirt.jpg", "outputs/shirt.jpg"]:
                self.assertEqual(repo._public_image_url(path), "https://maitrova.in/api/outputs/shirt.jpg")

    async def test_handoff(self):
        state = {}
        await self.service.handle("speak to staff", self.conv, state, self.tools, "b")
        self.assertTrue(state["handoff_requested"])

    async def test_stop_revokes_updates_and_account_access(self):
        state = {"purchase": {"quantity": 1}}

        reply = await self.service.handle("STOP", self.conv, state, self.tools, "b")

        self.assertIn("turned off", reply[0])
        self.subscriptions.update_many.assert_awaited_once()
        self.account_links.delete_one.assert_awaited_once()
        self.assertNotIn("purchase", state)

    async def test_payment_question_never_collects_payment_secrets(self):
        reply = await self.service.handle("Can I pay by UPI here?", self.conv, {}, self.tools, "b")
        self.assertIn("securely", reply[0])
        self.assertIn("Never send", reply[0])

    async def test_retry_checkout_revalidates_and_creates_fresh_operation(self):
        previous = {"product_id": "p", "size": "M", "quantity": 1, "expected_price": 100, "operation_id": "old"}
        state = {"last_checkout_purchase": previous}

        reply = await self.service.handle("send link again", self.conv, state, self.tools, "b")

        self.assertIn("whatsapp-connect?token=", reply[0])
        refreshed = self.link_requests.insert_one.await_args.args[0]["purchase"]
        self.assertEqual(refreshed["expected_price"], 120.0)
        self.assertNotEqual(refreshed["operation_id"], "old")

    async def test_queue_splits_messages(self):
        collection = SimpleNamespace(insert_one=AsyncMock())
        payload = {"object": "whatsapp_business_account", "entry": [{"changes": [{"value": {"messages": [{"id": "a", "from": "test"}, {"id": "b", "from": "test"}]}}]}]}
        count = await enqueue(SimpleNamespace(whatsapp_jobs=collection), payload)
        self.assertEqual(count, 2)
        self.assertEqual(collection.insert_one.await_args.args[0]["_id"], "b")

    def test_expired_sale_not_used(self):
        repo = EcommerceProductRepository.__new__(EcommerceProductRepository)
        self.assertIsNone(repo._active_sale_price({"price": 200, "salePrice": 100, "saleEndAt": datetime.now(timezone.utc) - timedelta(days=1)}))
        self.assertIsNone(repo._active_sale_price({"price": 200, "salePrice": 300}))


if __name__ == "__main__":
    unittest.main()
