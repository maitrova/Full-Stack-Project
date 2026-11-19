"""Keep the admin inbox in step with what customers actually received on WhatsApp.

The AI reply is saved by the chat flow, but several messages go straight to
WhatsApp: photo acknowledgements, error fallbacks, rate-limit notices and
order updates. They are recorded here as chat messages with a `system_notice`
kind, so the team sees the full conversation.
"""

import logging
from datetime import timedelta
from typing import Any

from app.utils.datetime import utc_now

logger = logging.getLogger(__name__)


def outbound_message_id(sent: dict[str, Any] | None) -> str | None:
    """WhatsApp's id for a message we sent, used for delivery ticks."""
    if not isinstance(sent, dict):
        return None
    message_id = ((sent.get("messages") or [{}])[0]).get("id")
    return str(message_id) if message_id else None


async def record_outbound_notice(
    database,
    to: str,
    text: str,
    sent: dict[str, Any] | None,
    notice: str,
    *,
    after_whatsapp_message_id: str | None = None,
    extra: dict[str, Any] | None = None,
) -> None:
    """Save a message we sent outside the AI reply. Never raises: the customer
    already has the message, only the inbox copy would be missing."""
    if database is None or not sent or not to:
        return
    try:
        conversation = await database.conversations.find_one(
            {"channel": "whatsapp", "external_customer_ref": str(to)},
            sort=[("last_message_at", -1)],
        )
        if conversation is None:
            return
        created_at = utc_now()
        if after_whatsapp_message_id:
            # Place it right after the customer message it answers, which may
            # have been saved after this notice was sent.
            anchor = await database.messages.find_one(
                {"conversation_id": conversation["_id"], "metadata.whatsapp_message_id": after_whatsapp_message_id},
                {"created_at": 1},
            )
            if anchor and anchor.get("created_at"):
                created_at = anchor["created_at"] + timedelta(milliseconds=1)
        await database.messages.insert_one({
            "business_id": conversation.get("business_id"),
            "conversation_id": conversation["_id"],
            "customer_id": conversation.get("customer_id"),
            "sender": "ai",
            "content": text,
            "message_type": "text",
            "metadata": {
                "system_notice": notice,
                "whatsapp_message_id": outbound_message_id(sent),
                **(extra or {}),
            },
            "created_at": created_at,
        })
    except Exception as exc:
        logger.warning("Could not record WhatsApp %s in the inbox (%s)", notice, type(exc).__name__)
