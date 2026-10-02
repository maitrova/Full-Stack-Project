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

    def test_explicit_same_category_search_clears_pending_purchase(self):
        conversation = {
            "selected_product_id": "old-shirt",
            "recommended_product_ids": ["old-shirt"],
            "conversation_state": {
                "category": "shirt",
                "selected_product_id": "old-shirt",
                "recommended_product_ids": ["old-shirt"],
                "purchase": {"product_id": "old-shirt", "size": "S", "quantity": 1},
            },
        }

        result = self.agent._prepare_context(conversation, "I want check shirts")

        self.assertIsNone(result["selected_product_id"])
        self.assertNotIn("purchase", result["conversation_state"])
        self.assertNotIn("recommended_product_ids", result["conversation_state"])

    def test_explicit_fabric_filter_starts_fresh_search(self):
        conversation = {
            "selected_product_id": "denim-shirt",
            "recommended_product_ids": ["denim-shirt"],
            "conversation_state": {
                "category": "shirt",
                "selected_product_id": "denim-shirt",
                "recommended_product_ids": ["denim-shirt"],
                "attributes": {"fabric": "denim"},
            },
        }

        result = self.agent._prepare_context(
            conversation, "only show me the cotton fabric"
        )

        self.assertIsNone(result["selected_product_id"])
        self.assertNotIn("recommended_product_ids", result["conversation_state"])
        self.assertEqual(result["conversation_state"]["category"], "shirt")

    def test_no_substring_reference(self):
        self.assertIsNone(self.agent._resolve_reference("white shirts", ["old"], "old"))
        self.assertIsNone(self.agent._resolve_reference("another one", ["old", "new"], None))
        self.assertEqual(self.agent._resolve_reference("is it available", ["old"], "old"), "old")

    def test_fresh_tshirt_browse_does_not_inherit_customization_catalogue(self):
        conversation = {
            "selected_product_id": "custom-polo",
            "recommended_product_ids": ["custom-polo"],
            "conversation_state": {
                "category": "polo",
                "attributes": {"catalog_type": "customization"},
                "selected_product_id": "custom-polo",
                "recommended_product_ids": ["custom-polo"],
            },
        }

        result = self.agent._prepare_context(conversation, "Show me some oversized Tshirts")

        self.assertNotIn("category", result["conversation_state"])
        self.assertNotIn("attributes", result["conversation_state"])
        self.assertIsNone(result["selected_product_id"])
        self.assertFalse(self.agent._continues_customization_context("Show me some oversized Tshirts"))

    def test_category_correction_keeps_active_customization_context(self):
        conversation = {
            "selected_product_id": "custom-hoodie",
            "recommended_product_ids": ["custom-hoodie"],
            "conversation_state": {
                "category": "hoodie",
                "attributes": {"catalog_type": "customization"},
            },
        }

        result = self.agent._prepare_context(conversation, "Change it to a T-shirt")

        self.assertEqual(
            result["conversation_state"]["attributes"]["catalog_type"],
            "customization",
        )
        self.assertTrue(self.agent._continues_customization_context("Change it to a T-shirt"))

    def test_live_catalogue_category_starts_a_fresh_search(self):
        result = self.agent._prepare_context(
            self.old,
            "Show me phone cases",
            ["Men Shirts", "Phone Cases", "Custom Mugs"],
        )

        self.assertIsNone(result["selected_product_id"])
        self.assertNotIn("color", result["conversation_state"])
        self.assertNotIn("max_price", result["conversation_state"])

    def test_other_category_options_keep_browse_history(self):
        key = "hoodie-search"
        conversation = {
            "selected_product_id": "hoodie-3",
            "recommended_product_ids": ["hoodie-1", "hoodie-2", "hoodie-3"],
            "conversation_state": {
                "category": "hoodie",
                "browse_history": {key: ["hoodie-1", "hoodie-2", "hoodie-3"]},
            },
        }

        result = self.agent._prepare_context(conversation, "show other hoodies")

        self.assertEqual(
            result["conversation_state"]["browse_history"][key],
            ["hoodie-1", "hoodie-2", "hoodie-3"],
        )

    def test_first_more_request_after_upgrade_keeps_last_recommendations(self):
        conversation = {
            "selected_product_id": None,
            "recommended_product_ids": ["hoodie-1", "hoodie-2", "hoodie-3"],
            "conversation_state": {
                "category": "hoodie",
                "recommended_product_ids": ["hoodie-1", "hoodie-2", "hoodie-3"],
            },
        }

        result = self.agent._prepare_context(conversation, "show other hoodies")

        self.assertEqual(
            result["conversation_state"]["recommended_product_ids"],
            ["hoodie-1", "hoodie-2", "hoodie-3"],
        )


if __name__ == "__main__":
    unittest.main()
