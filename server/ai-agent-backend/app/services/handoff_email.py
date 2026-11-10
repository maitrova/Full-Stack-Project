"""Emails the store team when a customer asks for a person.

The Node backend owns the Brevo key and the template, so this only reports the
new request to it. Sending happens in the background: a slow or failed email
must never delay or break the customer's chat reply, and the request is still
on the dashboard if the email is lost.
"""

import asyncio
import logging
import re

import httpx

from app.config.settings import settings

logger = logging.getLogger(__name__)

_pending: set[asyncio.Task] = set()

_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
# Order numbers are shown to customers as the last 8 hex characters of the id, e.g. #44FE2A88.
_ORDER_RE = re.compile(r"(?<![A-Za-z0-9])#?([A-Fa-f0-9]{8})(?![A-Za-z0-9])")


def _order_number(message: str | None, state: dict | None) -> str | None:
    """The order the customer is asking about: one they typed, else the last one they looked up."""
    for match in _ORDER_RE.finditer(message or ""):
        if re.search(r"\d", match.group(1)):  # skip plain words such as "deadbeef"
            return match.group(1).upper()
    verified = (state or {}).get("verified_order_ids") or []
    return str(verified[-1])[-8:].upper() if verified else None


async def _send(payload: dict) -> None:
    url = settings.ecommerce_api_url.rstrip("/") + "/whatsapp-commerce/handoff-email"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(url, json=payload, headers={"x-commerce-key": settings.whatsapp_commerce_key or ""})
        response.raise_for_status()
        result = response.json()
        if not result.get("sent"):
            logger.warning("Handoff email not sent: %s", result.get("reason"))
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("Handoff email failed: %s", exc)


def notify_admin_of_handoff(alert_result, conversation: dict, reason: str | None, summary: str | None,
                            urgency: str | None, contact: str | None = None, message: str | None = None,
                            state: dict | None = None) -> None:
    """Call with the alert upsert's result: only a newly opened alert sends an email."""
    if getattr(alert_result, "upserted_id", None) is None or not settings.whatsapp_commerce_key:
        return
    channel = conversation.get("channel") or "web"
    # On WhatsApp the external ref is the customer's number; on the web it is only a session id.
    phone = conversation.get("external_customer_ref") if channel == "whatsapp" else None
    email = contact if contact and _EMAIL_RE.fullmatch(contact.strip()) else None
    if contact and not email:
        phone = phone or contact
    customer_id = conversation.get("customer_id")
    task = asyncio.create_task(_send({
        "customer_name": conversation.get("customer_name"),
        "customer_id": str(customer_id) if customer_id else None,
        "contact": contact or phone,
        "phone": phone,
        "email": email,
        "order_id": _order_number(message, state),
        "customer_message": message,
        "channel": channel,
        "reason": reason,
        "summary": summary,
        "urgency": urgency,
    }))
    _pending.add(task)
    task.add_done_callback(_pending.discard)
