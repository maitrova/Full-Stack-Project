from datetime import datetime, timezone
from time import monotonic
from typing import Any

from app.ai.intent_parser import IntentParser
from app.ai.tool_router import ToolRouter
from app.schemas.evaluation import EvaluationCase
from app.tools.product_tools import ProductSearchParams, ProductTools


class AgentEvaluator:
    """Run safe, read-only agent evaluations without WhatsApp or commerce writes."""

    def __init__(self, product_tools: ProductTools, intent_parser: IntentParser | None = None):
        self.product_tools = product_tools
        self.intent_parser = intent_parser or IntentParser()

    async def run(
        self,
        business_id: str,
        cases: list[EvaluationCase],
        catalog_categories: list[str] | None = None,
    ) -> dict[str, Any]:
        results = []
        for index, case in enumerate(cases, start=1):
            started = monotonic()
            state = dict(case.conversation_state)
            intent = await self.intent_parser.parse(
                case.message,
                state,
                catalog_categories=catalog_categories or [],
            )
            route = ToolRouter.decide(intent, state, {})
            products = []
            # The router is the source of truth for tool selection. A read-only
            # catalogue action may have an intent such as commerce_action
            # (price/stock/photo/link), but it still needs catalogue results in
            # the evaluation report. Never execute mutating commerce actions.
            if (
                route.route == "product_catalogue"
                and intent.attributes.get("catalog_type") != "customization"
            ):
                products = await self.product_tools.search_from_intent(
                    business_id=business_id,
                    intent=intent,
                    query=case.message,
                    exclude_ids=[],
                    limit=5,
                )

            actual = {
                "intent": intent.intent,
                "action": intent.action,
                "route": route.route,
                "route_allowed": route.allowed,
                "category": intent.category,
                "language": intent.language,
                "confidence": float(intent.confidence or 0),
                "attributes": intent.attributes,
                "product_count": len(products),
                "products": [
                    {
                        "id": product.id,
                        "name": product.name,
                        "category": product.category,
                        "source_type": product.attributes.get("source_type"),
                        "semantic_match_score": product.attributes.get("semantic_match_score"),
                    }
                    for product in products
                ],
            }
            checks = self._compare(actual, case.expected)
            results.append({
                "id": case.id or f"case-{index:03d}",
                "message": case.message,
                "expected": case.expected,
                "actual": actual,
                "checks": checks,
                "passed": all(checks.values()) if checks else True,
                "latency_ms": round((monotonic() - started) * 1000),
            })

        passed = sum(1 for result in results if result["passed"])
        return {
            "created_at": datetime.now(timezone.utc),
            "total_cases": len(results),
            "passed_cases": passed,
            "failed_cases": len(results) - passed,
            "pass_rate": round(passed / len(results), 4) if results else 0,
            "average_latency_ms": round(sum(item["latency_ms"] for item in results) / len(results)) if results else 0,
            "results": results,
        }

    @staticmethod
    def _compare(actual: dict[str, Any], expected: dict[str, Any]) -> dict[str, bool]:
        checks: dict[str, bool] = {}
        for key in ("intent", "action", "route", "category", "language"):
            if key in expected and expected[key] is not None:
                checks[key] = str(actual.get(key) or "").lower() == str(expected[key]).lower()
        if "min_results" in expected:
            checks["min_results"] = actual["product_count"] >= int(expected["min_results"])
        if "max_results" in expected:
            checks["max_results"] = actual["product_count"] <= int(expected["max_results"])
        if expected.get("exclude_customization"):
            checks["exclude_customization"] = all(
                item.get("source_type") != "customization" for item in actual["products"]
            )
        if expected.get("theme"):
            searchable = " ".join(
                f"{item.get('name', '')} {item.get('category', '')}" for item in actual["products"]
            ).lower()
            checks["theme"] = str(expected["theme"]).lower() in searchable
        return checks

