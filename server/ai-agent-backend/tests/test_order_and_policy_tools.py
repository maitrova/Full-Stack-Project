import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock

from bson import ObjectId

from app.ai.web_agent import _ToolSession
from app.services.order_lookup import normalize_reference
from app.services.policy_search import question_terms, search_policies, split_sections

BUSINESS = {"_id": ObjectId(), "business_name": "Maitrova"}
ORDER_ID = "6ad0aa1b2c3d4e5f44fe2a8c"
SHIPPED = {"order_number": "44FE2A8C", "current_status": "Shipped", "total": 1399}


def make_session(lookup, user_id=None, state=None):
    agent = SimpleNamespace(order_lookup=lookup, knowledge_db=None)
    return _ToolSession(agent, BUSINESS, user_id=user_id, web_session_id="session-1234567890", state=state)


def make_lookup(**overrides):
    lookup = SimpleNamespace(
        recent_for_user=AsyncMock(return_value=[SHIPPED]),
        find_for_user=AsyncMock(return_value=SHIPPED),
        find_for_guest=AsyncMock(return_value={**SHIPPED, "order_id": ORDER_ID}),
        get_by_id=AsyncMock(return_value=dict(SHIPPED)),
        guest_locked=AsyncMock(return_value=False),
        record_guest_failure=AsyncMock(),
    )
    for name, value in overrides.items():
        setattr(lookup, name, value)
    return lookup


class TrackOrderToolTests(unittest.IsolatedAsyncioTestCase):
    async def test_signed_in_shopper_gets_latest_orders_without_details(self):
        lookup = make_lookup()
        session = make_session(lookup, user_id=str(ObjectId()))
        result = await session.execute("track_order", {})
        self.assertEqual(result["orders"], [SHIPPED])
        self.assertEqual(session.order_cards, [SHIPPED])
        lookup.find_for_guest.assert_not_awaited()

    async def test_signed_in_shopper_can_find_an_older_order_by_item(self):
        orders = [
            {"order_number": f"0000000{index}", "current_status": "Delivered", "items": [{"name": f"Plain Tee {index}"}]}
            for index in range(5)
        ] + [{"order_number": "44FE2A99", "current_status": "Delivered", "items": [{"name": "Sky Blue Linen Shirt"}]}]
        lookup = make_lookup(recent_for_user=AsyncMock(return_value=orders))
        session = make_session(lookup, user_id=str(ObjectId()))
        result = await session.execute("track_order", {"item": "the linen shirt"})
        self.assertEqual([order["order_number"] for order in result["orders"]], ["44FE2A99"])
        missing = await session.execute("track_order", {"item": "galaxy hoodie"})
        self.assertEqual(missing["orders"], [])

    async def test_signed_in_lookup_is_scoped_to_the_account(self):
        lookup = make_lookup(find_for_user=AsyncMock(return_value=None))
        user_id = str(ObjectId())
        result = await make_session(lookup, user_id=user_id).execute("track_order", {"order_number": "#44FE2A8C"})
        self.assertFalse(result["found"])
        lookup.find_for_user.assert_awaited_once_with(user_id, "44fe2a8c")

    async def test_guest_must_give_number_and_contact(self):
        lookup = make_lookup()
        session = make_session(lookup)
        self.assertTrue((await session.execute("track_order", {}))["verification_required"])
        self.assertTrue((await session.execute("track_order", {"order_number": "44FE2A8C"}))["verification_required"])
        lookup.find_for_guest.assert_not_awaited()
        self.assertEqual(session.order_cards, [])

    async def test_guest_wrong_details_record_a_failure_and_reveal_nothing(self):
        lookup = make_lookup(find_for_guest=AsyncMock(return_value=None))
        session = make_session(lookup)
        result = await session.execute("track_order", {"order_number": "44FE2A8C", "contact": "x@y.com"})
        self.assertEqual(set(result), {"found", "note"})
        lookup.record_guest_failure.assert_awaited_once()

    async def test_guest_locked_out_after_failures(self):
        lookup = make_lookup(guest_locked=AsyncMock(return_value=True))
        result = await make_session(lookup).execute("track_order", {"order_number": "44FE2A8C", "contact": "x@y.com"})
        self.assertTrue(result["locked"])
        lookup.find_for_guest.assert_not_awaited()

    async def test_verified_guest_order_is_remembered_for_the_conversation(self):
        lookup = make_lookup()
        state = {}
        session = make_session(lookup, state=state)
        result = await session.execute("track_order", {"order_number": "44FE2A8C", "contact": "9000012345"})
        self.assertNotIn("order_id", result["orders"][0])
        self.assertEqual(state["verified_order_ids"], [ORDER_ID])

        # Next turn: no contact needed for the same order.
        follow_up = make_session(lookup, state=state)
        result = await follow_up.execute("track_order", {"order_number": "44fe2a8c"})
        self.assertEqual(result["orders"][0]["current_status"], "Shipped")
        lookup.get_by_id.assert_awaited_with(ORDER_ID)
        self.assertEqual(lookup.find_for_guest.await_count, 1)

    def test_order_number_formats(self):
        self.assertEqual(normalize_reference("#44FE2A8C"), "44fe2a8c")
        self.assertEqual(normalize_reference("order no 44fe2a8c please"), "44fe2a8c")
        self.assertEqual(normalize_reference("2A8C"), "")


class FakeCollection:
    def __init__(self, documents):
        self.documents = documents

    def find(self, *args, **kwargs):
        return self

    def limit(self, *_):
        return self

    async def to_list(self, *_):
        return list(self.documents)


class PolicySearchTests(unittest.IsolatedAsyncioTestCase):
    POLICY = (
        "<p>RETURN &amp; REFUND POLICY</p><p>1. RETURN ELIGIBILITY</p><p>Returns within 48 hours of delivery.</p>"
        "<p>8. REFUND TIMELINE</p><p>Refunds take 5–7 business days after approval.</p>"
    )
    SHIPPING = "<p>2. SHIPPING POLICY</p><p>We deliver across India in 3–7 business days.</p>"
    CONTACT = "<p>Contact support at support@maitrova.in</p>"

    def database(self):
        return SimpleNamespace(
            companydocuments=FakeCollection([
                {"name": "Contact Support", "content": self.CONTACT},
                {"name": "return-refund-policy", "content": self.POLICY},
                {"name": "payment-shipping-cancellation-policy", "content": self.SHIPPING},
                {"name": "contact", "content": self.CONTACT},
            ]),
            ai_website_knowledge=FakeCollection([]),
        )

    def test_sections_split_on_numbered_headings(self):
        sections = split_sections("Return Refund Policy", "1. RETURN ELIGIBILITY\nWithin 48 hours.\n8. REFUND TIMELINE\n5-7 days.")
        self.assertEqual([section["heading"] for section in sections], ["1. RETURN ELIGIBILITY", "8. REFUND TIMELINE"])

    def test_synonyms_cover_everyday_wording(self):
        self.assertIn("refund", question_terms("when will I get my money back?"))
        self.assertIn("india", question_terms("do u ship to dubai"))

    async def test_question_finds_the_right_section_with_its_page_link(self):
        with unittest.mock.patch("app.services.policy_search.settings") as fake:
            fake.ecommerce_storefront_url = "https://www.maitrova.in"
            results = await search_policies(self.database(), "when will I get my money back?")
        self.assertEqual(results[0]["section"], "8. REFUND TIMELINE")
        self.assertEqual(results[0]["source_url"], "https://www.maitrova.in/return-refund-policy")

    async def test_duplicate_pages_are_returned_once_under_the_slug_name(self):
        with unittest.mock.patch("app.services.policy_search.settings") as fake:
            fake.ecommerce_storefront_url = "https://www.maitrova.in"
            results = await search_policies(self.database(), "how do I contact support?")
        contact = [item for item in results if "support@maitrova.in" in item["content"]]
        self.assertEqual(len(contact), 1)
        self.assertEqual(contact[0]["source_url"], "https://www.maitrova.in/contact")


if __name__ == "__main__":
    unittest.main()
