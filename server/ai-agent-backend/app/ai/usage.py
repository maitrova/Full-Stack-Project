from contextvars import ContextVar
from typing import Any
from app.config.settings import settings


_usage: ContextVar[list[dict[str, Any]] | None] = ContextVar("ai_usage", default=None)


def start_usage_tracking() -> None:
    _usage.set([])


def record_usage(provider: str, model: str, operation: str, usage: dict | None) -> None:
    entries = _usage.get()
    if entries is None:
        return
    usage = usage or {}
    input_tokens = int(usage.get("input_tokens") or usage.get("prompt_token_count") or usage.get("promptTokens") or 0)
    output_tokens = int(usage.get("output_tokens") or usage.get("candidates_token_count") or usage.get("completionTokens") or 0)
    total_tokens = int(usage.get("total_tokens") or usage.get("total_token_count") or usage.get("totalTokens") or input_tokens + output_tokens)
    input_rate = getattr(settings, f"{provider}_input_cost_per_million", 0.0)
    output_rate = getattr(settings, f"{provider}_output_cost_per_million", 0.0)
    estimated_cost_usd = (input_tokens * input_rate + output_tokens * output_rate) / 1_000_000
    entries.append({
        "provider": provider,
        "model": model,
        "operation": operation,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": total_tokens,
        "estimated_cost_usd": round(estimated_cost_usd, 8),
    })


def consume_usage() -> list[dict[str, Any]]:
    entries = list(_usage.get() or [])
    _usage.set(None)
    return entries
