"""One gentle reminder when a WhatsApp shopper goes quiet after seeing a product.

Plain text is only allowed within 24 hours of the customer's last message, so
this needs no Meta template but can only reach customers still in that window.
Every send is at most once: the conversation is claimed before sending, and a
failed send is not retried because Meta may have delivered it anyway.
"""

import asyncio
import hashlib
import logging
import re
from datetime import datetime, timedelta, timezone

from bson import ObjectId

from app.ai.language import detect_customer_language
from app.config.settings import settings
from app.repositories.message_repository import MessageRepository
from app.services.order_lookup import IST
from app.services.whatsapp_shop import WhatsAppShop

logger = logging.getLogger(__name__)

# Stops short of 24 hours so a slow cycle can't land outside Meta's window.
LATEST_AFTER_CUSTOMER = timedelta(hours=22)
# A WhatsApp thread never ends, so the limit per customer is a cooldown.
COOLDOWN = timedelta(days=7)
SEND_FROM_HOUR_IST = 9
SEND_UNTIL_HOUR_IST = 21
MAX_PER_CYCLE = 20
CYCLE_SECONDS = 300
SHOPPING_INTENTS = ["product_search", "general_question", "store_question"]

DECLINED_RE = re.compile(
    r"^\W*(?:no|nope|nah|cancel)\W*$"
    r"|\b(?:no thanks|not interested|don'?t want|dont need|don'?t need|vaddu|nahi chahiye|leave it)\b"
    r"|వద్దు|नहीं चाहिए",
    re.IGNORECASE,
)
# Same words the chat flows acknowledge as an opt-out.
OPT_OUT_RE = re.compile(
    r"^\s*(?:stop|unsubscribe|opt out|stop updates|disconnect(?: account)?|unlink(?: account)?)\s*[.!]*\s*$",
    re.IGNORECASE,
)

MESSAGES = {
    "English": ("Hi! The {product} you were looking at is still available. Want me to add it to your cart? "
                "Just reply here.{link}\n\nSend STOP to turn off these messages."),
    "Roman Telugu": ("Hi! Meeru chusina {product} inka available lo undi. Cart lo add cheyyamantara? "
                     "Ikkade reply cheyyandi.{link}\n\nIlanti messages vaddu ante STOP ani pampandi."),
    "Telugu": ("నమస్కారం! మీరు చూసిన {product} ఇంకా అందుబాటులో ఉంది. కార్ట్‌లో యాడ్ చేయమంటారా? "
               "ఇక్కడే రిప్లై చేయండి.{link}\n\nఈ మెసేజ్‌లు వద్దంటే STOP అని పంపండి."),
    "Hinglish": ("Hi! Aapne jo {product} dekha tha woh abhi available hai. Cart mein add kar doon? "
                 "Yahin reply karein.{link}\n\nYe messages band karne ke liye STOP bhejein."),
    "Hindi": ("नमस्ते! आपने जो {product} देखा था, वह अभी उपलब्ध है। क्या इसे कार्ट में जोड़ दूँ? "
              "यहीं जवाब दें।{link}\n\nये मैसेज बंद करने के लिए STOP भेजें।"),
}


def _utc(value: datetime | None) -> datetime | None:
    if value is not None and value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _digits(phone) -> str:
    return re.sub(r"\D", "", str(phone or ""))[-10:]


def _opt_out_id(business_id, phone) -> str:
    return hashlib.sha256(f"{business_id}:{phone}".encode()).hexdigest()


def is_opt_out(text: str | None) -> bool:
    return bool(OPT_OUT_RE.match(text or ""))


async def record_opt_out(database, business_id, phone: str) -> None:
    await database.whatsapp_followup_optouts.update_one(
        {"_id": _opt_out_id(business_id, phone)}, {"$set": {"opted_out_at": datetime.now(timezone.utc)}}, upsert=True,
    )


def within_send_hours(now: datetime) -> bool:
    return SEND_FROM_HOUR_IST <= now.astimezone(IST).hour < SEND_UNTIL_HOUR_IST


def followup_text(language: str | None, product_name: str, product_url: str | None) -> str:
    template = MESSAGES.get(language or "") or MESSAGES["English"]
    return template.format(product=product_name, link=f"\n{product_url}" if product_url else "")


class WhatsAppFollowups:
    def __init__(self, database, ecommerce_database, product_tools, commerce, client):
        self.db = database
        self.ecommerce_db = ecommerce_database
        self.product_tools = product_tools
        self.commerce = commerce
        self.client = client

    def _mode(self) -> str:
        return settings.whatsapp_followup_mode.strip().lower()

    def _allowed(self, phone) -> bool:
        if self._mode() == "on":
            return True
        allowlist = {_digits(item) for item in settings.whatsapp_followup_allowlist.split(",") if item.strip()}
        return self._mode() == "allowlist" and _digits(phone) in allowlist

    def _not_recently_followed(self, now: datetime) -> list[dict]:
        return [{"followup_sent_at": {"$exists": False}}, {"followup_sent_at": {"$lte": now - COOLDOWN}}]

    async def run_once(self, now: datetime | None = None) -> int:
        now = now or datetime.now(timezone.utc)
        if self._mode() not in {"on", "allowlist"} or not within_send_hours(now) or not self.client.is_configured:
            return 0
        delay = timedelta(hours=settings.whatsapp_followup_delay_hours)
        candidates = await self.db.conversations.find({
            "channel": "whatsapp",
            "status": "open",
            "current_intent": {"$in": SHOPPING_INTENTS},
            "last_message_at": {"$gte": now - LATEST_AFTER_CUSTOMER, "$lte": now - delay},
            "$or": self._not_recently_followed(now),
        }).sort("last_message_at", -1).limit(500).to_list(500)

        sent = 0
        for conversation in candidates:
            if sent >= MAX_PER_CYCLE:
                break
            try:
                if await self._follow_up(conversation, now):
                    sent += 1
            except Exception as exc:
                # Never log the exception text: it can include customer details.
                logger.warning("WhatsApp follow-up skipped (%s)", type(exc).__name__)
        return sent

    async def _follow_up(self, conversation: dict, now: datetime) -> bool:
        phone = conversation.get("external_customer_ref")
        if not phone or not self._allowed(phone):
            return False
        product = await self._product_to_mention(conversation, now)
        if product is None:
            return False
        state = conversation.get("conversation_state") or {}
        language = (state.get("reply_language") or {}).get("language") or detect_customer_language(
            "", settings.whatsapp_default_language,
        )["language"]
        text = followup_text(language, product.name, product.attributes.get("product_url"))

        claim = await self.db.conversations.update_one(
            {"_id": conversation["_id"], "last_message_at": conversation["last_message_at"],
             "$or": self._not_recently_followed(now)},
            {"$set": {"followup_sent_at": now, "followup_status": "sending", "followup_product_id": product.id}},
        )
        if not claim.modified_count:
            return False

        try:
            sent = await self.client.send_text(str(phone), text)
        except Exception as exc:
            logger.warning("WhatsApp follow-up send failed (%s)", type(exc).__name__)
            sent = None
        if not sent:
            await self.db.conversations.update_one({"_id": conversation["_id"]}, {"$set": {"followup_status": "failed"}})
            return False

        customer_id = conversation.get("customer_id")
        await MessageRepository(self.db).create_message(
            business_id=str(conversation["business_id"]),
            conversation_id=str(conversation["_id"]),
            customer_id=str(customer_id) if customer_id else None,
            payload={"sender": "ai", "content": text, "message_type": "text",
                     "metadata": {"source": "follow_up", "selected_product_id": product.id,
                                  "whatsapp_message_id": ((sent.get("messages") or [{}])[0]).get("id")}},
        )
        # The reply ("yes, add it") must reach the agent with this message and product in context.
        await self.db.conversations.update_one(
            {"_id": conversation["_id"]},
            {
                "$set": {"followup_status": "sent", "selected_product_id": product.id,
                         "conversation_state.selected_product_id": product.id, "last_message_at": now, "updated_at": now},
                "$push": {"conversation_state.recent_turns": {
                    "$each": [{"customer": "(customer went quiet; the store sent a follow-up)", "reply": text}],
                    "$slice": -12,
                }},
            },
        )
        return True

    async def _product_to_mention(self, conversation: dict, now: datetime):
        """The in-stock product to mention, or None if this customer shouldn't get a message."""
        business_id = conversation["business_id"]
        phone = conversation["external_customer_ref"]
        last_customer = await self.db.messages.find_one(
            {"conversation_id": conversation["_id"], "sender": "customer"},
            {"created_at": 1, "content": 1}, sort=[("created_at", -1)],
        )
        last_at = _utc(last_customer.get("created_at")) if last_customer else None
        delay = timedelta(hours=settings.whatsapp_followup_delay_hours)
        if last_at is None or not now - LATEST_AFTER_CUSTOMER <= last_at <= now - delay:
            return None
        if DECLINED_RE.search(str(last_customer.get("content") or "")):
            return None
        if await self.db.whatsapp_followup_optouts.find_one({"_id": _opt_out_id(business_id, phone)}, {"_id": 1}):
            return None
        # An unclaimed request doesn't pause the AI, so the status alone can't show it.
        if await self.db.whatsapp_handoff_alerts.find_one(
            {"conversation_id": conversation["_id"], "status": {"$in": ["open", "assigned"]}}, {"_id": 1},
        ):
            return None

        # Only what this chat showed recently: the saved selection can be weeks old.
        shown = await self.db.messages.find_one(
            {"conversation_id": conversation["_id"], "sender": "ai", "created_at": {"$gte": last_at - timedelta(hours=1)},
             "metadata.recommended_product_ids.0": {"$exists": True}},
            {"metadata": 1}, sort=[("created_at", -1)],
        )
        if shown is None:
            return None
        metadata = shown.get("metadata") or {}
        ids = [str(item) for item in metadata["recommended_product_ids"]]
        selected = str(metadata.get("selected_product_id") or "")
        product_id = selected if selected in ids else ids[0]

        if await self._ordered_since(business_id, phone, last_at):
            return None
        stock = await self.product_tools.check_stock(str(business_id), product_id)
        return stock["product"] if stock.get("available") else None

    async def _ordered_since(self, business_id, phone: str, last_at: datetime) -> bool:
        user_id = await WhatsAppShop(self.commerce, str(business_id), phone).order_user_id()
        if not user_id or not ObjectId.is_valid(user_id):
            return False
        order = await self.ecommerce_db.orders.find_one(
            {"user": ObjectId(user_id), "createdAt": {"$gte": last_at - timedelta(hours=1)}}, {"_id": 1},
        )
        return order is not None


async def followup_worker(database) -> None:
    from app.services.whatsapp_service import WhatsAppService

    service = WhatsAppService(database)
    followups = WhatsAppFollowups(
        database, service.ecommerce_database, service.sales_agent.product_tools, service.sales_agent.commerce, service.client,
    )
    while True:
        try:
            count = await followups.run_once()
            if count:
                logger.info("Sent %s WhatsApp follow-ups", count)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning("WhatsApp follow-up pass failed (%s)", type(exc).__name__)
        await asyncio.sleep(CYCLE_SECONDS)
