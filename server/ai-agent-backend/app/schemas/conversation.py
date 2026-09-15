from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

ConversationChannel = Literal["web", "whatsapp", "instagram"]
ConversationStatus = Literal["open", "closed", "handoff"]
MessageSender = Literal["customer", "ai", "human", "system"]
MessageType = Literal["text", "image", "product", "system"]


class ConversationCreate(BaseModel):
    customer_id: str | None = None
    channel: ConversationChannel = "web"


class ConversationPublic(BaseModel):
    id: str = Field(alias="_id")
    business_id: str
    customer_id: str | None = None
    channel: ConversationChannel
    external_customer_ref: str | None = None
    customer_name: str | None = None
    status: ConversationStatus
    current_intent: str | None = None
    conversation_state: dict[str, Any]
    recommended_product_ids: list[str]
    selected_product_id: str | None = None
    created_at: datetime
    updated_at: datetime
    last_message_at: datetime | None = None

    model_config = ConfigDict(populate_by_name=True)


class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=4000)
    sender: MessageSender = "customer"
    message_type: MessageType = "text"
    metadata: dict[str, Any] = Field(default_factory=dict)


class ConversationStatusUpdate(BaseModel):
    status: ConversationStatus


class HumanReplyCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=4000)


class MessagePublic(BaseModel):
    id: str = Field(alias="_id")
    business_id: str
    conversation_id: str
    customer_id: str | None = None
    sender: MessageSender
    content: str
    message_type: MessageType
    metadata: dict[str, Any]
    created_at: datetime

    model_config = ConfigDict(populate_by_name=True)


class ConversationDetail(ConversationPublic):
    messages: list[MessagePublic]
