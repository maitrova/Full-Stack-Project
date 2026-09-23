import logging
import re
from types import SimpleNamespace

from fastapi import HTTPException, status

from app.ai.intent_parser import IntentParser
from app.ai.product_image_analyzer import ProductImageAnalyzer
from app.ai.response_generator import ResponseGenerator
from app.ai.store_knowledge import StoreKnowledge
from app.repositories.business_repository import BusinessRepository
from app.repositories.conversation_repository import ConversationRepository
from app.repositories.message_repository import MessageRepository
from app.schemas.product import ProductPublic
from app.schemas.ai import AiChatRequest, AiChatResponse, IntentResult
from app.schemas.conversation import ConversationPublic, MessagePublic
from app.schemas.user import UserPublic
from app.tools.product_tools import ProductSearchParams, ProductTools
from app.utils.object_id import object_id_to_str, parse_object_id

logger = logging.getLogger(__name__)


class SalesAgent:
    def __init__(
        self,
        business_repository: BusinessRepository,
        conversation_repository: ConversationRepository,
        message_repository: MessageRepository,
        product_tools: ProductTools,
        intent_parser: IntentParser | None = None,
        image_analyzer: ProductImageAnalyzer | None = None,
        response_generator: ResponseGenerator | None = None,
        commerce=None,
    ):
        self.business_repository = business_repository
        self.conversation_repository = conversation_repository
        self.message_repository = message_repository
        self.product_tools = product_tools
        self.intent_parser = intent_parser or IntentParser()
        self.image_analyzer = image_analyzer or ProductImageAnalyzer()
        self.response_generator = response_generator or ResponseGenerator()
        self.commerce = commerce

    async def handle_chat(self, payload: AiChatRequest, current_user: UserPublic) -> AiChatResponse:
        business = await self.business_repository.find_by_owner_id(current_user.id)
        if business is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Create a business before using AI chat",
            )

        business_id = str(business["_id"])
        conversation = await self._get_or_create_conversation(payload.conversation_id, business_id)

        has_image = bool(payload.image_url or payload.image_data)
        display_message = payload.message.strip() or "Photo enquiry"
        customer_message = await self.message_repository.create_message(
            business_id=business_id,
            conversation_id=str(conversation["_id"]),
            customer_id=str(conversation["customer_id"]) if conversation.get("customer_id") else None,
            payload={
                "sender": "customer",
                "content": display_message,
                "message_type": "image" if has_image else "text",
                "metadata": {
                    "image_url": payload.image_url,
                    "has_image_data": bool(payload.image_data),
                    "image_mime_type": payload.image_mime_type,
                }
                if has_image
                else {},
            },
        )

        image_analysis = {}
        if has_image:
            image_analysis = await self.image_analyzer.analyze(
                image_url=payload.image_url,
                image_data=payload.image_data,
                mime_type=payload.image_mime_type,
                customer_message=payload.message,
            )
        image_analysis_failed = has_image and not image_analysis

        parse_message = payload.message or self._image_analysis_to_search_text(image_analysis)
        conversation = self._prepare_context(conversation, parse_message)
        intent = await self.intent_parser.parse(parse_message, conversation.get("conversation_state", {}))
        if image_analysis:
            intent = self._merge_image_analysis_into_intent(intent, image_analysis)

        updated_state = self._merge_conversation_state(conversation.get("conversation_state", {}), intent)
        if image_analysis:
            updated_state["last_image_analysis"] = image_analysis
        store_question = StoreKnowledge.is_store_question(payload.message) or intent.intent == "store_question"
        store_context = await StoreKnowledge(self.commerce.db if self.commerce else None).load(business, payload.message, include_all=intent.intent == "store_question")
        order_request = self._is_order_request(payload.message)
        follow_up = self._detect_follow_up(payload.message, conversation, updated_state)
        retry_options = self._is_retry_options_request(payload.message) and updated_state.get("last_search_had_results") is False
        products = []
        selected_product = None
        tool_calls = []
        response_goal = "answer"
        presentation = await self.commerce.handle(payload.message, conversation, updated_state, self.product_tools, business_id) if self.commerce else None
        if not presentation:
            presentation = await self._presentation_request(business_id, payload.message, conversation, updated_state)

        if image_analysis_failed and not presentation:
            ai_text = (
                "I received the image, but I couldn't analyze it right now. "
                "Please resend it as a clear JPG or PNG. If it still fails, send 'human' for help."
            )
            response_goal = "report that image analysis failed without guessing what is in the image"
            tool_calls.append({"name": "analyze_product_image", "status": "failed"})
        elif store_question and not presentation:
            selected_id = updated_state.get("selected_product_id") or conversation.get("selected_product_id")
            if selected_id:
                selected_product = await self.product_tools.get_product_details(business_id, str(selected_id))
            ai_text = StoreKnowledge.fallback(store_context)
            response_goal = "answer the store question from verified store information; acknowledge any missing facts"
        elif presentation:
            ai_text, products, media_mode = presentation
            response_goal = "product photos or link"
        elif re.fullmatch(r"(?:this|that|same) (?:product|item|one)", payload.message.lower().strip()) and not follow_up:
            ai_text = "Which one do you mean? Reply to its photo or send the option number, and I'll help with that item."
            response_goal = "clarify an ambiguous product reference without repeating recommendations"
        elif retry_options:
            retry_intent = self._intent_from_state(updated_state, intent)
            products, relaxed_summary = await self._search_relaxed_options(business_id, retry_intent)
            updated_state["recommended_product_ids"] = [product.id for product in products]
            updated_state["selected_product_id"] = products[0].id if len(products) == 1 else None
            tool_calls.append(
                {
                    "name": "search_relaxed_products",
                    "result_count": len(products),
                    "relaxed_summary": relaxed_summary,
                }
            )
            ai_text = self._build_relaxed_response(retry_intent, relaxed_summary, products)
            response_goal = "recommend close alternatives after the exact search failed"
        elif order_request and self._should_ask_for_product_choice(payload.message, conversation, updated_state):
            products = await self._load_recommended_products(
                business_id,
                conversation.get("recommended_product_ids", []) or updated_state.get("recommended_product_ids", []),
            )
            ai_text = "Sure, which one should I book? You can send 1, 2, 3, or the product name."
            response_goal = "ask the customer to choose a product for order"
        elif self._should_ask_for_product_choice(payload.message, conversation, updated_state):
            products = await self._load_recommended_products(
                business_id,
                conversation.get("recommended_product_ids", []) or updated_state.get("recommended_product_ids", []),
            )
            ai_text = "Sure, which one should I show? You can send 1, 2, 3, or the product name."
            response_goal = "ask the customer to choose a product from the options already shown"
        elif follow_up:
            selected_product_id = follow_up["product_id"]
            selected_product = await self.product_tools.get_product_details(business_id, selected_product_id)
            if selected_product is None:
                ai_text = "I am not seeing that product now. Please pick another option."
            elif order_request:
                products = [selected_product]
                updated_state.pop("last_order_id", None)
                ai_text = self._build_store_checkout_response(selected_product)
                response_goal = "send the customer to the ecommerce product checkout flow"
            elif follow_up["type"] == "alternatives":
                products = await self.product_tools.recommend_alternatives(
                    business_id=business_id,
                    product_id=selected_product.id,
                    cheaper=follow_up["cheaper"],
                )
                tool_calls.append(
                    {
                        "name": "recommend_alternatives",
                        "product_id": selected_product.id,
                        "cheaper": follow_up["cheaper"],
                        "result_count": len(products),
                    }
                )
                ai_text = self._build_alternatives_response(selected_product, products, follow_up["cheaper"])
                response_goal = "recommend cheaper or similar alternatives"
            elif follow_up["type"] == "stock":
                stock_result = await self.product_tools.check_stock(business_id, selected_product.id)
                tool_calls.append({"name": "check_stock", "product_id": selected_product.id})
                ai_text = self._build_stock_response(stock_result)
                response_goal = "answer stock availability"
            elif follow_up["type"] == "variants":
                variants = await self.product_tools.get_product_variants(
                    business_id=business_id,
                    product_id=selected_product.id,
                    variant_filters=follow_up["variant_filters"],
                )
                products = variants[:5]
                tool_calls.append(
                    {
                        "name": "get_product_variants",
                        "product_id": selected_product.id,
                        "result_count": len(products),
                    }
                )
                ai_text = self._build_variant_response(selected_product, products, follow_up["variant_filters"])
                response_goal = "answer variant availability"
            else:
                tool_calls.append({"name": "get_product_details", "product_id": selected_product.id})
                products = [selected_product]
                ai_text = self._build_detail_response(selected_product)
                response_goal = "explain product details"

            updated_state["selected_product_id"] = selected_product.id if selected_product else selected_product_id
            if products:
                updated_state["recommended_product_ids"] = [product.id for product in products]
        elif intent.intent == "product_search":
            products = await self.product_tools.search_from_intent(
                business_id=business_id,
                intent=intent,
                query=payload.message,
            )
            if not products:
                relaxed_products, relaxed_summary = await self._search_relaxed_options(business_id, intent)
                products = relaxed_products
                updated_state["recommended_product_ids"] = [product.id for product in products]
                updated_state["selected_product_id"] = products[0].id if len(products) == 1 else None
                updated_state["last_offer_type"] = "close_alternatives" if products else "no_match"
                tool_calls.append(
                    {
                        "name": "search_products",
                        "result_count": 0,
                    }
                )
                tool_calls.append(
                    {
                        "name": "search_relaxed_products",
                        "result_count": len(products),
                        "relaxed_summary": relaxed_summary,
                    }
                )
                ai_text = self._build_relaxed_response(intent, relaxed_summary, products)
                response_goal = "recommend close alternatives after the exact search failed"
            elif self._is_detail_request(payload.message) and products:
                selected_product = products[0]
                products = [selected_product]
                updated_state["selected_product_id"] = selected_product.id
                updated_state["recommended_product_ids"] = [selected_product.id]
                updated_state["last_offer_type"] = "product_details"
                tool_calls.append({"name": "get_product_details", "product_id": selected_product.id})
                ai_text = self._build_detail_response(selected_product)
                response_goal = "explain product details"
            else:
                updated_state["recommended_product_ids"] = [product.id for product in products]
                if len(products) == 1:
                    updated_state["selected_product_id"] = products[0].id
                updated_state["last_offer_type"] = "exact_matches"
                tool_calls.append(
                    {
                        "name": "search_products",
                        "result_count": len(products),
                    }
                )
                ai_text = self._build_response(intent, products)
                response_goal = "recommend matching products"
        else:
            ai_text = self._build_response(intent, products)
            response_goal = "ask a helpful clarifying question"

        if response_goal in {"recommend matching products", "recommend close alternatives after the exact search failed"}:
            updated_state["last_search_had_results"] = bool(products)

        if not presentation and not image_analysis_failed:
            ai_text = await self.response_generator.generate(
            customer_message=payload.message,
            intent=intent,
            fallback_response=ai_text,
            conversation_state=updated_state,
            products=products,
            selected_product=selected_product,
            response_goal=response_goal,
            store_context=store_context,
        )

        updated_state["recent_turns"] = (updated_state.get("recent_turns", []) + [
            {"customer": payload.message[:1000], "reply": ai_text[:1500]}
        ])[-4:]
        ai_message = await self.message_repository.create_message(
            business_id=business_id,
            conversation_id=str(conversation["_id"]),
            customer_id=str(conversation["customer_id"]) if conversation.get("customer_id") else None,
            payload={
                "sender": "ai",
                "content": ai_text,
                "message_type": "text",
                "metadata": {
                    "media_mode": presentation[2] if presentation else "recommendations",
                    "intent": intent.model_dump(),
                    "image_analysis": image_analysis,
                    "tool_calls": tool_calls,
                    "recommended_product_ids": [product.id for product in products],
                    "recommended_products": [self._product_card(product) for product in products],
                    "selected_product_id": updated_state.get("selected_product_id"),
                },
            },
        )

        await self.conversation_repository.collection.update_one(
            {"_id": conversation["_id"], "business_id": business["_id"]},
            {
                "$set": {
                    "status": "handoff" if updated_state.get("handoff_requested") else conversation.get("status", "open"),
                    "current_intent": intent.intent,
                    "conversation_state": updated_state,
                    "recommended_product_ids": updated_state.get("recommended_product_ids", [product.id for product in products]),
                    "selected_product_id": updated_state.get("selected_product_id"),
                    "updated_at": ai_message["created_at"],
                    "last_message_at": ai_message["created_at"],
                }
            },
        )
        if updated_state.get("handoff_requested"):
            await self.conversation_repository.collection.database.whatsapp_handoff_alerts.update_one(
                {"conversation_id": conversation["_id"], "status": {"$in": ["open", "assigned"]}},
                {
                    "$set": {"updated_at": ai_message["created_at"]},
                    "$setOnInsert": {
                        "business_id": business["_id"],
                        "conversation_id": conversation["_id"],
                        "customer_name": conversation.get("customer_name"),
                        "external_customer_ref": conversation.get("external_customer_ref"),
                        "status": "open",
                        "created_at": ai_message["created_at"],
                    },
                },
                upsert=True,
            )
        refreshed_conversation = await self.conversation_repository.find_by_id(str(conversation["_id"]), business_id)

        logger.info("AI chat handled for conversation %s with intent %s", conversation["_id"], intent.intent)
        return AiChatResponse(
            conversation=ConversationPublic.model_validate(object_id_to_str(refreshed_conversation)),
            customer_message=MessagePublic.model_validate(object_id_to_str(customer_message)),
            ai_message=MessagePublic.model_validate(object_id_to_str(ai_message)),
            intent=intent,
            recommended_products=products,
        )

    async def handle_external_chat(
        self,
        business: dict,
        message: str,
        channel: str,
        external_customer_ref: str,
        customer_name: str | None = None,
        image_url: str | None = None,
        image_data: str | None = None,
        image_mime_type: str | None = None,
        inbound_metadata: dict | None = None,
        quoted_product_id: str | None = None,
    ) -> AiChatResponse:
        business_id = str(business["_id"])
        conversation = await self.conversation_repository.find_by_external_customer_ref(
            business_id=business_id,
            channel=channel,
            external_customer_ref=external_customer_ref,
        )
        if conversation is None:
            conversation = await self.conversation_repository.create_conversation(
                business_id=business_id,
                payload={
                    "channel": channel,
                    "customer_id": None,
                    "external_customer_ref": external_customer_ref,
                    "customer_name": customer_name,
                },
            )
        elif customer_name and not conversation.get("customer_name"):
            await self.conversation_repository.collection.update_one(
                {"_id": conversation["_id"], "business_id": business["_id"]},
                {"$set": {"customer_name": customer_name}},
            )

        if quoted_product_id:
            quoted_state = dict(conversation.get("conversation_state", {}))
            if str(quoted_state.get("selected_product_id") or "") != str(quoted_product_id):
                quoted_state.pop("purchase", None)
            quoted_state["selected_product_id"] = str(quoted_product_id)
            quoted_state["recommended_product_ids"] = [str(quoted_product_id)]
            conversation["selected_product_id"] = str(quoted_product_id)
            conversation["recommended_product_ids"] = [str(quoted_product_id)]
            conversation["conversation_state"] = quoted_state
            await self.conversation_repository.collection.update_one(
                {"_id": conversation["_id"], "business_id": business["_id"]},
                {"$set": {
                    "selected_product_id": str(quoted_product_id),
                    "recommended_product_ids": [str(quoted_product_id)],
                    "conversation_state": quoted_state,
                }},
            )

        response = await self.handle_chat(
            AiChatRequest(
                message=message,
                conversation_id=str(conversation["_id"]),
                image_url=image_url,
                image_data=image_data,
                image_mime_type=image_mime_type,
            ),
            SimpleNamespace(id=str(business["owner_id"])),
        )

        metadata = inbound_metadata or {}
        if metadata:
            await self.message_repository.collection.update_one(
                {"_id": parse_object_id(response.customer_message.id), "business_id": business["_id"]},
                {"$set": {"metadata": {**response.customer_message.metadata, **metadata}}},
            )

        return response

    def _prepare_context(self, conversation: dict, message: str) -> dict:
        """Retain follow-up filters but discard stale selection on a new search."""
        conversation = dict(conversation)
        state = dict(conversation.get("conversation_state", {}))
        explicit = self.intent_parser._parse_with_rules(message, {})
        text = message.lower().strip()
        restart = bool(re.search(r"\b(start over|new search|forget that|forget previous|something else)\b", text))
        category_changed = bool(explicit.category and explicit.category != state.get("category"))
        if restart or category_changed:
            state = {"recent_turns": state.get("recent_turns", [])}
        changed_filter = any(getattr(explicit, key) is not None and getattr(explicit, key) != state.get(key) for key in ["category", "color", "max_price", "occasion"])
        # Explicit requests for another category or filter should trigger a fresh search.
        if restart or category_changed or changed_filter:
            state.pop("purchase", None)
            for key in ["selected_product_id", "recommended_product_ids", "pending_product_action", "last_search_had_results", "last_offer_type", "last_image_analysis", "last_order_id"]:
                state.pop(key, None)
            conversation["selected_product_id"] = None
            conversation["recommended_product_ids"] = []
        conversation["conversation_state"] = state
        return conversation

    async def _presentation_request(self, business_id, message, conversation, state):
        text = message.lower().strip()
        if text in {"thanks", "thank you", "thank you!", "thanks!", "thankyou"}:
            return "You're welcome!", [], "none"
        if text in {"hi", "hello", "hey"}:
            return "Hi! What are you looking for today?", [], "none"
        wants_link = bool(re.search(r"\b(link|url|website)\b", text))
        wants_photos = bool(re.search(r"\b(photos?|pictures?|images?|pics?)\b", text))
        pending = state.get("pending_product_action")
        ids = conversation.get("recommended_product_ids", []) or state.get("recommended_product_ids", [])
        options = await self._load_recommended_products(business_id, ids)
        selected = conversation.get("selected_product_id") or state.get("selected_product_id")
        # Resolve only explicit numbers/ordinals here; a bare 'one' is ambiguous.
        match = re.fullmatch(r"[1-5]", text) or re.search(r"\b(?:option|number|product)\s*([1-5])\b", text)
        index = int(match.group(match.lastindex or 0)) - 1 if match else None
        if index is None:
            for word, value in [("first", 0), ("second", 1), ("third", 2), ("fourth", 3), ("fifth", 4)]:
                if re.search(rf"\b{word}\b", text):
                    index = value
                    break
        named = [p for p in options if p.name.lower() in text]
        chosen = options[index] if index is not None and index < len(options) else (named[0] if len(named) == 1 else None)
        action = "link" if wants_link else "photos" if wants_photos else pending if chosen else None
        if not action and not chosen:
            return None
        # Let stock, alternatives, variants, and order handling keep their normal routing.
        if not action and chosen and text not in {chosen.name.lower(), str((index or 0) + 1), "first", "second", "third", "fourth", "fifth"}:
            return None
        if chosen is None and selected:
            chosen = await self.product_tools.get_product_details(business_id, str(selected))
        if chosen is None and len(options) == 1:
            chosen = options[0]
        if chosen is None:
            if action == "photos" and options:
                return "Here are photos of these options. Reply with the product number or name.", options, "recommendations"
            if options:
                state["pending_product_action"] = action
                return "Which product? Reply with its number or name:\n" + "\n".join(f"{i}. {p.name}" for i, p in enumerate(options, 1)), [], "none"
            state["pending_product_action"] = action
            return None
        state["selected_product_id"] = chosen.id
        state.pop("pending_product_action", None)
        if action == "link":
            url = chosen.attributes.get("product_url")
            reply = f"{chosen.name}\n{url}" if url else f"The store link for {chosen.name} is not configured yet."
            return reply, [chosen], "gallery" if wants_photos and chosen.images else "none"
        if action == "photos":
            reply = f"Photos of {chosen.name}:" if chosen.images else f"I don't have a publicly accessible photo for {chosen.name} right now."
            if wants_link:
                reply += "\n" + str(chosen.attributes.get("product_url") or "The store link is not configured yet.")
            return reply, [chosen], "gallery" if chosen.images else "none"
        return self._build_detail_response(chosen), [chosen], "recommendations"

    def _detect_follow_up(self, message: str, conversation: dict, conversation_state: dict) -> dict | None:
        text = message.lower().strip()
        recommended_ids = [str(product_id) for product_id in conversation.get("recommended_product_ids", [])]
        if not recommended_ids:
            recommended_ids = [str(product_id) for product_id in conversation_state.get("recommended_product_ids", [])]

        selected_product_id = conversation.get("selected_product_id") or conversation_state.get("selected_product_id")
        product_id = self._resolve_reference(text, recommended_ids, str(selected_product_id) if selected_product_id else None)
        if not product_id and self._is_alternative_request(text) and recommended_ids:
            product_id = str(selected_product_id) if selected_product_id else recommended_ids[0]
        if not product_id:
            return None

        variant_filters = self._extract_variant_filters(text)
        if variant_filters:
            follow_up_type = "variants"
        elif self._is_alternative_request(text):
            follow_up_type = "alternatives"
        elif self._is_stock_question(text):
            follow_up_type = "stock"
        else:
            follow_up_type = "details"

        return {
            "type": follow_up_type,
            "product_id": product_id,
            "variant_filters": variant_filters,
            "cheaper": self._is_cheaper_request(text),
        }

    def _image_analysis_to_search_text(self, image_analysis: dict) -> str:
        if not image_analysis:
            return "Find similar products for this image"
        values = [
            image_analysis.get("color"),
            image_analysis.get("fabric") or image_analysis.get("material"),
            image_analysis.get("category"),
            image_analysis.get("occasion"),
            image_analysis.get("style"),
        ]
        search_text = " ".join(str(value) for value in values if value)
        return search_text or "Find similar products for this image"

    def _merge_image_analysis_into_intent(self, intent: IntentResult, image_analysis: dict) -> IntentResult:
        attributes = dict(intent.attributes)
        for key in ["material", "fabric", "style", "pattern", "work", "gender"]:
            if image_analysis.get(key) and not attributes.get(key):
                attributes[key] = image_analysis[key]

        return IntentResult(
            intent="product_search",
            language=intent.language,
            script=intent.script,
            category=intent.category or image_analysis.get("category"),
            color=intent.color or image_analysis.get("color"),
            min_price=intent.min_price,
            max_price=intent.max_price,
            occasion=intent.occasion or image_analysis.get("occasion"),
            size=intent.size,
            brand=intent.brand,
            attributes=attributes,
            confidence=max(intent.confidence, float(image_analysis.get("confidence") or 0.65)),
        )

    def _resolve_reference(self, text: str, recommended_ids: list[str], selected_product_id: str | None) -> str | None:
        ordinal_matches = [
            ("second", 1),
            ("2nd", 1),
            ("third", 2),
            ("3rd", 2),
            ("fourth", 3),
            ("4th", 3),
            ("fifth", 4),
            ("5th", 4),
            ("first", 0),
            ("1st", 0),
        ]
        for word, index in ordinal_matches:
            if re.search(rf"\b{word}\b", text) and index < len(recommended_ids):
                return recommended_ids[index]

        numeric_match = re.search(r"\b([1-5])\b", text)
        if numeric_match:
            index = int(numeric_match.group(1)) - 1
            if index < len(recommended_ids):
                return recommended_ids[index]

        if any(
            re.search(rf"\b{re.escape(phrase)}\b", text)
            for phrase in [
                "this product",
                "that product",
                "this item",
                "that item",
                "this one",
                "that one",
                "same one",
                "it",
                "is it",
                "looks good",
                "show details",
                "details",
                "tell me more",
                "more about",
            ]
        ):
            return selected_product_id or (recommended_ids[0] if len(recommended_ids) == 1 else None)

        if self._is_affirmative(text) and selected_product_id:
            return selected_product_id

        return None

    def _extract_variant_filters(self, text: str) -> dict:
        filters = {}
        color = self._first_match(text, ["dark blue", "black", "blue", "red", "green", "white", "pink", "yellow", "gold", "purple"])
        if color:
            filters["color"] = color

        size_match = re.search(r"\b(xs|s|m|l|xl|xxl|xxxl|[5-9]|1[0-2])\b", text)
        if size_match:
            filters["size"] = size_match.group(1)

        fabric = self._first_match(text, ["silk", "cotton", "linen", "georgette", "chiffon"])
        if fabric:
            filters["attributes"] = {"fabric": fabric}

        return filters

    def _first_match(self, text: str, values: list[str]) -> str | None:
        return next((value for value in values if value in text), None)

    def _is_stock_question(self, text: str) -> bool:
        return any(phrase in text for phrase in ["stock", "available", "in stock", "undha", "unda", "dorukutunda"])

    def _is_detail_request(self, text: str) -> bool:
        normalized = text.lower()
        return any(phrase in normalized for phrase in ["detail", "details", "tell me", "more about"])

    def _is_alternative_request(self, text: str) -> bool:
        return any(phrase in text for phrase in ["cheaper", "less price", "low price", "similar", "show more", "another option", "alternative"])

    def _is_cheaper_request(self, text: str) -> bool:
        return any(phrase in text for phrase in ["cheaper", "less price", "low price", "budget"])

    def _is_order_request(self, message: str) -> bool:
        text = message.lower().strip()
        return any(
            phrase in text
            for phrase in [
                "order",
                "book",
                "buy",
                "purchase",
                "place order",
                "i want this",
                "want this",
                "take this",
                "confirm this",
                "cod",
                "cash on delivery",
                "deliver",
                "delivery",
                "address",
                "parcel",
                "pack this",
                "idi kavali",
                "idhi kavali",
                "kavali",
                "teesukunta",
            ]
        )

    def _looks_like_order_details(self, message: str) -> bool:
        text = message.lower().strip()
        return bool(
            re.search(r"\b\d{10,15}\b", text)
            or any(word in text for word in ["address", "location", "door", "street", "road", "colony", "mandal", "district"])
            or any(word in text for word in ["cod", "cash on delivery", "upi", "gpay", "phonepe", "payment"])
            or re.search(r"\b(my name is|name is|name:)\b", text)
        )

    def _is_retry_options_request(self, message: str) -> bool:
        text = message.lower().strip()
        exact_replies = {"yes", "yeah", "yep", "ok", "okay", "sure", "fine", "ha", "haa", "avunu"}
        return text in exact_replies or any(
            phrase in text
            for phrase in [
                "check for other options",
                "other options",
                "another option",
                "try different",
                "show alternatives",
                "show similar",
                "show more",
            ]
        )

    def _is_affirmative(self, text: str) -> bool:
        return text in {"yes", "yeah", "yep", "ok", "okay", "sure", "fine", "ha", "haa", "avunu"}

    def _should_ask_for_product_choice(self, message: str, conversation: dict, conversation_state: dict) -> bool:
        if not self._is_affirmative(message.lower().strip()):
            return False
        recommended_ids = conversation.get("recommended_product_ids", []) or conversation_state.get("recommended_product_ids", [])
        selected_product_id = conversation.get("selected_product_id") or conversation_state.get("selected_product_id")
        return len(recommended_ids) > 1 and not selected_product_id

    async def _load_recommended_products(self, business_id: str, product_ids: list) -> list[ProductPublic]:
        products = []
        for product_id in product_ids[:5]:
            product = await self.product_tools.get_product_details(business_id, str(product_id))
            if product:
                products.append(product)
        return products

    def _intent_from_state(self, conversation_state: dict, current_intent: IntentResult) -> IntentResult:
        return IntentResult(
            intent="product_search",
            language=current_intent.language,
            script=current_intent.script,
            category=conversation_state.get("category"),
            color=conversation_state.get("color"),
            min_price=conversation_state.get("min_price"),
            max_price=conversation_state.get("max_price"),
            occasion=conversation_state.get("occasion"),
            size=conversation_state.get("size"),
            brand=conversation_state.get("brand"),
            attributes=conversation_state.get("attributes", {}),
            confidence=current_intent.confidence,
        )

    async def _search_relaxed_options(self, business_id: str, intent: IntentResult) -> tuple[list[ProductPublic], str]:
        attempts = [
            (
                "the same category and budget, but relaxing color and occasion",
                ProductSearchParams(
                    business_id=business_id,
                    category=intent.category,
                    min_price=intent.min_price,
                    max_price=intent.max_price,
                    size=intent.size,
                    brand=intent.brand,
                    limit=5,
                ),
            ),
            (
                "the same category, but relaxing color, occasion, and budget",
                ProductSearchParams(
                    business_id=business_id,
                    category=intent.category,
                    size=intent.size,
                    brand=intent.brand,
                    limit=5,
                ),
            ),
            (
                "nearby options from other categories",
                ProductSearchParams(
                    business_id=business_id,
                    max_price=intent.max_price,
                    color=intent.color,
                    occasion=intent.occasion,
                    limit=5,
                ),
            ),
        ]

        for summary, params in attempts:
            products = await self.product_tools.search_products(params)
            if products:
                return products, summary

        return [], "broader catalogue"

    def _build_store_checkout_response(self, product: ProductPublic) -> str:
        product_url = product.attributes.get("product_url") if product.attributes else None
        if product_url:
            return f"Continue securely on the store to choose options, enter your address, and pay: {product_url}"
        return "Please open this product in the store to choose options, enter your address, and complete payment securely."

    async def _get_or_create_conversation(self, conversation_id: str | None, business_id: str) -> dict:
        if conversation_id:
            conversation = await self.conversation_repository.find_by_id(conversation_id, business_id)
            if conversation is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
            return conversation

        return await self.conversation_repository.create_conversation(
            business_id=business_id,
            payload={"channel": "web", "customer_id": None},
        )

    def _merge_conversation_state(self, current_state: dict, intent: IntentResult) -> dict:
        next_state = dict(current_state)
        for key, value in intent.model_dump().items():
            if key in {"intent", "confidence", "attributes"}:
                continue
            if value is not None:
                next_state[key] = value
        if intent.attributes:
            next_state["attributes"] = {**next_state.get("attributes", {}), **intent.attributes}
        return next_state

    def _build_response(self, intent: IntentResult, products: list[ProductPublic]) -> str:
        if intent.intent != "product_search":
            return "I can help with products, delivery, returns, payments, or your order. What would you like to know?"

        missing_questions = self._missing_questions(intent)
        if missing_questions and self._should_ask_clarifying(intent, products):
            return "Sure, I can help. " + " ".join(missing_questions)

        details = []
        if intent.color:
            details.append(intent.color)
        if intent.category:
            details.append(intent.category)
        if intent.occasion:
            details.append(f"for {intent.occasion}")
        if intent.max_price:
            details.append(f"under {int(intent.max_price)}")

        summary = " ".join(details) if details else "your requirement"
        if not products:
            return f"That exact {summary} is not available right now. Want me to show the closest options?"

        best_product = products[0]
        lines = [
            f"Yes, these {len(products)} option{'s' if len(products) != 1 else ''} look good for {summary}.",
            f"{best_product.name} is a nice first choice because it is {self._short_match_reason(best_product)}.",
        ]
        for index, product in enumerate(products, start=1):
            price = product.sale_price if product.sale_price is not None else product.price
            stock_text = "in stock" if product.stock > 0 else "out of stock"
            reason_parts = []
            if intent.color and product.attributes.get("color"):
                reason_parts.append(str(product.attributes["color"]))
            if product.attributes.get("fabric"):
                reason_parts.append(str(product.attributes["fabric"]))
            if product.attributes.get("occasion"):
                reason_parts.append(f"for {product.attributes['occasion']}")
            reason = f" ({', '.join(reason_parts)})" if reason_parts else ""
            lines.append(f"{index}. {product.name} - {product.currency} {int(price)} - {stock_text}{reason}")

        lines.append("Want details for any one?")
        return "\n".join(lines)

    def _build_relaxed_response(self, intent: IntentResult, relaxed_summary: str, products: list[ProductPublic]) -> str:
        requested_parts = []
        if intent.color:
            requested_parts.append(intent.color)
        if intent.occasion:
            requested_parts.append(intent.occasion)
        if intent.category:
            requested_parts.append(intent.category)
        if intent.max_price:
            requested_parts.append(f"under {int(intent.max_price)}")
        requested = " ".join(requested_parts) if requested_parts else "that exact request"

        if not products:
            return f"I checked close options too, but nothing good is available for {requested}. Can you change one thing, like color or budget?"

        lines = [
            f"That exact {requested} is not available right now. These are the closest ones:",
        ]
        for index, product in enumerate(products, start=1):
            price = product.sale_price if product.sale_price is not None else product.price
            stock_text = "in stock" if product.stock > 0 else "out of stock"
            color = product.attributes.get("color")
            occasion = product.attributes.get("occasion")
            detail = ", ".join(str(value) for value in [color, occasion] if value)
            suffix = f" ({detail})" if detail else ""
            lines.append(f"{index}. {product.name} - {product.currency} {int(price)} - {stock_text}{suffix}")
        lines.append("Want details for any one?")
        return "\n".join(lines)

    def _missing_questions(self, intent: IntentResult) -> list[str]:
        questions = []
        if not intent.category:
            questions.append("What product category are you looking for?")
        if not intent.max_price:
            questions.append("What budget should I stay within?")
        if not intent.color:
            questions.append("Any color preference?")
        return questions[:2]

    def _should_ask_clarifying(self, intent: IntentResult, products: list[ProductPublic]) -> bool:
        if not intent.category:
            return True
        has_useful_filter = any(
            [
                intent.color,
                intent.max_price,
                intent.occasion,
                intent.size,
                intent.brand,
                intent.attributes,
            ]
        )
        return not has_useful_filter

    def _short_match_reason(self, product: ProductPublic) -> str:
        parts = []
        if product.attributes.get("fabric"):
            parts.append(str(product.attributes["fabric"]))
        if product.attributes.get("occasion"):
            parts.append(f"suitable for {product.attributes['occasion']}")
        if product.stock > 0:
            parts.append("available")
        return ", ".join(parts) if parts else "a good option"

    def _build_detail_response(self, product: ProductPublic) -> str:
        price = product.sale_price if product.sale_price is not None else product.price
        lines = [
            f"{product.name}",
            f"Price is {product.currency} {int(price)}.",
            "It's in stock." if product.stock > 0 else "It's currently out of stock.",
        ]
        if product.description:
            lines.append(product.description)
        if product.attributes:
            readable_attributes = ", ".join(f"{key.replace('_', ' ')}: {value}" for key, value in product.attributes.items() if key in {"color", "fabric", "material", "fit", "sizes", "brand", "care"})
            if readable_attributes:
                lines.append(readable_attributes)
        lines.append("Would you like the product link?")
        return "\n".join(lines)

    def _build_stock_response(self, stock_result: dict) -> str:
        product = stock_result["product"]
        if product is None:
            return "I am not seeing that product now."
        if stock_result["available"]:
            return f"Yes, {product.name} is available. Stock left: {stock_result['stock']}."
        return f"{product.name} is currently out of stock."

    def _build_variant_response(self, selected_product: ProductPublic, variants: list[ProductPublic], filters: dict) -> str:
        filter_text = ", ".join(str(value) for key, value in filters.items() if key != "attributes" for value in [value])
        if filters.get("attributes"):
            filter_text = ", ".join([filter_text, *[str(value) for value in filters["attributes"].values()]]).strip(", ")

        if not variants:
            suffix = f" matching {filter_text}" if filter_text else ""
            return f"I checked options similar to {selected_product.name}{suffix}, but nothing is available right now."

        lines = [f"These similar options are available{' for ' + filter_text if filter_text else ''}:"]
        for index, product in enumerate(variants, start=1):
            price = product.sale_price if product.sale_price is not None else product.price
            stock_text = "in stock" if product.stock > 0 else "out of stock"
            lines.append(f"{index}. {product.name} - {product.currency} {int(price)} - {stock_text}")
        return "\n".join(lines)

    def _build_alternatives_response(self, selected_product: ProductPublic, products: list[ProductPublic], cheaper: bool) -> str:
        if not products:
            if cheaper:
                return f"I checked cheaper options like {selected_product.name}, but nothing is available right now."
            return f"I checked similar options to {selected_product.name}, but nothing is available right now."

        intro = "These cheaper similar options are available:" if cheaper else "These similar options are available:"
        lines = [intro]
        for index, product in enumerate(products, start=1):
            price = product.sale_price if product.sale_price is not None else product.price
            stock_text = "in stock" if product.stock > 0 else "out of stock"
            lines.append(f"{index}. {product.name} - {product.currency} {int(price)} - {stock_text}")
        lines.append("Want details for any one?")
        return "\n".join(lines)

    def _product_card(self, product: ProductPublic) -> dict:
        price = product.sale_price if product.sale_price is not None else product.price
        return {
            "id": product.id,
            "name": product.name,
            "category": product.category,
            "price": product.price,
            "sale_price": product.sale_price,
            "display_price": price,
            "currency": product.currency,
            "stock": product.stock,
            "image": product.images[0] if product.images else None,
            "attributes": product.attributes,
        }
