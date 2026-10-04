"""Verified pricing helpers. Discounts come only from catalogue fields."""


def verified_discount(price: float | None, sale_price: float | None) -> dict | None:
    if price is None or sale_price is None or price <= 0 or sale_price >= price:
        return None
    percent = round(((price - sale_price) / price) * 100)
    if percent <= 0:
        return None
    return {
        "original_price": price,
        "sale_price": sale_price,
        "discount_percent": percent,
    }


def verified_price_text(product) -> str:
    discount = verified_discount(product.price, product.sale_price)
    if not discount:
        price = product.sale_price if product.sale_price is not None else product.price
        return f"{product.currency} {int(price)}"
    return (
        f"{product.currency} {int(discount['sale_price'])} "
        f"(was {product.currency} {int(discount['original_price'])}, "
        f"{discount['discount_percent']}% off)"
    )
