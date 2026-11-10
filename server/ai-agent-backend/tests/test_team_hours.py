import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from bson import ObjectId

from app.ai.sales_agent import SalesAgent
from app.repositories.business_repository import BusinessRepository
from app.repositories.conversation_repository import ConversationRepository
from app.repositories.message_repository import MessageRepository
from app.schemas.ai import IntentResult
from app.services.whatsapp_commerce import WhatsAppCommerce
from app.services.team_hours import AFTER_HOURS_NOTES, is_team_available, with_team_hours_note
from tests.test_web_agent import FakeClient, make_agent
from tests.test_whatsapp_agent import ask, whatsapp_conversation


def ist(hour: int, minute: int = 0) -> datetime:
    # IST is UTC+5:30; 2026-11-04 00:00 IST is 18:30 UTC the day before.
    total = hour * 60 + minute - 330
    day = 4 if total >= 0 else 3
    total %= 1440
    return datetime(2026, 11, day, total // 60, total % 60, tzinfo=timezone.utc)


class TeamHoursTests(unittest.TestCase):
    def test_team_is_available_from_nine_until_five_ist(self):
        self.assertFalse(is_team_available(ist(8, 59)))
        self.assertTrue(is_team_available(ist(9, 0)))
        self.assertTrue(is_team_available(ist(16, 59)))
        self.assertFalse(is_team_available(ist(17, 0)))
        self.assertFalse(is_team_available(ist(23, 30)))

    def test_reply_is_unchanged_during_team_hours(self):
        self.assertEqual(with_team_hours_note("Told the team.", "English", ist(11)), "Told the team.")

    def test_after_hours_note_uses_the_customer_language(self):
        for language, note in AFTER_HOURS_NOTES.items():
            self.assertEqual(with_team_hours_note("Told the team.", language, ist(18)), f"Told the team.\n\n{note}")
        self.assertIn("9 AM to 5 PM IST", with_team_hours_note("Told the team.", None, ist(18)))
        self.assertIn("9 AM to 5 PM IST", with_team_hours_note("Told the team.", "Klingon", ist(18)))


class HandoffReplyTests(unittest.IsolatedAsyncioTestCase):
    async def tap(self, available: bool, state=None):
        agent, _, _ = make_agent(FakeClient([], [RuntimeError("model must not be called")]))
        with patch("app.services.team_hours.is_team_available", return_value=available):
            return await ask(agent, "Talk to a person", whatsapp_conversation(state))

    async def test_request_after_hours_tells_the_customer_the_timings(self):
        response = await self.tap(False, {"reply_language": {"language": "English"}})
        self.assertIn("reply to you here on WhatsApp", response.ai_message.content)
        self.assertIn(AFTER_HOURS_NOTES["English"], response.ai_message.content)

    async def test_request_during_hours_has_no_timings_note(self):
        response = await self.tap(True)
        self.assertNotIn("5 PM", response.ai_message.content)

    async def test_model_handled_request_gets_the_note_in_the_chat_language(self):
        client = FakeClient([("request_human", {"reason": "complaint", "summary": "Torn parcel."})], ["Our team will contact you here."])
        agent, _, _ = make_agent(client)
        with patch("app.services.team_hours.is_team_available", return_value=False):
            response = await ask(agent, "naku parcel torn ga vachindi, team tho matladali", whatsapp_conversation())
        self.assertIn(AFTER_HOURS_NOTES["Roman Telugu"], response.ai_message.content)

    async def test_ordinary_reply_after_hours_has_no_note(self):
        agent, _, _ = make_agent(FakeClient([], ["Hello! How can I help?"]))
        with patch("app.services.team_hours.is_team_available", return_value=False):
            response = await ask(agent, "hello", whatsapp_conversation())
        self.assertNotIn("5 PM", response.ai_message.content)


class RulesAgentHandoffTests(unittest.IsolatedAsyncioTestCase):
    """The older rules engine still answers some WhatsApp turns."""

    async def asyncSetUp(self):
        from motor.motor_asyncio import AsyncIOMotorClient

        self.mongo = AsyncIOMotorClient("mongodb://127.0.0.1:27017", serverSelectionTimeoutMS=1500)
        try:
            await self.mongo.admin.command("ping")
        except Exception:
            self.mongo.close()
            self.skipTest("local MongoDB is not running")
        await self.mongo.drop_database("appdb_team_hours_unittest")
        self.db = self.mongo["appdb_team_hours_unittest"]

    async def asyncTearDown(self):
        await self.mongo.drop_database("appdb_team_hours_unittest")
        self.mongo.close()

    async def say_human(self, agent, business):
        return await agent.handle_external_chat(business, "human", "whatsapp", "919000011111")

    async def test_note_is_added_once_when_the_request_is_made(self):
        business = {"_id": ObjectId(), "owner_id": ObjectId(), "name": "Maitrova", "business_name": "Maitrova"}
        await self.db.businesses.insert_one(business)
        agent = SalesAgent(
            BusinessRepository(self.db), ConversationRepository(self.db), MessageRepository(self.db),
            SimpleNamespace(), commerce=WhatsAppCommerce(self.db), knowledge_db=self.db,
        )
        agent.intent_parser.parse = AsyncMock(return_value=IntentResult(intent="human_handoff", action="human_handoff", language="English"))
        with patch("app.services.team_hours.is_team_available", return_value=False):
            first = await self.say_human(agent, business)
            second = await self.say_human(agent, business)
        self.assertIn("store team", first.ai_message.content)
        self.assertIn(AFTER_HOURS_NOTES["English"], first.ai_message.content)
        self.assertNotIn("5 PM", second.ai_message.content)


if __name__ == "__main__":
    unittest.main()
