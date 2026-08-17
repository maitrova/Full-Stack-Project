import httpx

from app.config import settings


def _auth_headers(auth_token: str | None) -> dict:
    if not auth_token:
        return {}

    token = auth_token.replace("Bearer ", "").strip()
    return {"Authorization": f"Bearer {token}"} if token else {}


def _item_product(item: dict) -> dict:
    for key in ["readymadeProduct", "dropproduct", "product"]:
        value = item.get(key)
        if isinstance(value, dict):
            return value
    return {}


def _item_name(item: dict) -> str:
    product = _item_product(item)
    return (
        product.get("title")
        or product.get("name")
        or item.get("name")
        or item.get("title")
        or "Product"
    )


def _item_category(item: dict) -> str:
    product = _item_product(item)
    category = product.get("category") or item.get("category") or ""
    if isinstance(category, dict):
        return category.get("name") or ""
    return str(category or "")


def _item_subcategory(item: dict) -> str:
    product = _item_product(item)
    subcategory = product.get("subCategory") or item.get("subCategory") or ""
    if isinstance(subcategory, dict):
        return subcategory.get("name") or ""
    return str(subcategory or "")


def _money(value) -> int:
    try:
        return int(float(value or 0))
    except (TypeError, ValueError):
        return 0


async def fetch_cart_summary(auth_token: str | None) -> dict | None:
    headers = _auth_headers(auth_token)
    if not headers:
        return None

    url = f"{settings.MERN_API_URL}/cart"

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            payload = response.json()
    except Exception:
        return None

    cart = payload.get("cart")
    if not isinstance(cart, dict):
        return None

    items = cart.get("items") or []
    simplified_items = []
    total = 0

    for item in items:
        qty = max(_money(item.get("qty")), 1)
        unit_price = _money(item.get("unitPrice"))
        total += qty * unit_price
        simplified_items.append(
            {
                "name": _item_name(item),
                "category": _item_category(item),
                "subCategory": _item_subcategory(item),
                "size": item.get("size") or "",
                "qty": qty,
                "unitPrice": unit_price,
            }
        )

    return {
        "items": simplified_items,
        "item_count": len(simplified_items),
        "estimated_total": total,
    }


def build_cart_text(cart: dict | None) -> str:
    if not cart or not cart.get("items"):
        return ""

    item_text = "; ".join(
        f"{item['name']} ({item.get('category') or 'Product'}, size {item.get('size') or 'N/A'}, qty {item.get('qty')})"
        for item in cart["items"][:6]
    )
    return f"Cart items: {item_text}. Estimated cart total: Rs {cart.get('estimated_total') or 0}."


def _order_item_names(order: dict) -> list[str]:
    names = []
    for item in order.get("items") or []:
        if isinstance(item, dict):
            names.append(_item_name(item))
    return [name for name in names if name]


def _order_summary(order: dict) -> dict:
    return {
        "order_id": str(order.get("_id") or ""),
        "status": order.get("status") or "",
        "order_status": order.get("orderStatus") or "",
        "payment_method": (order.get("payment") or {}).get("method") or "",
        "payment_status": (order.get("payment") or {}).get("status") or order.get("status") or "",
        "total": _money(order.get("total") or order.get("grandTotal") or order.get("amount")),
        "created_at": order.get("createdAt") or "",
        "delivered_at": order.get("deliveredAt") or "",
        "items": _order_item_names(order)[:6],
        "return_eligible": bool(order.get("returnEligible")),
        "return_deadline_at": order.get("returnDeadlineAt") or "",
    }


async def fetch_recent_orders(auth_token: str | None) -> list[dict]:
    headers = _auth_headers(auth_token)
    if not headers:
        return []

    url = f"{settings.MERN_API_URL}/orders/paid"

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            payload = response.json()
    except Exception:
        return []

    orders = payload.get("orders") or []
    if not isinstance(orders, list):
        return []

    return [_order_summary(order) for order in orders[:5]]


def build_order_tracking_response(orders: list[dict]) -> str:
    if not orders:
        return (
            "I could not find recent orders for this account. "
            "Please make sure you are logged in, or open My Orders to check manually."
        )

    latest = orders[0]
    item_names = ", ".join(latest.get("items") or ["your items"])
    order_status = latest.get("order_status") or latest.get("status") or "PROCESSING"
    payment_status = latest.get("payment_status") or "unknown"

    response = (
        f"Your latest order {latest.get('order_id')} is currently {order_status}. "
        f"Payment status is {payment_status}. Items: {item_names}."
    )

    if latest.get("return_eligible"):
        response += f" It is return eligible until {latest.get('return_deadline_at')}."

    return response


def find_order_for_message(orders: list[dict], message: str) -> dict | None:
    if not orders:
        return None

    normalized_message = message.lower()
    for order in orders:
        order_id = str(order.get("order_id") or "")
        if order_id and order_id.lower() in normalized_message:
            return order

    return orders[0]


def is_order_cancellable(order: dict | None) -> bool:
    if not order:
        return False

    status = str(order.get("status") or "").upper()
    order_status = str(order.get("order_status") or "").upper()
    payment_method = str(order.get("payment_method") or "").upper()

    return (
        status != "CANCELLED"
        and order_status == "PROCESSING"
        and (status == "PAID" or payment_method == "COD")
    )


def build_order_cancel_eligibility_response(order: dict | None) -> str:
    if not order:
        return (
            "I could not find a recent order for this account. "
            "Please make sure you are logged in, or open My Orders."
        )

    if is_order_cancellable(order):
        return (
            f"Order {order.get('order_id')} can be cancelled because it is still PROCESSING. "
            "If you want me to cancel it, say: cancel my latest order."
        )

    order_status = order.get("order_status") or order.get("status") or "unknown"
    return (
        f"Order {order.get('order_id')} cannot be cancelled from the AI right now because its status is {order_status}. "
        "Orders can only be cancelled before they move out of PROCESSING."
    )


async def cancel_order(auth_token: str | None, order_id: str) -> dict:
    headers = _auth_headers(auth_token)
    if not headers:
        return {
            "success": False,
            "message": "Please log in before cancelling an order.",
        }

    if not order_id:
        return {
            "success": False,
            "message": "I could not find which order to cancel.",
        }

    url = f"{settings.MERN_API_URL}/orders/{order_id}/cancel"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.patch(url, headers=headers)
            payload = response.json()
    except Exception:
        return {
            "success": False,
            "message": "I could not reach the order service right now.",
        }

    if response.status_code >= 400:
        return {
            "success": False,
            "message": payload.get("message") or "Order cancellation failed.",
        }

    return {
        "success": True,
        "message": payload.get("message") or "Order cancelled successfully.",
        "order": _order_summary(payload.get("order") or {}),
    }
