from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.conversation import ConversationPublic, MessagePublic
from app.schemas.product import ProductPublic


class AiChatRequest(BaseModel):
    message: str = Field(default="", max_length=4000)
    conversation_id: str | None = None
    image_url: str | None = None
    image_data: str | None = None
    image_mime_type: str | None = None

    @model_validator(mode="after")
    def require_text_or_image(self):
        if not self.message.strip() and not self.image_url and not self.image_data:
            raise ValueError("message, image_url, or image_data is required")
        return self


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
