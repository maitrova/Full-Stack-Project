import base64
import hashlib
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from fastapi import HTTPException, status
from pymongo import ReturnDocument

from app.ai.sales_agent import SalesAgent
from app.config.settings import settings
from app.database.mongodb import get_ecommerce_database
from app.repositories.business_repository import BusinessRepository
from app.repositories.conversation_repository import ConversationRepository
from app.repositories.message_repository import MessageRepository
from app.repositories.ecommerce_product_repository import EcommerceProductRepository
from app.tools.product_tools import ProductTools
from app.services.whatsapp_commerce import WhatsAppCommerce
from app.schemas.ai import AiChatResponse
from app.utils.object_id import parse_object_id

logger = logging.getLogger(__name__)


class WhatsAppClient:
    def __init__(
        self,
        access_token: str | None = None,
        phone_number_id: str | None = None,
        graph_api_version: str | None = None,
    ):
        self.access_token = access_token or settings.whatsapp_access_token
        self.phone_number_id = phone_number_id or settings.whatsapp_phone_number_id
        self.graph_api_version = graph_api_version or settings.whatsapp_graph_api_version

    @property
    def is_configured(self) -> bool:
        return bool(self.access_token and self.phone_number_id)

    async def send_text(self, to: str, body: str, reply_to_message_id: str | None = None) -> dict[str, Any] | None:
        if not self.is_configured:
            logger.warning("WhatsApp send skipped because access token or phone number id is missing")
            return None

        payload: dict[str, Any] = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "text",
            "text": {"preview_url": False, "body": body[:4096]},
        }
        if reply_to_message_id:
            payload["context"] = {"message_id": reply_to_message_id}

        url = f"https://graph.facebook.com/{self.graph_api_version}/{self.phone_number_id}/messages"
        headers = {"Authorization": f"Bearer {self.access_token}", "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(url, json=payload, headers=headers)
            try:
                response.raise_for_status()
            except httpx.HTTPStatusError:
                logger.error("WhatsApp send failed: %s", response.text)
                raise
            return response.json()

    async def send_image(
        self,
        to: str,
        image_url: str,
        caption: str | None = None,
        reply_to_message_id: str | None = None,
    ) -> dict[str, Any] | None:
        if not self.is_configured:
            logger.warning("WhatsApp image send skipped because access token or phone number id is missing")
            return None

        payload: dict[str, Any] = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "image",
            "image": {"link": image_url},
        }
        if caption:
            payload["image"]["caption"] = caption[:1024]
        if reply_to_message_id:
            payload["context"] = {"message_id": reply_to_message_id}

        url = f"https://graph.facebook.com/{self.graph_api_version}/{self.phone_number_id}/messages"
        headers = {"Authorization": f"Bearer {self.access_token}", "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(url, json=payload, headers=headers)
            try:
                response.raise_for_status()
            except httpx.HTTPStatusError:
                logger.error("WhatsApp image send failed: %s", response.text)
                raise
            return response.json()

    async def get_media_as_base64(self, media_id: str, fallback_mime_type: str | None = None) -> dict[str, str] | None:
        if not self.access_token:
            logger.warning("WhatsApp media download skipped because access token is missing")
            return None

        headers = {"Authorization": f"Bearer {self.access_token}"}
        metadata_url = f"https://graph.facebook.com/{self.graph_api_version}/{media_id}"
        # Meta media URLs may redirect to a short-lived CDN URL.
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            metadata_response = await client.get(metadata_url, headers=headers)
            try:
                metadata_response.raise_for_status()
            except httpx.HTTPStatusError:
                logger.error("WhatsApp media metadata fetch failed: %s", metadata_response.text)
                raise

            metadata = metadata_response.json()
            media_url = metadata.get("url")
            if not media_url:
                logger.warning("WhatsApp media metadata did not include a download URL")
                return None

            media_response = await client.get(media_url, headers=headers)
            try:
                media_response.raise_for_status()
            except httpx.HTTPStatusError:
                logger.error("WhatsApp media download failed: %s", media_response.text)
                raise

        mime_type = fallback_mime_type or metadata.get("mime_type") or media_response.headers.get("content-type") or "image/jpeg"
        if not mime_type.lower().startswith("image/"):
            logger.warning("WhatsApp media %s is not an image (%s)", media_id, mime_type)
            return None
        return {
            "image_data": base64.b64encode(media_response.content).decode("ascii"),
            "mime_type": mime_type.split(";")[0],
        }


class WhatsAppService:
    def __init__(self, database):
        self.deliveries = database.whatsapp_deliveries
        self.outbound_context = database.whatsapp_outbound_context
        self.ecommerce_database = get_ecommerce_database()
        self.business_repository = BusinessRepository(database)
        self.conversation_repository = ConversationRepository(database)
        self.sales_agent = SalesAgent(
            business_repository=self.business_repository,
            conversation_repository=self.conversation_repository,
            message_repository=MessageRepository(database),
            product_tools=ProductTools(EcommerceProductRepository(self.ecommerce_database)),
            commerce=WhatsAppCommerce(self.ecommerce_database),
        )
        self.message_repository = MessageRepository(database)
        self.client = WhatsAppClient()

    def verify_webhook(self, mode: str | None, token: str | None, challenge: str | None) -> str:
        if mode == "subscribe" and token and token == settings.whatsapp_verify_token and challenge is not None:
            return challenge
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="WhatsApp webhook verification failed")

    async def handle_webhook(self, payload: dict[str, Any]) -> dict[str, Any]:
        if payload.get("object") != "whatsapp_business_account":
            return {"status": "ignored"}

        business = await self._load_business()
        if business is None:
            return {"status": "configuration_error", "processed": 0}

        processed = 0
        for entry in payload.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                metadata = value.get("metadata", {})
                phone_number_id = metadata.get("phone_number_id")
                if settings.whatsapp_phone_number_id and phone_number_id != settings.whatsapp_phone_number_id:
                    logger.info("Ignoring WhatsApp webhook for phone_number_id %s", phone_number_id)
                    continue

                contacts_by_wa_id = {
                    contact.get("wa_id"): contact.get("profile", {}).get("name")
                    for contact in value.get("contacts", [])
                    if contact.get("wa_id")
                }

                for message in value.get("messages", []):
                    from_phone = message.get("from")
                    if not from_phone:
                        continue

                    whatsapp_message_id = message.get("id")
                    if whatsapp_message_id and await self._message_already_processed(whatsapp_message_id):
                        logger.info("Skipping duplicate WhatsApp message %s", whatsapp_message_id)
                        continue

                    # Every genuine inbound message opens/refreshes Meta's 24-hour
                    # customer-service window for built-in transactional text.
                    account = hashlib.sha256(f"{business['_id']}:{from_phone}".encode()).hexdigest()
                    await self.ecommerce_database.whatsapp_order_subscriptions.update_one(
                        {"_id": account, "active": True},
                        {
                            "$set": {
                                "customer_window_expires_at": datetime.now(timezone.utc) + timedelta(hours=24),
                                "updatedAt": datetime.now(timezone.utc),
                            }
                        },
                    )

                    if await self._rate_limited(from_phone):
                        await self.client.send_text(from_phone, "You are sending messages too quickly. Please wait a minute and try again.")
                        if whatsapp_message_id:
                            await self.deliveries.update_one(
                                {"_id": whatsapp_message_id},
                                {"$set": {"complete": True, "rate_limited": True}},
                                upsert=True,
                            )
                        processed += 1
                        continue

                    text = self._message_text(message)
                    if not text:
                        logger.info("Ignoring unsupported WhatsApp message type %s", message.get("type"))
                        continue

                    try:
                        quoted_message_id = str((message.get("context") or {}).get("id") or "") or None
                        quoted_product_id = await self._quoted_product_id(quoted_message_id, from_phone)
                        cached = await self.deliveries.find_one({"_id": whatsapp_message_id})
                        if cached and cached.get("response"):
                            await self._deliver(from_phone, whatsapp_message_id, AiChatResponse.model_validate(cached["response"]))
                            processed += 1
                            continue
                        if await self._store_handoff_message_if_needed(
                            business=business,
                            from_phone=from_phone,
                            customer_name=contacts_by_wa_id.get(from_phone),
                            text=text,
                            message=message,
                        ):
                            processed += 1
                            continue

                        image_payload = await self._message_image_payload(message)
                        ai_response = await self.sales_agent.handle_external_chat(
                            business=business,
                            message=text,
                            channel="whatsapp",
                            external_customer_ref=from_phone,
                            customer_name=contacts_by_wa_id.get(from_phone),
                            image_data=image_payload.get("image_data") if image_payload else None,
                            image_mime_type=image_payload.get("mime_type") if image_payload else None,
                            inbound_metadata={
                                "whatsapp_message_id": whatsapp_message_id,
                                "whatsapp_timestamp": message.get("timestamp"),
                                "whatsapp_type": message.get("type"),
                                "whatsapp_media_id": self._message_media_id(message),
                                "whatsapp_media_mime_type": image_payload.get("mime_type") if image_payload else None,
                                "whatsapp_quoted_message_id": quoted_message_id,
                                "whatsapp_quoted_product_id": quoted_product_id,
                            },
                            quoted_product_id=quoted_product_id,
                        )
                        await self.deliveries.update_one({"_id": whatsapp_message_id}, {"$set": {"response": ai_response.model_dump(mode="json")}}, upsert=True)
                        await self._deliver(from_phone, whatsapp_message_id, ai_response)
                        processed += 1
                    except Exception:
                        logger.exception("WhatsApp message processing failed")
                        raise

        return {"status": "ok", "processed": processed}

    async def _rate_limited(self, from_phone: str) -> bool:
        now = datetime.now(timezone.utc)
        bucket = now.strftime("%Y%m%d%H%M")
        key = hashlib.sha256(f"{from_phone}:{bucket}".encode()).hexdigest()
        database = self.deliveries.database
        record = await database.whatsapp_rate_limits.find_one_and_update(
            {"_id": key},
            {
                "$inc": {"count": 1},
                "$setOnInsert": {"created_at": now, "expires_at": now + timedelta(minutes=2)},
            },
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        return int(record.get("count") or 0) > settings.whatsapp_messages_per_minute

    async def _store_handoff_message_if_needed(
        self,
        business: dict,
        from_phone: str,
        customer_name: str | None,
        text: str,
        message: dict[str, Any],
    ) -> bool:
        conversation = await self.conversation_repository.find_by_external_customer_ref(
            business_id=str(business["_id"]),
            channel="whatsapp",
            external_customer_ref=from_phone,
        )
        if conversation is None or conversation.get("status") != "handoff":
            return False

        await self.message_repository.create_message(
            business_id=str(business["_id"]),
            conversation_id=str(conversation["_id"]),
            customer_id=str(conversation["customer_id"]) if conversation.get("customer_id") else None,
            payload={
                "sender": "customer",
                "content": text,
                "message_type": "image" if message.get("type") == "image" else "text",
                "metadata": {
                    "whatsapp_message_id": message.get("id"),
                    "whatsapp_timestamp": message.get("timestamp"),
                    "whatsapp_type": message.get("type"),
                    "whatsapp_media_id": self._message_media_id(message),
                    "handoff_paused_ai": True,
                },
            },
        )
        await self.conversation_repository.touch_last_message(str(conversation["_id"]), str(business["_id"]))
        if customer_name and not conversation.get("customer_name"):
            await self.conversation_repository.collection.update_one(
                {"_id": conversation["_id"], "business_id": business["_id"]},
                {"$set": {"customer_name": customer_name}},
            )
        logger.info("Stored WhatsApp message %s without AI reply because conversation is in handoff", message.get("id"))
        return True

    def _business_object_id(self):
        return parse_object_id(settings.whatsapp_business_id)

    async def _load_business(self) -> dict | None:
        if not settings.whatsapp_business_id:
            logger.error("WHATSAPP_BUSINESS_ID is required to process inbound WhatsApp messages")
            return None
        try:
            business_id = self._business_object_id()
        except HTTPException:
            logger.error("WHATSAPP_BUSINESS_ID must be the app Mongo business id, not the Meta WhatsApp Business Account ID")
            return None

        business = await self.business_repository.collection.find_one({"_id": business_id})
        if business is None:
            logger.error("Configured WhatsApp business was not found for WHATSAPP_BUSINESS_ID=%s", settings.whatsapp_business_id)
            return None
        return business

    async def _message_already_processed(self, whatsapp_message_id: str) -> bool:
        if not settings.whatsapp_business_id:
            return False
        existing = await self.deliveries.find_one({"_id": whatsapp_message_id, "complete": True})
        return existing is not None

    async def _deliver(self, to, message_id, response):
        delivery = await self.deliveries.find_one({"_id": message_id}) or {}
        if not delivery.get("text_sent"):
            sent = await self.client.send_text(to, response.ai_message.content, message_id)
            if not sent:
                raise RuntimeError("WhatsApp sender is not configured")
            await self._remember_outbound_context(
                sent,
                to,
                self._product_ids_mentioned(response),
                "text",
            )
            await self.deliveries.update_one({"_id": message_id}, {"$set": {"text_sent": True}})
        mode = response.ai_message.metadata.get("media_mode", "recommendations")
        if mode != "none":
            await self._send_recommended_product_images(to, response.recommended_products, gallery=mode == "gallery", delivery_id=message_id)
        await self.deliveries.update_one({"_id": message_id}, {"$set": {"complete": True}})

    def _message_text(self, message: dict[str, Any]) -> str | None:
        message_type = message.get("type")
        if message_type == "text":
            return message.get("text", {}).get("body", "").strip()
        if message_type == "button":
            return message.get("button", {}).get("text", "").strip()
        if message_type == "interactive":
            interactive = message.get("interactive", {})
            if interactive.get("type") == "button_reply":
                return interactive.get("button_reply", {}).get("title", "").strip()
            if interactive.get("type") == "list_reply":
                return interactive.get("list_reply", {}).get("title", "").strip()
        if message_type == "image":
            return message.get("image", {}).get("caption", "").strip() or "Photo enquiry"
        return None

    async def _quoted_product_id(self, quoted_message_id: str | None, from_phone: str) -> str | None:
        if not quoted_message_id or not hasattr(self, "outbound_context"):
            return None
        record = await self.outbound_context.find_one({
            "_id": quoted_message_id,
            "recipient_hash": hashlib.sha256(from_phone.encode()).hexdigest(),
            "expires_at": {"$gt": datetime.now(timezone.utc)},
        })
        product_ids = record.get("product_ids", []) if record else []
        return str(product_ids[0]) if len(product_ids) == 1 else None

    def _product_ids_mentioned(self, response) -> list[str]:
        products = response.recommended_products
        if len(products) <= 1:
            return [str(product.id) for product in products]
        body = response.ai_message.content.lower()
        mentioned = []
        for product in products:
            name = str(product.name).lower()
            url = str((product.attributes or {}).get("product_url") or "").lower()
            if (name and name in body) or (url and url in body):
                mentioned.append(str(product.id))
        return mentioned if len(mentioned) == 1 else [str(product.id) for product in products]

    async def _remember_outbound_context(self, sent: dict, to: str, product_ids: list[str], kind: str) -> None:
        if not product_ids or not hasattr(self, "outbound_context"):
            return
        now = datetime.now(timezone.utc)
        for item in sent.get("messages", []):
            outbound_id = item.get("id")
            if outbound_id:
                await self.outbound_context.update_one(
                    {"_id": str(outbound_id)},
                    {"$set": {
                        "recipient_hash": hashlib.sha256(to.encode()).hexdigest(),
                        "product_ids": [str(value) for value in product_ids],
                        "kind": kind,
                        "created_at": now,
                        "expires_at": now + timedelta(days=30),
                    }},
                    upsert=True,
                )

    def _message_media_id(self, message: dict[str, Any]) -> str | None:
        message_type = message.get("type")
        media = message.get(message_type, {}) if message_type in {"image"} else {}
        media_id = media.get("id")
        return str(media_id) if media_id else None

    async def _message_image_payload(self, message: dict[str, Any]) -> dict[str, str] | None:
        if message.get("type") != "image":
            return None

        image = message.get("image", {})
        media_id = self._message_media_id(message)
        if not media_id:
            logger.warning("WhatsApp image message did not include a media id")
            return None

        try:
            return await self.client.get_media_as_base64(media_id, image.get("mime_type"))
        except Exception as exc:
            logger.warning("WhatsApp image media could not be downloaded; continuing with text only: %s", exc.__class__.__name__)
            return None

    async def _send_recommended_product_images(self, to: str, products: list[Any], gallery: bool = False, delivery_id=None) -> None:
        sent = 0
        seen_image_urls = set()
        if delivery_id:
            previous = await self.deliveries.find_one({"_id": delivery_id}) or {}
            seen_image_urls.update(previous.get("sent_images", []))
        for number, product in enumerate(products[:5], 1):
            urls = (getattr(product, "images", None) or [])[:6 if gallery else 1]
            for image_url in urls:
                if not self._is_public_image_url(image_url) or image_url in seen_image_urls:
                    continue
                try:
                    caption = self._product_image_caption(product)
                    if not gallery:
                        caption = f"Option {number}\n" + caption
                    sent_response = await self.client.send_image(to, image_url, caption)
                    if not sent_response:
                        raise RuntimeError("WhatsApp sender is not configured")
                    await self._remember_outbound_context(sent_response, to, [str(product.id)], "product_image")
                    if delivery_id:
                        await self.deliveries.update_one({"_id": delivery_id}, {"$addToSet": {"sent_images": image_url}})
                    sent += 1
                    seen_image_urls.add(image_url)
                except Exception as exc:
                    logger.warning("WhatsApp product image send failed: %s", exc.__class__.__name__)
                    if delivery_id:
                        raise
            if gallery:
                break

    def _product_image_caption(self, product: Any) -> str:
        price = product.sale_price if product.sale_price is not None else product.price
        stock_text = "Available" if product.stock > 0 else "Out of stock"
        lines = [
            str(product.name),
            f"{product.currency} {int(price)}",
            stock_text,
        ]

        details = []
        for key in ["color", "fabric", "material", "occasion", "size"]:
            value = product.attributes.get(key) if product.attributes else None
            if value:
                details.append(str(value))
        if details:
            lines.append(", ".join(details[:4]))

        lines.append("Reply with this product name or number for details.")
        if product.attributes.get("product_url"):
            lines.append(str(product.attributes["product_url"]))
        return "\n".join(lines)

    def _is_public_image_url(self, image_url: str | None) -> bool:
        return bool(image_url and image_url.lower().startswith(("http://", "https://")))
