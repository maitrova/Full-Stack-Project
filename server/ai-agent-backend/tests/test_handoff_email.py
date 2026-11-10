import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from app.services import handoff_email
from tests import real_send


class NotifyAdminOfHandoffTest(unittest.IsolatedAsyncioTestCase):
    async def notify(self, result, conversation, key="secret", **kwargs):
        with patch.object(handoff_email, "_send", new=AsyncMock()) as send, \
                patch.object(handoff_email.settings, "whatsapp_commerce_key", key):
            handoff_email.notify_admin_of_handoff(result, conversation, "customer_asked", "Wants a person", "normal", **kwargs)
            for task in list(handoff_email._pending):
                await task
        return send

    async def test_new_alert_emails_with_whatsapp_number(self):
        send = await self.notify(SimpleNamespace(upserted_id="new"),
                                 {"channel": "whatsapp", "customer_name": "Ravi", "external_customer_ref": "919000011111"})
        payload = send.await_args.args[0]
        self.assertEqual(payload["contact"], "919000011111")
        self.assertEqual(payload["reason"], "customer_asked")

    async def test_existing_open_alert_does_not_email_again(self):
        send = await self.notify(SimpleNamespace(upserted_id=None), {"channel": "whatsapp"})
        send.assert_not_awaited()

    async def test_web_session_id_is_not_shown_as_contact(self):
        send = await self.notify(SimpleNamespace(upserted_id="new"), {"channel": "web", "external_customer_ref": "session-abc"})
        self.assertIsNone(send.await_args.args[0]["contact"])

    async def test_contact_given_in_chat_is_used_on_web(self):
        send = await self.notify(SimpleNamespace(upserted_id="new"), {"channel": "web"}, contact="ravi@example.com")
        self.assertEqual(send.await_args.args[0]["contact"], "ravi@example.com")

    async def test_email_message_and_order_are_sent(self):
        send = await self.notify(SimpleNamespace(upserted_id="new"), {"channel": "web", "customer_id": "u1"},
                                 contact="ravi@example.com", message="Where is order #44fe2a88? Talk to a person")
        payload = send.await_args.args[0]
        self.assertEqual(payload["email"], "ravi@example.com")
        self.assertIsNone(payload["phone"])
        self.assertEqual(payload["order_id"], "44FE2A88")
        self.assertEqual(payload["customer_id"], "u1")
        self.assertEqual(payload["customer_message"], "Where is order #44fe2a88? Talk to a person")

    async def test_order_falls_back_to_the_last_looked_up_order(self):
        send = await self.notify(SimpleNamespace(upserted_id="new"), {"channel": "web"}, contact="9000011111",
                                 message="please call me", state={"verified_order_ids": ["65f0aa11bb22cc3344fe2a88"]})
        payload = send.await_args.args[0]
        self.assertEqual(payload["phone"], "9000011111")
        self.assertEqual(payload["order_id"], "44FE2A88")

    async def test_plain_words_are_not_taken_as_order_numbers(self):
        send = await self.notify(SimpleNamespace(upserted_id="new"), {"channel": "whatsapp"}, message="deadbeef")
        self.assertIsNone(send.await_args.args[0]["order_id"])

    async def test_unconfigured_key_skips_quietly(self):
        send = await self.notify(SimpleNamespace(upserted_id="new"), {"channel": "whatsapp"}, key=None)
        send.assert_not_awaited()

    async def test_send_posts_to_the_store_with_the_shared_key(self):
        client = AsyncMock()
        client.__aenter__.return_value = client
        client.post.return_value = MagicMock(json=MagicMock(return_value={"sent": True}))
        with patch.object(handoff_email.httpx, "AsyncClient", return_value=client),                 patch.object(handoff_email.settings, "ecommerce_api_url", "https://shop.example/api/"),                 patch.object(handoff_email.settings, "whatsapp_commerce_key", "secret"):
            await real_send({"reason": "customer_asked"})
        self.assertEqual(client.post.await_args.args[0], "https://shop.example/api/whatsapp-commerce/handoff-email")
        self.assertEqual(client.post.await_args.kwargs["headers"], {"x-commerce-key": "secret"})

    async def test_store_error_never_reaches_the_chat(self):
        with patch.object(handoff_email.httpx, "AsyncClient", side_effect=handoff_email.httpx.ConnectError("down")):
            await real_send({"reason": "customer_asked"})


if __name__ == "__main__":
    unittest.main()
