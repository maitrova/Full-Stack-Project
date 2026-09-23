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


if __name__ == "__main__":
    unittest.main()
