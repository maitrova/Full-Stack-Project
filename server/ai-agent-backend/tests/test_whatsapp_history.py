"""Everything sent to a customer on WhatsApp must also appear in the admin inbox."""

import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from bson import ObjectId

from app.repositories.message_repository import MessageRepository
from app.services.whatsapp_history import outbound_message_id, record_outbound_notice
from app.services.whatsapp_outbound import WhatsAppOutbound, order_update_text
from app.services.whatsapp_service import IMAGE_ACK_TEXT, IMAGE_FAILURE_TEXT, WhatsAppService

TEST_DB = "appdb_history_unittest"
PHONE = "919000022222"


class Sender:
    """Records what would have gone to WhatsApp and returns Meta-style ids."""

    def __init__(self):
        self.sent = []

    def _ok(self, kind, *details):
        self.sent.append((kind, *details))
        return {"messages": [{"id": f"wamid.{kind}.{len(self.sent)}"}]}

    async def send_text(self, to, body, reply_to_message_id=None):
        return self._ok("text", body)

    async def send_reply_buttons(self, to, body, titles, reply_to_message_id=None):
        return self._ok("buttons", titles)

    async def send_option_list(self, to, body, products, reply_to_message_id=None):
        return self._ok("list", [p.name for p in products])

    async def send_image(self, to, image_url, caption=None, reply_to_message_id=None):
        return self._ok("image", image_url)

    async def send_template(self, to, name, language, parameters):
        return self._ok("template", name)


def tee(name, image):
    return SimpleNamespace(id=str(ObjectId()), name=name, images=[image], attributes={})


class HistoryTests(unittest.IsolatedAsyncioTestCase):
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
        self.business_id = ObjectId()
        self.chat_id = ObjectId()
        await self.db.conversations.insert_one({
            "_id": self.chat_id, "business_id": self.business_id, "channel": "whatsapp",
            "external_customer_ref": PHONE, "status": "open", "last_message_at": datetime.now(timezone.utc),
        })
        self.service = WhatsAppService.__new__(WhatsAppService)
        self.service.client = Sender()
        self.service.message_repository = MessageRepository(self.db)
        self.service.deliveries = self.db.whatsapp_deliveries
        self.service.outbound_context = self.db.whatsapp_outbound_context
        # The webhook creates this record before any reply is sent.
        await self.db.whatsapp_deliveries.insert_one({"_id": "wamid.in", "inbound_messages": 1, "outbound_messages": 0})

    async def asyncTearDown(self):
        await self.mongo.drop_database(TEST_DB)
        self.mongo.close()

    async def messages(self):
        return await self.db.messages.find({"conversation_id": self.chat_id}).sort("created_at", 1).to_list(None)

    async def ai_reply(self, content, **metadata):
        created = await self.service.message_repository.create_message(
            business_id=str(self.business_id), conversation_id=str(self.chat_id), customer_id=None,
            payload={"sender": "ai", "content": content, "metadata": metadata},
        )
        return SimpleNamespace(
            ai_message=SimpleNamespace(id=str(created["_id"]), content=content, metadata=metadata),
            conversation=SimpleNamespace(conversation_state={}),
        )

    async def test_notice_sits_right_after_the_customer_message_it_answers(self):
        sent_at = datetime.now(timezone.utc)
        customer_at = sent_at + timedelta(seconds=5)  # the photo is saved after the acknowledgement goes out
        await self.db.messages.insert_one({
            "conversation_id": self.chat_id, "sender": "customer", "content": "Photo enquiry",
            "metadata": {"whatsapp_message_id": "wamid.in"}, "created_at": customer_at,
        })
        await self.db.messages.insert_one({
            "conversation_id": self.chat_id, "sender": "ai", "content": "That's our Classic Tee.",
            "metadata": {}, "created_at": customer_at + timedelta(seconds=20),
        })
        await record_outbound_notice(self.db, PHONE, IMAGE_ACK_TEXT, {"messages": [{"id": "wamid.ack"}]},
                                     "photo_received", after_whatsapp_message_id="wamid.in")
        order = [message["content"] for message in await self.messages()]
        self.assertEqual(order, ["Photo enquiry", IMAGE_ACK_TEXT, "That's our Classic Tee."])
        notice = (await self.messages())[1]
        self.assertEqual(notice["metadata"], {"system_notice": "photo_received", "whatsapp_message_id": "wamid.ack"})
        self.assertEqual(notice["business_id"], self.business_id)

    async def test_nothing_is_recorded_when_unsent_or_for_an_unknown_number(self):
        await record_outbound_notice(self.db, PHONE, "Hi", None, "rate_limited")
        await record_outbound_notice(self.db, "910000000000", "Hi", {"messages": [{"id": "x"}]}, "rate_limited")
        self.assertEqual(await self.messages(), [])

    async def test_a_recording_failure_never_reaches_the_customer_flow(self):
        broken = SimpleNamespace(conversations=SimpleNamespace(find_one=AsyncMock(side_effect=RuntimeError("down"))))
        await record_outbound_notice(broken, PHONE, "Hi", {"messages": [{"id": "x"}]}, "rate_limited")

    async def test_buttons_and_product_photos_are_kept_on_the_reply(self):
        products = [tee("Classic Tee", "https://cdn.test/classic.jpg"), tee("Oversized Tee", "https://cdn.test/over.jpg")]
        response = await self.ai_reply("Which one would you like? Reply with an option.", media_mode="recommendations")
        response.recommended_products = products
        self.service._product_image_caption = lambda product: product.name
        await self.service._deliver(PHONE, "wamid.in", response)

        reply = (await self.messages())[0]
        self.assertEqual(reply["metadata"]["whatsapp_interactive"], {"type": "buttons", "choices": ["Option 1", "Option 2"]})
        images = reply["metadata"]["whatsapp_images"]
        self.assertEqual([image["url"] for image in images], ["https://cdn.test/classic.jpg", "https://cdn.test/over.jpg"])
        self.assertEqual(images[1]["caption"], "Option 2\nOversized Tee")
        self.assertTrue(all(image["whatsapp_message_id"].startswith("wamid.image") for image in images))
        self.assertEqual(images[0]["product_id"], products[0].id)

    async def test_a_list_reply_keeps_each_option_with_its_product(self):
        products = [tee(f"Tee {n}", f"https://cdn.test/{n}.jpg") for n in range(1, 5)]
        response = await self.ai_reply("Choose an option from the list.", media_mode="none")
        response.recommended_products = products
        await self.service._deliver(PHONE, "wamid.in", response)
        reply = (await self.messages())[0]
        self.assertEqual(reply["metadata"]["whatsapp_interactive"]["type"], "list")
        self.assertEqual(reply["metadata"]["whatsapp_interactive"]["choices"][3], "Option 4 · Tee 4")
        self.assertEqual(reply["metadata"]["whatsapp_images"], [])

    async def test_plain_text_reply_records_an_empty_photo_list_and_no_buttons(self):
        response = await self.ai_reply("Our store opens at 10am.", media_mode="none")
        response.recommended_products = []
        await self.service._deliver(PHONE, "wamid.in", response)
        reply = (await self.messages())[0]
        self.assertEqual(reply["metadata"]["whatsapp_images"], [])
        self.assertNotIn("whatsapp_interactive", reply["metadata"])

    async def test_designs_answer_sends_sample_designs_as_photos_and_keeps_them(self):
        previews = [
            {"name": f"Design {n}", "image": f"/outputs/adminuploadeddesigns/gym/{n}.webp",
             "url": "https://www.maitrova.in/products/classic-round-tee/customize?collection=gym", "collection": "Gym"}
            for n in range(6)
        ]
        previews[1]["image"] = ""  # a design without a picture is skipped
        response = await self.ai_reply("Here's our design library.", media_mode="none", design_previews=previews)
        response.recommended_products = []
        public = SimpleNamespace(ecommerce_public_url="https://maitrova.in/api/outputs", ecommerce_storefront_url=None)
        with patch("app.repositories.ecommerce_product_repository.settings", public):
            await self.service._deliver(PHONE, "wamid.in", response)
            sent_before = len(self.service.client.sent)
            await self.service._send_design_previews(PHONE, previews, delivery_id="wamid.in")  # a retry
        images = [item for item in self.service.client.sent if item[0] == "image"]
        self.assertEqual([url for _, url in images], [
            f"https://maitrova.in/api/outputs/adminuploadeddesigns/gym/{n}.webp" for n in (0, 2, 3)
        ])
        self.assertEqual(len(self.service.client.sent), sent_before, "a retry must not resend samples")
        recorded = (await self.messages())[0]["metadata"]["whatsapp_images"]
        self.assertEqual(len(recorded), 3)
        self.assertEqual(recorded[0]["caption"].splitlines(), [
            "Design 0", "Collection: Gym",
            "Try it in the designer: https://www.maitrova.in/products/classic-round-tee/customize?collection=gym",
        ])

    async def test_a_failing_design_sample_does_not_fail_the_reply(self):
        self.service.client.send_image = AsyncMock(side_effect=RuntimeError("meta down"))
        response = await self.ai_reply("Here's our design library.", media_mode="none", design_previews=[
            {"name": "D", "image": "https://cdn.test/d.webp", "url": "https://x.test"},
        ])
        response.recommended_products = []
        await self.service._deliver(PHONE, "wamid.in", response)
        delivery = await self.db.whatsapp_deliveries.find_one({"_id": "wamid.in"})
        self.assertTrue(delivery["complete"])

    async def test_failed_photo_check_shows_both_messages_the_customer_got(self):
        self.service.sales_agent = SimpleNamespace(handle_external_chat=AsyncMock())
        self.service._message_image_payload = AsyncMock(return_value=None)
        self.service._load_business = AsyncMock(return_value={"_id": self.business_id})
        self.service._message_already_processed = AsyncMock(return_value=False)
        self.service._rate_limited = AsyncMock(return_value=False)
        self.service._quoted_product_id = AsyncMock(return_value=None)
        self.service._store_handoff_message_if_needed = AsyncMock(return_value=False)
        self.service._show_typing = AsyncMock()
        self.service.ecommerce_database = SimpleNamespace(whatsapp_order_subscriptions=SimpleNamespace(update_one=AsyncMock()))
        payload = {"object": "whatsapp_business_account", "entry": [{"changes": [{"value": {
            "messages": [{"id": "wamid.photo", "from": PHONE, "type": "image", "image": {"id": "media"}}],
        }}]}]}
        with patch("app.services.whatsapp_service.settings", SimpleNamespace(whatsapp_phone_number_id=None)):
            await self.service.handle_webhook(payload)
        notices = [(message["metadata"]["system_notice"], message["content"]) for message in await self.messages()]
        self.assertEqual(notices, [("photo_received", IMAGE_ACK_TEXT), ("photo_check_failed", IMAGE_FAILURE_TEXT)])

    async def test_rate_limit_notice_is_recorded(self):
        self.service._load_business = AsyncMock(return_value={"_id": self.business_id})
        self.service._message_already_processed = AsyncMock(return_value=False)
        self.service._rate_limited = AsyncMock(return_value=True)
        self.service.ecommerce_database = SimpleNamespace(whatsapp_order_subscriptions=SimpleNamespace(update_one=AsyncMock()))
        payload = {"object": "whatsapp_business_account", "entry": [{"changes": [{"value": {
            "messages": [{"id": "wamid.fast", "from": PHONE, "type": "text", "text": {"body": "hi"}}],
        }}]}]}
        with patch("app.services.whatsapp_service.settings", SimpleNamespace(whatsapp_phone_number_id=None)):
            await self.service.handle_webhook(payload)
        [notice] = await self.messages()
        self.assertEqual(notice["metadata"]["system_notice"], "rate_limited")

    async def test_order_update_appears_in_the_chat_even_when_sent_as_a_template(self):
        user_id = ObjectId()
        await self.db.whatsapp_order_subscriptions.insert_one({
            "user": user_id, "active": True, "recipient": PHONE, "updatedAt": datetime.now(timezone.utc),
            "customer_window_expires_at": datetime.now(timezone.utc) - timedelta(hours=1),
        })
        outbound = WhatsAppOutbound(self.db, self.db, client=Sender())
        with patch("app.services.whatsapp_outbound.settings", SimpleNamespace(
            whatsapp_order_update_template="order_update", whatsapp_template_language="en",
        )):
            result = await outbound.order_update(str(user_id), "abcdef1234567890", "SHIPPED")
        self.assertEqual(result, {"sent": True, "kind": "template"})
        [notice] = await self.messages()
        self.assertEqual(notice["content"], order_update_text("SHIPPED", "34567890", ""))
        self.assertEqual(notice["metadata"]["system_notice"], "order_update")
        self.assertEqual(notice["metadata"]["sent_as"], "template")
        self.assertEqual(notice["metadata"]["order_number"], "34567890")


class OutboundIdTests(unittest.TestCase):
    def test_reads_metas_id_and_tolerates_missing_parts(self):
        self.assertEqual(outbound_message_id({"messages": [{"id": "wamid.1"}]}), "wamid.1")
        self.assertIsNone(outbound_message_id({"messages": []}))
        self.assertIsNone(outbound_message_id({}))
        self.assertIsNone(outbound_message_id(None))


if __name__ == "__main__":
    unittest.main()
