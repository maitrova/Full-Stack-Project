"""Provider-neutral function-calling loop (Gemini first, OpenAI fallback).

The model may call the declared tools several times before it writes the
final reply. Tool execution is delegated to the caller, so this module never
touches the catalogue, orders, or customer data itself.
"""

import asyncio
import json
import logging
import time
from dataclasses import dataclass
from typing import Any, Awaitable, Callable

import httpx

from app.ai.usage import record_usage
from app.config.settings import settings

logger = logging.getLogger(__name__)

ToolExecutor = Callable[[str, dict[str, Any]], Awaitable[dict[str, Any]]]
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
OPENAI_URL = "https://api.openai.com/v1/responses"
RETRYABLE_STATUS = {429, 500, 502, 503, 504}
# Models whose daily quota ran out, skipped until this monotonic time.
_exhausted_until: dict[str, float] = {}
EXHAUSTED_SKIP_SECONDS = 3600


@dataclass(frozen=True)
class ToolSpec:
    name: str
    description: str
    parameters: dict[str, Any]


class ToolCallingError(RuntimeError):
    """The model could not produce a final answer within the tool budget."""


class ProviderRateLimited(ToolCallingError):
    """The provider kept returning HTTP 429 after backing off."""


class ToolCallingClient:
    def __init__(self, gemini_api_key: str | None = None, openai_api_key: str | None = None):
        self.gemini_api_key = settings.gemini_api_key if gemini_api_key is None else gemini_api_key
        self.openai_api_key = settings.openai_api_key if openai_api_key is None else openai_api_key

    @property
    def is_configured(self) -> bool:
        return bool(self.gemini_api_key or self.openai_api_key)

    async def run(
        self,
        system_prompt: str,
        history: list[dict[str, str]],
        user_message: str,
        tools: list[ToolSpec],
        execute: ToolExecutor,
        max_rounds: int = 4,
    ) -> str:
        """Return the model's final text after it has finished calling tools.

        ``history`` holds earlier turns as {"role": "user"|"assistant", "text": ...}.
        """
        if self.gemini_api_key:
            try:
                return await self._run_gemini(system_prompt, history, user_message, tools, execute, max_rounds)
            except (httpx.HTTPError, ToolCallingError, KeyError, ValueError) as exc:
                if not self.openai_api_key:
                    raise
                logger.warning("Gemini tool calling unavailable; trying secondary provider: %s", exc.__class__.__name__)
        if self.openai_api_key:
            return await self._run_openai(system_prompt, history, user_message, tools, execute, max_rounds)
        raise ToolCallingError("No AI provider is configured")

    async def _run_gemini(self, system_prompt, history, user_message, tools, execute, max_rounds) -> str:
        contents: list[dict[str, Any]] = [
            {"role": "user" if turn["role"] == "user" else "model", "parts": [{"text": turn["text"]}]}
            for turn in history
            if turn.get("text")
        ]
        contents.append({"role": "user", "parts": [{"text": user_message}]})
        body_base = {
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "tools": [{"functionDeclarations": [
                {"name": tool.name, "description": tool.description, "parameters": tool.parameters}
                for tool in tools
            ]}],
            "generationConfig": {"temperature": 0.3, "maxOutputTokens": 800},
        }
        nudged = False
        async with httpx.AsyncClient(timeout=settings.web_agent_model_timeout_seconds) as client:
            for _ in range(max_rounds + 2):
                data = await self._post_gemini(client, {**body_base, "contents": contents})
                candidate = (data.get("candidates") or [{}])[0]
                content = candidate.get("content") or {}
                parts = content.get("parts") or []
                calls = [part["functionCall"] for part in parts if isinstance(part.get("functionCall"), dict)]
                if not calls:
                    text = "".join(str(part.get("text") or "") for part in parts if not part.get("thought")).strip()
                    if text:
                        return text
                    if nudged or len(contents) < 2:
                        raise ToolCallingError(f"Empty Gemini reply ({candidate.get('finishReason') or 'unknown'})")
                    # The model occasionally stops silently after reading tool
                    # results. Ask once for the shopper-facing reply.
                    nudged = True
                    if parts:
                        contents.append({"role": "model", "parts": parts})
                    contents.append({"role": "user", "parts": [{"text": "Now write your reply to the shopper using the tool results."}]})
                    continue
                # Echo the model turn unchanged: Gemini requires its thought
                # signatures back alongside the function results.
                contents.append({"role": "model", "parts": parts})
                results = await asyncio.gather(*[
                    execute(str(call.get("name") or ""), dict(call.get("args") or {})) for call in calls
                ])
                contents.append({"role": "user", "parts": [
                    {"functionResponse": {
                        "name": str(call.get("name") or ""),
                        "response": result,
                        **({"id": call["id"]} if call.get("id") else {}),
                    }}
                    for call, result in zip(calls, results)
                ]})
        raise ToolCallingError("Tool budget exhausted")

    async def _post_gemini(self, client: httpx.AsyncClient, body: dict) -> dict:
        # Free-tier quotas are per model, so a backup model keeps replies going
        # when the main model's daily quota runs out.
        backups = [name.strip() for name in settings.gemini_fallback_models.split(",") if name.strip()]
        models = list(dict.fromkeys([settings.gemini_model, *backups]))
        now = time.monotonic()
        available = [name for name in models if _exhausted_until.get(name, 0) <= now]
        models = available or models  # if every model is marked, try them anyway
        response = None
        for model in models:
            # Rate limits (429) are common on smaller quotas; back off twice
            # before trying the next model. Other server errors retry once.
            for attempt in range(3):
                try:
                    response = await client.post(
                        GEMINI_URL.format(model=model),
                        headers={"Content-Type": "application/json", "x-goog-api-key": self.gemini_api_key},
                        json=body,
                    )
                except httpx.TransportError:
                    # A brief network drop: retry once, then let the caller fall back.
                    if attempt:
                        raise
                    await asyncio.sleep(1)
                    continue
                if response.status_code == 429 and _daily_quota_exhausted(response):
                    # Retrying can't help for hours; skip this model for a while.
                    logger.warning("Gemini daily quota exhausted for model=%s; using the next model", model)
                    _exhausted_until[model] = time.monotonic() + EXHAUSTED_SKIP_SECONDS
                    break
                retries = 2 if response.status_code == 429 else 1
                if response.status_code in RETRYABLE_STATUS and attempt < retries:
                    await asyncio.sleep((1.5, 3.0)[attempt] if response.status_code == 429 else 0.5)
                    continue
                break
            if response.status_code not in RETRYABLE_STATUS | {404}:
                break
        if response.is_error:
            # Never log the key or the response body (it can echo customer text).
            logger.warning("Gemini tool call rejected: HTTP %s model=%s", response.status_code, model)
        if response.status_code == 429:
            raise ProviderRateLimited("Gemini rate limit")
        response.raise_for_status()
        data = response.json()
        usage = data.get("usageMetadata") or {}
        record_usage("gemini", model, "tool_calling", {
            "input_tokens": usage.get("promptTokenCount"),
            "output_tokens": usage.get("candidatesTokenCount"),
            "total_tokens": usage.get("totalTokenCount"),
        })
        return data

    async def _run_openai(self, system_prompt, history, user_message, tools, execute, max_rounds) -> str:
        items: list[dict[str, Any]] = [
            {"role": "user" if turn["role"] == "user" else "assistant", "content": turn["text"]}
            for turn in history
            if turn.get("text")
        ]
        items.append({"role": "user", "content": user_message})
        tool_payload = [
            {"type": "function", "name": tool.name, "description": tool.description, "parameters": tool.parameters}
            for tool in tools
        ]
        async with httpx.AsyncClient(timeout=settings.web_agent_model_timeout_seconds) as client:
            for _ in range(max_rounds + 1):
                response = await client.post(
                    OPENAI_URL,
                    headers={"Authorization": f"Bearer {self.openai_api_key}", "Content-Type": "application/json"},
                    json={
                        "model": settings.openai_model,
                        "instructions": system_prompt,
                        "input": items,
                        "tools": tool_payload,
                        "store": False,
                        "temperature": 0.3,
                    },
                )
                if response.is_error:
                    logger.warning("Secondary provider tool call rejected: HTTP %s", response.status_code)
                if response.status_code == 429:
                    raise ProviderRateLimited("Secondary provider rate limit")
                response.raise_for_status()
                data = response.json()
                record_usage("openai", settings.openai_model, "tool_calling", data.get("usage"))
                output = data.get("output") or []
                calls = [item for item in output if item.get("type") == "function_call"]
                if not calls:
                    text = "".join(
                        content.get("text", "")
                        for item in output if item.get("type") == "message"
                        for content in item.get("content", []) if content.get("type") == "output_text"
                    ).strip()
                    if not text:
                        raise ToolCallingError("Empty secondary provider reply")
                    return text
                items.extend(output)
                results = await asyncio.gather(*[
                    execute(str(call.get("name") or ""), _parse_arguments(call.get("arguments"))) for call in calls
                ])
                items.extend(
                    {"type": "function_call_output", "call_id": call.get("call_id"), "output": json.dumps(result, default=str)}
                    for call, result in zip(calls, results)
                )
        raise ToolCallingError("Tool budget exhausted")


def _daily_quota_exhausted(response: httpx.Response) -> bool:
    """True when a 429 names a per-day quota (only the quota id is read)."""
    try:
        details = (response.json().get("error") or {}).get("details") or []
    except ValueError:
        return False
    return any("PerDay" in str(violation.get("quotaId") or "")
               for detail in details for violation in detail.get("violations") or [])


def _parse_arguments(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    try:
        parsed = json.loads(raw or "{}")
    except (TypeError, ValueError):
        return {}
    return parsed if isinstance(parsed, dict) else {}
