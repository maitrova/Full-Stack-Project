from typing import Any

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
    language: str = "English"
    script: str = "Latin"
    category: str | None = None
    color: str | None = None
    min_price: float | None = None
    max_price: float | None = None
    occasion: str | None = None
    size: str | None = None
    brand: str | None = None
    attributes: dict[str, Any] = Field(default_factory=dict)
    confidence: float = 0.0


class AiChatResponse(BaseModel):
    conversation: ConversationPublic
    customer_message: MessagePublic
    ai_message: MessagePublic
    intent: IntentResult
    recommended_products: list[ProductPublic] = Field(default_factory=list)
