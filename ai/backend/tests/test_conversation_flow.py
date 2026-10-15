import unittest

from app.services.conversation_flow import reset_search_context, sync_flow_state


class ConversationFlowTests(unittest.TestCase):
    def test_flow_follows_the_purchase_lifecycle(self):
        state = {}
        self.assertEqual(sync_flow_state(state), "browsing")

        state["selected_product_id"] = "shirt"
        self.assertEqual(sync_flow_state(state), "product_selected")

        state["purchase"] = {"product_id": "shirt", "size": "L"}
        self.assertEqual(sync_flow_state(state), "collecting_variant")

        state["purchase"]["confirmed_quote"] = 899
        self.assertEqual(sync_flow_state(state), "awaiting_cart_confirmation")

        state.pop("purchase")
        state["last_cart_update"] = {"product_id": "shirt", "item_count": 1}
        self.assertEqual(sync_flow_state(state), "cart_updated")
        self.assertEqual(state["flow_previous_phase"], "awaiting_cart_confirmation")

    def test_handoff_has_priority_over_other_phases(self):
        state = {
            "selected_product_id": "shirt",
            "purchase": {"product_id": "shirt", "confirmed_quote": 899},
            "handoff_requested": True,
        }
        self.assertEqual(sync_flow_state(state), "human_handoff")

    def test_new_search_clears_transactional_state_but_keeps_preferences(self):
        state = {
            "selected_product_id": "shirt",
            "purchase": {"product_id": "shirt"},
            "last_cart_update": {"product_id": "shirt"},
            "customer_preferences": {"colors": ["blue"]},
            "recent_turns": [{"customer": "hi", "reply": "hello"}],
        }
        reset_search_context(state)
        self.assertNotIn("selected_product_id", state)
        self.assertNotIn("purchase", state)
        self.assertNotIn("last_cart_update", state)
        self.assertEqual(state["customer_preferences"]["colors"], ["blue"])


if __name__ == "__main__":
    unittest.main()
