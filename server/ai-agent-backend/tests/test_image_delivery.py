import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.services.whatsapp_service import WhatsAppService
from app.ai.product_image_analyzer import ProductImageAnalyzer


class ImageDeliveryTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.service = WhatsAppService.__new__(WhatsAppService)
        self.service.deliveries = SimpleNamespace(find_one=AsyncMock(return_value=None), update_one=AsyncMock())
        self.service.client = SimpleNamespace(send_text=AsyncMock(return_value={"messages": [{"id": "sent"}]}))
        self.service.sales_agent = SimpleNamespace(handle_external_chat=AsyncMock())
        self.service._message_image_payload = AsyncMock(return_value=None)
        self.service._load_business = AsyncMock(return_value={"_id": "business"})
        self.service._message_already_processed = AsyncMock(return_value=False)
        self.service._rate_limited = AsyncMock(return_value=False)
        self.service._quoted_product_id = AsyncMock(return_value=None)
        self.service._store_handoff_message_if_needed = AsyncMock(return_value=False)
        self.service.ecommerce_database = SimpleNamespace(whatsapp_order_subscriptions=SimpleNamespace(update_one=AsyncMock()))
        self.payload = {"object": "whatsapp_business_account", "entry": [{"changes": [{"value": {
            "messages": [{"id": "incoming", "from": "test", "type": "image", "image": {"id": "media"}}]
        }}]}]}

    async def run_webhook(self):
        with patch("app.services.whatsapp_service.settings", SimpleNamespace(whatsapp_phone_number_id=None)):
            return await self.service.handle_webhook(self.payload)

    async def test_failed_download_acknowledges_and_replies_without_text_only_ai(self):
        result = await self.run_webhook()
        self.assertEqual(result["processed"], 1)
        self.assertEqual(self.service.client.send_text.await_count, 2)
        self.assertIn("Thanks for the photo", self.service.client.send_text.await_args_list[0].args[1])
        self.assertIn("couldn't finish", self.service.client.send_text.await_args_list[1].args[1])
        self.service.sales_agent.handle_external_chat.assert_not_awaited()
        final = self.service.deliveries.update_one.await_args.args[1]["$set"]
        self.assertTrue(final["complete"])

    async def test_timed_out_processing_sends_recovery_reply(self):
        self.service._process_inbound_chat = AsyncMock(side_effect=TimeoutError)
        await self.run_webhook()
        self.assertEqual(self.service.client.send_text.await_count, 2)
        self.assertEqual(self.service.deliveries.update_one.await_args.args[1]["$set"]["processing_error"], "TimeoutError")

    async def test_successful_image_reaches_delivery(self):
        self.service._message_image_payload.return_value = {"image_data": "encoded", "mime_type": "image/png"}
        response = SimpleNamespace(model_dump=lambda **kwargs: {"response": "ok"})
        self.service.sales_agent.handle_external_chat.return_value = response
        self.service._deliver = AsyncMock()
        await self.run_webhook()
        self.service._deliver.assert_awaited_once_with("test", "incoming", response)
        self.assertEqual(self.service.sales_agent.handle_external_chat.await_args.kwargs["image_data"], "encoded")

    async def test_acknowledgement_not_repeated_on_retry(self):
        self.service.deliveries.find_one.return_value = {"image_ack_sent": True}
        await self.service._acknowledge_image("test", "incoming")
        self.service.client.send_text.assert_not_awaited()

    async def test_failed_outbound_reply_remains_retryable(self):
        self.service.client.send_text.return_value = None
        with self.assertRaises(RuntimeError):
            await self.service._send_image_failure("test", "incoming", "TimeoutError")
        self.service.deliveries.update_one.assert_not_awaited()

    async def test_handoff_remains_paused(self):
        self.service._store_handoff_message_if_needed.return_value = True
        await self.run_webhook()
        self.service.client.send_text.assert_not_awaited()

    async def test_optional_embedding_timeout_keeps_attribute_search_available(self):
        client = SimpleNamespace(is_configured=True, embed_content=AsyncMock(side_effect=TimeoutError))
        self.assertIsNone(await ProductImageAnalyzer(client).embed(image_data="encoded"))


if __name__ == "__main__":
    unittest.main()
