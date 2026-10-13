import unittest

from app.ai.intent_parser import IntentParser
from app.repositories.ecommerce_product_repository import EcommerceProductRepository


def catalogue_product(
    name: str,
    category: str,
    price: float = 999,
    stock: int = 5,
    sizes: list[str] | None = None,
    source: str = "readymade",
    attributes: dict | None = None,
) -> dict:
    return {
        "_id": name.lower().replace(" ", "-"),
        "name": name,
        "description": name,
        "category": category,
        "price": price,
        "sale_price": None,
        "stock": stock,
        "attributes": {
            "source_type": source,
            "sizes": sizes or ["M"],
            **(attributes or {}),
        },
        "tags": [name, category],
    }


class ProductSearchFilterTests(unittest.TestCase):
    def setUp(self):
        self.repository = EcommerceProductRepository.__new__(EcommerceProductRepository)

    def test_every_supported_category_matches_only_its_category(self):
        categories = [
            ("shirt", "Men Shirts"),
            ("t-shirt", "Men T-Shirts"),
            ("hoodie", "Hoodies"),
            ("sweatshirt", "Sweatshirts"),
            ("crop top", "Crop Tops"),
            ("saree", "Sarees"),
            ("dress", "Dresses"),
            ("jeans", "Jeans"),
            ("shoe", "Shoes"),
            ("bag", "Handbags"),
            ("accessory", "Accessories"),
        ]
        products = [catalogue_product(label, stored) for label, stored in categories]
        for requested, _ in categories:
            matches = [
                item for item in products
                if self.repository._matches(item, {"category": requested, "attributes": {}})
            ]
            self.assertEqual([item["name"] for item in matches], [requested])

    def test_budget_is_a_hard_filter_using_sale_price(self):
        within = catalogue_product("Budget Hoodie", "Hoodies", price=2200)
        within["sale_price"] = 1800
        outside = catalogue_product("Premium Hoodie", "Hoodies", price=2500)
        filters = {"category": "hoodie", "max_price": 2000, "attributes": {}}
        self.assertTrue(self.repository._matches(within, filters))
        self.assertFalse(self.repository._matches(outside, filters))

    def test_minimum_and_maximum_budget_are_both_enforced(self):
        filters = {"category": "hoodie", "min_price": 1500, "max_price": 2500, "attributes": {}}
        self.assertFalse(self.repository._matches(catalogue_product("Low", "Hoodies", 1499), filters))
        self.assertTrue(self.repository._matches(catalogue_product("Middle", "Hoodies", 2000), filters))
        self.assertFalse(self.repository._matches(catalogue_product("High", "Hoodies", 2501), filters))

    def test_size_is_a_hard_variant_filter(self):
        filters = {"category": "t-shirt", "size": "XL", "attributes": {}}
        self.assertTrue(self.repository._matches(
            catalogue_product("XL Tee", "T-Shirts", sizes=["M", "XL"]), filters,
        ))
        self.assertFalse(self.repository._matches(
            catalogue_product("Medium Tee", "T-Shirts", sizes=["M"]), filters,
        ))

    def test_catalog_type_is_a_hard_filter(self):
        for requested, source, accepted in [
            ("readymade", "readymade", True),
            ("drop product", "drop", True),
            ("customization", "customization", True),
        ]:
            for other_source in {"readymade", "drop", "customization"}:
                product = catalogue_product(f"{requested}-{other_source}", "Hoodies", source=other_source)
                result = self.repository._matches(
                    product,
                    {"category": "hoodie", "attributes": {"catalog_type": requested}},
                )
                self.assertEqual(result, other_source == source if accepted else False)

    def test_parser_extracts_search_constraints_deterministically(self):
        parser = IntentParser.__new__(IntentParser)
        intent = parser._parse_with_rules("navy hoodie under 2k in XL", {})
        self.assertEqual(intent.category, "hoodie")
        self.assertEqual(intent.color, "navy")
        self.assertEqual(intent.max_price, 2000)
        self.assertEqual(intent.size, "XL")


if __name__ == "__main__":
    unittest.main()
