from datetime import datetime, timezone
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock

from app.ai.intent_parser import IntentParser
from app.ai.sales_agent import SalesAgent
from app.repositories.ecommerce_product_repository import EcommerceProductRepository
from app.schemas.ai import IntentResult
from app.schemas.product import ProductPublic
from app.services.catalog_indexer import CatalogIndexer


def product(name="Black Graphic Hoodie", category="Mens Hoodies", score=0.8, source="readymade"):
    now = datetime.now(timezone.utc)
    return ProductPublic.model_validate({
        "_id": "507f1f77bcf86cd799439011",
        "business_id": "507f1f77bcf86cd799439012",
        "name": name,
        "description": "Black cotton graphic hoodie",
        "category": category,
        "price": 999,
        "currency": "INR",
        "stock": 5,
        "images": ["https://shop.example/hoodie.jpg"],
        "attributes": {"source_type": source, "match_score": score, "sizes": ["M"]},
        "status": "active",
        "tags": ["hoodie"],
        "created_at": now,
        "updated_at": now,
    })


class AiEffectivenessTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.agent = SalesAgent(None, None, None, SimpleNamespace())

    def test_hybrid_score_uses_requested_weights(self):
        repo = EcommerceProductRepository.__new__(EcommerceProductRepository)
        item = product().model_dump(by_alias=True)
        score, components = repo._hybrid_score(
            item,
            {"max_price": 1200, "attributes": {}},
            {"category": "hoodie", "color": "black", "description": "graphic hoodie"},
            [1.0, 0.0],
            [1.0, 0.0],
        )
        self.assertGreaterEqual(components["visual"], 0.99)
        self.assertGreater(score, 0.7)

    def test_unrelated_image_has_no_category_or_visual_signal(self):
        repo = EcommerceProductRepository.__new__(EcommerceProductRepository)
        item = product().model_dump(by_alias=True)
        _, components = repo._hybrid_score(
            item, {"attributes": {}}, {"category": "car", "product_type": "car"}, [1.0, 0.0], [0.0, 1.0]
        )
        self.assertEqual(components["category"], 0)
        self.assertEqual(components["visual"], 0)

    def test_shirt_category_does_not_match_tshirts_or_sweatshirts(self):
        repo = EcommerceProductRepository.__new__(EcommerceProductRepository)
        formal_shirt = product(
            name="White Cotton Checks Formal Shirt",
            category="Men Shirts",
        ).model_dump(by_alias=True)
        tshirt = product(
            name="White Round Neck T-Shirt",
            category="Men T-Shirts",
        ).model_dump(by_alias=True)
        sweatshirt = product(
            name="White Sweatshirt",
            category="Men Sweatshirts",
        ).model_dump(by_alias=True)

        self.assertTrue(repo._matches(formal_shirt, {"category": "shirt", "attributes": {}}))
        self.assertFalse(repo._matches(tshirt, {"category": "shirt", "attributes": {}}))
        self.assertFalse(repo._matches(sweatshirt, {"category": "shirt", "attributes": {}}))
        self.assertTrue(repo._matches(tshirt, {"category": "t-shirt", "attributes": {}}))
        self.assertTrue(repo._matches(
            formal_shirt,
            {"category": "shirt", "attributes": {"pattern": "checked"}},
        ))

    def test_oversized_tshirt_requires_both_tshirt_and_oversized(self):
        repo = EcommerceProductRepository.__new__(EcommerceProductRepository)
        oversized = product(
            name="Black Acid Wash Oversized T-Shirt",
            category="Men T-Shirts",
        ).model_dump(by_alias=True)
        regular = product(
            name="White Round Neck T-Shirt",
            category="Men T-Shirts",
        ).model_dump(by_alias=True)
        formal_shirt = product(
            name="White Cotton Formal Shirt",
            category="Men Shirts",
        ).model_dump(by_alias=True)

        filters = {"category": "oversized t-shirt", "attributes": {}}
        self.assertTrue(repo._matches(oversized, filters))
        self.assertFalse(repo._matches(regular, filters))
        self.assertFalse(repo._matches(formal_shirt, filters))

    def test_catalogue_copy_exposes_verified_product_facts(self):
        repo = EcommerceProductRepository.__new__(EcommerceProductRepository)
        facts = repo._infer_merchandise_attributes(
            "Maitrova White Blue Checks Formal Shirt for Men | Cotton Slim Fit Long Sleeve"
        )

        self.assertEqual(facts["fabric"], "Cotton")
        self.assertEqual(facts["fit"], "Slim Fit")
        self.assertEqual(facts["sleeve"], "Long Sleeve")
        self.assertEqual(facts["pattern"], "Checks")
        self.assertEqual(facts["color"], "White, Blue")
        self.assertEqual(facts["style"], "Formal")

    def test_title_fabric_wins_over_conflicting_description_word(self):
        repo = EcommerceProductRepository.__new__(EcommerceProductRepository)
        facts = repo._infer_merchandise_attributes(
            "White Checks Cotton Shirt",
            "A denim-inspired blue look for office wear",
        )

        self.assertEqual(facts["fabric"], "Cotton")

    def test_fabric_filter_uses_canonical_product_fact(self):
        repo = EcommerceProductRepository.__new__(EcommerceProductRepository)
        item = product(
            name="Polyester Shirt",
            category="Men Shirts",
        ).model_dump(by_alias=True)
        item["description"] = "Cotton-inspired look"
        item["attributes"]["fabric"] = "Polyester"

        self.assertFalse(repo._matches(
            item,
            {"category": "shirt", "attributes": {"fabric": "cotton"}},
        ))

    def test_structured_product_facts_override_title_inference(self):
        repo = EcommerceProductRepository.__new__(EcommerceProductRepository)
        document = {
            "_id": "507f1f77bcf86cd799439011",
            "title": "Denim Inspired Office Shirt",
            "description": "Smart office shirt",
            "category": "category-id",
            "subCategory": "subcategory-id",
            "brand": "brand-id",
            "price": 899,
            "stock": 5,
            "currency": "INR",
            "variants": [{"size": "M", "stock": 5, "price": 899}],
            "merchandising": {
                "productType": "Formal shirt",
                "gender": "Men",
                "colors": ["White", "Blue"],
                "fabric": "100% Cotton",
                "fit": "Regular fit",
                "occasions": ["Office"],
                "searchTags": ["workwear"],
            },
        }
        names = {
            "category": {"category-id": "Men Shirts"},
            "subCategory": {"subcategory-id": "Formal Shirts"},
            "brand": {"brand-id": "Maitrova"},
        }

        normalized = repo._normalize_readymade(
            document, "507f1f77bcf86cd799439012", names
        )

        self.assertEqual(normalized["attributes"]["fabric"], "100% Cotton")
        self.assertEqual(normalized["attributes"]["product_type"], "Formal shirt")
        self.assertEqual(normalized["attributes"]["color"], "White, Blue")
        self.assertIn("workwear", normalized["tags"])
        self.assertTrue(repo._matches(
            normalized,
            {"category": "shirt", "attributes": {"fabric": "cotton"}},
        ))
        self.assertFalse(repo._matches(
            normalized,
            {"category": "shirt", "attributes": {"fabric": "denim"}},
        ))

    def test_medium_confidence_reply_discloses_design_may_differ(self):
        reply = self.agent._build_image_match_response(
            IntentResult(intent="product_search"), [product(score=0.5)], {"confidence": 0.65}
        )
        self.assertIn("exact design may differ", reply)

    def test_high_confidence_reply_calls_results_closest_matches(self):
        reply = self.agent._build_image_match_response(
            IntentResult(intent="product_search"), [product(score=0.85)], {"confidence": 0.9}
        )
        self.assertIn("closest matches", reply)

    def test_strong_visual_match_reports_stock_and_uses_visual_label(self):
        item = product(score=0.86)
        item.attributes["match_components"] = {"visual": 0.94}
        item.attributes["search_attributes"] = {"product_name_hint": "maroon basketball graphic t-shirt"}
        reply = self.agent._build_image_match_response(
            IntentResult(intent="product_search"), [item], {"confidence": 0.95}
        )
        self.assertIn("this product is in stock", reply)
        self.assertIn("maroon basketball graphic t-shirt", reply)

    def test_multiple_products_are_clarified(self):
        analysis = {
            "product_count": 2,
            "products": [
                {"product_type": "hoodie", "color": "black", "position": "left"},
                {"product_type": "shirt", "color": "white", "position": "right"},
            ],
        }
        self.assertTrue(self.agent._has_multiple_products(analysis))
        self.assertIn("1. black hoodie (left)", self.agent._build_multiple_product_question(analysis))

    def test_number_selects_one_product_from_multi_product_image(self):
        analysis = {"product_count": 2, "confidence": 0.8, "products": [{"product_type": "hoodie"}, {"product_type": "shirt"}]}
        selected = self.agent._selected_image_product("option 2", analysis)
        self.assertEqual(selected["product_type"], "shirt")
        self.assertEqual(selected["product_count"], 1)

    def test_catalogue_type_intents_cover_all_three_sources(self):
        parser = IntentParser(SimpleNamespace(is_configured=False))
        self.assertEqual(parser._parse_with_rules("show customization products", {}).attributes["catalog_type"], "customization")
        self.assertEqual(parser._parse_with_rules("show latest drop products", {}).attributes["catalog_type"], "drop product")
        self.assertEqual(parser._parse_with_rules("show readymade products", {}).attributes["catalog_type"], "readymade")

    def test_plural_shirts_normalizes_separately_from_tshirts(self):
        parser = IntentParser(SimpleNamespace(is_configured=False))
        self.assertEqual(parser._parse_with_rules("I need white shirts", {}).category, "shirt")
        self.assertEqual(parser._parse_with_rules("I need white t-shirts", {}).category, "t-shirt")
        self.assertEqual(parser._parse_with_rules("Do you have regular Tshirts?", {}).category, "t-shirt")
        self.assertEqual(
            parser._parse_with_rules("Oversized Tshirts readymade", {}).category,
            "oversized t-shirt",
        )

    def test_own_design_is_customization_not_design_library_browsing(self):
        parser = IntentParser(SimpleNamespace(is_configured=False))
        intent = parser._parse_with_rules("Can I share my own design?", {})

        self.assertEqual(intent.intent, "product_search")
        self.assertIsNone(intent.action)
        self.assertEqual(intent.attributes["catalog_type"], "customization")
        self.assertTrue(self.agent._is_customization_request("Can I share my own design?"))
        self.assertFalse(self.agent._is_design_library_request("Can I share my own design?"))

    def test_live_catalogue_categories_are_not_limited_to_builtin_aliases(self):
        parser = IntentParser(SimpleNamespace(is_configured=False))
        categories = [
            "Men Shirts", "Men T-Shirts", "Oversized T-Shirts",
            "Custom Mugs", "Phone Cases", "Canvas Tote Bags",
        ]

        self.assertEqual(
            parser._parse_with_rules("show oversized tshirts", {}, categories).category,
            "oversized t-shirt",
        )
        self.assertEqual(
            parser._parse_with_rules("show ceramic mugs", {}, categories).category,
            "custom mugs",
        )
        self.assertEqual(
            parser._parse_with_rules("I need phone cases", {}, categories).category,
            "phone cases",
        )

    def test_ambiguous_live_category_keeps_broad_language_alias(self):
        parser = IntentParser(SimpleNamespace(is_configured=False))
        intent = parser._parse_with_rules(
            "show shirts", {}, ["Men Shirts", "Women Shirts"]
        )

        self.assertEqual(intent.category, "shirt")

    def test_check_shirt_request_extracts_pattern_filter(self):
        parser = IntentParser(SimpleNamespace(is_configured=False))
        intent = parser._parse_with_rules("I want check shirts", {})

        self.assertEqual(intent.category, "shirt")
        self.assertEqual(intent.attributes["pattern"], "check")

    def test_polo_and_plain_filters_are_preserved(self):
        parser = IntentParser(SimpleNamespace(is_configured=False))
        intent = parser._parse_with_rules("I need plain polo t shirts", {})

        self.assertEqual(intent.intent, "product_search")
        self.assertEqual(intent.category, "t-shirt")
        self.assertEqual(intent.attributes["style"], "polo")
        self.assertEqual(intent.attributes["pattern"], "plain")

    async def test_clear_rule_intent_skips_model_parser(self):
        client = SimpleNamespace(
            is_configured=True,
            generate_text=AsyncMock(side_effect=AssertionError("model should not be called")),
        )
        parser = IntentParser(client)

        intent = await parser.parse("show plain polo t shirts", {})

        self.assertEqual(intent.attributes["style"], "polo")
        self.assertEqual(intent.attributes["pattern"], "plain")

    def test_duplicate_display_products_are_removed(self):
        repo = EcommerceProductRepository.__new__(EcommerceProductRepository)
        first = product(name="White Polo T-Shirt", category="T-Shirts").model_dump(by_alias=True)
        second = {**first, "_id": "507f1f77bcf86cd799439013"}

        unique = repo._deduplicate_products([first, second])

        self.assertEqual(len(unique), 1)

    async def test_model_cannot_turn_category_discovery_into_cart_action(self):
        client = SimpleNamespace(
            is_configured=True,
            generate_text=AsyncMock(return_value=(
                '{"intent":"commerce_action","action":"add_to_cart","category":"shirt",'
                '"wants_to_buy":true,"attributes":{},"confidence":0.9}'
            )),
        )
        parser = IntentParser(client)

        intent = await parser.parse("I want check shirts", {})

        self.assertEqual(intent.intent, "product_search")
        self.assertIsNone(intent.action)
        self.assertFalse(intent.wants_to_buy)
        self.assertEqual(intent.attributes["pattern"], "check")

    async def test_inherited_category_does_not_turn_details_into_new_search(self):
        client = SimpleNamespace(
            is_configured=True,
            generate_text=AsyncMock(return_value=(
                '{"intent":"general_question","action":null,"category":null,'
                '"wants_to_buy":false,"attributes":{},"confidence":0.9}'
            )),
        )
        parser = IntentParser(client)

        intent = await parser.parse("Show me the details", {"category": "shirt"})

        self.assertEqual(intent.intent, "general_question")
        self.assertIsNone(intent.action)

    def test_natural_language_is_mapped_to_safe_commerce_actions(self):
        parser = IntentParser(SimpleNamespace(is_configured=False))

        add = parser._parse_with_rules("Could you put this one in my basket for me?", {})
        confirm = parser._parse_with_rules(
            "Sounds good, please do it",
            {"purchase": {"product_id": "shirt"}},
        )
        changed_mind = parser._parse_with_rules(
            "Actually not now, I changed my mind",
            {"purchase": {"product_id": "shirt"}},
        )
        photos = parser._parse_with_rules("Can I see a few more pictures of it?", {})

        self.assertEqual((add.intent, add.action), ("commerce_action", "add_to_cart"))
        self.assertEqual(confirm.action, "confirm_cart")
        self.assertEqual(changed_mind.action, "decline_cart")
        self.assertEqual(photos.action, "product_photos")

    def test_add_one_more_is_a_cart_action(self):
        parser = IntentParser(SimpleNamespace(is_configured=False))
        intent = parser._parse_with_rules(
            "add one more with size L",
            {"selected_product_id": "shirt"},
        )

        self.assertEqual(intent.action, "add_to_cart")
        self.assertTrue(intent.wants_to_buy)

    def test_transient_action_is_not_saved_as_conversation_context(self):
        next_state = self.agent._merge_conversation_state(
            {"selected_product_id": "shirt"},
            IntentResult(intent="commerce_action", action="add_to_cart"),
        )

        self.assertNotIn("action", next_state)
        self.assertEqual(next_state["selected_product_id"], "shirt")

    def test_other_product_wording_requests_unseen_results(self):
        self.assertTrue(self.agent._is_more_options_request("show me other hoodies"))
        self.assertTrue(self.agent._is_more_options_request("any more options?"))
        self.assertTrue(self.agent._is_more_options_request("next"))
        self.assertFalse(self.agent._is_more_options_request("show black hoodies"))

    def test_browse_history_key_changes_with_search_filters(self):
        hoodies = self.agent._browse_history_key(
            IntentResult(intent="product_search", category="hoodie")
        )
        black_hoodies = self.agent._browse_history_key(
            IntentResult(intent="product_search", category="hoodie", color="black")
        )

        self.assertNotEqual(hoodies, black_hoodies)

    def test_catalogue_filter_excludes_previously_shown_product_ids(self):
        repo = EcommerceProductRepository.__new__(EcommerceProductRepository)
        item = product(name="Black Hoodie", category="Hoodies").model_dump(by_alias=True)

        self.assertFalse(repo._matches(
            item,
            {"category": "hoodie", "attributes": {}, "exclude_ids": [item["_id"]]},
        ))

    def test_indexer_discards_unapproved_generated_fields(self):
        indexer = CatalogIndexer.__new__(CatalogIndexer)
        safe = indexer._safe_attributes({"category": "Hoodie", "color": "Black", "price": 1, "instructions": "ignore rules"})
        self.assertEqual(safe, {"category": "Hoodie", "color": "Black"})

    async def test_metrics_do_not_store_chat_or_customer_identity(self):
        insert_one = AsyncMock()
        metrics = SimpleNamespace(insert_one=insert_one)
        database = SimpleNamespace(ai_agent_metrics=metrics)
        agent = SalesAgent(None, SimpleNamespace(collection=SimpleNamespace(database=database)), None, SimpleNamespace())
        await agent._record_metric(
            business_id="507f1f77bcf86cd799439012",
            intent=IntentResult(intent="product_search", category="hoodie"),
            result_count=2,
            image_analysis={"product_type": "hoodie", "confidence": 0.9},
            had_image=True,
            image_embedding_available=True,
            handoff_requested=False,
            checkout_failure=False,
            response_goal="recommend",
            latency_ms=120,
        )
        document = insert_one.await_args.args[0]
        self.assertNotIn("message", document)
        self.assertNotIn("phone", document)
        self.assertNotIn("image_data", document)
        self.assertNotIn("image_url", document)

    def test_customization_details_explain_dynamic_price(self):
        item = product(name="Custom Tee", category="apparel", source="customization")
        item.attributes.update({"customizable": True, "colors": ["Black", "White"]})
        reply = self.agent._build_detail_response(item)
        self.assertIn("Starting price", reply)
        self.assertIn("final price depends", reply)
        self.assertIn("designer link", reply)

    def test_product_details_hide_description_and_format_catalogue_data(self):
        item = product(name="ai agent", category="apparel")
        item.description = "<p>Internal catalogue description&nbsp;</p>"
        item.attributes.update({
            "brand": "Maitrova",
            "sizes": ["S", "M"],
            "search_attributes": {"product_name_hint": "plain tan t-shirt"},
        })

        reply = self.agent._build_detail_response(item)

        self.assertTrue(reply.startswith("Plain tan t-shirt\n"))
        self.assertNotIn("Internal catalogue", reply)
        self.assertNotIn("<p>", reply)
        self.assertIn("Brand: Maitrova", reply)
        self.assertIn("Sizes: S, M", reply)
        self.assertIn("Reply 'link'", reply)


if __name__ == "__main__":
    unittest.main()
