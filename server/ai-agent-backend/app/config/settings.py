from functools import lru_cache
import logging

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "AI Sales Employee API"
    app_env: str = "development"
    debug: bool = True
    debug_raw: str | None = Field(default=None, validation_alias="DEBUG")
    api_prefix: str = "/api"
    log_level: str = "INFO"

    mongodb_url: str | None = None
    mongodb_db_name: str = "appdb"
    # MONGOOSE_URL is used by the parent Node ecommerce server.
    mongoose_url: str | None = None
    ecommerce_mongodb_url: str | None = None
    ecommerce_mongodb_db_name: str = "appdb"
    ecommerce_public_url: str | None = None
    ecommerce_storefront_url: str | None = None
    ecommerce_api_url: str = "http://127.0.0.1:5000/api"
    whatsapp_commerce_key: str | None = None
    whatsapp_app_secret: str | None = None

    jwt_secret: str = "change-this-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60

    frontend_origin: str = "http://localhost:5173"
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-flash-lite-latest"
    gemini_embedding_model: str = "gemini-embedding-2"
    gemini_embedding_dimensions: int = 768
    catalogue_index_batch_size: int = 10
    catalogue_index_interval_seconds: int = 60

    whatsapp_verify_token: str | None = None
    whatsapp_access_token: str | None = None
    whatsapp_phone_number_id: str | None = None
    whatsapp_graph_api_version: str = "v25.0"
    whatsapp_business_id: str | None = None
    whatsapp_business_name: str = "Maitrova"
    whatsapp_business_type: str = "ecommerce"
    whatsapp_waba_id: str | None = None
    whatsapp_messages_per_minute: int = 30
    whatsapp_checkout_links_per_hour: int = 10

    model_config = SettingsConfigDict(
        # When this service lives at server/ai-agent-backend, also read server/.env.
        # Values in ai-agent-backend/.env take precedence over the parent file.
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_origin.split(",") if origin.strip()]

    @property
    def primary_mongodb_url(self) -> str:
        """Use an AI-specific override, then the parent server connection."""
        return self.mongodb_url or self.mongoose_url or "mongodb://localhost:27017/appdb"

    @field_validator("debug", mode="before")
    @classmethod
    def parse_debug(cls, value):
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"release", "prod", "production"}:
                return False
            if normalized in {"debug", "info", "warn", "warning", "error", "critical"}:
                return normalized == "debug"
        return value

    @property
    def logging_level(self) -> int:
        if isinstance(self.debug_raw, str):
            normalized_debug = self.debug_raw.strip().upper()
            if normalized_debug == "WARN":
                normalized_debug = "WARNING"
            if normalized_debug in {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}:
                return getattr(logging, normalized_debug)
        if self.debug:
            return logging.DEBUG
        return getattr(logging, self.log_level.upper(), logging.INFO)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
