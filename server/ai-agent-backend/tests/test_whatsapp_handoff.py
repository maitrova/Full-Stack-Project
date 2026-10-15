import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from bson import ObjectId

from app.repositories.conversation_repository import ConversationRepository
from app.repositories.message_repository import MessageRepository
from app.services.whatsapp_outbound import WhatsAppOutbound, OutboundError, order_update_text
from app.services.whatsapp_service import WhatsAppClient, WhatsAppService
from tests.test_web_agent import FakeClient, make_agent, product
from tests.test_whatsapp_agent import ask, whatsapp_conversation

TEST_DB = "appdb_w4_unittest"
PHONE = "919000011111"


class FakeSender:
    def __init__(self):
        self.texts, self.templates, self.buttons = [], [], []

    async def send_text(self, to, body, reply_to_message_id=None):
        self.texts.append((to, body))
        return {"messages": [{"id": f"wamid.{len(self.texts)}"}]}

    async def send_template(self, to, name, language, parameters):
        self.templates.append((to, name, language, parameters))
        return {"messages": [{"id": "wamid.t"}]}

    async def send_reply_buttons(self, to, body, titles, reply_to_message_id=None):
        self.buttons.append((to, body, titles))
        return {"messages": [{"id": "wamid.b"}]}


class ButtonTests(unittest.IsolatedAsyncioTestCase):
    def test_talk_to_a_person_button_round_trip(self):
        self.assertEqual(WhatsAppClient._reply_button_id("Talk to a person", 1), "talk_to_person")
        tap = {"type": "interactive", "interactive": {"type": "button_reply", "button_reply": {"id": "talk_to_person", "title": "Talk to a person"}}}
        self.assertEqual(WhatsAppService._message_text(None, tap), "Talk to a person")

    async def test_tap_creates_a_whatsapp_alert_without_asking_for_contact(self):
        agent, _, database = make_agent(FakeClient([], [RuntimeError("model must not be called")]))
        response = await ask(agent, "Talk to a person", whatsapp_conversation())
        self.assertIn("reply to you here on WhatsApp", response.ai_message.content)
        alert = database.whatsapp_handoff_alerts.update_one.await_args.args[1]["$setOnInsert"]
        self.assertEqual((alert["channel"], alert["status"], alert["reason"]), ("whatsapp", "open", "customer_asked"))

    async def test_button_offered_on_order_and_complaint_turns_only(self):
        agent, _, _ = make_agent(FakeClient([], ["Sorry about that. Please share your order number."]))
        response = await ask(agent, "my parcel arrived damaged", whatsapp_conversation())
        self.assertTrue(response.ai_message.metadata["offer_human"])
        tees = [product("Tee 0")]
        agent, _, _ = make_agent(FakeClient([("search_products", {"query": "tee"})], [f"Here you go.\n[[show: {tees[0].id}]]"]), tees)
        response = await ask(agent, "show me tees", whatsapp_conversation())
        self.assertFalse(response.ai_message.metadata["offer_human"])

    async def test_offered_button_is_sent_with_the_reply(self):
        service = WhatsAppService.__new__(WhatsAppService)
        service.client = FakeSender()
        response = SimpleNamespace(
            ai_message=SimpleNamespace(content="Sorry about that. Our team can help.", metadata={"offer_human": True}),
            recommended_products=[], conversation=SimpleNamespace(conversation_state={}),
        )
        _, kind = await service._send_primary_response(PHONE, "wamid.in", response)
        self.assertEqual(kind, "buttons")
        self.assertEqual(service.client.buttons[0][2], ["Talk to a person"])


class OrderUpdateTextTests(unittest.TestCase):
    def test_text_uses_short_number_and_plain_status(self):
        text = order_update_text("SHIPPED", "44FE2A88", "INR 1399.00")
        self.assertIn("#44FE2A88 is shipped", text)
        self.assertIn("STOP", text)
        self.assertIn("Total: INR 1399.00", order_update_text("ORDER_CONFIRMED", "44FE2A88", "INR 1399.00"))


class MongoTestCase(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        from motor.motor_asyncio import AsyncIOMotorClient

        self.mongo = AsyncIOMotorClient("mongodb://127.0.0.1:27017", serverSelectionTimeoutMS=1500)
        try:
            await self.mongo.admin.command("ping")
        except Exception:
            self.skipTest("local MongoDB is not running")
        await self.mongo.drop_database(TEST_DB)
        self.db = self.mongo[TEST_DB]
        self.sender = FakeSender()

    async def asyncTearDown(self):
        await self.mongo.drop_database(TEST_DB)
        self.mongo.close()


class OrderUpdateTests(MongoTestCase):
    async def subscribe(self, window_hours: float):
        user = ObjectId()
        await self.db.whatsapp_order_subscriptions.insert_one({
            "_id": "acct", "user": user, "recipient": PHONE, "active": True, "updatedAt": datetime.now(timezone.utc),
            "customer_window_expires_at": datetime.now(timezone.utc) + timedelta(hours=window_hours),
        })
        return str(user)

    async def test_inside_window_sends_text_once(self):
        user = await self.subscribe(5)
        outbound = WhatsAppOutbound(self.db, self.db, self.sender)
        order = str(ObjectId())
        self.assertEqual(await outbound.order_update(user, order, "shipped", "INR 999.00"), {"sent": True, "kind": "text"})
        self.assertEqual(await outbound.order_update(user, order, "SHIPPED"), {"sent": False, "reason": "already_sent"})
        self.assertEqual(len(self.sender.texts), 1)
        self.assertIn(f"#{order[-8:].upper()} is shipped", self.sender.texts[0][1])

    async def test_outside_window_uses_the_template_or_skips(self):
        user = await self.subscribe(-1)
        outbound = WhatsAppOutbound(self.db, self.db, self.sender)
        order = str(ObjectId())
        with patch("app.services.whatsapp_outbound.settings.whatsapp_order_update_template", None):
            self.assertEqual((await outbound.order_update(user, order, "DELIVERED"))["reason"], "template_required")
        with patch("app.services.whatsapp_outbound.settings.whatsapp_order_update_template", "order_update"):
            self.assertEqual(await outbound.order_update(user, order, "DELIVERED"), {"sent": True, "kind": "template"})
        self.assertEqual(self.sender.templates[0][1:], ("order_update", "en", [order[-8:].upper(), "delivered", "-"]))

    async def test_unsubscribed_customers_get_nothing(self):
        outbound = WhatsAppOutbound(self.db, self.db, self.sender)
        self.assertEqual((await outbound.order_update(str(ObjectId()), str(ObjectId()), "SHIPPED"))["reason"], "not_subscribed")
        self.assertEqual(self.sender.texts, [])


class HandoffTests(MongoTestCase):
    async def make_chat(self, minutes_since_customer: float, status="open"):
        now = datetime.now(timezone.utc)
        business = {"_id": ObjectId()}
        conversation = {"_id": ObjectId(), "business_id": business["_id"], "channel": "whatsapp", "status": status,
                        "external_customer_ref": PHONE, "customer_id": None, "created_at": now, "updated_at": now}
        await self.db.conversations.insert_one(conversation)
        await self.db.messages.insert_one({"conversation_id": conversation["_id"], "business_id": business["_id"], "sender": "customer",
                                           "content": "hi", "created_at": now - timedelta(minutes=minutes_since_customer)})
        return business, conversation

    async def test_team_reply_sends_stores_and_pauses_the_ai(self):
        _, conversation = await self.make_chat(10)
        outbound = WhatsAppOutbound(self.db, self.db, self.sender)
        result = await outbound.team_reply(str(conversation["_id"]), "Hi, Priya here from Maitrova.", str(ObjectId()), "Priya")
        self.assertTrue(result["sent"])
        self.assertEqual(self.sender.texts, [(PHONE, "Hi, Priya here from Maitrova.")])
        stored = await self.db.messages.find_one({"sender": "human"})
        self.assertEqual(stored["metadata"]["sent_by"], "Priya")
        alert = await self.db.whatsapp_handoff_alerts.find_one({"conversation_id": conversation["_id"]})
        self.assertEqual(alert["status"], "assigned")
        self.assertEqual((await self.db.conversations.find_one({"_id": conversation["_id"]}))["status"], "handoff")

    async def test_team_reply_refused_outside_the_24_hour_window(self):
        _, conversation = await self.make_chat(25 * 60)
        with self.assertRaises(OutboundError) as caught:
            await WhatsAppOutbound(self.db, self.db, self.sender).team_reply(str(conversation["_id"]), "Hello", None, "Priya")
        self.assertEqual(caught.exception.status_code, 409)
        self.assertEqual(self.sender.texts, [])

    def service(self):
        service = WhatsAppService.__new__(WhatsAppService)
        service.client = self.sender
        service.conversation_repository = ConversationRepository(self.db)
        service.message_repository = MessageRepository(self.db)
        service._store_admin_media_for_handoff = AsyncMock(return_value=None)
        return service

    async def customer_writes(self, business, text="any update?"):
        return await self.service()._store_handoff_message_if_needed(
            business, PHONE, None, text, {"id": f"wamid.{ObjectId()}", "type": "text"},
        )

    async def test_assigned_chat_stays_paused_with_one_acknowledgement(self):
        business, conversation = await self.make_chat(1, status="handoff")
        await self.db.whatsapp_handoff_alerts.insert_one({"conversation_id": conversation["_id"], "status": "assigned",
                                                          "assigned_at": datetime.now(timezone.utc)})
        self.assertTrue(await self.customer_writes(business))
        self.assertTrue(await self.customer_writes(business, "hello?"))
        self.assertEqual(len(self.sender.texts), 1)
        self.assertIn("our team has your message", self.sender.texts[0][1])

    async def test_ai_resumes_when_the_team_goes_quiet(self):
        business, conversation = await self.make_chat(1, status="handoff")
        stale = datetime.now(timezone.utc) - timedelta(hours=13)
        await self.db.whatsapp_handoff_alerts.insert_one({"conversation_id": conversation["_id"], "status": "assigned",
                                                          "assigned_at": stale, "last_human_reply_at": stale})
        self.assertFalse(await self.customer_writes(business))
        alert = await self.db.whatsapp_handoff_alerts.find_one({"conversation_id": conversation["_id"]})
        self.assertEqual((alert["status"], alert["auto_resumed"]), ("resumed", True))
        self.assertEqual((await self.db.conversations.find_one({"_id": conversation["_id"]}))["status"], "open")

    async def test_unclaimed_request_does_not_silence_the_ai(self):
        business, conversation = await self.make_chat(1, status="handoff")
        await self.db.whatsapp_handoff_alerts.insert_one({"conversation_id": conversation["_id"], "status": "open"})
        self.assertFalse(await self.customer_writes(business, "can I talk to a human"))
        self.assertEqual((await self.db.whatsapp_handoff_alerts.find_one({}))["status"], "open")


if __name__ == "__main__":
    unittest.main()
