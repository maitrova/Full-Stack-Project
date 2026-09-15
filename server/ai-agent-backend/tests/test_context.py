import unittest
from app.ai.sales_agent import SalesAgent


class ContextTests(unittest.TestCase):
    def setUp(self):
        self.agent = SalesAgent(None, None, None, None)
        self.old = {"selected_product_id": "old", "recommended_product_ids": ["old"], "conversation_state": {"category": "saree", "color": "red", "max_price": 1000, "selected_product_id": "old", "recommended_product_ids": ["old"], "last_order_id": "draft"}}

    def test_category_switch_discards_old_filters(self):
        result = self.agent._prepare_context(self.old, "white shirt")
        self.assertIsNone(result["selected_product_id"])
        self.assertNotIn("color", result["conversation_state"])
        self.assertNotIn("max_price", result["conversation_state"])
        self.assertEqual(self.old["selected_product_id"], "old")

    def test_budget_refinement_retains_category_clears_selection(self):
        result = self.agent._prepare_context(self.old, "under 2000")
        self.assertEqual(result["conversation_state"]["category"], "saree")
        self.assertIsNone(result["selected_product_id"])

    def test_selection_followup_keeps_context(self):
        result = self.agent._prepare_context(self.old, "send its link")
        self.assertEqual(result["selected_product_id"], "old")

    def test_no_substring_reference(self):
        self.assertIsNone(self.agent._resolve_reference("white shirts", ["old"], "old"))
        self.assertIsNone(self.agent._resolve_reference("another one", ["old", "new"], None))
        self.assertEqual(self.agent._resolve_reference("is it available", ["old"], "old"), "old")


if __name__ == "__main__":
    unittest.main()
