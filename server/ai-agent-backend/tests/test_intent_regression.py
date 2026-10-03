import unittest
from types import SimpleNamespace

from app.ai.intent_parser import IntentParser


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

