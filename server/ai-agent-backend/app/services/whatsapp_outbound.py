"""Messages the store sends first: team replies from the dashboard and order updates.

This service is the only place (besides AI replies) that sends WhatsApp
messages, so Meta credentials live in one service. The Express backend calls
it through the key-protected internal routes in app/routes/whatsapp.py.

Meta's rule: free-form text only within 24 hours of the customer's last
message; outside that window only an approved template may be sent.
"""

import hashlib
import logging
from datetime import datetime, timedelta, timezone

import httpx
from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from app.config.settings import settings
from app.repositories.message_repository import MessageRepository
from app.services.whatsapp_service import WhatsAppClient

logger = logging.getLogger(__name__)

CUSTOMER_WINDOW = timedelta(hours=24)
ORDER_STATUS_TEXT = {
    "ORDER_CONFIRMED": "confirmed",
    "PROCESSING": "being prepared",
    "PAYMENT_FAILED": "awaiting payment (the payment didn't go through)",
    "READY": "packed and ready to ship",
    "SHIPPED": "shipped",
    "DELIVERED": "delivered",
    "CANCELLED": "cancelled",
    "REFUND_PROCESSING": "refund in progress",
    "REFUND_PAID": "refunded",
    "REFUND_FAILED": "refund needs attention",
}
ORDER_NEXT_STEP = {
    "PAYMENT_FAILED": "You can retry payment from your cart.",
    "SHIPPED": "You can follow it under My Orders.",
    "DELIVERED": "We hope you love it. Reply here if anything isn't right.",
    "REFUND_FAILED": "Our team will contact you about it.",
}


class OutboundError(Exception):
    def __init__(self, status_code: int, message: str, **extra):
        super().__init__(message)
        self.status_code = status_code
        self.message = message
        self.extra = extra


def order_number(order_id: str) -> str:
    return str(order_id)[-8:].upper()


def order_update_text(event: str, number: str, total: str) -> str:
    status = ORDER_STATUS_TEXT.get(event, event.replace("_", " ").lower())
    text = f"Your Maitrova order #{number} is {status}."
    if event == "ORDER_CONFIRMED" and total:
        text += f" Total: {total}."
    if ORDER_NEXT_STEP.get(event):
        text += " " + ORDER_NEXT_STEP[event]
    return text + " Send STOP to turn off these updates."


class WhatsAppOutbound:
    def __init__(self, database, ecommerce_database, client: WhatsAppClient | None = None):
        self.db = database
        self.ecommerce_db = ecommerce_database
        self.client = client or WhatsAppClient()

    async def team_reply(self, conversation_id: str, text: str, admin_id: str | None, admin_name: str | None) -> dict:
        text = str(text or "").strip()
        if not text or len(text) > 4096:
            raise OutboundError(400, "Write a reply of up to 4096 characters.")
        if not ObjectId.is_valid(conversation_id):
            raise OutboundError(400, "Invalid conversation id")
        conversation = await self.db.conversations.find_one({"_id": ObjectId(conversation_id), "channel": "whatsapp"})
        if conversation is None or not conversation.get("external_customer_ref"):
            raise OutboundError(404, "WhatsApp chat not found")

        last_customer = await self.db.messages.find_one(
            {"conversation_id": conversation["_id"], "sender": "customer"}, {"created_at": 1}, sort=[("created_at", -1)],
        )
        now = datetime.now(timezone.utc)
        last_at = last_customer.get("created_at") if last_customer else None
        if last_at is not None and last_at.tzinfo is None:
            last_at = last_at.replace(tzinfo=timezone.utc)
        if last_at is None or now - last_at > CUSTOMER_WINDOW:
            raise OutboundError(409, "WhatsApp only allows replies within 24 hours of the customer's last message. "
                                     "Wait for the customer to write again.", window_closed=True)

        try:
            sent = await self.client.send_text(str(conversation["external_customer_ref"]), text)
        except httpx.HTTPError:
            raise OutboundError(502, "WhatsApp didn't accept the message. Please try again.")
        if not sent:
            raise OutboundError(503, "WhatsApp sending is not configured on the AI service.")

        name = (admin_name or "Store team").strip()[:80]
        message = await MessageRepository(self.db).create_message(
            business_id=str(conversation["business_id"]),
            conversation_id=conversation_id,
            customer_id=str(conversation["customer_id"]) if conversation.get("customer_id") else None,
            payload={"sender": "human", "content": text, "message_type": "text",
                     "metadata": {"source": "admin_inbox", "sent_by": name,
                                  "whatsapp_message_id": ((sent.get("messages") or [{}])[0]).get("id")}},
        )
        owner = {"handoff_assigned_to": ObjectId(admin_id) if admin_id and ObjectId.is_valid(admin_id) else admin_id,
                 "handoff_assigned_name": name, "handoff_assigned_at": now}
        await self.db.conversations.update_one(
            {"_id": conversation["_id"]},
            {"$set": {"status": "handoff", "handoff_status": "assigned", "last_message_at": now, "updated_at": now,
                      **({} if conversation.get("handoff_status") == "assigned" and conversation.get("handoff_assigned_name") else owner)}},
        )
        # The team now owns the chat: the AI pauses (see WhatsAppService) until
        # the team resumes it or stops replying for a while.
        result = await self.db.whatsapp_handoff_alerts.update_many(
            {"conversation_id": conversation["_id"], "status": {"$in": ["open", "assigned"]}},
            {"$set": {"status": "assigned", "last_human_reply_at": now, "updated_at": now}},
        )
        if not result.matched_count:
            await self.db.whatsapp_handoff_alerts.insert_one({
                "business_id": conversation["business_id"], "conversation_id": conversation["_id"], "channel": "whatsapp",
                "customer_name": conversation.get("customer_name"), "external_customer_ref": conversation["external_customer_ref"],
                "status": "assigned", "reason": "team_started", "summary": "The team replied from the dashboard.",
                "urgency": "normal", "assigned_to": owner["handoff_assigned_to"], "assigned_name": name,
                "assigned_at": now, "last_human_reply_at": now, "created_at": now, "updated_at": now,
            })
        return {"sent": True, "message_id": str(message["_id"])}

    async def order_update(self, user_id: str, order_id: str, event: str, total: str | None = None) -> dict:
        event = str(event or "").strip().upper()
        if not ObjectId.is_valid(str(user_id)) or not order_id or not event:
            raise OutboundError(400, "user_id, order_id and event are required")
        subscription = await self.ecommerce_db.whatsapp_order_subscriptions.find_one(
            {"user": ObjectId(str(user_id)), "active": True}, sort=[("updatedAt", -1)],
        )
        if not subscription or not subscription.get("recipient"):
            return {"sent": False, "reason": "not_subscribed"}

        # One message per order and event, however many code paths report it.
        log_id = hashlib.sha256(f"{order_id}:{event}".encode()).hexdigest()
        now = datetime.now(timezone.utc)
        try:
            await self.ecommerce_db.whatsapp_notification_log.insert_one({
                "_id": log_id, "user": ObjectId(str(user_id)), "order": str(order_id), "event": event,
                "status": "sending", "created_at": now,
            })
        except DuplicateKeyError:
            existing = await self.ecommerce_db.whatsapp_notification_log.find_one({"_id": log_id})
            if existing and existing.get("status") in {"sent", "sending"}:
                return {"sent": False, "reason": "already_sent"}

        number = order_number(order_id)
        window = subscription.get("customer_window_expires_at")
        if window is not None and window.tzinfo is None:
            window = window.replace(tzinfo=timezone.utc)
        in_window = window is not None and window > now
        template = (settings.whatsapp_order_update_template or "").strip()
        try:
            if in_window:
                sent, kind = await self.client.send_text(subscription["recipient"], order_update_text(event, number, total or "")), "text"
            elif template:
                status = ORDER_STATUS_TEXT.get(event, event.replace("_", " ").lower())
                sent, kind = await self.client.send_template(
                    subscription["recipient"], template, settings.whatsapp_template_language, [number, status, total or "-"],
                ), "template"
            else:
                await self._log(log_id, "skipped", reason="template_required")
                return {"sent": False, "reason": "template_required"}
        except httpx.HTTPStatusError as exc:
            reason = f"meta_http_{exc.response.status_code}"
            await self._log(log_id, "failed", reason=reason)
            logger.warning("WhatsApp order update %s failed: %s", event, reason)
            return {"sent": False, "reason": reason}
        except httpx.HTTPError:
            await self._log(log_id, "failed", reason="network")
            return {"sent": False, "reason": "network"}
        if not sent:
            await self._log(log_id, "failed", reason="not_configured")
            return {"sent": False, "reason": "not_configured"}
        await self._log(log_id, "sent", kind=kind)
        return {"sent": True, "kind": kind}

    async def _log(self, log_id: str, status: str, **fields) -> None:
        await self.ecommerce_db.whatsapp_notification_log.update_one(
            {"_id": log_id}, {"$set": {"status": status, "updated_at": datetime.now(timezone.utc), **fields}},
        )
