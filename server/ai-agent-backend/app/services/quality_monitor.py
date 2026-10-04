"""Quality thresholds used by the merchant monitoring endpoints."""


def build_quality_alerts(summary: dict) -> list[dict[str, str]]:
    requests = int(summary.get("requests") or 0)
    if not requests:
        return []
    alerts: list[dict[str, str]] = []
    checks = [
        ("empty_search_rate", 0.30, "high_empty_search_rate", "warning"),
        ("clarification_rate", 0.25, "high_clarification_rate", "warning"),
        ("handoff_rate", 0.35, "high_handoff_rate", "warning"),
    ]
    for metric, threshold, code, severity in checks:
        value = float((summary.get("quality") or {}).get(metric) or 0)
        if value >= threshold:
            alerts.append({
                "code": code,
                "severity": severity,
                "metric": metric,
                "message": f"{metric} is {value:.0%}, above the {threshold:.0%} threshold.",
            })
    if int(summary.get("checkout_failures") or 0) > 0:
        alerts.append({
            "code": "checkout_failures",
            "severity": "critical",
            "metric": "checkout_failures",
            "message": "At least one checkout attempt failed in the selected period.",
        })
    return alerts
