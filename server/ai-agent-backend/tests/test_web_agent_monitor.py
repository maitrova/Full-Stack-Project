import unittest
from datetime import datetime, timezone
from types import SimpleNamespace

from app.services.web_agent_monitor import web_agent_alerts, web_agent_summary


class FakeMetrics:
    def __init__(self, rows):
        self.rows = rows
        self.query = None

    def find(self, query, projection):
        self.query = query
        return self

    async def to_list(self, length):
        return list(self.rows)


def reply(**fields):
    return {"agent_mode": "tools", "latency_ms": 4000, "estimated_cost_usd": 0.001, "conversation_id": "c1", **fields}


class WebAgentMonitorTests(unittest.IsolatedAsyncioTestCase):
    async def test_summary_counts_rates_and_cost(self):
        rows = [
            reply(tool_names=["search_products"], cart_actions=1),
            reply(tool_names=["search_products", "add_to_cart"], grounding_retry=True, conversation_id="c2", latency_ms=9000),
            reply(rate_limited=True, conversation_id="c3"),
            reply(claim_corrected=True, handoff_requested=True),
            {"agent_mode": "tools_fallback", "reason": "model_error"},
            {"agent_mode": "tools_fallback", "reason": "model_error"},
            {"agent_mode": "tools_fallback", "reason": "image"},
        ]
        metrics = FakeMetrics(rows)
        summary = await web_agent_summary(SimpleNamespace(ai_agent_metrics=metrics), "biz", datetime.now(timezone.utc))
        self.assertEqual((summary["replies"], summary["busy_replies"], summary["fallbacks"]), (3, 1, 3))
        self.assertEqual(summary["fallback_reasons"], {"model_error": 2, "image": 1})
        self.assertEqual(summary["tool_usage"], {"search_products": 2, "add_to_cart": 1})
        self.assertEqual((summary["grounding_retries"], summary["claim_corrections"], summary["cart_actions"]), (1, 1, 1))
        self.assertEqual(summary["conversations"], 3)
        self.assertAlmostEqual(summary["cost_per_conversation_usd"], 0.004 / 3, places=6)
        self.assertEqual(summary["rates"]["fallback_rate"], round(3 / 7, 4))
        codes = {alert["code"] for alert in summary["alerts"]}
        self.assertTrue({"ai_provider_rate_limited", "high_fallback_rate", "high_grounding_retry_rate", "cart_claims_corrected"} <= codes)
        self.assertEqual(metrics.query["agent_mode"], {"$in": ["tools", "tools_fallback"]})

    async def test_healthy_or_empty_period_has_no_alerts(self):
        self.assertEqual(web_agent_alerts({"replies": 0, "busy_replies": 0, "fallbacks": 0}), [])
        healthy = await web_agent_summary(
            SimpleNamespace(ai_agent_metrics=FakeMetrics([reply() for _ in range(20)])), "biz", datetime.now(timezone.utc),
        )
        self.assertEqual(healthy["alerts"], [])

    async def test_timeouts_are_counted_once_and_alert(self):
        rows = [reply() for _ in range(9)] + [reply(timed_out=True), {"agent_mode": "tools_fallback", "reason": "timeout"}]
        summary = await web_agent_summary(SimpleNamespace(ai_agent_metrics=FakeMetrics(rows)), "biz", datetime.now(timezone.utc))
        self.assertEqual((summary["replies"], summary["timeouts"], summary["fallbacks"]), (9, 1, 0))
        self.assertIn("ai_provider_slow", {alert["code"] for alert in summary["alerts"]})

    def test_slow_replies_alert(self):
        alerts = web_agent_alerts({"replies": 5, "rates": {}, "p90_latency_ms": 15000})
        self.assertEqual([alert["code"] for alert in alerts], ["slow_replies"])


if __name__ == "__main__":
    unittest.main()
