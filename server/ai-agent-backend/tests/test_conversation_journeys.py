import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.schemas.ai import IntentResult
from app.services.conversation_flow import sync_flow_state
from app.services.whatsapp_commerce import WhatsAppCommerce


def product():
    return SimpleNamespace(
        id="shirt",
        name="Structured Cotton Shirt",
        currency="INR",
        attributes={
            "source_type": "readymade",
            "sizes": ["S", "M", "L"],
            "variants": [
                {"size": "S", "stock": 8, "effective_price": 899},
                {"size": "M", "stock": 8, "effective_price": 899},
                {"size": "L", "stock": 8, "effective_price": 899},
            ],
        },
    )


class ConversationJourneyTests(unittest.IsolatedAsyncioTestCase):
    async def test_order_request_with_product_filters_searches_before_checkout(self):
        commerce = WhatsAppCommerce(SimpleNamespace())
        tools = SimpleNamespace(get_product_details=AsyncMock())
        conversation = {}
        state = {}

        result = await commerce.handle(
            "I need to order the white shirt",
            conversation,
            state,
            tools,
            "business",
            intent=IntentResult(
                intent="product_search",
                category="shirt",
                color="white",
                wants_to_buy=True,
            ),
        )

        self.assertIsNone(result)
        self.assertNotIn("purchase", state)
        tools.get_product_details.assert_not_awaited()

    async def test_customer_can_correct_size_before_atomic_cart_confirmation(self):
        commerce = WhatsAppCommerce(SimpleNamespace())
        commerce._linked = AsyncMock(return_value=True)
        commerce._request = AsyncMock(return_value=(200, {"message": "added"}))
        tools = SimpleNamespace(get_product_details=AsyncMock(return_value=product()))
        conversation = {"selected_product_id": "shirt", "external_customer_ref": "919999999999"}
        state = {"selected_product_id": "shirt"}

        with patch("app.services.whatsapp_commerce.settings", SimpleNamespace(ecommerce_storefront_url="https://shop.example")):
            await commerce.handle(
                "add this to cart", conversation, state, tools, "business",
                intent=IntentResult(intent="commerce_action", action="add_to_cart", wants_to_buy=True),
            )
            self.assertEqual(sync_flow_state(state), "collecting_variant")
            await commerce.handle("L", conversation, state, tools, "business")
            self.assertEqual(state["purchase"]["size"], "L")
            await commerce.handle("2", conversation, state, tools, "business")
            self.assertEqual(sync_flow_state(state), "awaiting_cart_confirmation")

            corrected = await commerce.handle(
                "Actually make that size S", conversation, state, tools, "business"
            )
            self.assertIn("size S", corrected[0])
            self.assertEqual(state["purchase"]["size"], "S")
            self.assertEqual(state["purchase"]["quantity"], 2)

            completed = await commerce.handle("Yes, add it", conversation, state, tools, "business")

        self.assertIn("in your cart", completed[0])
        self.assertEqual(sync_flow_state(state), "cart_updated")
        self.assertEqual(commerce._request.await_args.args[3]["size"], "S")

    async def test_multi_size_quote_can_be_replaced_with_one_corrected_size(self):
        commerce = WhatsAppCommerce(SimpleNamespace())
        tools = SimpleNamespace(get_product_details=AsyncMock(return_value=product()))
        conversation = {"selected_product_id": "shirt", "external_customer_ref": "919999999999"}
        state = {"selected_product_id": "shirt", "purchase": {"product_id": "shirt"}}

        quote = await commerce.handle("one L and one S", conversation, state, tools, "business")
        self.assertIn("size L", quote[0])
        correction = await commerce.handle("Sorry, change it to M", conversation, state, tools, "business")

        self.assertNotIn("items", state["purchase"])
        self.assertEqual(state["purchase"]["size"], "M")
        self.assertIn("How many", correction[0])

    async def test_handoff_carries_reason_summary_and_urgency(self):
        commerce = WhatsAppCommerce(SimpleNamespace(
            whatsapp_order_subscriptions=AsyncMock(),
            whatsapp_account_links=AsyncMock(),
        ))
        state = {
            "customization_interest": True,
            "selected_product_id": "hoodie",
            "recent_turns": [{"customer": "Put my logo on a hoodie"}],
        }
        response = await commerce.handle(
            "urgent, let me talk to a human", {"external_customer_ref": "919999999999"},
            state, SimpleNamespace(), "business",
            intent=IntentResult(intent="commerce_action", action="human_handoff"),
        )

        self.assertIn("store team", response[0])
        self.assertEqual(state["handoff_context"]["reason"], "customization_help")
        self.assertEqual(state["handoff_context"]["urgency"], "high")
        self.assertIn("Put my logo", state["handoff_context"]["summary"])
        self.assertEqual(sync_flow_state(state), "human_handoff")

    def test_long_whatsapp_reply_is_limited_to_three_options(self):
        from app.ai.sales_agent import SalesAgent

        reply = "Header\n" + "\n".join(f"{index}. Product {index}" for index in range(1, 7))
        compact = SalesAgent._compact_whatsapp_reply(reply)
        self.assertIn("3. Product 3", compact)
        self.assertNotIn("4. Product 4", compact)


if __name__ == "__main__":
    unittest.main()
