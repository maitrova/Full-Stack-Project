import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from bson import ObjectId

from app.services import whatsapp_followup
from app.services.whatsapp_service import WhatsAppService
from app.services.whatsapp_followup import (
    WhatsAppFollowups,
    followup_text,
    is_opt_out,
    record_opt_out,
    within_send_hours,
)

TEST_DB = "appdb_followup_unittest"
TEST_STORE_DB = "appdb_followup_store_unittest"
PHONE = "919000011111"
PRODUCT_ID = str(ObjectId())
# 12:00 IST, inside sending hours.
NOW = datetime(2026, 11, 4, 6, 30, tzinfo=timezone.utc)


class FakeSender:
    is_configured = True

    def __init__(self, error=None):
        self.texts, self.error = [], error

    async def send_text(self, to, body, reply_to_message_id=None):
        if self.error:
            raise self.error
        self.texts.append((to, body))
        return {"messages": [{"id": "wamid.followup"}]}


class FakeTools:
    def __init__(self, stock=5):
        self.stock = stock

    async def check_stock(self, business_id, product_id):
        product = SimpleNamespace(id=product_id, name="Black Oversized Shirt",
                                  attributes={"product_url": "https://maitrova.in/p/black-shirt"})
        return {"available": self.stock > 0, "stock": self.stock, "product": product}


class PureRulesTests(unittest.TestCase):
    def test_only_a_whole_stop_message_opts_out(self):
        for text in ("STOP", " stop. ", "Unsubscribe", "opt out"):
            self.assertTrue(is_opt_out(text), text)
        for text in ("don't stop showing me shirts", "hello", "", None):
            self.assertFalse(is_opt_out(text), text)

    def test_send_hours_use_india_time(self):
        self.assertTrue(within_send_hours(datetime(2026, 11, 4, 6, 30, tzinfo=timezone.utc)))  # 12:00 IST
        self.assertFalse(within_send_hours(datetime(2026, 11, 4, 20, 0, tzinfo=timezone.utc)))  # 01:30 IST

    def test_text_uses_customer_language_and_always_explains_stop(self):
        self.assertIn("inka available lo undi", followup_text("Roman Telugu", "Shirt", None))
        for language in ("English", "Roman Telugu", "Telugu", "Hinglish", "Hindi", "Klingon", None):
            self.assertIn("STOP", followup_text(language, "Shirt", "https://x.example"))
            self.assertIn("https://x.example", followup_text(language, "Shirt", "https://x.example"))


class FollowupFlowTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        from motor.motor_asyncio import AsyncIOMotorClient

        self.mongo = AsyncIOMotorClient("mongodb://127.0.0.1:27017", serverSelectionTimeoutMS=1500)
        try:
            await self.mongo.admin.command("ping")
        except Exception:
            self.mongo.close()
            self.skipTest("local MongoDB is not running")
        await self.mongo.drop_database(TEST_DB)
        await self.mongo.drop_database(TEST_STORE_DB)
        self.db, self.store = self.mongo[TEST_DB], self.mongo[TEST_STORE_DB]
        self.business_id = ObjectId()
        patches = [
            patch.object(whatsapp_followup.settings, "whatsapp_followup_mode", "on"),
            patch.object(whatsapp_followup.settings, "whatsapp_followup_allowlist", ""),
            patch.object(whatsapp_followup.settings, "whatsapp_followup_delay_hours", 4),
        ]
        for item in patches:
            item.start()
            self.addCleanup(item.stop)

    async def asyncTearDown(self):
        await self.mongo.drop_database(TEST_DB)
        await self.mongo.drop_database(TEST_STORE_DB)
        self.mongo.close()

    def followups(self, sender=None, stock=5):
        self.sender = sender or FakeSender()
        return WhatsAppFollowups(self.db, self.store, FakeTools(stock), SimpleNamespace(db=self.store), self.sender)

    async def chat(self, hours_ago=5, message="show me black shirts", **fields):
        at = NOW - timedelta(hours=hours_ago)
        conversation = {
            "_id": ObjectId(), "business_id": self.business_id, "channel": "whatsapp", "status": "open",
            "external_customer_ref": PHONE, "current_intent": "product_search", "last_message_at": at,
            "conversation_state": {"reply_language": {"language": "Roman Telugu"}, "recent_turns": []},
            **fields,
        }
        await self.db.conversations.insert_one(conversation)
        await self.db.messages.insert_many([
            {"conversation_id": conversation["_id"], "sender": "customer", "content": message, "created_at": at},
            {"conversation_id": conversation["_id"], "sender": "ai", "content": "Here you go", "created_at": at,
             "metadata": {"recommended_product_ids": [PRODUCT_ID]}},
        ])
        return conversation

    async def test_quiet_shopper_gets_one_follow_up_with_context_for_their_reply(self):
        conversation = await self.chat()
        followups = self.followups()
        self.assertEqual(await followups.run_once(NOW), 1)
        self.assertEqual(self.sender.texts[0][0], PHONE)
        self.assertIn("Black Oversized Shirt", self.sender.texts[0][1])
        self.assertIn("https://maitrova.in/p/black-shirt", self.sender.texts[0][1])

        saved = await self.db.conversations.find_one({"_id": conversation["_id"]})
        self.assertEqual(saved["followup_status"], "sent")
        self.assertEqual(saved["selected_product_id"], PRODUCT_ID)
        self.assertEqual(saved["conversation_state"]["selected_product_id"], PRODUCT_ID)
        self.assertEqual(saved["conversation_state"]["recent_turns"][-1]["reply"], self.sender.texts[0][1])
        stored = await self.db.messages.find_one({"conversation_id": conversation["_id"], "metadata.source": "follow_up"})
        self.assertEqual(stored["content"], self.sender.texts[0][1])

        # Later cycles, even once the cooldown's chat filter window has moved on, stay silent.
        self.assertEqual(await followups.run_once(NOW + timedelta(minutes=5)), 0)
        self.assertEqual(await followups.run_once(NOW + timedelta(hours=5)), 0)
        self.assertEqual(len(self.sender.texts), 1)

    async def assert_no_message(self, followups=None):
        followups = followups or self.followups()
        self.assertEqual(await followups.run_once(NOW), 0)
        self.assertEqual(self.sender.texts, [])

    async def test_too_soon_and_too_late_are_skipped(self):
        await self.chat(hours_ago=2)
        await self.assert_no_message()
        await self.db.conversations.delete_many({})
        await self.chat(hours_ago=23)
        await self.assert_no_message()

    async def test_outside_send_hours_waits(self):
        await self.chat()
        followups = self.followups()
        self.assertEqual(await followups.run_once(datetime(2026, 11, 4, 20, 0, tzinfo=timezone.utc)), 0)
        self.assertEqual(self.sender.texts, [])

    async def test_off_mode_sends_nothing(self):
        await self.chat()
        with patch.object(whatsapp_followup.settings, "whatsapp_followup_mode", "off"):
            await self.assert_no_message()

    async def test_allowlist_mode_only_reaches_listed_numbers(self):
        await self.chat()
        with patch.object(whatsapp_followup.settings, "whatsapp_followup_mode", "allowlist"):
            await self.assert_no_message()
            with patch.object(whatsapp_followup.settings, "whatsapp_followup_allowlist", "9000011111"):
                self.assertEqual(await self.followups().run_once(NOW), 1)

    async def test_stop_blocks_follow_ups_for_this_number(self):
        await self.chat()
        await record_opt_out(self.db, self.business_id, PHONE)
        await self.assert_no_message()
        saved = await self.db.whatsapp_followup_optouts.find_one({})
        self.assertNotIn(PHONE, str(saved))

    async def test_stop_message_through_the_webhook_blocks_follow_ups(self):
        await self.chat()
        service = WhatsAppService.__new__(WhatsAppService)
        service.conversation_repository = SimpleNamespace(collection=SimpleNamespace(database=self.db))
        service.deliveries = SimpleNamespace(find_one=AsyncMock(return_value=None), update_one=AsyncMock())
        service.ecommerce_database = SimpleNamespace(whatsapp_order_subscriptions=SimpleNamespace(update_one=AsyncMock()))
        service._load_business = AsyncMock(return_value={"_id": self.business_id})
        service._message_already_processed = AsyncMock(return_value=False)
        service._rate_limited = AsyncMock(return_value=False)
        service._quoted_product_id = AsyncMock(return_value=None)
        service._store_handoff_message_if_needed = AsyncMock(return_value=True)
        with patch("app.services.whatsapp_service.settings", SimpleNamespace(whatsapp_phone_number_id=None)):
            await service.handle_webhook({"object": "whatsapp_business_account", "entry": [{"changes": [{"value": {
                "messages": [{"id": "wamid.stop", "from": PHONE, "type": "text", "text": {"body": "STOP"}}],
            }}]}]})
        self.assertEqual(await self.db.whatsapp_followup_optouts.count_documents({}), 1)
        await self.assert_no_message()

    async def test_handoff_status_and_unclaimed_alert_are_skipped(self):
        await self.chat(status="handoff")
        await self.assert_no_message()
        await self.db.conversations.delete_many({})
        conversation = await self.chat()
        await self.db.whatsapp_handoff_alerts.insert_one({"conversation_id": conversation["_id"], "status": "open"})
        await self.assert_no_message()

    async def test_order_or_support_chat_is_skipped(self):
        await self.chat(current_intent="order_tracking")
        await self.assert_no_message()

    async def test_customer_who_declined_is_skipped(self):
        for message in ("no thanks", "vaddu", "No.", "నాకు వద్దు"):
            await self.db.conversations.delete_many({})
            await self.db.messages.delete_many({})
            await self.chat(message=message)
            await self.assert_no_message()

    async def test_out_of_stock_product_is_skipped(self):
        await self.chat()
        await self.assert_no_message(self.followups(stock=0))

    async def test_no_product_shown_in_this_session_is_skipped(self):
        conversation = await self.chat()
        await self.db.messages.update_many(
            {"conversation_id": conversation["_id"], "sender": "ai"},
            {"$set": {"created_at": NOW - timedelta(days=20)}},
        )
        await self.assert_no_message()

    async def test_customer_who_ordered_since_is_skipped(self):
        await self.chat()
        user_id = ObjectId()
        await self.store.users.insert_one({"_id": user_id, "phone": PHONE})
        await self.store.orders.insert_one({"user": user_id, "createdAt": NOW - timedelta(hours=1)})
        await self.assert_no_message()

    async def test_older_order_does_not_block(self):
        await self.chat()
        user_id = ObjectId()
        await self.store.users.insert_one({"_id": user_id, "phone": PHONE})
        await self.store.orders.insert_one({"user": user_id, "createdAt": NOW - timedelta(days=30)})
        self.assertEqual(await self.followups().run_once(NOW), 1)

    async def test_failed_send_is_recorded_and_never_retried(self):
        conversation = await self.chat()
        followups = self.followups(FakeSender(error=RuntimeError("meta down")))
        self.assertEqual(await followups.run_once(NOW), 0)
        saved = await self.db.conversations.find_one({"_id": conversation["_id"]})
        self.assertEqual(saved["followup_status"], "failed")

        working = self.followups()
        self.assertEqual(await working.run_once(NOW + timedelta(minutes=5)), 0)
        self.assertEqual(self.sender.texts, [])

    async def test_two_workers_cannot_both_send(self):
        conversation = await self.chat()
        followups = self.followups()
        stale_copy = dict(conversation)
        self.assertTrue(await followups._follow_up(stale_copy, NOW))
        self.assertFalse(await followups._follow_up(stale_copy, NOW))
        self.assertEqual(len(self.sender.texts), 1)

    async def test_cooldown_allows_a_new_follow_up_after_a_week(self):
        await self.chat(followup_sent_at=NOW - timedelta(days=8))
        self.assertEqual(await self.followups().run_once(NOW), 1)
        await self.db.conversations.delete_many({})
        await self.chat(followup_sent_at=NOW - timedelta(days=2))
        await self.assert_no_message()


if __name__ == "__main__":
    unittest.main()
