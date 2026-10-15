import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from bson import ObjectId

from app.ai.sales_agent import SalesAgent
from app.ai.web_agent import WebAgent, _ToolSession, tools_agent_enabled, ungrounded_details
from app.schemas.ai import AiChatRequest
from app.schemas.product import ProductPublic

BUSINESS = {"_id": ObjectId(), "business_name": "Maitrova"}
SESSION = "8f14e45f-ceea-467a-9575-0d6d2e1c2b1a"
NOW = datetime.now(timezone.utc)


def product(name="Oversized Black Tee", price=999.0, sale_price=799.0, source="readymade", **attributes):
    return ProductPublic.model_validate({
        "_id": str(ObjectId()),
        "business_id": str(BUSINESS["_id"]),
        "name": name,
        "description": "Heavyweight cotton tee.",
        "category": "T-Shirts",
        "price": price,
        "sale_price": sale_price,
        "stock": 12,
        "attributes": {"source_type": source, "sizes": ["M", "L"], "fabric": "Cotton",
                       "product_url": "https://maitrova.in/p/tee", **attributes},
        "created_at": NOW,
        "updated_at": NOW,
    })


class FakeClient:
    """Plays a scripted model: runs the given tool calls, then returns replies in order."""

    is_configured = True

    def __init__(self, calls, replies):
        self.calls = calls
        self.replies = list(replies)
        self.prompts = []

    async def run(self, system_prompt, history, user_message, tools, execute):
        self.prompts.append(user_message)
        for name, args in self.calls:
            await execute(name, args)
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply


def make_agent(client, products=()):
    conversation = {"_id": ObjectId(), "business_id": BUSINESS["_id"], "channel": "web", "customer_id": None,
                    "web_session_id": SESSION, "status": "open", "conversation_state": {},
                    "recommended_product_ids": [], "created_at": NOW, "updated_at": NOW}
    database = SimpleNamespace(
        whatsapp_handoff_alerts=SimpleNamespace(update_one=AsyncMock()),
        ai_action_audit=SimpleNamespace(insert_many=AsyncMock()),
        ai_agent_metrics=SimpleNamespace(insert_one=AsyncMock()),
    )
    conversation_repository = SimpleNamespace(
        find_by_id=AsyncMock(return_value=conversation),
        create_conversation=AsyncMock(return_value=conversation),
        collection=SimpleNamespace(update_one=AsyncMock(), database=database),
    )

    async def create_message(business_id, conversation_id, customer_id, payload):
        return {"_id": ObjectId(), "business_id": business_id, "conversation_id": conversation_id,
                "customer_id": customer_id, "created_at": NOW, **payload}

    product_tools = SimpleNamespace(
        search_from_intent=AsyncMock(return_value=list(products)),
        search_products=AsyncMock(return_value=list(products)),
        get_product_details=AsyncMock(return_value=products[0] if products else None),
        recommend_alternatives=AsyncMock(return_value=[]),
    )
    sales_agent = SalesAgent(
        business_repository=SimpleNamespace(),
        conversation_repository=conversation_repository,
        message_repository=SimpleNamespace(create_message=AsyncMock(side_effect=create_message)),
        product_tools=product_tools,
    )
    sales_agent.handle_chat = AsyncMock(return_value="rules-reply")
    return WebAgent(sales_agent, client=client), sales_agent, database


class GroundingTests(unittest.TestCase):
    def test_prices_with_commas_and_decimals_match_tool_data(self):
        trusted = '{"price": 1299.0, "discount_percent": 20}'
        self.assertEqual(ungrounded_details("It's ₹1,299 now, 20% off.", trusted), [])

    def test_invented_numbers_and_links_are_flagged(self):
        trusted = '{"price": 799.0, "url": "https://maitrova.in/p/tee"}'
        missing = ungrounded_details("Only ₹499! Returns within 30 days: https://evil.example/x", trusted)
        self.assertIn("499", missing)
        self.assertIn("30", missing)
        self.assertIn("https://evil.example/x", missing)

    def test_link_at_end_of_a_line_in_json_tool_output_is_trusted(self):
        import json
        trusted = json.dumps({"content": "Chat: https://wa.me/919390319652?text=Hello%20Team\nHours: 9 to 7"})
        self.assertEqual(ungrounded_details("WhatsApp us: https://wa.me/919390319652?text=Hello%20Team", trusted), [])

    def test_markdown_links_become_plain_text(self):
        self.assertEqual(
            WebAgent._clean_reply("See our [Privacy Policy](https://maitrova.in/privacy-policy) page."),
            "See our Privacy Policy: https://maitrova.in/privacy-policy page.",
        )

    def test_trusted_link_without_its_query_is_allowed(self):
        trusted = "https://maitrova.in/products/hoodie/customize?collection=anime"
        self.assertEqual(ungrounded_details("Open https://maitrova.in/products/hoodie/customize", trusted), [])
        self.assertEqual(ungrounded_details("Open https://maitrova.in/products/other", trusted),
                         ["https://maitrova.in/products/other"])

    def test_small_counts_and_known_links_are_allowed(self):
        self.assertEqual(ungrounded_details("Here are 3 options: https://maitrova.in/p/tee.", "https://maitrova.in/p/tee"), [])


class RolloutTests(unittest.TestCase):
    def test_mode_and_percentage(self):
        with patch("app.ai.web_agent.settings") as fake:
            fake.web_agent_mode, fake.web_agent_rollout_percent = "tools", 0
            self.assertTrue(tools_agent_enabled(SESSION))
            fake.web_agent_mode, fake.web_agent_rollout_percent = "rules", 0
            self.assertFalse(tools_agent_enabled(SESSION))
            fake.web_agent_rollout_percent = 100
            self.assertTrue(tools_agent_enabled(SESSION))
            fake.web_agent_rollout_percent = 50
            sessions = [f"{index:032d}" for index in range(400)]
            share = sum(tools_agent_enabled(value) for value in sessions) / len(sessions)
            self.assertTrue(0.35 < share < 0.65)


class ToolSessionTests(unittest.IsolatedAsyncioTestCase):
    async def test_search_maps_product_type_and_hides_stock_counts(self):
        tee = product()
        agent, sales_agent, _ = make_agent(FakeClient([], ["ok"]), [tee])
        session = _ToolSession(agent, BUSINESS)
        result = await session.execute("search_products", {"query": "black tee", "product_type": "customizable",
                                                            "category": "t-shirt", "size": "l", "max_price": 1000})
        intent = sales_agent.product_tools.search_from_intent.await_args_list[0].kwargs["intent"]
        self.assertEqual(intent.attributes["catalog_type"], "customization")
        self.assertEqual(intent.size, "L")
        item = result["products"][0]
        self.assertEqual(item["price"], 799.0)
        self.assertEqual(item["discount_percent"], 20)
        self.assertNotIn("stock", item)
        self.assertTrue(item["in_stock"])

    async def test_customizable_price_is_the_designer_starting_price(self):
        custom = product("Classic Round Neck T-Shirt", price=699.0, sale_price=None, source="customization",
                         customizable=True, variants=[{"size": "S", "stock": 5, "effective_price": 499.0},
                                                      {"size": "XL", "stock": 5, "effective_price": 549.0}])
        summary = WebAgent.product_summary(custom)
        self.assertEqual(summary["price"], 499.0)
        self.assertTrue(summary["price_is_starting_from"])
        self.assertEqual(summary["listing_price"], 699.0)
        self.assertIn("Printing cost", summary["pricing_note"])

    async def test_design_library_lists_collections_and_previews_a_collection(self):
        hoodie = product("Hoodie", source="customization", customizable=True,
                         product_url="https://maitrova.in/products/hoodie/customize")
        agent, sales_agent, _ = make_agent(FakeClient([], ["ok"]))
        sales_agent._load_design_library_folders = AsyncMock(return_value=["anime", "empty"])
        files = {
            "anime": [{"name": f"Naruto {index}", "image": f"/outputs/anime/{index}.webp"} for index in range(8)],
            "empty": [],
        }
        session = _ToolSession(agent, BUSINESS)
        session.page_product = hoodie
        with patch("app.ai.web_agent._load_design_files", AsyncMock(side_effect=lambda folder: files[folder])):
            listing = await session.execute("browse_design_library", {})
            self.assertEqual(listing["designer_url"], "https://maitrova.in/products/hoodie/customize")
            self.assertEqual(listing["collections"], [{
                "collection": "anime", "design_count": 8,
                "designer_url": "https://maitrova.in/products/hoodie/customize?collection=anime",
            }])
            self.assertEqual(session.design_previews, [])
            detail = await session.execute("browse_design_library", {"collection": "Anime"})
        self.assertEqual(detail["design_count"], 8)
        self.assertEqual(len(session.design_previews), 6)
        self.assertTrue(session.design_previews[0]["url"].endswith("?collection=anime"))

    def cart_session(self, product_list, message, cart=None):
        agent, sales_agent, _ = make_agent(FakeClient([], ["ok"]), product_list)
        session = _ToolSession(agent, BUSINESS)
        session.message = message
        session.cart = cart
        return session, sales_agent

    async def test_add_to_cart_queues_an_action_for_the_browser(self):
        tee = product(variants=[{"size": "L", "stock": 5, "effective_price": 799.0}, {"size": "XL", "stock": 0, "effective_price": 799.0}])
        session, _ = self.cart_session([tee], "add the black tee in L to my cart")
        result = await session.execute("add_to_cart", {"product_id": tee.id, "size": "l", "quantity": 2})
        self.assertTrue(result["queued"])
        self.assertEqual(session.actions, [{"type": "add_to_cart", "kind": "READYMADE", "product_id": tee.id,
                                            "size": "L", "qty": 2, "name": tee.name}])

    async def test_no_quietly_smaller_quantity_when_more_than_the_limit_was_asked(self):
        tee = product(variants=[{"size": "M", "stock": 25, "effective_price": 599.0}])
        session, _ = self.cart_session([tee], "add 50 classic white tees in M")
        result = await session.execute("add_to_cart", {"product_id": tee.id, "size": "M", "quantity": 10})
        self.assertIn("error", result)
        self.assertEqual(session.actions, [])
        session, _ = self.cart_session([tee], "add 3 classic white tees in M")
        self.assertTrue((await session.execute("add_to_cart", {"product_id": tee.id, "size": "M", "quantity": 3}))["queued"])

    async def test_add_to_cart_is_refused_without_the_shoppers_request(self):
        tee = product(variants=[{"size": "L", "stock": 5, "effective_price": 799.0}])
        session, _ = self.cart_session([tee], "is the black tee available in L?")
        result = await session.execute("add_to_cart", {"product_id": tee.id, "size": "L"})
        self.assertIn("error", result)
        self.assertEqual(session.actions, [])

    async def test_add_to_cart_checks_size_stock_and_type(self):
        tee = product(variants=[{"size": "L", "stock": 1, "effective_price": 799.0}, {"size": "XL", "stock": 0, "effective_price": 799.0}])
        session, _ = self.cart_session([tee], "add it to cart")
        self.assertEqual((await session.execute("add_to_cart", {"product_id": tee.id}))["sizes_in_stock"], ["L"])
        self.assertIn("not in stock", (await session.execute("add_to_cart", {"product_id": tee.id, "size": "XL"}))["error"])
        self.assertIn("Not enough stock", (await session.execute("add_to_cart", {"product_id": tee.id, "size": "L", "quantity": 3}))["error"])
        custom = product("Hoodie", source="customization", customizable=True, product_url="https://maitrova.in/products/hoodie/customize")
        session, _ = self.cart_session([custom], "add the hoodie to my cart")
        result = await session.execute("add_to_cart", {"product_id": custom.id, "size": "M"})
        self.assertIn("customizable", result["error"])
        self.assertEqual(result["url"], "https://maitrova.in/products/hoodie/customize")
        self.assertEqual(session.actions, [])

    async def test_size_answer_completes_the_pending_add_only_for_that_product(self):
        tee = product(variants=[{"size": "L", "stock": 5, "effective_price": 799.0}, {"size": "XL", "stock": 5, "effective_price": 799.0}])
        other = product("Olive Henley", variants=[{"size": "XL", "stock": 5, "effective_price": 849.0}])
        agent, _, _ = make_agent(FakeClient([], ["ok"]), [tee, other])
        state = {}
        first = _ToolSession(agent, BUSINESS, state=state)
        first.message = "add the black tee to my cart"
        self.assertTrue((await first.execute("add_to_cart", {"product_id": tee.id}))["needs_size"])

        reply = _ToolSession(agent, BUSINESS, state=state)
        reply.message = "XL"
        reply.remember(other)
        self.assertIn("error", await reply.execute("add_to_cart", {"product_id": other.id, "size": "XL"}))
        self.assertTrue((await reply.execute("add_to_cart", {"product_id": tee.id, "size": "XL"}))["queued"])

        later = _ToolSession(agent, BUSINESS, state=state)
        later.message = "XL"
        self.assertIn("error", await later.execute("add_to_cart", {"product_id": tee.id, "size": "XL"}))

    async def test_cart_view_update_and_remove_use_the_cart_snapshot(self):
        cart = {"items": [{"item_id": "item-1", "name": "Charcoal Fleece Hoodie", "kind": "READYMADE", "size": "XL", "qty": 1, "unit_price": 1399}],
                "subtotal": 1399, "total_items": 1}
        session, _ = self.cart_session([], "make the hoodie 2 and what's my total?", cart)
        view = await session.execute("view_cart", {})
        self.assertEqual(view["subtotal"], 1399)
        self.assertTrue((await session.execute("update_cart_item", {"item_id": "item-1", "quantity": 2}))["queued"])
        self.assertIn("error", await session.execute("remove_cart_item", {"item_id": "not-in-cart"}))
        self.assertEqual(session.actions, [{"type": "update_cart_qty", "item_id": "item-1", "qty": 2, "name": "Charcoal Fleece Hoodie"}])

        session, _ = self.cart_session([], "what's in my cart?", cart)
        self.assertIn("error", await session.execute("remove_cart_item", {"item_id": "item-1"}))

    async def test_search_fills_category_and_colour_stated_in_the_query(self):
        agent, sales_agent, _ = make_agent(FakeClient([], ["ok"]), [product()])
        session = _ToolSession(agent, BUSINESS)
        await session.execute("search_products", {"query": "black t-shirt", "max_price": 1000})
        intent = sales_agent.product_tools.search_from_intent.await_args_list[0].kwargs["intent"]
        self.assertEqual((intent.category, intent.color), ("t-shirt", "black"))
        await session.execute("search_products", {"query": "something for summer"})
        intent = sales_agent.product_tools.search_from_intent.await_args_list[-1].kwargs["intent"]
        self.assertEqual((intent.category, intent.color), (None, None))

    async def test_bad_arguments_and_unknown_tools_do_not_crash(self):
        agent, _, _ = make_agent(FakeClient([], ["ok"]))
        session = _ToolSession(agent, BUSINESS)
        self.assertIn("error", await session.execute("search_products", {"unexpected": 1}))
        self.assertIn("error", await session.execute("delete_everything", {}))
        self.assertEqual([call["status"] for call in session.tool_calls], ["failed", "completed"])

    async def test_show_marker_is_stripped_and_only_accepts_ids_returned_by_tools(self):
        tee = product()
        agent, _, _ = make_agent(FakeClient([], ["ok"]), [tee])
        session = _ToolSession(agent, BUSINESS)
        await session.execute("search_products", {"query": "tee"})
        reply = session.take_shown_products(f"Here you go.\n[[show: {ObjectId()}, {tee.id}]]")
        self.assertEqual(reply, "Here you go.")
        self.assertEqual(session.shown_ids, [tee.id])

    async def test_product_in_other_sizes_is_reported_not_hidden(self):
        tee = product(sizes=["S", "M", "L", "XL"])
        agent, sales_agent, _ = make_agent(FakeClient([], ["ok"]), [tee])
        sales_agent.product_tools.search_from_intent = AsyncMock(
            side_effect=lambda business_id, intent, query, limit: [] if intent.size else [tee]
        )
        session = _ToolSession(agent, BUSINESS)
        result = await session.execute("search_products", {"query": "oversized black tee", "size": "XXL"})
        self.assertEqual(result["products"], [])
        self.assertEqual(result["not_in_requested_size"][0]["sizes_in_stock"], ["S", "M", "L", "XL"])
        self.assertIn("XXL", result["note"])

    async def test_descriptive_query_falls_back_to_closest_matches(self):
        linen = product("Sky Blue Linen Shirt", occasions=["Summer", "Vacation"])
        hoodie = product("Charcoal Fleece Hoodie", occasions=["Winter"])
        agent, sales_agent, _ = make_agent(FakeClient([], ["ok"]))
        sales_agent.product_tools.search_from_intent = AsyncMock(return_value=[])
        sales_agent.product_tools.search_products = AsyncMock(return_value=[linen, hoodie])
        session = _ToolSession(agent, BUSINESS)
        result = await session.execute("search_products", {"query": "something comfortable for hot summer days"})
        self.assertEqual([item["name"] for item in result["products"]], ["Sky Blue Linen Shirt"])
        self.assertIn("closest", result["note"])

    async def test_customizable_alternatives_need_a_garment_type(self):
        agent, sales_agent, _ = make_agent(FakeClient([], ["ok"]))
        sales_agent.product_tools.search_from_intent = AsyncMock(return_value=[])
        sales_agent.product_tools.search_products = AsyncMock(return_value=[])
        session = _ToolSession(agent, BUSINESS)
        result = await session.execute("search_products", {"query": "jeans 34 waist"})
        self.assertNotIn("customizable_alternatives", result)


class WebAgentFlowTests(unittest.IsolatedAsyncioTestCase):
    def request(self, message="show me black tees"):
        return AiChatRequest(message=message, page_context={"page_type": "home", "path": "/"})

    async def test_grounded_reply_is_saved_with_product_cards(self):
        tee = product()
        client = FakeClient([("search_products", {"query": "black tee"})],
                            [f"The Oversized Black Tee is ₹799 right now (20% off).\n[[show: {tee.id}]]"])
        agent, sales_agent, database = make_agent(client, [tee])
        response = await agent.handle_chat(self.request(), None, BUSINESS, SESSION)
        self.assertEqual(response.ai_message.content, "The Oversized Black Tee is ₹799 right now (20% off).")
        self.assertEqual([item.id for item in response.recommended_products], [tee.id])
        self.assertEqual(response.intent.intent, "product_search")
        sales_agent.handle_chat.assert_not_awaited()
        metric = database.ai_agent_metrics.insert_one.await_args.args[0]
        self.assertEqual(metric["agent_mode"], "tools")
        self.assertEqual(metric["tool_names"], ["search_products"])

    async def test_ungrounded_reply_is_retried_then_falls_back_to_rules(self):
        tee = product()
        client = FakeClient([("search_products", {"query": "tee"})], ["It's ₹499 today.", "Still ₹499."])
        agent, sales_agent, _ = make_agent(client, [tee])
        result = await agent.handle_chat(self.request(), None, BUSINESS, SESSION)
        self.assertEqual(result, "rules-reply")
        self.assertIn("499", client.prompts[1])

    async def test_retry_that_fixes_the_reply_is_accepted(self):
        tee = product()
        client = FakeClient([("search_products", {"query": "tee"})], ["It's ₹499 today.", "It's ₹799 today."])
        agent, sales_agent, _ = make_agent(client, [tee])
        response = await agent.handle_chat(self.request(), None, BUSINESS, SESSION)
        self.assertEqual(response.ai_message.content, "It's ₹799 today.")
        self.assertTrue(response.ai_message.metadata["grounding_retry"])

    async def test_provider_failure_falls_back_to_rules(self):
        agent, sales_agent, _ = make_agent(FakeClient([], [RuntimeError("down")]))
        self.assertEqual(await agent.handle_chat(self.request(), None, BUSINESS, SESSION), "rules-reply")
        sales_agent.handle_chat.assert_awaited_once()

    async def test_reply_claiming_an_unqueued_cart_change_is_corrected(self):
        tee = product(variants=[{"size": "L", "stock": 5, "effective_price": 799.0}])
        # The model asks about size itself, then claims to add without the tool succeeding.
        client = FakeClient([], ["I am adding the Oversized Black Tee in L to your cart.", "I am adding it now."])
        agent, _, _ = make_agent(client, [tee])
        response = await agent.handle_chat(self.request("is the black tee nice?"), None, BUSINESS, SESSION)
        self.assertIn("couldn't make that change", response.ai_message.content)
        self.assertEqual(response.actions, [])

        client = FakeClient([], ["I am adding the Oversized Black Tee in L to your cart.", "That tee is in stock. Want me to add it?"])
        agent, _, _ = make_agent(client, [tee])
        response = await agent.handle_chat(self.request("is the black tee nice?"), None, BUSINESS, SESSION)
        self.assertEqual(response.ai_message.content, "That tee is in stock. Want me to add it?")

    async def test_tool_call_written_as_text_is_never_shown(self):
        tee = product(variants=[{"size": "L", "stock": 5, "effective_price": 799.0}])
        written = f'Sure, cart lo add chestunnanu.\n[[add_to_cart(product_id="{tee.id}", size="L")]]'
        agent, _, _ = make_agent(FakeClient([], [written, written]), [tee])
        response = await agent.handle_chat(self.request("ee tee L size cart lo pettu"), None, BUSINESS, SESSION)
        self.assertNotIn("add_to_cart", response.ai_message.content)
        self.assertIn("couldn't make that change", response.ai_message.content)

    async def test_add_request_carries_over_to_the_size_answer(self):
        tee = product(variants=[{"size": "XL", "stock": 5, "effective_price": 799.0}])
        agent, sales_agent, _ = make_agent(FakeClient([], ["Which size would you like?"]), [tee])
        await agent.handle_chat(self.request("add the black tee to my cart"), None, BUSINESS, SESSION)
        state = sales_agent.conversation_repository.collection.update_one.await_args.args[1]["$set"]["conversation_state"]
        self.assertTrue(state["add_requested_last_turn"])

        sales_agent.conversation_repository.find_by_id.return_value["conversation_state"] = state
        agent.client = FakeClient([("add_to_cart", {"product_id": tee.id, "size": "XL"})], ["Adding the black tee in XL now."])
        response = await agent.handle_chat(self.request("XL"), None, BUSINESS, SESSION)
        self.assertEqual([action["size"] for action in response.actions], ["XL"])

    async def test_rate_limit_sends_a_quick_busy_reply_instead_of_the_rules_agent(self):
        from app.ai.tool_calling import ProviderRateLimited
        from app.ai.web_agent import BUSY_REPLY

        agent, sales_agent, database = make_agent(FakeClient([], [ProviderRateLimited("429")]))
        response = await agent.handle_chat(self.request(), None, BUSINESS, SESSION)
        self.assertEqual(response.ai_message.content, BUSY_REPLY)
        sales_agent.handle_chat.assert_not_awaited()
        self.assertTrue(database.ai_agent_metrics.insert_one.await_args.args[0]["rate_limited"])
        updates = sales_agent.conversation_repository.collection.update_one.await_args.args[1]["$set"]
        self.assertNotIn("recent_turns", updates["conversation_state"])

    async def test_timeout_asks_to_resend_instead_of_using_the_rules_agent(self):
        import asyncio
        from app.ai.web_agent import SLOW_REPLY

        agent, sales_agent, database = make_agent(FakeClient([], [asyncio.TimeoutError()]))
        response = await agent.handle_chat(self.request(), None, BUSINESS, SESSION)
        self.assertEqual(response.ai_message.content, SLOW_REPLY)
        sales_agent.handle_chat.assert_not_awaited()
        metrics = [call.args[0] for call in database.ai_agent_metrics.insert_one.await_args_list]
        self.assertTrue(any(row.get("timed_out") for row in metrics))
        self.assertTrue(any(row.get("reason") == "timeout" for row in metrics))

    async def test_images_go_to_rules_agent(self):
        agent, sales_agent, _ = make_agent(FakeClient([], ["unused"]))
        request = AiChatRequest(message="do you have this?", image_data="aGVsbG8=", image_mime_type="image/png")
        self.assertEqual(await agent.handle_chat(request, None, BUSINESS, SESSION), "rules-reply")

    async def test_handoff_creates_dashboard_alert(self):
        client = FakeClient([("request_human", {"reason": "complaint", "summary": "Received a torn shirt."})],
                            ["Sorry about that. Our team will contact you shortly."])
        agent, sales_agent, database = make_agent(client)
        await agent.handle_chat(self.request("my shirt arrived torn, call me on 9876543210"), None, BUSINESS, SESSION)
        alert = database.whatsapp_handoff_alerts.update_one.await_args.args[1]["$setOnInsert"]
        self.assertEqual(alert["reason"], "complaint")
        self.assertEqual(alert["urgency"], "high")
        self.assertEqual(alert["channel"], "web")
        self.assertEqual(alert["contact"], "9876543210")
        updates = sales_agent.conversation_repository.collection.update_one.await_args.args[1]["$set"]
        self.assertEqual(updates["status"], "handoff")
        self.assertTrue(updates["conversation_state"]["handoff_requested"])

    async def test_guest_handoff_collects_a_contact_first(self):
        client = FakeClient([("request_human", {"reason": "complaint", "summary": "Torn shirt."})],
                            ["Sorry about that. What's the best number to reach you?"])
        agent, sales_agent, database = make_agent(client)
        await agent.handle_chat(self.request("my shirt arrived torn"), None, BUSINESS, SESSION)
        database.whatsapp_handoff_alerts.update_one.assert_not_awaited()
        state = sales_agent.conversation_repository.collection.update_one.await_args.args[1]["$set"]["conversation_state"]
        self.assertEqual(state["awaiting_handoff_contact"]["reason"], "complaint")

        # The next message with a number completes the handoff without the model.
        sales_agent.conversation_repository.find_by_id.return_value["conversation_state"] = state
        agent.client = FakeClient([], [RuntimeError("model must not be called")])
        response = await agent.handle_chat(self.request("98765 43210"), None, BUSINESS, SESSION)
        self.assertIn("passed your request", response.ai_message.content)
        alert = database.whatsapp_handoff_alerts.update_one.await_args.args[1]["$setOnInsert"]
        self.assertEqual((alert["reason"], alert["contact"]), ("complaint", "98765 43210"))

    async def test_talk_to_person_button(self):
        agent, _, database = make_agent(FakeClient([], [RuntimeError("model must not be called")]))
        guest = await agent.handle_chat(AiChatRequest(message="", quick_action="talk_to_human"), None, BUSINESS, SESSION)
        self.assertIn("mobile number or email", guest.ai_message.content)
        database.whatsapp_handoff_alerts.update_one.assert_not_awaited()

        user = SimpleNamespace(id=str(ObjectId()))
        agent, _, database = make_agent(FakeClient([], [RuntimeError("model must not be called")]))
        signed_in = await agent.handle_chat(AiChatRequest(message="", quick_action="talk_to_human"), user, BUSINESS, SESSION)
        self.assertIn("asked our store team", signed_in.ai_message.content)
        database.whatsapp_handoff_alerts.update_one.assert_awaited_once()

    async def test_quick_action_without_text_becomes_a_question(self):
        client = FakeClient([], ["Sure."])
        agent, _, _ = make_agent(client)
        await agent.handle_chat(AiChatRequest(message="", quick_action="product_fabric"), None, BUSINESS, SESSION)
        self.assertIn("fabric", client.prompts[0])


if __name__ == "__main__":
    unittest.main()
