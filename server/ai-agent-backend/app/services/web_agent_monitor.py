"""Health of the website's tool-calling agent, for the merchant metrics endpoint.

Reads only counters from `ai_agent_metrics` (no message text). Reply rows carry
agent_mode="tools"; fallbacks to the rules agent are separate event rows with
agent_mode="tools_fallback" and a reason.
"""

from datetime import datetime

# (metric, threshold, code, severity, message)
THRESHOLDS = [
    ("busy_rate", 0.05, "ai_provider_rate_limited", "critical",
     "The AI provider rate-limited {value:.0%} of replies. Check the Gemini quota and billing."),
    ("timeout_rate", 0.05, "ai_provider_slow", "warning",
     "{value:.0%} of messages timed out and the shopper was asked to resend."),
    ("fallback_rate", 0.15, "high_fallback_rate", "warning",
     "{value:.0%} of replies fell back to the rules agent."),
    ("grounding_retry_rate", 0.20, "high_grounding_retry_rate", "warning",
     "{value:.0%} of replies needed a retry because they contained unverified prices, numbers or links."),
    ("claim_correction_rate", 0.05, "cart_claims_corrected", "warning",
     "{value:.0%} of replies claimed a cart change that hadn't happened and were corrected."),
]
SLOW_P90_MS = 12000


def _p90(values: list[int]) -> int | None:
    if not values:
        return None
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int(round(0.9 * (len(ordered) - 1))))]


async def web_agent_summary(database, business_id, since: datetime, channel: str = "web") -> dict:
    # Rows written before channels were recorded are all from the website.
    channel_filter = {"channel": "whatsapp"} if channel == "whatsapp" else {"channel": {"$ne": "whatsapp"}}
    rows = await database.ai_agent_metrics.find(
        {"business_id": business_id, "created_at": {"$gte": since}, "agent_mode": {"$in": ["tools", "tools_fallback"]}, **channel_filter},
        {"_id": 0, "agent_mode": 1, "reason": 1, "rate_limited": 1, "timed_out": 1, "grounding_retry": 1, "claim_corrected": 1,
         "cart_actions": 1, "tool_failures": 1, "handoff_requested": 1, "latency_ms": 1, "estimated_cost_usd": 1,
         "conversation_id": 1, "tool_names": 1, "account_links_sent": 1},
    ).to_list(length=20000)

    replies = [row for row in rows if row.get("agent_mode") == "tools"]
    answered = [row for row in replies if not row.get("rate_limited") and not row.get("timed_out")]
    timeouts = sum(1 for row in replies if row.get("timed_out"))
    # Timeouts reply themselves; fallback rows marked "timeout" mirror them.
    fallbacks = [row for row in rows if row.get("agent_mode") == "tools_fallback" and row.get("reason") != "timeout"]
    busy = sum(1 for row in replies if row.get("rate_limited"))
    total = len(replies) + len(fallbacks)
    reasons: dict[str, int] = {}
    for row in fallbacks:
        reason = str(row.get("reason") or "unknown")
        reasons[reason] = reasons.get(reason, 0) + 1
    tools: dict[str, int] = {}
    for row in answered:
        for name in row.get("tool_names") or []:
            tools[name] = tools.get(name, 0) + 1
    latencies = [int(row["latency_ms"]) for row in answered if row.get("latency_ms") is not None]
    conversations = {row.get("conversation_id") for row in replies if row.get("conversation_id")}
    cost = sum(float(row.get("estimated_cost_usd") or 0) for row in replies)

    def rate(count: int, base: int) -> float:
        return round(count / base, 4) if base else 0.0

    summary = {
        "replies": len(answered),
        "busy_replies": busy,
        "timeouts": timeouts,
        "fallbacks": len(fallbacks),
        "fallback_reasons": dict(sorted(reasons.items(), key=lambda item: -item[1])),
        "grounding_retries": sum(1 for row in answered if row.get("grounding_retry")),
        "claim_corrections": sum(1 for row in answered if row.get("claim_corrected")),
        "cart_actions": sum(int(row.get("cart_actions") or 0) for row in answered),
        "tool_failures": sum(int(row.get("tool_failures") or 0) for row in answered),
        "handoffs": sum(1 for row in answered if row.get("handoff_requested")),
        "account_links_sent": sum(int(row.get("account_links_sent") or 0) for row in answered),
        "tool_usage": dict(sorted(tools.items(), key=lambda item: -item[1])),
        "average_latency_ms": round(sum(latencies) / len(latencies)) if latencies else None,
        "p90_latency_ms": _p90(latencies),
        "conversations": len(conversations),
        "estimated_cost_usd": round(cost, 6),
        "cost_per_conversation_usd": round(cost / len(conversations), 6) if conversations else 0.0,
    }
    summary["rates"] = {
        "busy_rate": rate(busy, total),
        "timeout_rate": rate(timeouts, total),
        "fallback_rate": rate(len(fallbacks), total),
        "grounding_retry_rate": rate(summary["grounding_retries"], len(answered)),
        "claim_correction_rate": rate(summary["claim_corrections"], len(answered)),
    }
    summary["alerts"] = web_agent_alerts(summary)
    if channel == "whatsapp":
        for alert in summary["alerts"]:
            alert["code"] = "whatsapp_" + alert["code"]
            alert["message"] = "WhatsApp: " + alert["message"]
    return summary


def web_agent_alerts(summary: dict) -> list[dict[str, str]]:
    if not (summary.get("replies") or summary.get("busy_replies") or summary.get("timeouts") or summary.get("fallbacks")):
        return []
    alerts = []
    for metric, threshold, code, severity, message in THRESHOLDS:
        value = float((summary.get("rates") or {}).get(metric) or 0)
        if value >= threshold:
            alerts.append({"code": code, "severity": severity, "metric": metric, "message": message.format(value=value)})
    p90 = summary.get("p90_latency_ms")
    if p90 and p90 > SLOW_P90_MS:
        alerts.append({
            "code": "slow_replies", "severity": "warning", "metric": "p90_latency_ms",
            "message": f"1 in 10 replies took longer than {p90 / 1000:.1f}s.",
        })
    return alerts
