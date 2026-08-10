SAMPLE_PRODUCTS = [
    {
        "name": "Black Cotton A-Line Dress",
        "category": "Dress",
        "color": "Black",
        "price": 1499,
        "sizes": ["S", "M", "L"],
        "description": "Comfortable cotton dress for casual daily wear.",
    },
    {
        "name": "Black Party Midi Dress",
        "category": "Dress",
        "color": "Black",
        "price": 1999,
        "sizes": ["M", "L"],
        "description": "Party-ready midi dress with a clean evening look.",
    },
    {
        "name": "Red Printed Kurti",
        "category": "Kurti",
        "color": "Red",
        "price": 999,
        "sizes": ["S", "M", "L", "XL"],
        "description": "Printed kurti for casual and festive styling.",
    },
    {
        "name": "White Oversized T-Shirt",
        "category": "T-Shirt",
        "color": "White",
        "price": 799,
        "sizes": ["S", "M", "L", "XL"],
        "description": "Relaxed oversized t-shirt for everyday outfits.",
    },
    {
        "name": "Blue Denim Jacket",
        "category": "Jacket",
        "color": "Blue",
        "price": 2499,
        "sizes": ["M", "L", "XL"],
        "description": "Layering denim jacket for casual streetwear looks.",
    },
]


def build_product_context(products: list[dict] | None = None) -> str:
    # Step 3/4: These products are hardcoded sample data, not MongoDB data.
    products_to_format = products if products is not None else SAMPLE_PRODUCTS
    product_lines = []

    for index, product in enumerate(products_to_format, start=1):
        product_lines.append(
            (
                f"{index}. {product['name']} | "
                f"Category: {product['category']} | "
                f"Color: {product['color']} | "
                f"Price: Rs {product['price']} | "
                f"Sizes: {', '.join(product['sizes'])} | "
                f"Description: {product['description']}"
            )
        )

    return "\n".join(product_lines)
