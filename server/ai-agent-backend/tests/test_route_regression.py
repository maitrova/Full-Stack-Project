import json
from pathlib import Path
import unittest

from app.ai.intent_parser import IntentParser


class RouteRegressionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        fixture = Path(__file__).parent / "fixtures" / "route_regression_cases.json"
        cls.cases = json.loads(fixture.read_text(encoding="utf-8"))
        cls.parser = IntentParser.__new__(IntentParser)

    def test_route_regression_cases(self):
        for case in self.cases:
            with self.subTest(message=case["message"]):
                state = dict(case.get("state") or {})
                intent = self.parser._parse_with_rules(case["message"], state)
                route = self._route(case["message"], intent, state)
                self.assertEqual(route, case["route"])

    @staticmethod
    def _route(message, intent, state):
        if intent.action == "human_handoff":
            return "human_handoff"
        if intent.action == "browse_designs":
            return "design_library"
        if intent.attributes.get("catalog_type") == "customization":
            return "customization"
        if intent.product_option and state.get("recommended_product_ids"):
            return "product_selection"
        if intent.action in {"show_sizes", "check_price", "check_stock", "product_photos", "product_link"}:
            return "product_details"
        if intent.intent == "product_search":
            return "product_search"
        return "unsupported" if intent.intent == "general_question" else intent.intent


if __name__ == "__main__":
    unittest.main()
