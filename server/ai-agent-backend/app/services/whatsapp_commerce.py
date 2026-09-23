"""Account-scoped shopping actions. Model output never authorizes mutations."""
import hashlib
import html
import logging
import re
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlsplit

import httpx
from pymongo import ReturnDocument
from pymongo.errors import PyMongoError
from app.config.settings import settings
from app.ai.store_knowledge import StoreKnowledge

logger = logging.getLogger(__name__)


class WhatsAppCommerce:
    _NUMBER_WORDS = {
        "one": 1,
        "two": 2,
        "three": 3,
        "four": 4,
        "five": 5,
        "six": 6,
        "seven": 7,
        "eight": 8,
        "nine": 9,
        "ten": 10,
        "eleven": 11,
        "twelve": 12,
        "thirteen": 13,
        "fourteen": 14,
        "fifteen": 15,
        "sixteen": 16,
        "seventeen": 17,
        "eighteen": 18,
        "nineteen": 19,
        "twenty": 20,
        "ek": 1,
        "do": 2,
        "teen": 3,
        "chaar": 4,
        "paanch": 5,
        "che": 6,
        "saat": 7,
        "aath": 8,
        "nau": 9,
        "das": 10,
        "एक": 1,
        "दो": 2,
        "तीन": 3,
        "okati": 1,
        "okka": 1,
        "rendu": 2,
        "moodu": 3,
        "nalugu": 4,
        "aidu": 5,
        "aaru": 6,
        "edu": 7,
        "enimidi": 8,
        "tommidi": 9,
        "padi": 10,
        "ఒకటి": 1,
        "రెండు": 2,
        "మూడు": 3,
    }

    def __init__(self, store_database):
        self.db = store_database

    @staticmethod
    def _product_label(product) -> str:
        """Keep WhatsApp replies readable when catalogue titles are very long."""
        name = re.sub(r"\s+", " ", str(product.name or "this item")).strip()
        return name if len(name) <= 90 else name[:87].rstrip() + "…"

    async def handle(self, message, conversation, state, product_tools, business_id):
        text = message.lower().strip()
        account = hashlib.sha256(f"{business_id}:{conversation.get('external_customer_ref')}".encode()).hexdigest()
        origin = (settings.ecommerce_storefront_url or "").rstrip("/")
        result = lambda reply, products=None: (reply, products or [], "none")
        if text in {"stop", "unsubscribe", "opt out", "stop updates"}:
            await self.db.whatsapp_order_subscriptions.update_many(
                {"account": account},
                {"$set": {"active": False, "opted_out_at": datetime.now(timezone.utc)}},
            )
            await self.db.whatsapp_account_links.delete_one({"_id": account})
            state.pop("purchase", None)
            return result("WhatsApp order updates and connected-account access are turned off. Message us again anytime to shop.")
        if re.search(r"\b(human|real person|speak to staff|talk to staff|agent please)\b", text):
            state["handoff_requested"] = True
            return result("I've marked this conversation for the store team. They'll reply here when available.")
        if text in {"disconnect", "unlink", "disconnect account"}:
            await self.db.whatsapp_account_links.delete_one({"_id": account})
            state.pop("purchase", None)
            return result("Your store account is disconnected from this WhatsApp chat.")
        if re.search(r"\b(my orders?|order status|track|tracking|payment status|where is my|my delivery)\b", text):
            if not await self._linked(account):
                return result(await self._link_message(account, origin, recipient=conversation.get("external_customer_ref"), return_path="/orders"))
            order_id_match = re.search(r"\b[a-f0-9]{24}\b", text)
            path = f"/orders/{order_id_match[0]}" if order_id_match else "/orders"
            status, data = await self._request("GET", path, account)
            if status == 401:
                return result(await self._link_message(account, origin, recipient=conversation.get("external_customer_ref"), return_path="/orders"))
            if status == 404 and order_id_match:
                return result("I couldn't find that order on your connected account. Please check the order ID.")
            if status != 200:
                return result("I couldn't check your orders just now. Please try again shortly.")
            orders = [data["order"]] if data.get("order") else data.get("orders", [])
            if not orders:
                return result("There are no orders on your connected account yet.")
            if not order_id_match and re.search(r"\b(second|2nd)\b", text) and len(orders) > 1:
                orders = [orders[1]]
            elif not order_id_match and re.search(r"\b(last|latest|most recent)\b", text):
                orders = [orders[0]]
            rows = [f"Order {o['_id']}: {o.get('orderStatus', 'Unknown')}; payment {o.get('status', 'Unknown')}; {o.get('currency', 'INR')} {o.get('total', '')}" for o in orders]
            return result(("Order details:\n" if len(orders) == 1 else "Your latest orders:\n") + "\n".join(rows) + (f"\nManage securely: {origin}/orders" if origin.startswith("https://") else ""))
        if re.search(r"\b(cancel my|return my|refund my)\b", text):
            return result(f"Please open the order on your account to submit the request: {origin}/orders" if origin.startswith("https://") else "The public store URL is not configured. Please ask the store team for help.")
        if re.search(r"\b(can i pay|pay here|payment link|upi|gpay|phonepe|razorpay|cash on delivery|\bcod\b|payment failed)\b", text):
            pending = state.get("purchase") or state.get("last_checkout_purchase")
            if re.search(r"payment link|payment failed|retry|continue", text) and pending:
                return result(await self._checkout_retry_message(account, origin, conversation, state, product_tools, business_id, pending))
            return result(
                "Payment is completed securely on the Maitrova website through Razorpay, or by COD when the selected products are eligible. Never send a UPI PIN, OTP, or card details in WhatsApp. Complete your product selection and I will send the secure checkout link."
            )
        if re.search(r"\b(new link|fresh link|retry checkout|continue checkout|send (?:the )?link again|link (?:has |is )?(?:been )?expired|expired link|link not working)\b", text):
            pending = state.get("last_checkout_purchase")
            if pending:
                return result(await self._checkout_retry_message(account, origin, conversation, state, product_tools, business_id, pending))
            return result("No problem. Tell me the product, size, and quantity again and I’ll create a fresh checkout link.")
        if text in {"checkout", "my cart", "show cart", "open cart"}:
            destination = "/checkout" if text == "checkout" else "/cart"
            return result(f"Open securely and sign in with your store account:\n{origin}{destination}" if origin.startswith("https://") else "The public store URL is not configured. Please ask the store team for help.")
        if re.search(r"\b(combo|bundle|pack offer)\b", text) and not state.get("purchase"):
            return result(f"Browse current combo packs here:\n{origin}/combo-packs" if origin.startswith("https://") else "The combo-pack page is not configured yet.")
        if re.search(r"\b(compare|difference)\b", text):
            ids = conversation.get("recommended_product_ids", [])[:3]
            products = [await product_tools.get_product_details(business_id, str(pid)) for pid in ids]
            products = [p for p in products if p]
            if len(products) < 2:
                return result("Show me which two products you'd like to compare first.")
            return result("\n".join(f"{p.name}: {p.currency} {p.sale_price if p.sale_price is not None else p.price:g}; sizes {', '.join(p.attributes.get('sizes', [])) or 'none in stock'}; {p.stock} left." for p in products))
        if not state.get("purchase") and re.search(r"\b(size|sizes|stock|material|fabric|customize|customise|customization)\b", text) and not re.search(r"\b(buy|cart|order|purchase)\b", text):
            selected = state.get("selected_product_id") or conversation.get("selected_product_id")
            if selected:
                product = await product_tools.get_product_details(business_id, str(selected))
                if product and re.search(r"\b(customize|customise|customization)\b", text):
                    if product.attributes.get("customizable"):
                        product_url = product.attributes.get("product_url")
                        return result(
                            f"Yes, you can customize {self._product_label(product)} here:\n{product_url}"
                            if product_url
                            else "This product is customizable, but its designer link is not configured yet."
                        )
                    return result(
                        f"{self._product_label(product)} is sold as shown and is not customizable. "
                        + (f"Browse customizable products here:\n{origin}/customproducts" if origin.startswith("https://") else "Ask the store team about custom options.")
                    )
                if product and re.search(r"\b(size|sizes|stock)\b", text):
                    variants = product.attributes.get("variants", [])
                    return result(product.name + "\n" + "\n".join(f"{v['size']}: {v['stock']} available, {product.currency} {v['effective_price']:g}" for v in variants))
                if product:
                    return result((product.description or "Those details aren't listed for this product.")[:2000] + "\nIf that doesn't answer your question, send 'human' to ask the store team.")
        # A policy question must not advance an unfinished purchase.
        if StoreKnowledge.is_store_question(message):
            return None
        # Customers often say "I want this" after the agent has shown one product.
        # Support common Telugu wording as well as the English purchase verbs.
        buy = bool(re.search(
            r"\b(add to cart|buy|purchase|book|order|i want this|want this|need this|idi kavali|naaku idi kavali|naku idi kavali|kavali|kaavali)\b|కావాలి|నాకు ఇది కావాలి",
            text,
        ))
        purchase = state.get("purchase")
        continuing_purchase = bool(purchase)
        if not buy and not purchase:
            return None
        if text in {"cancel", "no", "never mind", "stop", "nahi", "వద్దు"}:
            state.pop("purchase", None)
            return result("Okay, I haven't added anything to your cart.")
        if not purchase:
            product_id = state.get("selected_product_id") or conversation.get("selected_product_id")
            ids = conversation.get("recommended_product_ids", [])
            choice = re.search(r"\b(?:option|product|number)\s*#?\s*([1-5])\b", text)
            if not choice:
                choice = re.fullmatch(r"(?:buy|purchase|order|add to cart)\s+([1-5])", text)
            if choice and int(choice[1]) <= len(ids):
                product_id = ids[int(choice[1]) - 1]
            for index, word in enumerate(["first", "second", "third", "fourth", "fifth"]):
                if re.search(rf"\b{word}\b", text) and index < len(ids):
                    product_id = ids[index]
            if not origin.startswith("https://"):
                return result("The public store URL is not configured. Please ask the store team for help.")
            if not product_id:
                return result("Which one would you like? You can tell me its name or option number.")
            purchase = {"product_id": str(product_id), "operation_id": secrets.token_hex(16)}
            state["purchase"] = purchase
        product = await product_tools.get_product_details(business_id, purchase["product_id"])
        if not product:
            state.pop("purchase", None)
            return result("That product is no longer available. Please choose another product.")
        source_type = product.attributes.get("source_type")
        if source_type in {"drop", "customization"}:
            state.pop("purchase", None)
            product_url = product.attributes.get("product_url")
            if not product_url:
                return result("The product is available, but its store page is not configured yet. Please send 'human' for help.")
            if source_type == "customization":
                return result(f"Open the designer to choose the product, size, color, images, and text securely:\n{product_url}")
            return result(f"Open this drop product to choose the available size and continue securely:\n{product_url}")
        size_match = re.search(r"\b(XXL|XL|XS|S|M|L)\b", message.upper())
        quantity = self._extract_quantity(
            message,
            allow_conversational=continuing_purchase and bool(purchase.get("size") or size_match),
        )
        if size_match:
            purchase["size"] = size_match[1]
            purchase.pop("confirmed_quote", None)
        if quantity is not None:
            purchase["quantity"] = quantity
            purchase.pop("confirmed_quote", None)
        if not purchase.get("size"):
            return result("Sure — which size would you like? Available: " + ", ".join(product.attributes.get("sizes", [])))
        if not purchase.get("quantity"):
            return result(f"Great, size {purchase['size']}. How many would you like?")
        variant = next((v for v in product.attributes.get("variants", []) if v["size"] == purchase["size"]), None)
        quantity = purchase["quantity"]
        if quantity < 1 or quantity > 20 or not variant or variant["stock"] < quantity:
            purchase.pop("quantity", None)
            purchase.pop("confirmed_quote", None)
            return result("That size and quantity aren’t available together right now. Please try another size or quantity (up to 20).")
        price = variant["effective_price"]
        confirmations = {"confirm", "yes", "yes confirm", "haan", "ha", "avunu", "sare", "हाँ", "అవును", "సరే"}
        is_confirmation = text in confirmations or bool(re.search(r"\b(?:please )?confirm(?: chey| cheyyi)?\b|కన్ఫర్మ్ చేయి", text))
        if purchase.get("confirmed_quote") != price or not is_confirmation:
            purchase["confirmed_quote"] = price
            return result(
                f"Just checking before I add it: {quantity} × {self._product_label(product)} "
                f"in size {purchase['size']} at {product.currency} {price:g} each. "
                "Would you like me to add it to your cart?"
            )
        if not await self._linked(account):
            checkout_purchase = {**purchase, "expected_price": price}
            link_message = await self._link_message(
                account,
                origin,
                recipient=conversation.get("external_customer_ref"),
                purchase=checkout_purchase,
                return_path="/checkout",
            )
            state["last_checkout_purchase"] = checkout_purchase
            state.pop("purchase", None)
            return result(link_message)
        status, data = await self._request("POST", "/cart", account, {**purchase, "expected_price": price})
        if status in {200, 201}:
            state.pop("purchase", None)
            return result(f"All set — it’s in your cart. You can finish your address and payment securely here:\n{origin}/checkout")
        if status == 401:
            checkout_purchase = {**purchase, "expected_price": price}
            link_message = await self._link_message(account, origin, recipient=conversation.get("external_customer_ref"), purchase=checkout_purchase, return_path="/checkout")
            state["last_checkout_purchase"] = checkout_purchase
            state.pop("purchase", None)
            return result(link_message)
        return result(data.get("message") or "I couldn't confirm the cart update. Please check your cart before trying again.")

    async def _checkout_retry_message(self, account, origin, conversation, state, product_tools, business_id, pending):
        product = await product_tools.get_product_details(business_id, str(pending.get("product_id") or ""))
        if not product:
            state.pop("last_checkout_purchase", None)
            return "That product is no longer available. Please choose another product."
        variant = next((item for item in product.attributes.get("variants", []) if item.get("size") == pending.get("size")), None)
        quantity = int(pending.get("quantity") or 0)
        if not variant or quantity < 1 or quantity > 20 or int(variant.get("stock") or 0) < quantity:
            state.pop("last_checkout_purchase", None)
            return "That size or quantity is no longer available. Please choose an in-stock option again."
        # Reissuing a link is not a second purchase: retain the cart operation ID.
        refreshed = {**pending, "expected_price": variant["effective_price"], "operation_id": pending.get("operation_id") or secrets.token_hex(16)}
        state["last_checkout_purchase"] = refreshed
        return await self._link_message(
            account,
            origin,
            recipient=conversation.get("external_customer_ref"),
            purchase=refreshed,
            return_path="/checkout",
        )

    async def _link_message(self, account: str, origin: str, recipient: str | None = None, purchase: dict | None = None, return_path: str = "/checkout") -> str:
        if not origin.startswith("https://"):
            return "Account linking needs the public store URL configured. A store teammate can help."
        if not re.fullmatch(r"\d{7,15}", str(recipient or "")):
            return "I couldn't create the checkout link because the WhatsApp recipient is invalid. Please ask the store team for help."

        now = datetime.now(timezone.utc)
        hour_bucket = now.strftime("%Y%m%d%H")
        limit_record = await self.db.whatsapp_link_rate_limits.find_one_and_update(
            {"_id": f"{account}:{hour_bucket}"},
            {
                "$inc": {"count": 1},
                "$setOnInsert": {"expiresAt": now + timedelta(hours=2)},
            },
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        if int(limit_record.get("count") or 0) > getattr(settings, "whatsapp_checkout_links_per_hour", 10):
            return "Too many secure links were requested. Please wait and try again later, or send 'human' for help."

        # The AI agent and ecommerce backend intentionally share appdb. Writing
        # the one-time request here avoids a network/auth dependency while the
        # website still performs login, live price/stock checks, and cart writes.
        token = secrets.token_urlsafe(32)
        expires_at = now + timedelta(minutes=15)
        try:
            await self.db.whatsapp_link_requests.insert_one({
                "_id": hashlib.sha256(token.encode()).hexdigest(),
                "account": account,
                "recipient": str(recipient),
                "purchase": purchase,
                "return_path": return_path if return_path in {"/checkout", "/cart", "/orders"} else "/checkout",
                "created_at": now,
                "expiresAt": expires_at,
            })
        except PyMongoError:
            logger.exception("Could not persist WhatsApp checkout link")
            return "I couldn't create a secure checkout link right now. Please try once more, or send 'human' for help."

        link = f"{origin}/whatsapp-connect?token={token}"
        parsed = urlsplit(link)
        tokens = parse_qs(parsed.query).get("token", [])
        if ((parsed.scheme, parsed.netloc) != (urlsplit(origin).scheme, urlsplit(origin).netloc)
                or parsed.path != "/whatsapp-connect" or parsed.fragment
                or len(tokens) != 1 or not re.fullmatch(r"[A-Za-z0-9_-]{40,128}", tokens[0])):
            return "The agent and store checkout addresses don't match. Please ask the store team to check both storefront URL settings."
        if purchase:
            return f"Perfect — tap this secure link to continue:\n{link}\nOnce you sign in, I’ll add the confirmed item to your cart and take you to checkout. It expires in 15 minutes. You’ll receive order updates here; send STOP anytime to turn them off."
        return f"To keep your order details private, open this secure link:\n{link}\nIt expires in 15 minutes. You’ll receive order updates here; send STOP anytime to turn them off."

    def _extract_quantity(self, message: str, allow_conversational: bool = False) -> int | None:
        """Read explicit quantities, plus natural replies when the agent just asked how many."""
        text = message.lower().strip()
        explicit = re.search(
            r"\b(?:qty|quantity)\s*(?:is\s*)?[:=]?\s*(\d{1,3})\b"
            r"|\b(\d{1,3})\s*(?:pieces?|pcs?|items?|shirts?|units?)\b",
            text,
        )
        if explicit:
            return int(explicit[1] or explicit[2])

        if not allow_conversational:
            return None

        digit = re.search(r"\b\d{1,3}\b", text)
        if digit:
            return int(digit[0])

        # Python word boundaries split Indic combining marks, so check native-script
        # number words as substrings and retain boundaries for Latin words.
        for number_word, value in self._NUMBER_WORDS.items():
            if number_word.isascii():
                if re.search(rf"\b{re.escape(number_word)}\b", text):
                    return value
            elif number_word in text:
                return value

        if re.search(r"\b(?:a\s+single|single|one\s+single)\b", text):
            return 1
        if re.search(r"\b(?:a\s+couple|couple|a\s+pair|pair)\b", text):
            return 2
        if re.search(r"\b(?:a|one)\s+(?:piece|item|shirt|unit)\b", text):
            return 1
        if re.search(r"\b(?:a\s+dozen|dozen)\b", text):
            return 12

        return None

    async def _linked(self, account):
        return await self.db.whatsapp_account_links.find_one({"_id": account, "expiresAt": {"$gt": datetime.now(timezone.utc)}})

    async def _request(self, method, path, account, payload=None):
        if not settings.whatsapp_commerce_key:
            return 503, {"message": "Store account actions are not configured yet. Please ask the store team."}
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                response = await client.request(method, settings.ecommerce_api_url.rstrip("/") + "/whatsapp-commerce" + path, json=payload, headers={"x-commerce-key": settings.whatsapp_commerce_key, "x-whatsapp-account": account})
            try:
                data = response.json()
            except ValueError:
                data = {}
            if response.status_code == 401 and not data.get("message"):
                data["message"] = "The store checkout authorization is not configured correctly."
            elif response.status_code >= 500 and not data.get("message"):
                data["message"] = "The store checkout service returned an error."
            return response.status_code, data
        except httpx.HTTPError:
            logger.exception("Store commerce request failed: %s %s", method, path)
            return 503, {"message": "The store service isn't responding. Please check your cart before retrying."}
