from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

OrderStatus = Literal["draft", "confirmed", "packed", "shipped", "delivered", "cancelled"]


class OrderItem(BaseModel):
    product_id: str
    name: str
    quantity: int = Field(default=1, ge=1)
    unit_price: float = Field(..., ge=0)
    currency: str = Field(default="INR", min_length=3, max_length=3)
    image: str | None = None
    attributes: dict[str, Any] = Field(default_factory=dict)


class OrderCreate(BaseModel):
    conversation_id: str | None = None
    customer_name: str | None = None
    customer_phone: str | None = None
    delivery_address: str | None = None
    payment_method: str | None = None
    status: OrderStatus = "draft"
    items: list[OrderItem] = Field(default_factory=list)
    notes: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class OrderUpdate(BaseModel):
    customer_name: str | None = None
    customer_phone: str | None = None
    delivery_address: str | None = None
    payment_method: str | None = None
    status: OrderStatus | None = None
    notes: str | None = None
    metadata: dict[str, Any] | None = None


class OrderPublic(OrderCreate):
    id: str = Field(alias="_id")
    business_id: str
    total_amount: float
    currency: str = "INR"
    missing_fields: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(populate_by_name=True)
