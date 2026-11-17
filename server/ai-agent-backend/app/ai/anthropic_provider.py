"""Shared Claude (Anthropic Messages API) request helper.

Both the tool-calling loop and the text/vision client send requests through
``create_message`` so retries, backup models, refusals and usage logging work
the same way everywhere. Customer text is never logged.
"""

import asyncio
import logging
import time
from typing import Any

import anthropic
from anthropic import AsyncAnthropic

from app.ai.usage import record_usage
from app.config.settings import settings

logger = logging.getLogger(__name__)

PROVIDER = "anthropic"


class ClaudeRefusal(RuntimeError):
    """Claude's safety classifier declined the request (stop_reason "refusal")."""


def claude_models() -> list[str]:
    backups = [name.strip() for name in settings.anthropic_fallback_models.split(",") if name.strip()]
    return list(dict.fromkeys([settings.anthropic_model, *backups]))


def make_client(api_key: str, timeout: float) -> AsyncAnthropic:
    # Retries are handled in create_message so backoff can respect the
    # caller's deadline and move to a backup model.
    return AsyncAnthropic(api_key=api_key, timeout=timeout, max_retries=0)


def response_text(message: Any) -> str:
    """Join the text blocks; thinking and tool_use blocks are skipped."""
    return "".join(block.text for block in message.content if block.type == "text").strip()


async def create_message(
    client: AsyncAnthropic,
    operation: str,
    *,
    deadline: float | None = None,
    **params: Any,
) -> Any:
    """Send one Messages API request, retrying and switching models as needed.

    Raises ClaudeRefusal when the model declines, and re-raises the last
    anthropic error when every model failed.
    """
    started = time.monotonic()
    requests_sent = 0
    last_error: Exception | None = None
    models = claude_models()
    params.setdefault("output_config", {"effort": settings.anthropic_effort})
    for model in models:
        # Rate limits (429) back off twice; overloaded/server errors and
        # network drops retry once; then the next model is tried.
        for attempt in range(3):
            requests_sent += 1
            try:
                message = await client.messages.create(model=model, **params)
            except anthropic.RateLimitError as exc:
                last_error = exc
                if attempt < 2 and _wait_fits(deadline, (1.5, 3.0)[attempt]):
                    await asyncio.sleep((1.5, 3.0)[attempt])
                    continue
                break
            except (anthropic.InternalServerError, anthropic.APIConnectionError) as exc:
                # InternalServerError covers 5xx including 529 overloaded.
                last_error = exc
                if attempt < 1 and _wait_fits(deadline, 0.5):
                    await asyncio.sleep(0.5)
                    continue
                break
            except anthropic.NotFoundError as exc:
                last_error = exc
                logger.warning("Claude %s model %s not found; trying the next model", operation, model)
                break
            except anthropic.APIStatusError as exc:
                logger.warning("Claude %s request rejected: HTTP %s model=%s", operation, exc.status_code, model)
                raise
            record_usage(
                PROVIDER, model, operation, _usage_dict(message.usage),
                latency_ms=round((time.monotonic() - started) * 1000), attempts=requests_sent,
            )
            if message.stop_reason == "refusal":
                details = getattr(message, "stop_details", None)
                category = getattr(details, "category", None) or "unknown"
                logger.warning("Claude %s declined by safety classifier: category=%s model=%s", operation, category, model)
                raise ClaudeRefusal(f"Claude refused ({category})")
            return message
        if len(models) > 1:
            logger.info("Claude %s model %s unavailable (%s); trying fallback", operation, model,
                        last_error.__class__.__name__ if last_error else "unknown")
    if isinstance(last_error, anthropic.APIStatusError):
        logger.warning("Claude %s request failed: HTTP %s", operation, last_error.status_code)
    assert last_error is not None
    raise last_error


def _wait_fits(deadline: float | None, delay: float) -> bool:
    # Leave time for one more request after the wait; otherwise move on.
    return deadline is None or time.monotonic() + delay + 5 <= deadline


def _usage_dict(usage: Any) -> dict[str, int]:
    if usage is None:
        return {}
    cached = int(getattr(usage, "cache_read_input_tokens", 0) or 0)
    cache_write = int(getattr(usage, "cache_creation_input_tokens", 0) or 0)
    input_tokens = int(usage.input_tokens or 0) + cached + cache_write
    output_tokens = int(usage.output_tokens or 0)
    return {"input_tokens": input_tokens, "output_tokens": output_tokens, "total_tokens": input_tokens + output_tokens}
