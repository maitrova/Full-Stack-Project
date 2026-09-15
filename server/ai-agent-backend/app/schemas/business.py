from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class BusinessBase(BaseModel):
    business_name: str = Field(..., min_length=2, max_length=120)
    business_type: str = Field(..., min_length=2, max_length=80)
    description: str | None = Field(default=None, max_length=1000)
    phone: str | None = Field(default=None, max_length=30)
    email: EmailStr | None = None
    currency: str = Field(default="INR", min_length=3, max_length=3)
    timezone: str = Field(default="Asia/Kolkata", min_length=2, max_length=80)


class BusinessCreate(BusinessBase):
    pass


class BusinessUpdate(BaseModel):
    business_name: str | None = Field(default=None, min_length=2, max_length=120)
    business_type: str | None = Field(default=None, min_length=2, max_length=80)
    description: str | None = Field(default=None, max_length=1000)
    phone: str | None = Field(default=None, max_length=30)
    email: EmailStr | None = None
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    timezone: str | None = Field(default=None, min_length=2, max_length=80)


class BusinessPublic(BusinessBase):
    id: str = Field(alias="_id")
    owner_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(populate_by_name=True)
