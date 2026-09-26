import json
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

from bson import ObjectId

from app.ai.intent_parser import IntentParser
from app.ai.product_image_analyzer import ProductImageAnalyzer
from app.ai.sales_agent import SalesAgent
from app.schemas.ai import AiChatRequest, IntentResult
from app.tools.product_tools import ProductTools


class ImageSearchFlowTests(unittest.IsolatedAsyncioTestCase):
    async def test_intent_search_returns_catalogue_results(self):
        repository = SimpleNamespace(search_products=AsyncMock(return_value=[]))
        tools = ProductTools(repository)
        self.assertEqual(await tools.search_from_intent("store", IntentResult(category="t-shirt")), [])
        self.assertEqual(repository.search_products.await_args.kwargs["filters"]["category"], "t-shirt")
        await tools.search_from_intent("store", IntentResult(), query="graphic print")
        self.assertEqual(repository.search_products.await_args.kwargs["filters"]["query"], "graphic print")

    async def test_image_search_without_vector_adapter_returns_a_list(self):
        repository = SimpleNamespace(search_products=AsyncMock(return_value=[]))
        self.assertEqual(await ProductTools(repository).search_from_image(
            "store", IntentResult(category="t-shirt"), {"product_type": "t-shirt"}, None,
        ), [])
        repository.search_products.assert_awaited_once()

    def test_malformed_analysis_fields_do_not_crash_intent_merge(self):
        analyzer = ProductImageAnalyzer(SimpleNamespace(is_configured=False))
        analysis = analyzer._load_json(json.dumps({
            "product_type": "t-shirt", "color": ["black", "gold"], "brand": {},
            "confidence": "unknown", "product_count": "many", "products": [None, "shirt"],
        }))
        intent = SalesAgent(None, None, None, None)._merge_image_analysis_into_intent(IntentResult(), analysis)
        self.assertEqual(intent.color, "black, gold")
        self.assertIsNone(intent.brand)
        self.assertEqual(analysis["confidence"], 0)
        self.assertEqual(analysis["products"], [])

    async def test_uploaded_shirt_reaches_catalogue_and_returns_product_reply(self):
        now = datetime.now(timezone.utc)
        business_id, conversation_id, product_id = ObjectId(), ObjectId(), ObjectId()
        conversation = {
            "_id": conversation_id, "business_id": business_id, "channel": "whatsapp",
            "status": "open", "conversation_state": {}, "recommended_product_ids": [],
            "created_at": now, "updated_at": now,
        }
        product = {
            "_id": product_id, "business_id": business_id, "name": "Black Graphic T-Shirt",
            "category": "T-Shirts", "price": 799, "currency": "INR", "stock": 5,
            "images": [], "attributes": {"match_score": 0.8}, "status": "active",
            "created_at": now, "updated_at": now,
        }
        repository = SimpleNamespace(search_ranked_products=AsyncMock(return_value=[product]))

        async def create_message(**kwargs):
            return {"_id": ObjectId(), "created_at": now, **kwargs["payload"],
                    "business_id": business_id, "conversation_id": conversation_id}

        async def generate(**kwargs):
            return kwargs["fallback_response"]

        client = SimpleNamespace(is_configured=True, generate_with_image=AsyncMock(return_value=json.dumps({
            "product_type": "t-shirt", "category": "T-Shirts", "color": ["black"],
            "confidence": 0.95, "product_count": 1,
        })), embed_content=AsyncMock(return_value=[1.0, 0.0]))
        agent = SalesAgent(
            SimpleNamespace(find_by_owner_id=AsyncMock(return_value={"_id": business_id})),
            SimpleNamespace(find_by_id=AsyncMock(return_value=conversation),
                            collection=SimpleNamespace(update_one=AsyncMock())),
            SimpleNamespace(create_message=AsyncMock(side_effect=create_message)),
            ProductTools(repository),
            intent_parser=IntentParser(SimpleNamespace(is_configured=False)),
            image_analyzer=ProductImageAnalyzer(client),
            response_generator=SimpleNamespace(generate=AsyncMock(side_effect=generate)),
        )
        response = await agent.handle_chat(AiChatRequest(
            conversation_id=str(conversation_id), message="Do u have this", image_data="encoded",
        ), SimpleNamespace(id="owner"))
        self.assertIn("Black Graphic T-Shirt", response.ai_message.content)
        self.assertEqual(len(response.recommended_products), 1)
        repository.search_ranked_products.assert_awaited_once()
        self.assertNotIn("couldn't", response.ai_message.content)


if __name__ == "__main__":
    unittest.main()
