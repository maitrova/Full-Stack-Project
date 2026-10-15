from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.conversation import ConversationPublic, MessagePublic
from app.schemas.product import ProductPublic


class AiChatRequest(BaseModel):
    message: str = Field(default="", max_length=4000)
    quick_action: Literal[
        "product_details", "product_fabric", "product_size_fit", "product_colors",
        "product_offers", "product_delivery_returns", "product_customize", "ask_else", "talk_to_human",
    ] | None = None
    conversation_id: str | None = None
    page_context: dict[str, Any] = Field(default_factory=dict)
    # Summary of the shopper's current cart, sent by the website:
    # {"items": [{"item_id", "name", "kind", "size", "qty", "unit_price"}], "subtotal", "total_items"}
    cart: dict[str, Any] | None = None
    image_url: str | None = None
    image_data: str | None = None
    image_mime_type: str | None = None

    @model_validator(mode="after")
    def require_text_or_image(self):
        if not self.message.strip() and not self.quick_action and not self.image_url and not self.image_data:
            raise ValueError("message, image_url, or image_data is required")
        return self


class AiRecommendationRequest(BaseModel):
    session_id: str | None = None
    page_context: dict[str, Any] = Field(default_factory=dict)


class IntentResult(BaseModel):
    intent: str = "general_question"
    action: Literal[
        "add_to_cart",
        "confirm_cart",
        "decline_cart",
        "product_photos",
        "product_link",
        "browse_designs",
        "check_price",
        "check_stock",
        "show_sizes",
        "track_order",
        "show_cart",
        "remove_from_cart",
        "update_cart_quantity",
        "checkout",
        "retry_checkout",
        "human_handoff",
    ] | None = None
    language: str = "English"
    script: str = "Latin"
    category: str | None = None
    color: str | None = None
    min_price: float | None = None
    max_price: float | None = None
    occasion: str | None = None
    size: str | None = None
    brand: str | None = None
    product_option: int | None = Field(default=None, ge=1, le=5)
    wants_to_buy: bool = False
    attributes: dict[str, Any] = Field(default_factory=dict)
    confidence: float = 0.0


class AiChatResponse(BaseModel):
    conversation: ConversationPublic
    customer_message: MessagePublic
    ai_message: MessagePublic
    intent: IntentResult
    recommended_products: list[ProductPublic] = Field(default_factory=list)
    # Design-library thumbnails: [{"name", "image", "url"}].
    design_previews: list[dict[str, Any]] = Field(default_factory=list)
    # Order summaries for the shopper's own (or verified) orders.
    order_cards: list[dict[str, Any]] = Field(default_factory=list)
    # Cart changes for the website to carry out with its own cart API:
    # {"type": "add_to_cart" | "update_cart_qty" | "remove_cart_item", ...}
    actions: list[dict[str, Any]] = Field(default_factory=list)
    # Combo packs to show as offer cards.
    offers: list[dict[str, Any]] = Field(default_factory=list)
    workflow_trace: list[dict[str, Any]] = Field(default_factory=list)
