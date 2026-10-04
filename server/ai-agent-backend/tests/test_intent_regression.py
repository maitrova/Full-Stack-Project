import unittest
from types import SimpleNamespace

from app.ai.intent_parser import IntentParser
from app.ai.action_policy import ActionPolicy
from app.schemas.ai import IntentResult
from app.services.quality_monitor import build_quality_alerts


class IntentRegressionTests(unittest.TestCase):
    def setUp(self):
        self.parser = IntentParser(SimpleNamespace(is_configured=False))

    def test_real_shopping_phrases(self):
        cases = [
            ("plain polo t shirts", "t-shirt", {"style": "polo", "pattern": "plain"}),
            ("black oversized tshirts under 1500", "oversized t-shirt", {"style": "oversized"}),
            ("white cotton shirts", "shirt", {"fabric": "cotton"}),
            ("show check shirts", "shirt", {"pattern": "check"}),
        ]
        for message, category, attributes in cases:
            with self.subTest(message=message):
                intent = self.parser._parse_with_rules(message, {})
                self.assertEqual(intent.intent, "product_search")
                self.assertEqual(intent.category, category)
                for key, value in attributes.items():
                    self.assertEqual(intent.attributes.get(key), value)

    def test_discovery_does_not_become_purchase(self):
        intent = self.parser._parse_with_rules("I want black polo shirts", {})
        self.assertEqual(intent.intent, "product_search")
        self.assertFalse(intent.wants_to_buy)

    def test_catalogue_aware_typo_correction(self):
        intent = self.parser._parse_with_rules(
            "show blak poloo tshrits under 1500",
            {},
            ["Men T-Shirts", "Polo T-Shirts"],
        )
        self.assertEqual(intent.intent, "product_search")
        self.assertEqual(intent.category, "t-shirt")
        self.assertEqual(intent.color, "black")
        self.assertEqual(intent.attributes.get("style"), "polo")
        self.assertEqual(intent.max_price, 1500)

    def test_order_word_with_filters_stays_product_discovery(self):
        """A category request must not become an add-to-cart mutation."""
        model_intent = IntentResult(
            intent="commerce_action",
            action="add_to_cart",
            category="shirt",
            confidence=0.92,
        )
        safe = self.parser._sanitize_model_intent(
            model_intent,
            "I need to order the white shhirt",
            {},
        )
        self.assertEqual(safe.intent, "product_search")
        self.assertIsNone(safe.action)
        self.assertEqual(safe.category, "shirt")
        self.assertEqual(safe.color, "white")
        self.assertFalse(safe.wants_to_buy)

    def test_confirmation_without_pending_purchase_is_safe(self):
        model_intent = IntentResult(
            intent="commerce_action",
            action="confirm_cart",
            confidence=0.95,
        )
        safe = self.parser._sanitize_model_intent(model_intent, "yes", {})
        self.assertEqual(safe.intent, "general_question")
        self.assertIsNone(safe.action)

    def test_action_policy_blocks_cart_mutations_without_state(self):
        allowed, reason = ActionPolicy.validate(
            IntentResult(intent="commerce_action", action="checkout"),
            {},
            {},
        )
        self.assertFalse(allowed)
        self.assertIn("required", reason)

    def test_action_policy_allows_confirmation_with_pending_quote(self):
        allowed, reason = ActionPolicy.validate(
            IntentResult(intent="commerce_action", action="confirm_cart"),
            {},
            {"purchase": {"product_id": "p1", "confirmed_quote": 999}},
        )
        self.assertTrue(allowed)
        self.assertIsNone(reason)

    def test_quality_monitor_emits_actionable_alerts(self):
        alerts = build_quality_alerts({
            "requests": 10,
            "checkout_failures": 1,
            "quality": {
                "empty_search_rate": 0.4,
                "clarification_rate": 0.1,
                "handoff_rate": 0.1,
            },
        })
        codes = {alert["code"] for alert in alerts}
        self.assertIn("high_empty_search_rate", codes)
        self.assertIn("checkout_failures", codes)

