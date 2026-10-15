from functools import lru_cache
import logging
from pathlib import Path

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
    ecommerce_outputs_path: str | None = None
    ecommerce_storefront_url: str | None = None
    ecommerce_customization_url: str | None = None
    ecommerce_api_url: str = "http://127.0.0.1:5000/api"
    remote_image_allowed_hosts: str = ""
    remote_image_max_bytes: int = 10 * 1024 * 1024
    whatsapp_commerce_key: str | None = None
    whatsapp_app_secret: str | None = None

    jwt_secret: str = "change-this-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60

    frontend_origin: str = "http://localhost:5173"
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-3.1-flash-lite"
    # Tried in order when the main model is rate-limited or unavailable.
    gemini_fallback_models: str = "gemini-3.5-flash-lite"
    gemini_embedding_model: str = "gemini-embedding-2"
    gemini_embedding_dimensions: int = 768
    openai_api_key: str | None = None
    openai_model: str = "gpt-4.1-mini"
    merchant_prompt_version: str = "2026-10-01"
    merchant_prompt_instructions: str = ""
    gemini_input_cost_per_million: float = 0.0
    gemini_output_cost_per_million: float = 0.0
    openai_input_cost_per_million: float = 0.0
    openai_output_cost_per_million: float = 0.0
    catalogue_index_batch_size: int = 10
    catalogue_index_interval_seconds: int = 60
    # Prefer no exact result over unrelated products for broad descriptions.
    catalogue_semantic_min_score: float = 0.55
    website_knowledge_urls: str = ""
    website_knowledge_sync_interval_seconds: int = 900
    website_knowledge_chunk_size: int = 1800
    website_knowledge_embedding_min_score: float = 0.62
    website_knowledge_embedding_top_k: int = 6
    ai_evaluation_key: str = ""
    ai_evaluation_rate_limit_per_minute: int = 20
    # The single storefront tenant used by the website chat. Falls back to
    # WHATSAPP_BUSINESS_ID so both channels share one business by default.
    storefront_business_id: str | None = None
    ai_chat_session_messages_per_minute: int = 20
    ai_chat_session_messages_per_day: int = 300
    ai_chat_ip_messages_per_minute: int = 60
    ai_chat_ip_messages_per_day: int = 1500
    # Website chat engine: "rules" (keyword routing) or "tools" (the model
    # chooses catalogue/policy lookups). While on "rules", this percentage of
    # browser sessions is routed to "tools" for a gradual rollout.
    web_agent_mode: str = "rules"
    web_agent_rollout_percent: int = 0
    web_agent_model_timeout_seconds: float = 15.0
    # Falling back after a timeout gives a slower and worse answer, so allow
    # slow provider rounds to finish; past this the shopper is asked to resend.
    web_agent_total_timeout_seconds: float = 40.0

    whatsapp_verify_token: str | None = None
    whatsapp_access_token: str | None = None
    whatsapp_phone_number_id: str | None = None
    whatsapp_graph_api_version: str = "v25.0"
    # Overridden only by the local WhatsApp simulator, never in production.
    whatsapp_graph_api_base_url: str = "https://graph.facebook.com"
    # WhatsApp engine: "rules" or "tools"; while on rules, this percentage of
    # customers (by phone) uses the tool-calling agent.
    whatsapp_agent_mode: str = "rules"
    whatsapp_agent_rollout_percent: int = 0
    # Rollout stage 1: comma-separated WhatsApp numbers (team phones, Meta test
    # number) that always get the tool-calling agent. Matches the last 10 digits.
    whatsapp_agent_allowlist: str = ""
    whatsapp_business_id: str | None = None
    whatsapp_business_name: str = "Maitrova"
    whatsapp_business_type: str = "ecommerce"
    whatsapp_waba_id: str | None = None
    whatsapp_messages_per_minute: int = 30
    whatsapp_checkout_links_per_hour: int = 10
    # A teammate's takeover pauses the AI; after this long without a team
    # reply the AI resumes, so a customer is never left without answers.
    whatsapp_handoff_idle_hours: float = 12
    # Meta-approved utility template for order updates outside the 24-hour
    # window. Body parameters: {{1}} order number, {{2}} status, {{3}} total.
    whatsapp_order_update_template: str | None = None
    whatsapp_template_language: str = "en"
    whatsapp_default_language: str = "Roman Telugu"

    model_config = SettingsConfigDict(
        # When this service lives at server/ai-agent-backend, also read server/.env.
        # Values in ai-agent-backend/.env take precedence over the parent file.
        env_file=(
            Path(__file__).resolve().parents[3] / ".env",
            Path(__file__).resolve().parents[2] / ".env",
        ),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def cors_origins(self) -> list[str]:
        configured = [origin.strip().rstrip("/") for origin in self.frontend_origin.split(",") if origin.strip()]
        # Local development commonly switches between localhost and 127.0.0.1.
        # Keep both origins available so an application error is still returned
        # to the browser with CORS headers.
        return list(dict.fromkeys(configured + [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]))

    @property
    def resolved_storefront_business_id(self) -> str | None:
        return (self.storefront_business_id or self.whatsapp_business_id or "").strip() or None

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
