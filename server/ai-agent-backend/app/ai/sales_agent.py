import asyncio
import hashlib
import logging
import re
import time
from uuid import uuid4
from datetime import datetime, timezone
from difflib import get_close_matches
from types import SimpleNamespace
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import httpx
from fastapi import HTTPException, status

from app.ai.intent_parser import IntentParser
from app.ai.action_policy import ActionPolicy
from app.ai.product_image_analyzer import ProductImageAnalyzer
from app.ai.response_generator import ResponseGenerator
from app.ai.store_knowledge import StoreKnowledge
from app.ai.usage import consume_usage, start_usage_tracking
from app.config.settings import settings
from app.repositories.business_repository import BusinessRepository
from app.repositories.conversation_repository import ConversationRepository
from app.repositories.message_repository import MessageRepository
from app.schemas.product import ProductPublic
from app.schemas.ai import AiChatRequest, AiChatResponse, IntentResult
from app.schemas.conversation import ConversationPublic, MessagePublic
from app.schemas.user import UserPublic
from app.services.conversation_flow import reset_search_context, sync_flow_state
from app.services.pricing import verified_discount, verified_price_text
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
        self._catalog_category_cache: tuple[float, list[str]] | None = None

    async def handle_chat(self, payload: AiChatRequest, current_user: UserPublic) -> AiChatResponse:
        start_usage_tracking()
        started_at = time.monotonic()
        request_id = uuid4().hex
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

        catalog_categories = await self._catalog_category_names()
        image_analysis = {}
        image_embedding = None
        if has_image:
            image_analysis, image_embedding = await asyncio.gather(
                self.image_analyzer.analyze(
                    image_url=payload.image_url,
                    image_data=payload.image_data,
                    mime_type=payload.image_mime_type,
                    customer_message=payload.message,
                    catalog_categories=catalog_categories,
                ),
                self.image_analyzer.embed(
                    image_url=payload.image_url,
                    image_data=payload.image_data,
                    mime_type=payload.image_mime_type,
                ),
            )
        image_analysis_failed = has_image and not image_analysis

        # A customer may send the image first and ask "do you have this?" in
        # the next message (or as a reply to that image). Reuse the latest
        # visual attributes instead of treating "this one" as a cart command.
        image_reference_question = self._is_image_reference_question(payload.message)
        effective_image_analysis = image_analysis
        image_product_choice = self._selected_image_product(
            payload.message,
            conversation.get("conversation_state", {}).get("last_image_analysis") or {},
        )
        if image_product_choice and not effective_image_analysis:
            effective_image_analysis = image_product_choice
        if image_reference_question and not has_image and not effective_image_analysis:
            effective_image_analysis = dict(
                conversation.get("conversation_state", {}).get("last_image_analysis") or {}
            )

        # A captionless WhatsApp image arrives with the internal placeholder
        # "Photo enquiry". Search from the visual attributes, not that label.
        if effective_image_analysis and (has_image or image_reference_question or image_product_choice):
            visual_search_text = self._image_analysis_to_search_text(effective_image_analysis)
            customer_text = payload.message.strip()
            parse_message = " ".join(
                value
                for value in [customer_text if customer_text.lower() != "photo enquiry" else "", visual_search_text]
                if value
            )
        else:
            parse_message = payload.message or self._image_analysis_to_search_text(effective_image_analysis)
        conversation = self._prepare_context(conversation, parse_message, catalog_categories)
        intent = await self.intent_parser.parse(
            parse_message,
            conversation.get("conversation_state", {}),
            catalog_categories=catalog_categories,
        )
        if effective_image_analysis:
            intent = self._merge_image_analysis_into_intent(intent, effective_image_analysis)

        customization_request = self._is_customization_request(payload.message, has_image=has_image)
        previous_catalog_type = str(
            (conversation.get("conversation_state", {}).get("attributes") or {}).get("catalog_type") or ""
        ).lower()
        explicit_catalog_type = str(intent.attributes.get("catalog_type") or "").lower()
        customization_navigation = bool(re.search(
            r"\b(?:where should i design|where can i design|designer link|where can i customize|"
            r"where should i customize|start designing|open the designer)\b",
            self.intent_parser._normalize_text(payload.message),
        ))
        continuing_customization = (
            previous_catalog_type == "customization"
            and (intent.intent == "product_search" or customization_navigation)
            and explicit_catalog_type not in {"readymade", "drop", "drop product"}
            and (customization_navigation or self._continues_customization_context(payload.message))
        )
        if customization_request or continuing_customization:
            intent.intent = "product_search"
            intent.attributes["catalog_type"] = "customization"
            intent.wants_to_buy = False

        updated_state = self._merge_conversation_state(conversation.get("conversation_state", {}), intent)
        # A successful cart mutation is a one-turn event. The next customer
        # message resumes the phase derived from the remaining context.
        updated_state.pop("last_cart_update", None)
        self._remember_customer_preferences(updated_state, payload.message, intent)
        image_lookup = bool(has_image or (effective_image_analysis and (image_reference_question or image_product_choice)))
        if image_lookup:
            # A new visual enquiry must not inherit an older product selection.
            # Otherwise commerce can ask the customer to choose from stale options
            # before the uploaded image has been searched.
            reset_search_context(updated_state)
            conversation["selected_product_id"] = None
            conversation["recommended_product_ids"] = []
        self._apply_product_option(intent.product_option, conversation, updated_state)
        action_allowed, policy_reason = ActionPolicy.validate(intent, conversation, updated_state)
        policy_blocked = not action_allowed
        if policy_blocked:
            logger.warning(
                "Blocked unsafe commerce action=%s conversation=%s reason=%s",
                intent.action,
                conversation.get("_id"),
                policy_reason,
            )
            updated_state["last_policy_block"] = {
                "action": intent.action,
                "reason": policy_reason,
            }
            intent.action = None
            intent.intent = "general_question"
            intent.wants_to_buy = False
        if image_analysis_failed:
            updated_state.pop("last_image_analysis", None)
        if effective_image_analysis:
            updated_state["last_image_analysis"] = effective_image_analysis
        store_question = StoreKnowledge.is_store_question(payload.message) or intent.intent == "store_question"
        store_context = await StoreKnowledge(self.commerce.db if self.commerce else None).load(business, payload.message, include_all=intent.intent == "store_question")
        design_library_request = (
            intent.action == "browse_designs"
            or self._is_design_library_request(payload.message)
        )
        more_options_request = self._is_more_options_request(payload.message)
        # Short follow-ups such as "show more" must continue the active
        # product browse. The intent model can misclassify these messages as
        # browse_designs, which otherwise routes the reply to the design
        # library and loses the product context.
        if more_options_request:
            design_library_request = False
        if more_options_request:
            # "More" is a continuation of the active search even when the
            # language model classifies the short phrase as a general question.
            intent = self._intent_from_state(updated_state, intent)
        browse_key = self._browse_history_key(intent)
        browse_history = dict(updated_state.get("browse_history") or {})
        previous_recommendations = (
            updated_state.get("recommended_product_ids")
            or conversation.get("recommended_product_ids")
            or []
        )
        seen_product_ids = (
            list(browse_history.get(browse_key) or previous_recommendations)
            if more_options_request
            else []
        )
        order_request = self._is_order_request(payload.message)
        needs_clarification = (
            not has_image
            and not policy_blocked
            and intent.intent == "product_search"
            and float(intent.confidence or 0) < 0.6
            and not any([
                intent.category,
                intent.color,
                intent.min_price is not None,
                intent.max_price is not None,
                intent.occasion,
                intent.size,
                intent.brand,
                intent.attributes,
            ])
        )
        follow_up = (
            None
            if more_options_request
            else self._detect_follow_up(payload.message, conversation, updated_state)
        )
        retry_options = self._is_retry_options_request(payload.message) and updated_state.get("last_search_had_results") is False
        products = []
        selected_product = None
        tool_calls = []
        response_goal = "answer"
        presentation = None
        if design_library_request and not image_lookup and not needs_clarification:
            presentation = await self._design_library_presentation(
                business_id,
                payload.message,
                conversation,
                updated_state,
            )
        if self.commerce and not image_lookup and not presentation and not needs_clarification:
            presentation = await self.commerce.handle(
                payload.message,
                conversation,
                updated_state,
                self.product_tools,
                business_id,
                intent=intent,
            )
        # An uploaded customer image is input for vision/search. It must not be
        # mistaken for a request to resend photos from the previous turn.
        if not presentation and not has_image and not needs_clarification:
            presentation = await self._presentation_request(
                business_id,
                payload.message,
                conversation,
                updated_state,
                intent_action=intent.action,
                intent_option=intent.product_option,
            )

        if needs_clarification:
            ai_text = "I want to find the right product for you. What product type, style, color, or budget should I search for?"
            response_goal = "ask for clarification because intent confidence is low"
            tool_calls.append({"name": "intent_validation", "status": "clarification_requested"})
        elif policy_blocked:
            ai_text = (
                "I need you to select a product first before I can continue. "
                "Please reply with the product number or name from the options shown."
            )
            response_goal = "explain that a commerce action needs a selected product"
            tool_calls.append({
                "name": "action_policy",
                "status": "blocked",
                "reason": policy_reason,
            })
        elif image_analysis_failed and not presentation and not customization_request:
            ai_text = (
                "Thanks for the photo. Image analysis is temporarily unavailable, "
                "so I can't reliably identify the item yet. Tell me the product type, "
                "color, or any name printed on it, and I'll search our catalogue. "
                "You can also send 'human' to speak with our team."
            )
            response_goal = "report that image analysis failed without guessing what is in the image"
            tool_calls.append({"name": "analyze_product_image", "status": "failed"})
        elif has_image and self._has_multiple_products(image_analysis) and not presentation and not customization_request:
            ai_text = self._build_multiple_product_question(image_analysis)
            response_goal = "ask which pictured product the customer means"
            tool_calls.append({"name": "analyze_product_image", "status": "multiple_products"})
        elif has_image and float(image_analysis.get("confidence") or 0) < 0.4 and not presentation and not customization_request:
            product_type = image_analysis.get("product_type") or "item"
            ai_text = f"I can see a possible {product_type}, but the image isn't clear enough to match confidently. Can you send a closer crop of the product?"
            response_goal = "ask for a clearer product image because recognition confidence is low"
            tool_calls.append({"name": "analyze_product_image", "status": "low_confidence"})
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
            if has_image and effective_image_analysis and intent.attributes.get("catalog_type") != "customization":
                products = await self.product_tools.search_from_image(
                    business_id=business_id,
                    intent=intent,
                    image_analysis=effective_image_analysis,
                    image_embedding=image_embedding,
                )
            else:
                products = await self.product_tools.search_from_intent(
                    business_id=business_id,
                    intent=intent,
                    query=payload.message,
                    exclude_ids=seen_product_ids,
                    limit=3 if conversation.get("channel") == "whatsapp" else 5,
                )
            if not products:
                if more_options_request:
                    requested = intent.category or "matching product"
                    ai_text = f"I’ve shown all currently available {requested} options. Tell me what you want to change, such as color, style, or budget."
                    response_goal = "report that there are no unseen matching products"
                    updated_state["last_offer_type"] = "no_more_options"
                    tool_calls.append({
                        "name": "search_more_products",
                        "excluded_count": len(seen_product_ids),
                        "result_count": 0,
                    })
                else:
                    relaxed_products, relaxed_summary = await self._search_relaxed_options(
                        business_id,
                        intent,
                        allow_other_categories=not bool(effective_image_analysis or intent.category),
                    )
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
                    if intent.attributes.get("catalog_type") == "customization":
                        ai_text = self._build_customization_response(
                            products,
                            reference_received=bool(has_image or effective_image_analysis),
                        )
                        response_goal = "guide the customer from a customization request to a customizable base product"
                    elif effective_image_analysis and not products:
                        ai_text = self._build_image_no_match_response(effective_image_analysis)
                        response_goal = "clearly report that the pictured product type is not in the catalogue"
                    else:
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
                if intent.attributes.get("catalog_type") == "customization":
                    ai_text = self._build_customization_response(
                        products,
                        reference_received=bool(has_image or effective_image_analysis),
                    )
                    response_goal = "guide the customer from a customization request to a customizable base product"
                elif effective_image_analysis:
                    ai_text = self._build_image_match_response(intent, products, effective_image_analysis)
                    response_goal = "recommend visually ranked catalogue products with calibrated confidence"
                else:
                    ai_text = self._build_response(intent, products)
                    response_goal = "recommend matching products"
        else:
            ai_text = self._build_response(intent, products)
            response_goal = "ask a helpful clarifying question"

        if response_goal in {
            "recommend matching products",
            "recommend visually ranked catalogue products with calibrated confidence",
            "recommend close alternatives after the exact search failed",
            "guide the customer from a customization request to a customizable base product",
        }:
            updated_state["last_search_had_results"] = bool(products)

        if conversation.get("channel") == "whatsapp" and len(products) > 3:
            products = products[:3]

        if intent.intent == "product_search" and products and response_goal in {
            "recommend matching products",
            "recommend visually ranked catalogue products with calibrated confidence",
            "guide the customer from a customization request to a customizable base product",
        }:
            previous_ids = seen_product_ids if more_options_request else []
            browse_history[browse_key] = list(dict.fromkeys([
                *previous_ids,
                *[product.id for product in products],
            ]))[-100:]
            # Keep only the most recent search groups so conversation state
            # stays bounded across long-running customer chats.
            updated_state["browse_history"] = dict(list(browse_history.items())[-20:])

        if products:
            updated_state["option_product_ids"] = {
                str(index): product.id for index, product in enumerate(products, start=1)
            }
            updated_state["option_products"] = [
                {"option": index, "name": product.name}
                for index, product in enumerate(products, start=1)
            ]
            updated_state["last_search"] = {
                "category": intent.category,
                "color": intent.color,
                "source_type": intent.attributes.get("catalog_type"),
                "result_count": len(products),
                "from_image": bool(effective_image_analysis),
            }

        if not presentation and (not image_analysis_failed or customization_request):
            ai_text = await self.response_generator.generate(
                customer_message=payload.message,
                intent=intent,
                fallback_response=ai_text,
                conversation_state=updated_state,
                products=products,
                selected_product=selected_product,
                response_goal=response_goal,
                store_context=store_context,
                merchant_prompt=business.get("ai_prompt_config"),
            )

        if conversation.get("channel") == "whatsapp":
            ai_text = self._compact_whatsapp_reply(ai_text)

        updated_state["recent_turns"] = (updated_state.get("recent_turns", []) + [
            {"customer": payload.message[:1000], "reply": ai_text[:1500]}
        ])[-12:]
        flow_phase = sync_flow_state(updated_state)
        ai_message = await self.message_repository.create_message(
            business_id=business_id,
            conversation_id=str(conversation["_id"]),
            customer_id=str(conversation["customer_id"]) if conversation.get("customer_id") else None,
            payload={
                "sender": "ai",
                "content": ai_text,
                "message_type": "text",
                "metadata": {
                    "request_id": request_id,
                    "media_mode": presentation[2] if presentation else "recommendations",
                    "intent": intent.model_dump(),
                    "image_analysis": image_analysis,
                    "tool_calls": tool_calls,
                    "recommended_product_ids": [product.id for product in products],
                    "recommended_products": [self._product_card(product) for product in products],
                    "selected_product_id": updated_state.get("selected_product_id"),
                    "flow_phase": flow_phase,
                    "merchant_prompt_version": (business.get("ai_prompt_config") or {}).get("version") or settings.merchant_prompt_version,
                },
            },
        )

        is_customization_lead = bool(
            customization_request
            or continuing_customization
            or design_library_request
            or intent.attributes.get("catalog_type") == "customization"
            or updated_state.get("customization_interest")
        )
        if is_customization_lead:
            updated_state["customization_interest"] = True
        customization_reply_lower = ai_text.lower()
        customization_needs_handoff = bool(
            is_customization_lead
            and (
                # There is no verified base product/designer URL to continue
                # the flow, so the store team must take ownership.
                ("designer link is not configured" in customization_reply_lower)
                or (
                    ("couldn't find" in customization_reply_lower or "couldn't load" in customization_reply_lower)
                    and "https://" not in ai_text
                )
                or ("send 'human'" in customization_reply_lower and "https://" not in ai_text)
            )
        )
        if customization_needs_handoff and not updated_state.get("handoff_requested"):
            updated_state["handoff_requested"] = True
            updated_state["handoff_context"] = {
                "reason": "customization_help",
                "summary": (
                    "The customer requested customization, but the agent could not complete the "
                    "customization flow or provide a verified designer link."
                ),
                "urgency": "high",
            }
            ai_text = (
                "I couldn't complete the customization setup automatically. "
                "I've sent this to our customization team with your request, and they will contact you shortly."
            )
        conversation_updates = {
            "status": "handoff" if updated_state.get("handoff_requested") else conversation.get("status", "open"),
            "current_intent": intent.intent,
            "conversation_state": updated_state,
            "recommended_product_ids": updated_state.get("recommended_product_ids", [product.id for product in products]),
            "selected_product_id": updated_state.get("selected_product_id"),
            "updated_at": ai_message["created_at"],
            "last_message_at": ai_message["created_at"],
        }
        if is_customization_lead:
            conversation_updates.update({
                "lead_type": "customization",
                "lead_status": conversation.get("lead_status") or "new",
                "lead_updated_at": ai_message["created_at"],
            })
        elif updated_state.get("handoff_requested"):
            conversation_updates.update({
                "lead_type": conversation.get("lead_type") or "general",
                "lead_status": conversation.get("lead_status") or "new",
                "lead_updated_at": ai_message["created_at"],
            })

        handoff_context = updated_state.get("handoff_context") or {}
        if updated_state.get("handoff_requested"):
            conversation_updates.update({
                "handoff_reason": handoff_context.get("reason") or "customer_requested_team",
                "handoff_summary": handoff_context.get("summary") or "",
                "handoff_urgency": handoff_context.get("urgency") or "normal",
                "handoff_requested_at": ai_message["created_at"],
            })

        await self.conversation_repository.collection.update_one(
            {"_id": conversation["_id"], "business_id": business["_id"]},
            {"$set": conversation_updates},
        )
        if updated_state.get("handoff_requested"):
            await self.conversation_repository.collection.database.whatsapp_handoff_alerts.update_one(
                {"conversation_id": conversation["_id"], "status": {"$in": ["open", "assigned"]}},
                {
                    "$set": {"updated_at": ai_message["created_at"]},
                    "$setOnInsert": {
                        "business_id": business["_id"],
                        "conversation_id": conversation["_id"],
                        "request_id": request_id,
                        "customer_name": conversation.get("customer_name"),
                        "external_customer_ref": conversation.get("external_customer_ref"),
                        "lead_type": "customization" if is_customization_lead else "general",
                        "status": "open",
                        "reason": handoff_context.get("reason") or "customer_requested_team",
                        "summary": handoff_context.get("summary") or "",
                        "urgency": handoff_context.get("urgency") or "normal",
                        "created_at": ai_message["created_at"],
                    },
                },
                upsert=True,
            )
        if tool_calls:
            try:
                await self.conversation_repository.collection.database.ai_action_audit.insert_many([
                    {
                        "business_id": business["_id"],
                        "conversation_id": conversation["_id"],
                        "customer_id": conversation.get("customer_id"),
                        "channel": conversation.get("channel"),
                        "action": str(call.get("name") or "unknown"),
                        "arguments": {key: value for key, value in call.items() if key not in {"name", "error"}},
                        "outcome": "failed" if call.get("status") == "failed" else "completed",
                        "created_at": datetime.now(timezone.utc),
                    }
                    for call in tool_calls
                ])
            except Exception as exc:
                logger.warning("AI action audit write skipped: %s", exc.__class__.__name__)
        refreshed_conversation = await self.conversation_repository.find_by_id(str(conversation["_id"]), business_id)

        provider_usage = consume_usage()
        await self._record_metric(
            business_id=business_id,
            request_id=request_id,
            intent=intent,
            result_count=len(products),
            image_analysis=image_analysis,
            had_image=has_image,
            image_embedding_available=bool(image_embedding),
            handoff_requested=bool(updated_state.get("handoff_requested")),
            policy_blocked=policy_blocked,
            checkout_failure=(
                "couldn't create a secure checkout link" in ai_text.lower()
                or "store service isn't responding" in ai_text.lower()
            ),
            response_goal=response_goal,
            latency_ms=round((time.monotonic() - started_at) * 1000),
            provider_usage=provider_usage,
        )

        logger.info(
            "AI chat handled request=%s conversation=%s intent=%s confidence=%.2f results=%s",
            request_id, conversation["_id"], intent.intent, float(intent.confidence or 0), len(products),
        )
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
        account_ref = hashlib.sha256(f"{business_id}:{external_customer_ref}".encode()).hexdigest()
        linked_identity = (
            await self.commerce.db.whatsapp_account_links.find_one(
                {"_id": account_ref, "expiresAt": {"$gt": datetime.now(timezone.utc)}}
            )
            if self.commerce else None
        )
        canonical_customer_id = (
            str(linked_identity["user"])
            if linked_identity and linked_identity.get("user")
            else None
        )
        canonical_ref = f"user:{canonical_customer_id}" if canonical_customer_id else f"whatsapp:{account_ref}"
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
                    "customer_id": canonical_customer_id,
                    "external_customer_ref": external_customer_ref,
                    "customer_name": customer_name,
                    "canonical_customer_ref": canonical_ref,
                },
            )
        elif (customer_name and not conversation.get("customer_name")) or (canonical_customer_id and not conversation.get("customer_id")):
            await self.conversation_repository.collection.update_one(
                {"_id": conversation["_id"], "business_id": business["_id"]},
                {"$set": {
                    **({"customer_name": customer_name} if customer_name else {}),
                    **({"customer_id": parse_object_id(canonical_customer_id)} if canonical_customer_id else {}),
                    "canonical_customer_ref": canonical_ref,
                }},
            )
            if canonical_customer_id:
                conversation["customer_id"] = parse_object_id(canonical_customer_id)
            conversation["canonical_customer_ref"] = canonical_ref

        if quoted_product_id:
            quoted_state = dict(conversation.get("conversation_state", {}))
            if str(quoted_state.get("selected_product_id") or "") != str(quoted_product_id):
                quoted_state.pop("purchase", None)
                quoted_state.pop("last_declined_purchase", None)
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

    def _prepare_context(
        self,
        conversation: dict,
        message: str,
        catalog_categories: list[str] | None = None,
    ) -> dict:
        """Retain follow-up filters but discard stale selection on a new search."""
        conversation = dict(conversation)
        state = dict(conversation.get("conversation_state", {}))
        previous_recommendations = list(
            conversation.get("recommended_product_ids", [])
            or state.get("recommended_product_ids", [])
        )
        more_options_request = self._is_more_options_request(message)
        explicit = self.intent_parser._parse_with_rules(message, {}, catalog_categories)
        text = message.lower().strip()
        restart = bool(re.search(r"\b(start over|new search|forget that|forget previous|something else)\b", text))
        forget_preferences = bool(re.search(r"\b(forget (?:my |all |the )?(?:preferences|taste|history|previous)|clear (?:my )?(?:preferences|history))\b", text))
        category_changed = bool(explicit.category and explicit.category != state.get("category"))
        explicit_category_search = bool(
            explicit.category
            and not re.search(r"\b(?:this|that|it|option|product)\b", text)
        )
        explicit_attribute_search = bool(
            explicit.attributes
            and re.search(r"\b(?:only|show|find|looking|look for|want|need)\b", text)
            and not re.search(r"\b(?:this|that|it|option|product)\b", text)
        )
        previous_catalog_type = (state.get("attributes") or {}).get("catalog_type")
        explicit_catalog_type = explicit.attributes.get("catalog_type")
        if restart or category_changed or explicit_category_search:
            state = {
                "recent_turns": state.get("recent_turns", []),
                **({} if forget_preferences else {"customer_preferences": state.get("customer_preferences", {})}),
                **({"browse_history": state["browse_history"]} if state.get("browse_history") else {}),
            }
            if (category_changed or explicit_category_search) and previous_catalog_type and not explicit_catalog_type:
                if previous_catalog_type != "customization" or self._continues_customization_context(message):
                    state["attributes"] = {"catalog_type": previous_catalog_type}
        changed_filter = any(getattr(explicit, key) is not None and getattr(explicit, key) != state.get(key) for key in ["category", "color", "max_price", "occasion"])
        # Explicit requests for another category or filter should trigger a fresh search.
        if restart or category_changed or explicit_category_search or explicit_attribute_search or changed_filter:
            reset_search_context(state)
            conversation["selected_product_id"] = None
            if more_options_request and previous_recommendations:
                state["recommended_product_ids"] = previous_recommendations
                conversation["recommended_product_ids"] = previous_recommendations
            else:
                conversation["recommended_product_ids"] = []
        conversation["conversation_state"] = state
        return conversation

    async def _presentation_request(
        self, business_id, message, conversation, state, intent_action=None, intent_option=None,
    ):
        text = message.lower().strip()
        if text in {"thanks", "thank you", "thank you!", "thanks!", "thankyou"}:
            return "You're welcome!", [], "none"
        if text in {"hi", "hello", "hey"}:
            return "Hi! What are you looking for today?", [], "none"
        wants_link = intent_action == "product_link" or bool(re.search(r"\b(link|url|website)\b", text))
        wants_photos = intent_action == "product_photos" or bool(re.search(r"\b(photos?|pictures?|images?|pics?)\b", text))
        pending = state.get("pending_product_action")
        ids = conversation.get("recommended_product_ids", []) or state.get("recommended_product_ids", [])
        options = await self._load_recommended_products(business_id, ids)
        selected = conversation.get("selected_product_id") or state.get("selected_product_id")
        # Resolve only explicit numbers/ordinals here; a bare 'one' is ambiguous.
        match = re.fullmatch(r"[1-5]", text) or re.search(
            r"\b(?:option(?: number)?|number|product)\s*#?\s*([1-5])\b", text,
        )
        index = intent_option - 1 if intent_option else (int(match.group(match.lastindex or 0)) - 1 if match else None)
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
        if not action and chosen and index is None and text != chosen.name.lower():
            return None
        if chosen is None and selected:
            chosen = await self.product_tools.get_product_details(business_id, str(selected))
        if chosen is None and len(options) == 1:
            chosen = options[0]
        if chosen is None:
            if action == "photos" and options:
                photo_options = [product for product in options if product.images]
                if photo_options:
                    return "Here are photos of these options. Reply with the product number or name.", photo_options, "recommendations"
                return "I don't have publicly accessible photos for those options right now. Reply with the product number for its details or link.", [], "none"
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
        if chosen.attributes.get("customizable"):
            return self._build_customization_selection_response(chosen), [chosen], "recommendations"
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
            image_analysis.get("product_name_hint"),
            image_analysis.get("visible_text"),
            image_analysis.get("brand"),
            image_analysis.get("color"),
            image_analysis.get("fabric") or image_analysis.get("material"),
            image_analysis.get("category") or image_analysis.get("product_type"),
            image_analysis.get("occasion"),
            image_analysis.get("style"),
        ]
        search_text = " ".join(str(value) for value in values if value)
        return search_text or "Find similar products for this image"

    def _is_image_reference_question(self, message: str) -> bool:
        text = message.lower().strip()
        return bool(
            re.search(r"\b(?:do|did|can)?\s*(?:u|you|we)\s+(?:have|sell|stock)\s+(?:this|it|this one)\b", text)
            or re.search(r"\b(?:is|are)\s+(?:this|it)\s+(?:available|in stock)\b", text)
            or text in {"u have this", "u have this one", "have this", "have this one"}
        )

    def _is_customization_request(self, message: str, has_image: bool = False) -> bool:
        """Recognize natural custom-design requests without requiring exact keywords."""
        text = self.intent_parser._normalize_text(message).strip()
        if re.search(
            r"\b(custom|customized|customised|customizable|customisable|customise|customize|"
            r"customization|customisation|personalize|personalise|own design)\b",
            text,
        ):
            return True
        if re.search(
            r"\b(?:add|put|print|upload|use)\b.{0,35}\b(?:my |our )?"
            r"(?:image|photo|picture|logo|text|name|design)\b",
            text,
        ):
            return True
        if re.search(
            r"\b(?:make|create|design|recreate|print)\b.{0,35}\b(?:this|that|same|similar|like this|design)\b",
            text,
        ):
            return True
        return has_image and bool(
            re.search(r"\b(?:i |we )?(?:want|need|would like).{0,20}\b(?:like|same as)\s+(?:this|that)\b", text)
        )

    def _continues_customization_context(self, message: str) -> bool:
        """Keep custom context for refinements, but clear it for a fresh browse."""
        text = self.intent_parser._normalize_text(message).strip()
        if self._is_customization_request(message):
            return True
        if re.search(r"\b(?:readymade|ready-made|ready made|regular products?)\b", text):
            return False
        explicit = self.intent_parser._parse_with_rules(message, {})
        fresh_browse = bool(re.search(
            r"\b(?:show|find|search|looking for|look for|want|need|do you have|have any)\b",
            text,
        ))
        continuity = bool(re.search(
            r"\b(?:instead|change|switch|make it|same design|that design|this design|on a|on an|for a|for an|"
            r"where should i design|where can i design|designer link|where can i customize|where should i customize)\b",
            text,
        ))
        if explicit.category and fresh_browse and not continuity:
            return False
        return bool(continuity or explicit.category or explicit.color or explicit.attributes)

    @staticmethod
    def _is_design_library_request(message: str) -> bool:
        text = message.lower().strip()
        if re.search(
            r"\b(?:share|send|upload|use|provide)\b.{0,35}\b(?:my|our|own)\s+"
            r"(?:design|artwork|logo|image|photo|picture)\b",
            text,
        ):
            return False
        return bool(
            re.search(
                r"\b(?:design library|design collections?|design folders?|design templates?|"
                r"ready designs?|available designs?|artwork library)\b",
                text,
            )
            or re.search(
                r"\b(?:what|which|show|share|send|view|browse|have|available)\b.{0,35}"
                r"\b(?:designs?|artworks?|templates?|collections?)\b",
                text,
            )
            or re.search(
                r"\b(?:designs?|artworks?|templates?)\b.{0,35}"
                r"\b(?:have|available|show|share|send|view|browse)\b",
                text,
            )
            or re.search(
                r"\b(?:where|how|send|share|give|show|need|want)\b.{0,35}"
                r"\b(?:designer|design|customi[sz]e|customization|customisation)\b",
                text,
            )
        )

    async def _design_library_presentation(
        self,
        business_id: str,
        message: str,
        conversation: dict,
        state: dict,
    ) -> tuple[str, list[ProductPublic], str]:
        selected_id = conversation.get("selected_product_id") or state.get("selected_product_id")
        base_product = None
        if selected_id:
            candidate = await self.product_tools.get_product_details(business_id, str(selected_id))
            if candidate and candidate.attributes.get("customizable") and candidate.stock > 0:
                base_product = candidate

        if base_product is None:
            custom_products = await self.product_tools.search_products(
                ProductSearchParams(
                    business_id=business_id,
                    attributes={"catalog_type": "customization"},
                    limit=5,
                )
            )
            base_product = next(
                (
                    product
                    for product in custom_products
                    if product.stock > 0 and product.attributes.get("product_url")
                ),
                None,
            )

        base_url = base_product.attributes.get("product_url") if base_product else None
        if not base_url:
            origin = (settings.ecommerce_storefront_url or "").rstrip("/")
            fallback_url = f"{origin}/customproducts" if origin.startswith("https://") else None
            reply = "I couldn't verify the design library right now."
            if fallback_url:
                reply += f"\nOption 1: Browse customizable products here:\n{fallback_url}"
            reply += "\nOption 2: Send 'human' and our customization team will help you."
            return reply, [], "none"

        folders = await self._load_design_library_folders()
        if not folders:
            return (
                "I couldn't load the design collections right now.\n"
                "Option 1: Open the verified custom designer and choose Design Library:\n"
                f"{base_url}\n"
                "Option 2: Send 'human' and our customization team will share the available designs.",
                [],
                "none",
            )

        requested_folder = self._match_design_folder(message, folders)
        if requested_folder:
            folder_url = self._design_collection_url(base_url, requested_folder)
            return (
                f"Here is our verified {requested_folder} design collection:\n{folder_url}\n"
                "Open it to preview a design on the product and customize it.\n"
                "If you need help choosing a design, send 'human' and our customization team will help you.",
                [],
                "none",
            )

        visible_folders = folders[:6]
        lines = ["Here are our verified design collections. Open any one to explore its designs:"]
        for index, folder in enumerate(visible_folders, start=1):
            lines.append(f"{index}. {folder}\n{self._design_collection_url(base_url, folder)}")
        if len(folders) > len(visible_folders):
            lines.append("Tell me the collection name if you want another one.")
        lines.append("Need help or a design not listed here? Send 'human' and our customization team will help you.")
        return "\n".join(lines), [], "none"

    async def _load_design_library_folders(self) -> list[str]:
        url = settings.ecommerce_api_url.rstrip("/") + "/designuploads/folders"
        try:
            async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
                response = await client.get(url)
                response.raise_for_status()
                payload = response.json()
            folders = payload.get("folders") if isinstance(payload, dict) else []
            return [str(folder).strip() for folder in folders or [] if str(folder).strip()]
        except (httpx.HTTPError, OSError, ValueError) as exc:
            logger.warning("Design library folders unavailable: %s", exc.__class__.__name__)
            return []

    @staticmethod
    def _match_design_folder(message: str, folders: list[str]) -> str | None:
        text = message.lower()
        direct = next((folder for folder in folders if folder.lower() in text), None)
        if direct:
            return direct
        candidate = re.sub(
            r"\b(?:what|which|show|share|send|view|browse|have|available|designs?|artworks?|"
            r"templates?|collections?|folders?|library|do|you|me|the|your|our)\b",
            " ",
            text,
        )
        candidate = re.sub(r"\s+", " ", candidate).strip()
        if not candidate:
            return None
        normalized = {folder.lower(): folder for folder in folders}
        match = get_close_matches(candidate, list(normalized), n=1, cutoff=0.62)
        return normalized[match[0]] if match else None

    @staticmethod
    def _design_collection_url(base_url: str, folder: str) -> str:
        parts = urlsplit(base_url)
        query = dict(parse_qsl(parts.query, keep_blank_values=True))
        query["collection"] = folder
        return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))

    def _has_multiple_products(self, image_analysis: dict) -> bool:
        try:
            return int(image_analysis.get("product_count") or 1) > 1
        except (TypeError, ValueError):
            return False

    def _selected_image_product(self, message: str, image_analysis: dict) -> dict | None:
        products = image_analysis.get("products") or []
        if not products or not self._has_multiple_products(image_analysis):
            return None
        match = re.fullmatch(r"(?:option\s*)?([1-5])", message.lower().strip())
        if not match:
            return None
        index = int(match.group(1)) - 1
        if index >= len(products) or not isinstance(products[index], dict):
            return None
        selected = dict(products[index])
        selected["product_count"] = 1
        selected["confidence"] = image_analysis.get("confidence")
        return selected

    def _build_multiple_product_question(self, image_analysis: dict) -> str:
        descriptions = []
        for index, product in enumerate((image_analysis.get("products") or [])[:5], start=1):
            if not isinstance(product, dict):
                continue
            label = product.get("description") or " ".join(
                str(product.get(key) or "") for key in ["color", "product_type"]
            ).strip()
            position = product.get("position")
            descriptions.append(f"{index}. {label}" + (f" ({position})" if position else ""))
        options = "\n" + "\n".join(descriptions) if descriptions else ""
        return "I can see more than one product in the image. Which one should I check?" + options

    def _build_image_match_response(
        self,
        intent: IntentResult,
        products: list[ProductPublic],
        image_analysis: dict,
    ) -> str:
        if not products:
            return self._build_image_no_match_response(image_analysis)
        top_score = float(products[0].attributes.get("match_score") or 0)
        top_visual = float((products[0].attributes.get("match_components") or {}).get("visual") or 0)
        vision_confidence = float(image_analysis.get("confidence") or 0)
        exact_match = top_score >= 0.78 and top_visual >= 0.72 and vision_confidence >= 0.7
        if exact_match and products[0].stock > 0:
            intro = "Yes, this product is in stock:"
        elif exact_match:
            intro = "We have this product, but it is currently out of stock:"
        elif top_score >= 0.72 and vision_confidence >= 0.7:
            intro = "These are the closest matches to your image:"
        else:
            intro = "These look similar, but the exact design may differ:"
        lines = [intro]
        for index, product in enumerate(products, start=1):
            price = product.sale_price if product.sale_price is not None else product.price
            kind = product.attributes.get("source_type") or "product"
            visual_label = (product.attributes.get("search_attributes") or {}).get("product_name_hint")
            label = str(visual_label or product.name).strip()
            lines.append(f"{index}. {label} - {verified_price_text(product)} - {kind}")
        lines.append("Reply with the option number for photos, sizes, or the product link.")
        return "\n".join(lines)

    def _merge_image_analysis_into_intent(self, intent: IntentResult, image_analysis: dict) -> IntentResult:
        attributes = dict(intent.attributes)
        for key in ["material", "fabric"]:
            if image_analysis.get(key) and not attributes.get(key):
                attributes[key] = image_analysis[key]

        return IntentResult(
            intent="product_search",
            language=intent.language,
            script=intent.script,
            category=image_analysis.get("category") or intent.category or image_analysis.get("product_type"),
            color=intent.color or image_analysis.get("color"),
            min_price=intent.min_price,
            max_price=intent.max_price,
            occasion=intent.occasion or image_analysis.get("occasion"),
            size=intent.size,
            brand=intent.brand or image_analysis.get("brand"),
            product_option=intent.product_option,
            wants_to_buy=intent.wants_to_buy,
            attributes=attributes,
            confidence=max(intent.confidence, float(image_analysis.get("confidence") or 0.65)),
        )

    @staticmethod
    def _apply_product_option(product_option: int | None, conversation: dict, state: dict) -> None:
        if not product_option:
            return
        ids = conversation.get("recommended_product_ids", []) or state.get("recommended_product_ids", [])
        index = product_option - 1
        if index < 0 or index >= len(ids):
            return
        selected = str(ids[index])
        purchase = state.get("purchase") or {}
        if purchase and str(purchase.get("product_id") or "") != selected:
            state.pop("purchase", None)
            state.pop("last_declined_purchase", None)
        state["selected_product_id"] = selected

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

        numeric_match = (
            re.fullmatch(r"([1-5])", text)
            or re.search(r"\b(?:option|number|product)\s*#?\s*([1-5])\b", text)
        )
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

        size_match = re.search(r"\b(xs|s|m|l|xl|xxl|xxxl)\b", text)
        if not size_match:
            size_match = re.search(r"\bsize\s*([5-9]|1[0-2])\b", text)
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

    async def _search_relaxed_options(
        self,
        business_id: str,
        intent: IntentResult,
        allow_other_categories: bool = True,
    ) -> tuple[list[ProductPublic], str]:
        # Catalogue type is a hard boundary. A customization request may relax
        # color/category details, but must never turn into ready-made results.
        source_attributes = {}
        if intent.attributes.get("catalog_type"):
            source_attributes["catalog_type"] = intent.attributes["catalog_type"]
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
                    attributes=source_attributes,
                    limit=5,
                ),
            ),
            (
                "the same category, but relaxing color, occasion, and budget",
                ProductSearchParams(
                    business_id=business_id,
                    category=intent.category,
                    size=intent.size,
                    attributes=source_attributes,
                    limit=5,
                ),
            ),
        ]

        if allow_other_categories:
            attempts.append(
                (
                    "nearby options from other categories",
                    ProductSearchParams(
                        business_id=business_id,
                        max_price=intent.max_price,
                        color=intent.color,
                        occasion=intent.occasion,
                        attributes=source_attributes,
                        limit=5,
                    ),
                )
            )

        for summary, params in attempts:
            products = await self.product_tools.search_products(params)
            if products:
                return products, summary

        return [], "broader catalogue"

    async def _catalog_category_names(self) -> list[str]:
        """Return only categories currently used by active ecommerce products."""
        cached = getattr(self, "_catalog_category_cache", None)
        if cached and time.monotonic() - cached[0] < 300:
            return list(cached[1])
        repository = getattr(self.product_tools, "product_repository", None)
        category_loader = getattr(repository, "catalog_categories", None)
        if category_loader:
            try:
                categories = await category_loader()
                self._catalog_category_cache = (time.monotonic(), list(categories))
                return list(categories)
            except Exception as exc:
                logger.warning("Could not load unified catalogue categories: %s", exc.__class__.__name__)

        if self.commerce is None or getattr(self.commerce, "db", None) is None:
            return []

        try:
            database = self.commerce.db
            category_ids = await database.readymadeproducts.distinct(
                "category",
                {"isActive": {"$ne": False}},
            )
            if not category_ids:
                return []
            documents = await database.categories.find(
                {"_id": {"$in": category_ids}},
                {"name": 1},
            ).to_list(length=len(category_ids))
            categories = sorted(
                {
                    str(document.get("name") or "").strip()
                    for document in documents
                    if str(document.get("name") or "").strip()
                }
            )
            self._catalog_category_cache = (time.monotonic(), categories)
            return categories
        except Exception as exc:
            logger.warning("Could not load catalogue categories for image analysis: %s", exc.__class__.__name__)
            return []

    def _build_store_checkout_response(self, product: ProductPublic) -> str:
        product_url = product.attributes.get("product_url") if product.attributes else None
        if product_url:
            return f"Continue securely on the store to choose options, enter your address, and pay: {product_url}"
        return "Please open this product in the store to choose options, enter your address, and complete payment securely."

    def _build_image_no_match_response(self, image_analysis: dict) -> str:
        product_type = (
            image_analysis.get("product_type")
            or image_analysis.get("category")
            or "product"
        )
        return (
            f"I analyzed the image as a {product_type}, but I couldn't find a matching item "
            "in the current store catalogue. You can send another image, or ask me to show the available categories."
        )

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
            if key in {"intent", "action", "confidence", "attributes", "product_option", "wants_to_buy"}:
                continue
            if value is not None:
                next_state[key] = value
        if intent.attributes:
            next_state["attributes"] = {**next_state.get("attributes", {}), **intent.attributes}
        return next_state

    @staticmethod
    def _is_more_options_request(message: str) -> bool:
        text = str(message or "").lower().strip()
        return bool(
            re.search(
                r"\b(?:other|more|different|next|else|remaining|another)\b.{0,30}"
                r"\b(?:options?|products?|items?|styles?|hoodies?|shirts?|t\s*-?\s*shirts?)\b",
                text,
            )
            or re.search(
                r"\b(?:show|send|give|see|view)\b.{0,20}\b(?:other|more|next|different)\b",
                text,
            )
            or text in {"more", "others", "other ones", "next", "next ones", "anything else"}
        )

    @staticmethod
    def _browse_history_key(intent: IntentResult) -> str:
        attributes = intent.attributes or {}
        parts = [
            intent.category,
            intent.color,
            intent.min_price,
            intent.max_price,
            intent.occasion,
            intent.size,
            intent.brand,
            *[
                f"{key}:{attributes[key]}"
                for key in sorted(attributes)
                if attributes.get(key) not in (None, "", [], {})
            ],
        ]
        normalized = "|".join(str(value or "").strip().lower() for value in parts)
        return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:20]

    def _remember_customer_preferences(self, state: dict, message: str, intent: IntentResult) -> None:
        """Keep a compact durable taste profile without replaying the full chat history."""
        if intent.intent != "product_search":
            return
        explicit = self.intent_parser._parse_with_rules(message, {})
        preferences = dict(state.get("customer_preferences") or {})

        def remember(key: str, value) -> None:
            if value is None or value == "":
                return
            values = list(preferences.get(key) or [])
            normalized = str(value).strip()
            values = [item for item in values if str(item).lower() != normalized.lower()]
            preferences[key] = ([normalized] + values)[:8]

        remember("categories", explicit.category or intent.category)
        remember("colors", explicit.color)
        remember("occasions", explicit.occasion)
        remember("brands", explicit.brand)
        if explicit.max_price is not None:
            preferences["latest_budget_max"] = explicit.max_price
        for key in ("fabric", "catalog_type"):
            remember(f"{key}s", explicit.attributes.get(key))

        # The model can recognize natural size wording that the fallback parser
        # does not. Store it only when this message contains an explicit size cue.
        if intent.size and re.search(r"\b(?:size|xs|s|m|l|xl|xxl|small|medium|large)\b", message.lower()):
            remember("sizes", intent.size)
        if preferences:
            preferences["updated_at"] = datetime.now(timezone.utc).isoformat()
            state["customer_preferences"] = preferences

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
        style = str(intent.attributes.get("style") or "").strip()
        if style and style.casefold() != str(intent.category or "").casefold():
            details.append(style)
        pattern = str(intent.attributes.get("pattern") or "").strip()
        if pattern:
            details.append(pattern)
        if intent.occasion:
            details.append(f"for {intent.occasion}")
        if intent.max_price:
            details.append(f"under {int(intent.max_price)}")

        summary = " ".join(details) if details else "your requirement"
        if not products:
            return f"That exact {summary} is not available right now. Want me to show the closest options?"

        category_url = self._category_url(intent.category)
        lines = [
            f"Here are some recommendations for {summary}:",
        ]
        if category_url:
            lines.append(f"Browse all {self._category_label(intent.category)}: {category_url}")
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
            lines.append(f"{index}. {product.name} - {verified_price_text(product)} - {stock_text}{reason}")

        lines.append("Want details for any one?")
        return "\n".join(lines)

    @staticmethod
    def _category_label(category: str | None) -> str:
        value = re.sub(r"\s+", " ", str(category or "products").replace("-", " ")).strip().lower()
        if "tshirt" in value or "t shirt" in value:
            return "T-shirts"
        if value == "shirt" or value.endswith(" shirts"):
            return "shirts"
        if value.endswith("s"):
            return value
        return f"{value}s" if value else "products"

    @classmethod
    def _category_url(cls, category: str | None) -> str | None:
        origin = str(settings.ecommerce_storefront_url or "").rstrip("/")
        if not origin.startswith("https://") or not category:
            return None
        value = str(category).lower().replace("-", " ").strip()
        if "tshirt" in value or "t shirt" in value:
            slug = "t-shirts"
        elif value == "shirt" or value.endswith(" shirts"):
            slug = "shirts"
        else:
            slug = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
            if slug and not slug.endswith("s"):
                slug += "s"
        return f"{origin}/products/{slug}" if slug else None

    @staticmethod
    def _compact_whatsapp_reply(value: str, limit: int = 900) -> str:
        """Keep WhatsApp output scannable without cutting links or cart facts."""
        text = re.sub(r"\n{3,}", "\n\n", str(value or "").strip())
        option_count = 0
        lines = []
        for line in text.splitlines():
            if re.match(r"^\s*\d+[.)]\s+", line):
                option_count += 1
                if option_count > 3:
                    continue
            lines.append(line.rstrip())
        text = "\n".join(lines).strip()
        if len(text) <= limit:
            return text
        safe = text[:limit]
        boundary = max(safe.rfind("\n"), safe.rfind(". "), safe.rfind("? "))
        if boundary >= limit // 2:
            safe = safe[:boundary + 1]
        return safe.rstrip() + "\nReply with what you want to check next."

    def _build_customization_response(
        self,
        products: list[ProductPublic],
        reference_received: bool = False,
    ) -> str:
        designer_url = str(settings.ecommerce_customization_url or "").strip()
        if not products:
            lines = [
                "I can help with your custom design, but I couldn't verify a matching base product in chat.",
            ]
            if designer_url.startswith("https://"):
                lines.append(f"Option 1: Open the customization page and choose a base product: {designer_url}")
            lines.append("Option 2: Send 'human' and our customization team will contact you.")
            return "\n".join(lines)

        if reference_received:
            intro = (
                "Yes, we can use this as your design reference. Choose a customizable base product below; "
                "after you choose, I'll send its designer link."
            )
        else:
            intro = (
                "Yes, you can create your own design. Choose a base product below; after you choose, "
                "I'll send its designer link."
            )
        lines = [intro]
        if designer_url.startswith("https://"):
            lines.append(f"Option 1: Open the customization page: {designer_url}")
        for index, product in enumerate(products, start=1):
            price = product.sale_price if product.sale_price is not None else product.price
            colors = product.attributes.get("colors") or []
            color_text = f" - colors: {', '.join(str(value) for value in colors[:4])}" if colors else ""
            stock_text = "available" if product.stock > 0 else "out of stock"
            lines.append(
                f"{index}. {product.name} - starts at {verified_price_text(product)} - {stock_text}{color_text}"
            )
        lines.append("In the designer, choose the product, size, color, and add your image or text.")
        lines.append("Option 2: If you need help, send 'human' and our customization team will contact you.")
        return "\n".join(lines)

    def _build_customization_selection_response(self, product: ProductPublic) -> str:
        price = product.sale_price if product.sale_price is not None else product.price
        url = product.attributes.get("product_url")
        lines = [product.name, f"Starting price: {verified_price_text(product)}."]
        if product.stock <= 0:
            lines.append("This base product is currently out of stock.")
            return "\n".join(lines)
        lines.append("Choose the size and color, then add your image or text in the designer.")
        if url:
            lines.append(str(url))
            lines.append("If you sent a reference here, upload it again in the designer so it is attached to your product.")
        else:
            lines.append("The designer link is not configured yet. Send 'human' and our team will help you.")
        lines.append("If you cannot complete the customization in the designer, send 'human' and our team will contact you.")
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
            lines.append(f"{index}. {product.name} - {verified_price_text(product)} - {stock_text}{suffix}")
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
        customizable = bool(product.attributes.get("customizable"))
        name = self._product_display_name(product)
        lines = [
            name,
            f"Starting price is {verified_price_text(product)}." if customizable else f"Price is {verified_price_text(product)}.",
            ("Available to customize." if customizable else "In stock.")
            if product.stock > 0
            else "Currently out of stock.",
        ]
        if product.attributes:
            for key in ("brand", "color", "fabric", "material", "fit", "sizes", "care"):
                value = product.attributes.get(key)
                if not value:
                    continue
                display_value = ", ".join(str(item) for item in value) if isinstance(value, (list, tuple, set)) else str(value)
                lines.append(f"{key.replace('_', ' ').title()}: {display_value}")
        if customizable:
            colors = product.attributes.get("colors") or []
            if colors:
                lines.append("Colors: " + ", ".join(str(value) for value in colors) + ".")
            lines.append("You can add images and text in the designer; the final price depends on the selected size and design elements.")
        lines.append(
            "Reply 'designer link' to customize it, or 'photos' for more images."
            if customizable
            else "Reply 'link' for the product link, or 'photos' for more images."
        )
        return "\n".join(lines)

    @staticmethod
    def _product_display_name(product: ProductPublic) -> str:
        visual_name = (product.attributes.get("search_attributes") or {}).get("product_name_hint")
        name = str(visual_name or product.name).strip()
        return name[:1].upper() + name[1:] if name else "Product"

    def _build_stock_response(self, stock_result: dict) -> str:
        product = stock_result["product"]
        if product is None:
            return "I am not seeing that product now."
        if stock_result["available"]:
            return f"Yes, {product.name} is available. Stock left: {stock_result['stock']}."
        return f"{product.name} is currently out of stock."

    async def _record_metric(
        self,
        business_id: str,
        intent: IntentResult,
        result_count: int,
        image_analysis: dict,
        had_image: bool,
        image_embedding_available: bool,
        handoff_requested: bool,
        checkout_failure: bool,
        response_goal: str,
        latency_ms: int,
        policy_blocked: bool = False,
        provider_usage: list[dict] | None = None,
        request_id: str | None = None,
    ) -> None:
        """Store operational counters without message text, media, or customer identifiers."""
        try:
            database = self.conversation_repository.collection.database
            await database.ai_agent_metrics.insert_one(
                {
                    "business_id": parse_object_id(business_id),
                    "request_id": request_id,
                    "intent": intent.intent,
                    "intent_confidence": float(intent.confidence or 0),
                    "category": intent.category,
                    "source_type": intent.attributes.get("catalog_type"),
                    "result_count": int(result_count),
                    "empty_result": result_count == 0 and intent.intent == "product_search",
                    "had_image": had_image,
                    "image_analysis_failed": had_image and not bool(image_analysis),
                    "image_product_type": image_analysis.get("product_type"),
                    "image_confidence": image_analysis.get("confidence"),
                    "image_embedding_available": image_embedding_available,
                    "handoff_requested": handoff_requested,
                    "policy_blocked": policy_blocked,
                    "checkout_failure": checkout_failure,
                    "response_goal": response_goal,
                    "latency_ms": latency_ms,
                    "provider_usage": provider_usage or [],
                    "input_tokens": sum(item.get("input_tokens", 0) for item in provider_usage or []),
                    "output_tokens": sum(item.get("output_tokens", 0) for item in provider_usage or []),
                    "total_tokens": sum(item.get("total_tokens", 0) for item in provider_usage or []),
                    "estimated_cost_usd": round(sum(item.get("estimated_cost_usd", 0) for item in provider_usage or []), 8),
                    "created_at": datetime.now(timezone.utc),
                }
            )
        except Exception as exc:
            logger.warning("AI metric write skipped: %s", exc.__class__.__name__)

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
        discount = verified_discount(product.price, product.sale_price)
        return {
            "id": product.id,
            "name": product.name,
            "category": product.category,
            "price": product.price,
            "sale_price": product.sale_price,
            "display_price": price,
            "discount": discount,
            "price_label": verified_price_text(product),
            "currency": product.currency,
            "stock": product.stock,
            "image": product.images[0] if product.images else None,
            "attributes": product.attributes,
        }
