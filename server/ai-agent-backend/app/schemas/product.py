from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

ProductStatus = Literal["active", "draft", "archived"]


class ProductBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    category: str = Field(..., min_length=2, max_length=80)
    price: float = Field(..., ge=0)
    sale_price: float | None = Field(default=None, ge=0)
    currency: str = Field(default="INR", min_length=3, max_length=3)
    stock: int = Field(default=0, ge=0)
    sku: str | None = Field(default=None, max_length=80)
    images: list[str] = Field(default_factory=list)
    attributes: dict[str, Any] = Field(default_factory=dict)
    status: ProductStatus = "active"
    tags: list[str] = Field(default_factory=list)

    @field_validator("sale_price")
    @classmethod
    def sale_price_cannot_exceed_price(cls, value, info):
        price = info.data.get("price")
        if value is not None and price is not None and value > price:
            raise ValueError("sale_price cannot be greater than price")
        return value

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        return value.upper()


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    category: str | None = Field(default=None, min_length=2, max_length=80)
    price: float | None = Field(default=None, ge=0)
    sale_price: float | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    stock: int | None = Field(default=None, ge=0)
    sku: str | None = Field(default=None, max_length=80)
    images: list[str] | None = None
    attributes: dict[str, Any] | None = None
    status: ProductStatus | None = None
    tags: list[str] | None = None

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str | None) -> str | None:
        return value.upper() if value else value


class ProductPublic(ProductBase):
    id: str = Field(alias="_id")
    business_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(populate_by_name=True)
