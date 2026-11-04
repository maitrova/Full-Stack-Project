import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

from bson import ObjectId

from app.services.whatsapp_queue import enqueue, record_message_statuses
from app.services.whatsapp_service import WhatsAppService

TEST_DB = "appdb_w6_unittest"


def at(minute: int) -> str:
    return str(int(datetime(2026, 11, 4, 12, minute, tzinfo=timezone.utc).timestamp()))


def utc(minute: int) -> datetime:
    return datetime(2026, 11, 4, 12, minute)


class MessageStatusTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        from motor.motor_asyncio import AsyncIOMotorClient

        self.mongo = AsyncIOMotorClient("mongodb://127.0.0.1:27017", serverSelectionTimeoutMS=1500)
        try:
            await self.mongo.admin.command("ping")
        except Exception:
            self.mongo.close()
            self.skipTest("No local MongoDB on 127.0.0.1:27017")
        await self.mongo.drop_database(TEST_DB)
        self.db = self.mongo[TEST_DB]

    async def asyncTearDown(self):
        await self.mongo.drop_database(TEST_DB)
        self.mongo.close()

    async def row(self, message_id="wamid.1"):
        return await self.db.whatsapp_message_status.find_one({"_id": message_id})

    async def test_each_status_keeps_its_own_time(self):
        await record_message_statuses(self.db, [
            {"id": "wamid.1", "status": "sent", "timestamp": at(1)},
            {"id": "wamid.1", "status": "delivered", "timestamp": at(2)},
            {"id": "wamid.1", "status": "read", "timestamp": at(3)},
        ])
        row = await self.row()
        self.assertEqual((row["sent_at"], row["delivered_at"], row["read_at"]), (utc(1), utc(2), utc(3)))

    async def test_out_of_order_and_repeated_statuses_are_safe(self):
        await record_message_statuses(self.db, [
            {"id": "wamid.1", "status": "read", "timestamp": at(5)},
            {"id": "wamid.1", "status": "sent", "timestamp": at(1)},
            {"id": "wamid.1", "status": "read", "timestamp": at(9)},
        ])
        row = await self.row()
        self.assertEqual(row["read_at"], utc(5))
        self.assertEqual(row["sent_at"], utc(1))
        self.assertNotIn("delivered_at", row)

    async def test_failure_reason_is_kept_without_personal_data(self):
        await record_message_statuses(self.db, [{
            "id": "wamid.1", "status": "failed", "timestamp": at(1), "recipient_id": "919000011111",
            "errors": [{"code": 131047, "title": "Re-engagement message", "message": "919000011111 outside window"}],
        }])
        row = await self.row()
        self.assertEqual((row["error_code"], row["error_title"]), (131047, "Re-engagement message"))
        self.assertNotIn("919000011111", str(row))

    async def test_expiry_is_set_once_for_cleanup(self):
        await record_message_statuses(self.db, [{"id": "wamid.1", "status": "sent", "timestamp": at(1)}])
        first = (await self.row())["expires_at"]
        await record_message_statuses(self.db, [{"id": "wamid.1", "status": "read", "timestamp": at(2)}])
        self.assertEqual((await self.row())["expires_at"], first)
        self.assertGreater(first, datetime.now() + timedelta(days=170))

    async def test_unknown_statuses_and_bad_timestamps_do_not_break_the_rest(self):
        await record_message_statuses(self.db, [
            {"id": "wamid.1", "status": "deleted", "timestamp": at(1)},
            {"status": "read", "timestamp": at(1)},
            {"id": "wamid.2", "status": "read", "timestamp": "not-a-time"},
            {"id": "wamid.3", "status": "read", "timestamp": at(4)},
        ])
        self.assertIsNone(await self.row("wamid.1"))
        self.assertIsNotNone((await self.row("wamid.2"))["read_at"])
        self.assertEqual((await self.row("wamid.3"))["read_at"], utc(4))

    async def test_simultaneous_statuses_for_a_new_message_all_land(self):
        import asyncio

        await asyncio.gather(*[
            record_message_statuses(self.db, [{"id": "wamid.1", "status": status, "timestamp": at(index)}])
            for index, status in enumerate(["sent", "delivered", "read"])
        ])
        row = await self.row()
        self.assertEqual({key for key in row if key.endswith("_at") and key != "created_at" and key != "expires_at"},
                         {"sent_at", "delivered_at", "read_at"})

    async def test_webhook_records_statuses_and_still_queues_messages(self):
        payload = {"object": "whatsapp_business_account", "entry": [{"id": "e", "changes": [{"value": {
            "statuses": [{"id": "wamid.1", "status": "delivered", "timestamp": at(2)}],
            "messages": [{"id": "in.1", "from": "919000011111", "type": "text"}],
        }}]}]}
        self.assertEqual(await enqueue(self.db, payload), 1)
        self.assertEqual((await self.row())["delivered_at"], utc(2))
        self.assertIsNotNone(await self.db.whatsapp_jobs.find_one({"_id": "in.1"}))

    async def test_a_status_write_failure_does_not_stop_customer_messages(self):
        payload = {"object": "whatsapp_business_account", "entry": [{"id": "e", "changes": [{"value": {
            "statuses": [{"id": "wamid.1", "status": "delivered", "timestamp": at(2)}],
            "messages": [{"id": "in.2", "from": "919000011111", "type": "text"}],
        }}]}]}
        broken = SimpleNamespace(
            whatsapp_message_status=SimpleNamespace(update_one=AsyncMock(side_effect=RuntimeError("down"))),
            whatsapp_delivery_failures=self.db.whatsapp_delivery_failures,
            whatsapp_jobs=self.db.whatsapp_jobs,
        )
        self.assertEqual(await enqueue(broken, payload), 1)


class LinkOutboundMessageTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.service = WhatsAppService.__new__(WhatsAppService)
        self.update_one = AsyncMock()
        self.service.message_repository = SimpleNamespace(collection=SimpleNamespace(update_one=self.update_one))
        self.chat_id = str(ObjectId())
        self.response = SimpleNamespace(ai_message=SimpleNamespace(id=self.chat_id))

    async def test_ai_reply_is_linked_to_its_whatsapp_id(self):
        await self.service._link_outbound_message({"messages": [{"id": "wamid.ai"}]}, self.response)
        target, update = self.update_one.await_args.args
        self.assertEqual(target, {"_id": ObjectId(self.chat_id)})
        self.assertEqual(update, {"$set": {"metadata.whatsapp_message_id": "wamid.ai"}})

    async def test_nothing_is_written_without_a_whatsapp_id(self):
        await self.service._link_outbound_message({"messages": []}, self.response)
        await self.service._link_outbound_message({}, self.response)
        self.update_one.assert_not_awaited()

    async def test_a_link_failure_does_not_interrupt_delivery(self):
        self.update_one.side_effect = RuntimeError("down")
        await self.service._link_outbound_message({"messages": [{"id": "wamid.ai"}]}, self.response)

    async def test_deliver_links_the_message_it_sent(self):
        self.service.deliveries = SimpleNamespace(find_one=AsyncMock(return_value={}), update_one=AsyncMock())
        self.service._send_primary_response = AsyncMock(return_value=({"messages": [{"id": "wamid.ai"}]}, "text"))
        self.service._remember_outbound_context = AsyncMock()
        self.service._product_ids_mentioned = lambda response: []
        self.service._send_recommended_product_images = AsyncMock()
        response = SimpleNamespace(ai_message=SimpleNamespace(id=self.chat_id, metadata={"media_mode": "none"}), recommended_products=[])
        await self.service._deliver("919000011111", "in.1", response)
        self.assertEqual(self.update_one.await_args.args[1], {"$set": {"metadata.whatsapp_message_id": "wamid.ai"}})


if __name__ == "__main__":
    unittest.main()
