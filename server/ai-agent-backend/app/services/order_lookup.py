"""Read-only order lookup for the website chat.

Orders are returned only to their owner: the signed-in account, or a guest who
gives the order number plus the account email/phone or delivery mobile number.
Summaries never include addresses, payment ids, or bank details.
"""

import hashlib
import re
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.config.settings import settings

# India has no daylight saving, so a fixed offset is exact and avoids needing
# a time zone database (absent on Windows without the tzdata package).
IST = timezone(timedelta(hours=5, minutes=30), "IST")
ORDER_STATUS_LABELS = {
    "PROCESSING": "Being prepared",
    "READY": "Packed and ready to ship",
    "SHIPPED": "Shipped",
    "DELIVERED": "Delivered",
}
PAYMENT_STATUS_LABELS = {
    "PENDING_PAYMENT": "Awaiting payment",
    "PAID": "Paid",
    "FAILED": "Payment failed",
    "CANCELLED": "Cancelled",
}
RETURN_STATUS_LABELS = {"PROCESSING": "Under review", "APPROVED": "Approved", "REJECTED": "Rejected"}
REFUND_STATUS_LABELS = {"PROCESSING": "Refund in progress", "PAID": "Refunded", "FAILED": "Refund failed"}
HISTORY_LABELS = {**ORDER_STATUS_LABELS, "PENDING_PAYMENT": "Awaiting payment", "FAILED": "Payment failed", "CANCELLED": "Cancelled"}
MIN_REFERENCE_LENGTH = 6
GUEST_FAILURES_PER_SESSION = 5
GUEST_FAILURES_PER_ORDER = 10


def normalize_reference(value: str | None) -> str:
    """'#44FE2A88' / 'order 44fe2a88' / a full id -> lower-case hex."""
    match = re.findall(r"[a-f0-9]{6,24}", str(value or "").lower())
    return max(match, key=len) if match else ""


def _phone_digits(value: str | None) -> str:
    digits = re.sub(r"\D", "", str(value or ""))
    return digits[-10:] if len(digits) >= 10 else ""


def _without_empty(value):
    if isinstance(value, dict):
        cleaned = {key: _without_empty(item) for key, item in value.items()}
        return {key: item for key, item in cleaned.items() if item not in (None, "", [], {})}
    if isinstance(value, list):
        return [_without_empty(item) for item in value]
    return value


def _when(value, with_time: bool = False) -> str | None:
    if not isinstance(value, datetime):
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    local = value.astimezone(IST)
    return local.strftime("%d %b %Y, %I:%M %p" if with_time else "%d %b %Y").lstrip("0")


class OrderLookup:
    def __init__(self, database: AsyncIOMotorDatabase):
        self.db = database

    async def recent_for_user(self, user_id: str, limit: int = 3) -> list[dict]:
        if not ObjectId.is_valid(user_id):
            return []
        orders = await self.db.orders.find({"user": ObjectId(user_id)}).sort("createdAt", -1).limit(limit).to_list(limit)
        return [await self.summarize(order) for order in orders]

    async def find_for_user(self, user_id: str, reference: str) -> dict | None:
        reference = normalize_reference(reference)
        if not ObjectId.is_valid(user_id) or len(reference) < MIN_REFERENCE_LENGTH:
            return None
        orders = await self.db.orders.find({"user": ObjectId(user_id)}).sort("createdAt", -1).limit(500).to_list(500)
        order = next((item for item in orders if str(item["_id"]).endswith(reference)), None)
        return await self.summarize(order) if order else None

    async def user_id_for_phone(self, phone: str) -> str | None:
        """The one account whose own phone number is this (Meta-verified) number.

        Delivery-address numbers are deliberately not used: a gift's recipient
        must not see the buyer's orders. Ambiguous matches return None.
        """
        digits = _phone_digits(phone)
        if not digits:
            return None
        users = await self.db.users.find({"phone": {"$regex": f"{digits}$"}}, {"_id": 1}).limit(2).to_list(2)
        return str(users[0]["_id"]) if len(users) == 1 else None

    async def find_for_guest(self, reference: str, contact: str) -> dict | None:
        """Match the order number against orders owned by the given contact.

        Only orders of accounts (or delivery addresses) that match the email or
        phone are searched, so a wrong contact can never reveal an order.
        """
        reference = normalize_reference(reference)
        if len(reference) < MIN_REFERENCE_LENGTH:
            return None
        contact = str(contact or "").strip()
        email = contact.lower() if "@" in contact else ""
        phone = _phone_digits(contact)
        if not email and not phone:
            return None

        user_filters = []
        if email:
            user_filters.append({"email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}})
        if phone:
            user_filters.append({"phone": {"$regex": f"{phone}$"}})
        user_ids = [item["_id"] for item in await self.db.users.find({"$or": user_filters}, {"_id": 1}).to_list(20)]
        address_ids = []
        if phone:
            address_ids = [
                item["_id"]
                for item in await self.db.addresses.find({"mobileNumber": {"$regex": f"{phone}$"}}, {"_id": 1}).to_list(50)
            ]
        owner_filters = []
        if user_ids:
            owner_filters.append({"user": {"$in": user_ids}})
        if address_ids:
            owner_filters.append({"deliveryAddress": {"$in": address_ids}})
        if not owner_filters:
            return None
        orders = await self.db.orders.find({"$or": owner_filters}).sort("createdAt", -1).limit(500).to_list(500)
        order = next((item for item in orders if str(item["_id"]).endswith(reference)), None)
        if order is None:
            return None
        # The caller keeps the full id so the same chat needn't re-verify.
        return {**await self.summarize(order), "order_id": str(order["_id"])}

    async def get_by_id(self, order_id: str) -> dict | None:
        """Only for an order this conversation has already verified."""
        if not ObjectId.is_valid(order_id):
            return None
        order = await self.db.orders.find_one({"_id": ObjectId(order_id)})
        return await self.summarize(order) if order else None

    async def guest_locked(self, session_id: str, reference: str) -> bool:
        records = await self.db.ai_order_lookup_attempts.find(
            {"_id": {"$in": [self._attempt_key("session", session_id), self._attempt_key("order", normalize_reference(reference))]}}
        ).to_list(2)
        counts = {record["scope"]: int(record.get("count") or 0) for record in records}
        return counts.get("session", 0) >= GUEST_FAILURES_PER_SESSION or counts.get("order", 0) >= GUEST_FAILURES_PER_ORDER

    async def record_guest_failure(self, session_id: str, reference: str) -> None:
        now = datetime.now(timezone.utc)
        for scope, value in (("session", session_id), ("order", normalize_reference(reference))):
            await self.db.ai_order_lookup_attempts.find_one_and_update(
                {"_id": self._attempt_key(scope, value)},
                {"$inc": {"count": 1}, "$setOnInsert": {"scope": scope, "expires_at": now + timedelta(hours=1)}},
                upsert=True,
                return_document=ReturnDocument.AFTER,
            )

    @staticmethod
    def _attempt_key(scope: str, value: str) -> str:
        bucket = datetime.now(timezone.utc).strftime("%Y%m%d%H")
        return hashlib.sha256(f"{scope}:{value}:{bucket}".encode()).hexdigest()

    async def summarize(self, order: dict) -> dict:
        status = order.get("status")
        order_status = order.get("orderStatus") or "PROCESSING"
        if status in {"CANCELLED", "FAILED", "PENDING_PAYMENT"}:
            current = PAYMENT_STATUS_LABELS[status]
        else:
            current = ORDER_STATUS_LABELS.get(order_status, order_status.title())
        payment = order.get("payment") or {}
        method = {"RAZORPAY": "Online payment", "COD": "Cash on delivery"}.get(payment.get("method"), "Not selected")
        order_id = str(order["_id"])
        storefront = str(settings.ecommerce_storefront_url or "").rstrip("/")
        summary: dict = {
            "order_number": order_id[-8:].upper(),
            "placed_on": _when(order.get("createdAt")),
            "current_status": current,
            "payment": {"method": method, "status": PAYMENT_STATUS_LABELS.get(status, status)},
            "total": order.get("total"),
            "currency": order.get("currency") or "INR",
            "items": await self._items(order.get("items") or []),
            "timeline": [
                {"status": HISTORY_LABELS.get(step.get("status"), str(step.get("status") or "").title()), "at": _when(step.get("at"), with_time=True)}
                for step in order.get("statusHistory") or []
            ],
            "order_page": f"{storefront}/orders" if storefront.startswith("https://") else None,
        }
        if payment.get("failureReason") and status == "FAILED":
            summary["payment"]["failure_reason"] = payment["failureReason"]
        if order.get("deliveredAt"):
            summary["delivered_on"] = _when(order["deliveredAt"])
        if status == "CANCELLED":
            summary["cancelled_on"] = _when(order.get("cancelledAt"))
            summary["cancelled_by"] = {"CUSTOMER": "You", "ADMIN": "The store"}.get(order.get("cancelledByRole"), None)
            if order.get("cancellationReason"):
                summary["cancellation_reason"] = order["cancellationReason"]
        refund_status = payment.get("refundStatus")
        if refund_status in REFUND_STATUS_LABELS:
            summary["refund"] = {
                "status": REFUND_STATUS_LABELS[refund_status],
                "amount": payment.get("refundAmount"),
                "initiated_on": _when(payment.get("refundInitiatedAt")),
                "paid_on": _when(payment.get("refundPaidAt")),
            }
        return_request = order.get("returnRequest") or {}
        if return_request.get("status") in RETURN_STATUS_LABELS:
            summary["return_request"] = {
                "status": RETURN_STATUS_LABELS[return_request["status"]],
                "requested_on": _when(return_request.get("requestedAt")),
                "reason": return_request.get("reason") or None,
                "refund": REFUND_STATUS_LABELS.get(return_request.get("refundStatus")),
                "deadline": _when(return_request.get("deadlineAt")),
            }
        return _without_empty(summary)

    async def _items(self, items: list[dict]) -> list[dict]:
        ids = {
            "readymadeproducts": [item["readymadeProduct"] for item in items if item.get("readymadeProduct")],
            "dropproducts": [item["dropproduct"] for item in items if item.get("dropproduct")],
            "designs": [item["design"] for item in items if item.get("design")],
        }
        names: dict[str, str] = {}
        for collection, field in (("readymadeproducts", "title"), ("dropproducts", "name"), ("designs", "title")):
            if ids[collection]:
                for document in await self.db[collection].find({"_id": {"$in": ids[collection]}}, {field: 1}).to_list(100):
                    names[str(document["_id"])] = str(document.get(field) or "")
        result = []
        for item in items:
            reference = item.get("readymadeProduct") or item.get("dropproduct") or item.get("design")
            name = names.get(str(reference)) if reference else None
            if item.get("kind") == "COMBO":
                name = item.get("comboName") or "Combo pack"
            elif item.get("kind") == "DESIGN":
                name = f"{name} (custom design)" if name else "Custom design"
            result.append({
                "name": name or "Product",
                "size": item.get("size"),
                "qty": item.get("qty"),
                "price": item.get("unitPrice"),
            })
        return result
