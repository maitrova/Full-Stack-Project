"""Run the repeatable intent regression set and print accuracy metrics."""

import argparse
import json
import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).parents[1]))

from app.ai.intent_parser import IntentParser


def matches(expected: dict, actual) -> bool:
    if actual.intent != expected["intent"]:
        return False
    if expected.get("action") and actual.action != expected["action"]:
        return False
    for key in ("category", "color", "min_price", "max_price"):
        if key in expected and getattr(actual, key) != expected[key]:
            return False
    for key, value in (expected.get("attributes") or {}).items():
        if actual.attributes.get(key) != value:
            return False
    return True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixture", default=str(Path(__file__).parents[1] / "tests" / "fixtures" / "intent_eval_cases.json"))
    args = parser.parse_args()
    cases = json.loads(Path(args.fixture).read_text(encoding="utf-8"))
    intent_parser = IntentParser(SimpleNamespace(is_configured=False))
    passed = 0
    failures = []
    for case in cases:
        actual = intent_parser._parse_with_rules(case["message"], {})
        if matches(case, actual):
            passed += 1
        else:
            failures.append({
                "message": case["message"],
                "expected": case,
                "actual": actual.model_dump(),
            })
    total = len(cases)
    print(json.dumps({
        "total": total,
        "passed": passed,
        "failed": total - passed,
        "accuracy": round(passed / total, 4) if total else 0,
        "failures": failures,
    }, indent=2, default=str))
    return 0 if not failures else 1


if __name__ == "__main__":
    raise SystemExit(main())
