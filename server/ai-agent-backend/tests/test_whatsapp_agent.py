import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from bson import ObjectId

from app.ai.web_agent import WHATSAPP_TOOLS, WebAgent, _ToolSession, whatsapp_commerce_turn, whatsapp_reply_language
from app.schemas.ai import AiChatRequest
from tests.test_web_agent import BUSINESS, FakeClient, make_agent, product

PHONE = "919000000001"


def whatsapp_conversation(state=None):
    return {"_id": ObjectId(), "business_id": BUSINESS["_id"], "channel": "whatsapp", "customer_id": None,
            "external_customer_ref": PHONE, "status": "open", "conversation_state": state or {},
            "recommended_product_ids": [], "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}


async def ask(agent, message, conversation):
    business = {**BUSINESS, "owner_id": ObjectId()}
    return await agent.handle_chat(AiChatRequest(message=message, conversation_id=str(conversation["_id"])), None, business,
                                   web_session_id="wa-" + PHONE, conversation=conversation, channel="whatsapp")


class WhatsAppRoutingTests(unittest.TestCase):
    def test_only_opt_out_and_unlinking_go_to_the_existing_flow(self):
        for message in ("stop", "STOP", "unlink account", "disconnect"):
            self.assertTrue(whatsapp_commerce_turn(message, {}), message)
        for message in ("add the black tee in L to my cart", "track my order", "checkout", "stop sending hoodies",
                        "show me hoodies", "naaku kurta kavali", "what is your return policy?", "2"):
            self.assertFalse(whatsapp_commerce_turn(message, {}), message)

    def test_purchase_answers_continue_the_purchase(self):
        state = {"purchase": {"product_id": "x"}}
        for message in ("XL", "2", "yes", "ok!"):
            self.assertTrue(whatsapp_commerce_turn(message, state), message)
        self.assertFalse(whatsapp_commerce_turn("show me kurtas instead", state))

    def test_language_follows_the_conversation(self):
        state = {}
        self.assertEqual(whatsapp_reply_language("show me hoodies", state)["language"], "English")
        self.assertEqual(whatsapp_reply_language("2", state)["language"], "English")
        self.assertEqual(whatsapp_reply_language("naaku kurta kavali", state)["language"], "Roman Telugu")
        self.assertEqual(whatsapp_reply_language("ok", state)["language"], "Roman Telugu")

    def test_whatsapp_prompt_and_tools_cover_cart_orders_and_links(self):
        names = {tool.name for tool in WHATSAPP_TOOLS}
        self.assertLessEqual({"add_to_cart", "view_cart", "track_order", "checkout_link", "send_account_link"}, names)
        prompt = WebAgent.__new__(WebAgent)._system_prompt({"business_name": "Maitrova"}, "show me hoodies", "whatsapp", {})
        self.assertIn("Cart rules (WhatsApp)", prompt)
        self.assertIn("Orders (WhatsApp)", prompt)
        for absent in ("in the shopper's browser", "I'm adding", "Signed-in shoppers are reachable"):
            self.assertNotIn(absent, prompt)
        self.assertIn("never ask for contact details", prompt)


class WhatsAppAgentFlowTests(unittest.IsolatedAsyncioTestCase):
    async def test_commerce_turn_is_handed_to_the_rules_agent(self):
        agent, sales_agent, database = make_agent(FakeClient([], [RuntimeError("model must not be called")]))
        result = await ask(agent, "stop", whatsapp_conversation())
        self.assertEqual(result, "rules-reply")
        self.assertEqual(sales_agent.handle_chat.await_args.kwargs["business"]["_id"], BUSINESS["_id"])
        fallback = database.ai_agent_metrics.insert_one.await_args.args[0]
        self.assertEqual(fallback["reason"], "whatsapp_commerce")

    async def test_stop_from_a_number_never_connected_is_acknowledged(self):
        agent, sales_agent, _ = make_agent(FakeClient([], [RuntimeError("model must not be called")]))
        sales_agent.commerce = object()
        with patch("app.ai.web_agent.WhatsAppShop", lambda *args: FakeShop(linked=False)):
            response = await ask(agent, "STOP", whatsapp_conversation())
        self.assertIn("won't send you anything", response.ai_message.content)
        sales_agent.handle_chat.assert_not_awaited()

    async def test_stop_from_a_connected_number_turns_everything_off(self):
        agent, sales_agent, _ = make_agent(FakeClient([], [RuntimeError("model must not be called")]))
        sales_agent.commerce = object()
        shop = FakeShop(linked=True)
        with patch("app.ai.web_agent.WhatsAppShop", lambda *args: shop):
            response = await ask(agent, "Stop.", whatsapp_conversation())
        self.assertIn("turned off", response.ai_message.content)
        self.assertEqual(shop.calls, [("opt_out",)])
        sales_agent.handle_chat.assert_not_awaited()

    async def test_products_are_sent_as_up_to_three_photos(self):
        products = [product(f"Tee {index}") for index in range(5)]
        ids = ", ".join(item.id for item in products[:4])
        client = FakeClient([("search_products", {"query": "tees"})], [f"1. Tee 0\n2. Tee 1\n3. Tee 2\n4. Tee 3\n[[show: {ids}]]"])
        agent, _, _ = make_agent(client, products)
        response = await ask(agent, "show me tees", whatsapp_conversation())
        self.assertEqual(len(response.recommended_products), 3)
        self.assertEqual(response.ai_message.metadata["media_mode"], "recommendations")
        self.assertEqual(response.ai_message.metadata["channel"], "whatsapp")

    async def test_cart_replies_naming_a_product_send_no_photo(self):
        tee = product("Tee Zero")
        client = FakeClient([("search_products", {"query": "tee"}), ("view_cart", {})], ["Your cart has the Tee Zero in M."])
        agent, _, _ = make_agent(client, [tee])
        response = await ask(agent, "what's in my cart?", whatsapp_conversation())
        self.assertEqual(response.recommended_products, [])

    async def test_no_photos_when_no_products(self):
        agent, _, _ = make_agent(FakeClient([], ["Returns are accepted for damaged or wrong items."]))
        response = await ask(agent, "what is your return policy?", whatsapp_conversation())
        self.assertEqual(response.ai_message.metadata["media_mode"], "none")

    async def test_handoff_needs_no_contact_on_whatsapp(self):
        client = FakeClient([("request_human", {"reason": "complaint", "summary": "Torn parcel."})], ["Our team will contact you here."])
        agent, _, database = make_agent(client)
        await ask(agent, "my parcel arrived torn, I want a person", whatsapp_conversation())
        alert = database.whatsapp_handoff_alerts.update_one.await_args.args[1]["$setOnInsert"]
        self.assertEqual((alert["reason"], alert["urgency"]), ("complaint", "high"))


class FakeShop:
    """The store API for one WhatsApp number."""

    def __init__(self, linked=True, items=(), order_user=None):
        self.linked = linked
        self.items = [dict(item) for item in items]
        self.order_user = order_user
        self.calls = []

    async def linked_user_id(self):
        return "user-1" if self.linked else None

    async def order_user_id(self):
        return ("user-1" if self.linked else None) or self.order_user

    async def cart(self):
        return (200, {"items": self.items}) if self.linked else (401, {"message": "Link your account"})

    async def add(self, **purchase):
        self.calls.append(("add", purchase))
        return 201, {"items": []}

    async def update(self, item_id, quantity):
        self.calls.append(("update", item_id, quantity))
        return 200, {}

    async def remove(self, item_id):
        self.calls.append(("remove", item_id))
        return 200, {}

    async def opt_out(self):
        self.calls.append(("opt_out",))
        was_on, self.linked = self.linked, False
        return was_on

    async def link(self, return_path, purchase=None):
        self.calls.append(("link", return_path, purchase))
        return f"Sign in here: https://maitrova.in/whatsapp-link?t=abc{return_path}"


class WhatsAppCommerceToolTests(unittest.IsolatedAsyncioTestCase):
    def session(self, shop, products=(), message=""):
        agent, _, _ = make_agent(FakeClient([], ["ok"]), list(products))
        session = _ToolSession(agent, BUSINESS)
        session.shop = shop
        session.message = message
        return session

    async def test_linked_add_changes_the_store_cart_at_the_checked_price(self):
        tee = product(variants=[{"size": "L", "stock": 5, "effective_price": 719.1}])
        shop = FakeShop()
        session = self.session(shop, [tee], "add the black tee in L to my cart")
        result = await session.execute("add_to_cart", {"product_id": tee.id, "size": "L", "quantity": 2})
        self.assertTrue(result["added"])
        self.assertEqual(shop.calls, [("add", {"product_id": tee.id, "size": "L", "quantity": 2, "expected_price": 719.1})])
        self.assertTrue(session.actions[0]["executed"])

    async def test_unlinked_add_sends_a_sign_in_link_carrying_the_item(self):
        tee = product(variants=[{"size": "M", "stock": 5, "effective_price": 799.0}])
        shop = FakeShop(linked=False)
        session = self.session(shop, [tee], "buy the black tee in M")
        result = await session.execute("add_to_cart", {"product_id": tee.id, "size": "M"})
        self.assertTrue(result["link_required"])
        self.assertIn("https://maitrova.in/whatsapp-link", result["message_to_send"])
        self.assertEqual(shop.calls, [("link", "/checkout", {"product_id": tee.id, "size": "M", "quantity": 1, "expected_price": 799.0})])
        self.assertEqual(session.actions, [])  # nothing was added, so "Added" would be an unbacked claim

    async def test_validation_still_runs_before_the_store_is_called(self):
        tee = product(variants=[{"size": "L", "stock": 1, "effective_price": 799.0}])
        shop = FakeShop()
        session = self.session(shop, [tee], "is it available in L?")
        self.assertIn("error", await session.execute("add_to_cart", {"product_id": tee.id, "size": "L"}))
        session.message = "add 3 in L"
        result = await session.execute("add_to_cart", {"product_id": tee.id, "size": "L", "quantity": 3})
        self.assertIn("Not enough stock", result["error"])
        self.assertEqual(shop.calls, [])

    async def test_view_update_and_remove_use_the_store_cart(self):
        shop = FakeShop(items=[{"item_id": "i1", "name": "Black Tee", "size": "L", "quantity": 1, "unit_price": 799.0},
                               {"item_id": "i2", "name": "Olive Henley", "size": "M", "quantity": 2, "unit_price": 849.5}])
        session = self.session(shop, message="what is in my cart?")
        cart = await session.execute("view_cart", {})
        self.assertEqual(cart["subtotal"], 2498.0)
        session.message = "make the black tee 3"
        self.assertTrue((await session.execute("update_cart_item", {"item_id": "i1", "quantity": 3}))["updated"])
        session.message = "remove the henley"
        self.assertTrue((await session.execute("remove_cart_item", {"item_id": "i2"}))["removed"])
        self.assertEqual(shop.calls, [("update", "i1", 3), ("remove", "i2")])
        self.assertIn("error", await session.execute("remove_cart_item", {"item_id": "unknown"}))

    async def test_unlinked_cart_asks_for_the_account_link(self):
        shop = FakeShop(linked=False)
        session = self.session(shop, message="show my cart")
        self.assertTrue((await session.execute("view_cart", {}))["not_linked"])
        link = await session.execute("send_account_link", {"purpose": "cart"})
        self.assertIn("whatsapp-link", link["message_to_send"])
        self.assertEqual(shop.calls[-1], ("link", "/cart", None))

    async def test_checkout_link_opens_checkout(self):
        result = await self.session(FakeShop(), message="checkout").execute("checkout_link", {})
        self.assertIn("/checkout", result["message_to_send"])

    async def test_a_retried_reply_changes_the_store_cart_only_once(self):
        tee = product(variants=[{"size": "L", "stock": 5, "effective_price": 799.0}])
        shop = FakeShop(items=[{"item_id": "i1", "name": "Black Tee", "size": "L", "quantity": 1, "unit_price": 799.0}])
        session = self.session(shop, [tee], "add the black tee in L to my cart")
        for _ in range(2):  # the model's second attempt repeats the same call
            self.assertTrue((await session.execute("add_to_cart", {"product_id": tee.id, "size": "L"}))["added"])
        session.message = "remove the black tee"
        for _ in range(2):
            self.assertTrue((await session.execute("remove_cart_item", {"item_id": "i1"}))["removed"])
        self.assertEqual([call[0] for call in shop.calls], ["add", "remove"])

    async def test_cart_changes_report_the_stores_new_total(self):
        tee = product(variants=[{"size": "L", "stock": 5, "effective_price": 799.0}])
        shop = FakeShop(items=[{"item_id": "i1", "name": "Black Tee", "size": "L", "quantity": 2, "unit_price": 799.0}])
        session = self.session(shop, [tee], "add the black tee in L to my cart")
        self.assertEqual((await session.execute("add_to_cart", {"product_id": tee.id, "size": "L"}))["cart_subtotal"], 1598.0)

    async def test_orders_use_the_account_with_this_phone_number(self):
        session = self.session(FakeShop(linked=False, order_user="user-9"), message="where is my order?")
        session.agent.order_lookup = SimpleNamespace(recent_for_user=AsyncMock(return_value=[{"order_number": "AB12CD34", "items": []}]))
        result = await session.execute("track_order", {})
        self.assertEqual(result["orders"][0]["order_number"], "AB12CD34")
        session.agent.order_lookup.recent_for_user.assert_awaited_with("user-9", limit=20)

    async def test_unknown_number_is_asked_to_verify(self):
        session = self.session(FakeShop(linked=False), message="where is my order?")
        session.agent.order_lookup = SimpleNamespace()
        result = await session.execute("track_order", {})
        self.assertTrue(result["verification_required"])
        self.assertIn("send_account_link", result["note"])


if __name__ == "__main__":
    unittest.main()
