"""Evaluate the agent's deterministic routing against the expanded dataset."""
import argparse
import json
import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).parents[1]))

from app.ai.intent_parser import IntentParser
from app.ai.language import detect_customer_language
from app.ai.store_knowledge import StoreKnowledge


ACTION_ROUTES = {
    "check_price": "check_price",
    "check_stock": "check_stock",
    "product_photos": "product_photos",
    "product_link": "product_link",
    "add_to_cart": "add_to_cart",
    "confirm_cart": "confirm_cart",
    "decline_cart": "decline_cart",
    "checkout": "checkout",
    "track_order": "track_order",
    "human_handoff": "human_handoff",
    "browse_designs": "design_library",
}

MUTATING_ACTIONS = {
    "add_to_cart", "confirm_cart", "decline_cart", "checkout",
    "remove_from_cart", "update_cart_quantity",
}


def update_context(state: dict, message: str, intent) -> dict:
    """Approximate the state transitions used by the live conversation flow.

    The evaluator has no database or real product IDs, so it uses synthetic
    option IDs. This is enough to test whether later turns inherit filters,
    resolve option numbers, and respect a pending purchase confirmation.
    """
    next_state = dict(state)
    for field in ("category", "color", "min_price", "max_price", "occasion", "size", "brand"):
        value = getattr(intent, field, None)
        if value is not None:
            next_state[field] = value
    if intent.attributes:
        next_state["attributes"] = {
            **(next_state.get("attributes") or {}),
            **intent.attributes,
        }
    if intent.intent == "product_search":
        next_state["recommended_product_ids"] = [f"option-{index}" for index in range(1, 6)]
        next_state.pop("selected_product_id", None)
    if intent.product_option:
        next_state["selected_product_id"] = f"option-{intent.product_option}"
    if intent.action == "add_to_cart":
        next_state["purchase"] = {
            "product_id": next_state.get("selected_product_id"),
            "quoted": True,
        }
    elif intent.action == "confirm_cart":
        next_state.pop("purchase", None)
        next_state["confirmed_cart"] = True
    elif intent.action == "decline_cart":
        next_state.pop("purchase", None)
        next_state["last_declined_purchase"] = True
    return next_state


def actual_route(message: str, intent, state: dict | None = None) -> str:
    if intent.action in ACTION_ROUTES:
        return ACTION_ROUTES[intent.action]
    if intent.product_option and (state or {}).get("recommended_product_ids"):
        return "product_selection"
    if (state or {}).get("attributes", {}).get("catalog_type") == "customization":
        return "customization"
    if intent.intent == "store_question" or StoreKnowledge.is_store_question(message):
        return "store_question"
    if intent.attributes.get("catalog_type") == "customization":
        return "customization"
    if intent.intent == "product_search":
        return "product_search"
    return "general_question"


def route_matches(expected: str, actual: str) -> bool:
    if expected == "product_recommendation":
        return actual == "product_search"
    # Unsupported is a dataset behavior label. The safe implementation uses
    # general_question plus a fallback/handoff rather than a dangerous action.
    if expected == "unsupported":
        return actual == "general_question"
    if expected == "product_details":
        return actual in {"product_details", "check_price", "check_stock", "product_photos"}
    return expected == actual


def main() -> int:
    cli = argparse.ArgumentParser()
    cli.add_argument("dataset", type=Path)
    args = cli.parse_args()
    cases = json.loads(args.dataset.read_text(encoding="utf-8"))
    parser = IntentParser(SimpleNamespace(is_configured=False))
    results = []
    for case in cases:
        state = dict(case.get("context") or {})
        turns = [str(turn) for turn in case.get("conversation") or [""]]
        actual = None
        message = turns[-1]
        for turn in turns:
            actual = parser._parse_with_rules(turn, state)
            state = update_context(state, turn, actual)
        route = actual_route(message, actual, state)
        expected_entities = case.get("expected_entities") or {}
        entity_failures = {}
        for key in ("category", "color", "size", "max_price", "occasion"):
            expected = expected_entities.get(key)
            if expected is not None and getattr(actual, key, None) != expected:
                entity_failures[key] = {"expected": expected, "actual": getattr(actual, key, None)}
        expected_catalog = expected_entities.get("catalog_type")
        if expected_catalog and actual.attributes.get("catalog_type") != expected_catalog:
            entity_failures["catalog_type"] = {
                "expected": expected_catalog,
                "actual": actual.attributes.get("catalog_type"),
            }
        expected_language = case.get("language")
        language = detect_customer_language(message)["language"]
        failures = []
        if not route_matches(case["expected_route"], route):
            failures.append("route")
        if entity_failures:
            failures.append("entities")
        if expected_language and expected_language != language:
            failures.append("language")
        results.append({
            "id": case["id"],
            "passed": not failures,
            "failures": failures,
            "expected_route": case["expected_route"],
            "actual_route": route,
            "expected_language": expected_language,
            "actual_language": language,
            "entity_failures": entity_failures,
            "message": message,
        })
    passed = sum(1 for result in results if result["passed"])
    summary = {
        "total": len(results),
        "passed": passed,
        "failed": len(results) - passed,
        "accuracy": round(passed / len(results), 4) if results else 0,
        "failure_breakdown": {
            key: sum(key in result["failures"] for result in results)
            for key in ("route", "entities", "language")
        },
        "failures": [result for result in results if not result["passed"]],
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0 if summary["failed"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
