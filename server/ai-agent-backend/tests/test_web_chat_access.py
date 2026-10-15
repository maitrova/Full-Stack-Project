import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock

from bson import ObjectId
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.ai.sales_agent import SalesAgent
from app.dependencies import auth
from app.routes.ai import get_web_session_id

BUSINESS_ID = str(ObjectId())
SESSION = "8f14e45f-ceea-467a-9575-0d6d2e1c2b1a"
OTHER_SESSION = "c9f0f895-fb98-4b91-8b7f-1a2b3c4d5e6f"


def make_agent(existing: dict | None):
    created = {"_id": ObjectId(), "channel": "web", "conversation_state": {}}
    repository = SimpleNamespace(
        find_by_id=AsyncMock(return_value=existing),
        create_conversation=AsyncMock(return_value=created),
        collection=SimpleNamespace(update_one=AsyncMock()),
    )
    agent = SalesAgent(
        business_repository=SimpleNamespace(),
        conversation_repository=repository,
        message_repository=SimpleNamespace(),
        product_tools=SimpleNamespace(),
    )
    return agent, repository, created


class WebConversationAccessTests(unittest.IsolatedAsyncioTestCase):
    async def test_new_guest_conversation_records_browser_session(self):
        agent, repository, created = make_agent(None)
        conversation = await agent._get_or_create_web_conversation(None, BUSINESS_ID, SESSION, None)
        self.assertIs(conversation, created)
        payload = repository.create_conversation.await_args.kwargs["payload"]
        self.assertEqual(payload["web_session_id"], SESSION)
        self.assertIsNone(payload["customer_id"])

    async def test_guest_resumes_own_conversation(self):
        existing = {"_id": ObjectId(), "channel": "web", "customer_id": None, "web_session_id": SESSION}
        agent, repository, _ = make_agent(existing)
        conversation = await agent._get_or_create_web_conversation(str(existing["_id"]), BUSINESS_ID, SESSION, None)
        self.assertIs(conversation, existing)
        repository.create_conversation.assert_not_awaited()

    async def test_other_browser_cannot_resume_guest_conversation(self):
        existing = {"_id": ObjectId(), "channel": "web", "customer_id": None, "web_session_id": SESSION}
        agent, repository, created = make_agent(existing)
        conversation = await agent._get_or_create_web_conversation(str(existing["_id"]), BUSINESS_ID, OTHER_SESSION, None)
        self.assertIs(conversation, created)

    async def test_guest_conversation_is_linked_when_shopper_signs_in(self):
        user_id = str(ObjectId())
        existing = {"_id": ObjectId(), "channel": "web", "customer_id": None, "web_session_id": SESSION}
        agent, repository, _ = make_agent(existing)
        conversation = await agent._get_or_create_web_conversation(str(existing["_id"]), BUSINESS_ID, SESSION, user_id)
        self.assertIs(conversation, existing)
        self.assertEqual(str(conversation["customer_id"]), user_id)
        repository.collection.update_one.assert_awaited_once()

    async def test_account_conversation_requires_same_account(self):
        owner = ObjectId()
        existing = {"_id": ObjectId(), "channel": "web", "customer_id": owner, "web_session_id": SESSION}
        agent, _, created = make_agent(existing)
        # Same browser after sign-out must not reopen the account's chat.
        self.assertIs(await agent._get_or_create_web_conversation(str(existing["_id"]), BUSINESS_ID, SESSION, None), created)
        self.assertIs(await agent._get_or_create_web_conversation(str(existing["_id"]), BUSINESS_ID, SESSION, str(ObjectId())), created)
        self.assertIs(await agent._get_or_create_web_conversation(str(existing["_id"]), BUSINESS_ID, OTHER_SESSION, str(owner)), existing)

    async def test_stale_or_invalid_ids_start_fresh_instead_of_404(self):
        agent, repository, created = make_agent(None)
        self.assertIs(await agent._get_or_create_web_conversation(str(ObjectId()), BUSINESS_ID, SESSION, None), created)
        self.assertIs(await agent._get_or_create_web_conversation("not-an-id", BUSINESS_ID, SESSION, None), created)

    async def test_whatsapp_conversation_is_never_resumed_from_web(self):
        existing = {"_id": ObjectId(), "channel": "whatsapp", "customer_id": None, "web_session_id": SESSION}
        agent, _, created = make_agent(existing)
        self.assertIs(await agent._get_or_create_web_conversation(str(existing["_id"]), BUSINESS_ID, SESSION, None), created)


class OptionalUserTests(unittest.IsolatedAsyncioTestCase):
    async def test_missing_token_is_guest(self):
        self.assertIsNone(await auth.get_optional_user(None))

    async def test_invalid_token_is_guest_not_401(self):
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="not-a-jwt")
        self.assertIsNone(await auth.get_optional_user(credentials))


class SessionHeaderTests(unittest.TestCase):
    def test_accepts_uuid_and_rejects_bad_values(self):
        self.assertEqual(get_web_session_id(SESSION), SESSION)
        for value in (None, "", "short", "has spaces in it 1234", "x" * 200):
            with self.assertRaises(HTTPException):
                get_web_session_id(value)


if __name__ == "__main__":
    unittest.main()
