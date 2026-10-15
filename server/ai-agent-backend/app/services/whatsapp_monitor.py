"""WhatsApp delivery health, for the merchant metrics endpoint.

Counts only: no message text or phone numbers. Covers what the agent summary
can't see: the inbound queue, messages Meta failed to deliver (including
template rejections and closed 24-hour windows), order updates, and handoffs
waiting for the team.
"""

from datetime import datetime, timedelta, timezone

# Meta Cloud API error codes (developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes).
TEMPLATE_ERROR_CODES = {132000, 132001, 132005, 132007, 132012, 132015, 132016, 132068, 132069}
WINDOW_ERROR_CODES = {131047}  # more than 24 hours since the customer's last message
QUEUE_STUCK_AFTER = timedelta(minutes=5)
HANDOFF_WAIT_LIMIT = timedelta(hours=2)
DELIVERY_FAILURES_WARNING = 5


async def whatsapp_health(database, ecommerce_database, business_id, since: datetime) -> dict:
    now = datetime.now(timezone.utc)

    stuck_jobs = await database.whatsapp_jobs.count_documents(
        {"status": {"$in": ["ready", "processing"]}, "created_at": {"$lte": now - QUEUE_STUCK_AFTER}},
    )
    failed_jobs = await database.whatsapp_jobs.count_documents({"status": "failed", "created_at": {"$gte": since}})
    processing_errors = await database.whatsapp_deliveries.count_documents(
        {"created_at": {"$gte": since}, "processing_error": {"$exists": True}},
    )
    rate_limited = await database.whatsapp_deliveries.count_documents({"created_at": {"$gte": since}, "rate_limited": True})

    failure_codes: dict[str, int] = {}
    template_failures = window_failures = 0
    async for row in database.whatsapp_delivery_failures.find({"created_at": {"$gte": since}}, {"error_code": 1}):
        code = row.get("error_code")
        failure_codes[str(code)] = failure_codes.get(str(code), 0) + 1
        template_failures += code in TEMPLATE_ERROR_CODES
        window_failures += code in WINDOW_ERROR_CODES

    updates = {"sent_text": 0, "sent_template": 0, "skipped_window_closed": 0, "failed": 0}
    update_failures: dict[str, int] = {}
    async for row in ecommerce_database.whatsapp_notification_log.find(
        {"created_at": {"$gte": since}, "status": {"$exists": True}}, {"status": 1, "kind": 1, "reason": 1},
    ):
        if row.get("status") == "sent":
            updates["sent_template" if row.get("kind") == "template" else "sent_text"] += 1
        elif row.get("reason") == "template_required":
            updates["skipped_window_closed"] += 1
        elif row.get("status") == "failed":
            updates["failed"] += 1
            reason = str(row.get("reason") or "unknown")
            update_failures[reason] = update_failures.get(reason, 0) + 1
    updates["failure_reasons"] = update_failures

    alerts_collection = database.whatsapp_handoff_alerts
    base = {"business_id": business_id, "channel": "whatsapp"}
    waiting = await alerts_collection.find_one({**base, "status": "open"}, {"created_at": 1}, sort=[("created_at", 1)])
    handoffs = {
        "waiting": await alerts_collection.count_documents({**base, "status": "open"}),
        "with_team": await alerts_collection.count_documents({**base, "status": "assigned"}),
        "auto_resumed": await alerts_collection.count_documents({**base, "auto_resumed": True, "resolved_at": {"$gte": since}}),
        "team_replies": await database.messages.count_documents(
            {"business_id": business_id, "sender": "human", "metadata.source": "admin_inbox", "created_at": {"$gte": since}},
        ),
        "oldest_waiting_at": waiting.get("created_at") if waiting else None,
    }

    summary = {
        "queue": {"stuck": stuck_jobs, "failed": failed_jobs},
        "processing_errors": processing_errors,
        "rate_limited_customers": rate_limited,
        "delivery_failures": sum(failure_codes.values()),
        "delivery_failure_codes": dict(sorted(failure_codes.items(), key=lambda item: -item[1])),
        "template_failures": template_failures,
        "window_closed_failures": window_failures,
        "order_updates": updates,
        "handoffs": handoffs,
    }
    summary["alerts"] = whatsapp_alerts(summary, now)
    return summary


def whatsapp_alerts(summary: dict, now: datetime) -> list[dict[str, str]]:
    alerts = []

    def add(code, severity, metric, message):
        alerts.append({"code": code, "severity": severity, "metric": metric, "message": message})

    if summary["queue"]["stuck"]:
        add("whatsapp_queue_stuck", "critical", "queue.stuck",
            f"{summary['queue']['stuck']} WhatsApp message(s) have waited over 5 minutes. Check that the AI service worker is running.")
    if summary["queue"]["failed"]:
        add("whatsapp_jobs_failed", "warning", "queue.failed",
            f"{summary['queue']['failed']} WhatsApp message(s) failed after 5 attempts and got no reply.")
    if summary["template_failures"]:
        add("whatsapp_template_rejected", "critical", "template_failures",
            f"Meta rejected {summary['template_failures']} template message(s). Check the order update template in Meta Business Manager.")
    if summary["delivery_failures"] >= DELIVERY_FAILURES_WARNING:
        add("whatsapp_delivery_failures", "warning", "delivery_failures",
            f"Meta couldn't deliver {summary['delivery_failures']} message(s) (codes: {summary['delivery_failure_codes']}).")
    updates = summary["order_updates"]
    if updates["skipped_window_closed"]:
        add("whatsapp_updates_need_template", "warning", "order_updates.skipped_window_closed",
            f"{updates['skipped_window_closed']} order update(s) weren't sent because the 24-hour window had closed and no "
            "template is set (WHATSAPP_ORDER_UPDATE_TEMPLATE).")
    if updates["failed"]:
        add("whatsapp_updates_failed", "warning", "order_updates.failed",
            f"{updates['failed']} order update(s) failed ({updates['failure_reasons']}).")
    oldest = summary["handoffs"]["oldest_waiting_at"]
    if oldest is not None:
        oldest = oldest if oldest.tzinfo else oldest.replace(tzinfo=timezone.utc)
        if now - oldest > HANDOFF_WAIT_LIMIT:
            hours = (now - oldest).total_seconds() / 3600
            add("whatsapp_handoff_waiting", "warning", "handoffs.oldest_waiting_at",
                f"A WhatsApp customer has waited {hours:.1f} hours for the team. Open WhatsApp chats → Team requested.")
    return alerts
