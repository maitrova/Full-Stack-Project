"""Cart, checkout and account links for one WhatsApp customer.

Wraps the existing WhatsApp commerce client: the store API performs every
cart change for the linked account (live stock, price check, idempotent
operation ids), and secure one-time links connect a WhatsApp number to a
store account. Nothing here trusts the model; tools validate first.
"""

import hashlib
from datetime import datetime, timezone
from uuid import uuid4

from app.config.settings import settings
from app.services.order_lookup import OrderLookup


class WhatsAppShop:
    def __init__(self, commerce, business_id: str, phone: str):
        self.commerce = commerce
        self.phone = str(phone or "")
        # Same account reference the existing WhatsApp flow and store API use.
        self.account = hashlib.sha256(f"{business_id}:{self.phone}".encode()).hexdigest()
        self.origin = str(settings.ecommerce_storefront_url or "").rstrip("/")

    async def linked_user_id(self) -> str | None:
        link = await self.commerce.db.whatsapp_account_links.find_one(
            {"_id": self.account, "expiresAt": {"$gt": datetime.now(timezone.utc)}}, {"user": 1},
        )
        return str(link["user"]) if link and link.get("user") else None

    async def order_user_id(self) -> str | None:
        """Whose orders this customer may see: the linked account, else the
        one account whose own phone is this verified WhatsApp number."""
        return await self.linked_user_id() or await OrderLookup(self.commerce.db).user_id_for_phone(self.phone)

    async def opt_out(self) -> bool:
        """STOP: end order updates and disconnect the account. True if anything was on."""
        now = datetime.now(timezone.utc)
        updates = await self.commerce.db.whatsapp_order_subscriptions.update_many(
            {"account": self.account, "active": True}, {"$set": {"active": False, "opted_out_at": now}},
        )
        link = await self.commerce.db.whatsapp_account_links.delete_one({"_id": self.account})
        return bool(updates.modified_count or link.deleted_count)

    async def cart(self) -> tuple[int, dict]:
        return await self.commerce._request("GET", "/cart", self.account)

    async def add(self, product_id: str, size: str, quantity: int, expected_price: float) -> tuple[int, dict]:
        return await self.commerce._request("POST", "/cart", self.account, {
            "product_id": product_id, "size": size, "quantity": quantity,
            "expected_price": round(float(expected_price), 2), "operation_id": uuid4().hex,
        })

    async def update(self, item_id: str, quantity: int) -> tuple[int, dict]:
        return await self.commerce._request("PATCH", f"/cart/items/{item_id}", self.account,
                                            {"quantity": quantity, "operation_id": uuid4().hex})

    async def remove(self, item_id: str) -> tuple[int, dict]:
        return await self.commerce._request("DELETE", f"/cart/items/{item_id}", self.account,
                                            {"operation_id": uuid4().hex})

    async def link(self, return_path: str, purchase: dict | None = None) -> str:
        """A secure one-time sign-in link (15 minutes). With `purchase`, the
        store adds that item to the cart after sign-in."""
        if purchase:
            purchase = {**purchase, "operation_id": uuid4().hex, "expected_price": round(float(purchase["expected_price"]), 2)}
        return await self.commerce._link_message(self.account, self.origin, recipient=self.phone,
                                                 purchase=purchase, return_path=return_path)
