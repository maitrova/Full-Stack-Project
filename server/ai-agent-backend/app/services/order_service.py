import logging

from fastapi import HTTPException, status

from app.repositories.business_repository import BusinessRepository
from app.repositories.conversation_repository import ConversationRepository
from app.repositories.order_repository import OrderRepository
from app.repositories.product_repository import ProductRepository
from app.schemas.order import OrderCreate, OrderPublic, OrderUpdate
from app.schemas.user import UserPublic
from app.services.whatsapp_service import WhatsAppClient
from app.utils.datetime import utc_now
from app.utils.object_id import object_id_to_str

logger = logging.getLogger(__name__)


class OrderService:
    def __init__(
        self,
        business_repository: BusinessRepository,
        order_repository: OrderRepository,
        product_repository: ProductRepository,
        conversation_repository: ConversationRepository,
    ):
        self.business_repository = business_repository
        self.order_repository = order_repository
        self.product_repository = product_repository
        self.conversation_repository = conversation_repository

    async def _get_owned_business(self, current_user: UserPublic) -> dict:
        business = await self.business_repository.find_by_owner_id(current_user.id)
        if business is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Create a business before managing orders",
            )
        return business

    async def list_orders(self, current_user: UserPublic) -> list[OrderPublic]:
        business = await self._get_owned_business(current_user)
        orders = await self.order_repository.list_orders(str(business["_id"]))
        return [OrderPublic.model_validate(object_id_to_str(order)) for order in orders]

    async def create_order(self, payload: OrderCreate, current_user: UserPublic) -> OrderPublic:
        business = await self._get_owned_business(current_user)
        order = await self.create_order_for_business(str(business["_id"]), payload.model_dump())
        return OrderPublic.model_validate(object_id_to_str(order))

    async def create_order_for_business(self, business_id: str, payload: dict) -> dict:
        normalized = self._normalize_order(payload)
        order = await self.order_repository.create_order(business_id, normalized)
        logger.info("Created order %s for business %s", order["_id"], business_id)
        return order

    async def update_order(self, order_id: str, payload: OrderUpdate, current_user: UserPublic) -> OrderPublic:
        business = await self._get_owned_business(current_user)
        existing = await self.order_repository.find_by_id(order_id, str(business["_id"]))
        if existing is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

        update_payload = payload.model_dump(exclude_unset=True)
        merged = {**object_id_to_str(existing), **update_payload}
        normalized_update = {
            **update_payload,
            "missing_fields": self._missing_fields(merged),
        }
        order = await self.order_repository.update_order(order_id, str(business["_id"]), normalized_update)
        if order is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

        if self._should_finalize_order(existing, order):
            order = await self._finalize_confirmed_order(order, str(business["_id"]))

        return OrderPublic.model_validate(object_id_to_str(order))

    def _normalize_order(self, payload: dict) -> dict:
        items = payload.get("items") or []
        total = sum(float(item.get("unit_price") or 0) * int(item.get("quantity") or 1) for item in items)
        currency = next((item.get("currency") for item in items if item.get("currency")), "INR")
        normalized = {
            **payload,
            "items": items,
            "total_amount": total,
            "currency": currency,
        }
        normalized["missing_fields"] = self._missing_fields(normalized)
        return normalized

    def _missing_fields(self, payload: dict) -> list[str]:
        required = ["customer_name", "customer_phone", "delivery_address", "payment_method"]
        return [field for field in required if not payload.get(field)]

    def _should_finalize_order(self, existing: dict, updated: dict) -> bool:
        if existing.get("status") == "confirmed":
            return False
        return updated.get("status") == "confirmed"

    async def _finalize_confirmed_order(self, order: dict, business_id: str) -> dict:
        metadata = dict(order.get("metadata") or {})
        update: dict = {"metadata": metadata}

        if not metadata.get("stock_reduced_at"):
            stock_result = await self._reduce_stock_for_order(order, business_id)
            metadata["stock_reduced_at"] = utc_now().isoformat()
            metadata["stock_reduction"] = stock_result

        if not metadata.get("whatsapp_confirmation_sent_at"):
            sent = await self._send_whatsapp_confirmation(order, business_id)
            if sent:
                metadata["whatsapp_confirmation_sent_at"] = utc_now().isoformat()

        refreshed = await self.order_repository.update_order(str(order["_id"]), business_id, update)
        return refreshed or order

    async def _reduce_stock_for_order(self, order: dict, business_id: str) -> list[dict]:
        results = []
        for item in order.get("items", []):
            product_id = item.get("product_id")
            quantity = int(item.get("quantity") or 1)
            if not product_id:
                continue

            reduced = await self.product_repository.decrement_stock(product_id, business_id, quantity)
            results.append(
                {
                    "product_id": product_id,
                    "quantity": quantity,
                    "reduced": reduced,
                }
            )
            if not reduced:
                logger.warning("Could not reduce stock for product %s on order %s", product_id, order.get("_id"))
        return results

    async def _send_whatsapp_confirmation(self, order: dict, business_id: str) -> bool:
        conversation_id = order.get("conversation_id")
        if not conversation_id:
            return False

        conversation = await self.conversation_repository.find_by_id(str(conversation_id), business_id)
        if conversation is None or conversation.get("channel") != "whatsapp" or not conversation.get("external_customer_ref"):
            return False

        try:
            await WhatsAppClient().send_text(str(conversation["external_customer_ref"]), self._confirmation_message(order))
            return True
        except Exception:
            logger.exception("Could not send WhatsApp confirmation for order %s", order.get("_id"))
            return False

    def _confirmation_message(self, order: dict) -> str:
        item_lines = []
        for item in order.get("items", []):
            quantity = int(item.get("quantity") or 1)
            item_lines.append(f"{quantity} x {item.get('name')}")

        items_text = "\n".join(item_lines) if item_lines else "Your selected product"
        total = int(float(order.get("total_amount") or 0))
        currency = order.get("currency") or "INR"
        return "\n".join(
            [
                "Your order is confirmed.",
                items_text,
                f"Total: {currency} {total}",
                "We will process it shortly.",
            ]
        )
