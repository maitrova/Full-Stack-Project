"""Provider-neutral function-calling loop (Claude first, OpenAI fallback).

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

import anthropic
import httpx

from app.ai.anthropic_provider import ClaudeRefusal, create_message, make_client, response_text
from app.ai.usage import record_usage
from app.config.settings import settings

logger = logging.getLogger(__name__)

ToolExecutor = Callable[[str, dict[str, Any]], Awaitable[dict[str, Any]]]
OPENAI_URL = "https://api.openai.com/v1/responses"
# Thinking tokens count toward this cap; too low a cap leaves no room for the
# reply and costs an extra "nudge" round.
TOOL_MAX_TOKENS = 4096
NUDGE = "Now write your reply to the shopper using the tool results."


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
    def __init__(self, anthropic_api_key: str | None = None, openai_api_key: str | None = None):
        self.anthropic_api_key = settings.anthropic_api_key if anthropic_api_key is None else anthropic_api_key
        self.openai_api_key = settings.openai_api_key if openai_api_key is None else openai_api_key

    @property
    def is_configured(self) -> bool:
        return bool(self.anthropic_api_key or self.openai_api_key)

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
        if self.anthropic_api_key:
            try:
                return await self._run_claude(system_prompt, history, user_message, tools, execute, max_rounds)
            except (anthropic.APIError, httpx.HTTPError, ToolCallingError, KeyError, ValueError) as exc:
                if not self.openai_api_key:
                    if isinstance(exc, anthropic.RateLimitError):
                        raise ProviderRateLimited("Claude rate limit") from exc
                    if isinstance(exc, anthropic.APIError):
                        raise ToolCallingError(f"Claude unavailable ({exc.__class__.__name__})") from exc
                    raise
                logger.warning("Claude tool calling unavailable; trying secondary provider: %s", exc.__class__.__name__)
        if self.openai_api_key:
            return await self._run_openai(system_prompt, history, user_message, tools, execute, max_rounds)
        raise ToolCallingError("No AI provider is configured")

    async def _run_claude(self, system_prompt, history, user_message, tools, execute, max_rounds) -> str:
        messages: list[dict[str, Any]] = [
            {"role": "user" if turn["role"] == "user" else "assistant", "content": turn["text"]}
            for turn in history
            if turn.get("text")
        ]
        # The Messages API requires the conversation to open with a user turn.
        while messages and messages[0]["role"] != "user":
            messages.pop(0)
        messages.append({"role": "user", "content": user_message})
        tool_payload = [
            {"name": tool.name, "description": tool.description, "input_schema": tool.parameters}
            for tool in tools
        ]
        nudged = False
        # The caller cancels at the total timeout; knowing it lets rate-limit
        # backoff skip to the next model instead of sleeping past it.
        deadline = time.monotonic() + settings.web_agent_total_timeout_seconds
        async with make_client(self.anthropic_api_key, settings.web_agent_model_timeout_seconds) as client:
            for _ in range(max_rounds + 2):
                try:
                    response = await create_message(
                        client, "tool_calling", deadline=deadline,
                        max_tokens=TOOL_MAX_TOKENS,
                        system=system_prompt,
                        tools=tool_payload,
                        messages=messages,
                    )
                except ClaudeRefusal as exc:
                    raise ToolCallingError(str(exc)) from exc
                calls = [block for block in response.content if block.type == "tool_use"]
                if not calls:
                    text = response_text(response)
                    if text:
                        return text
                    if nudged:
                        raise ToolCallingError(f"Empty Claude reply ({response.stop_reason or 'unknown'})")
                    # The model occasionally stops silently after reading tool
                    # results. Ask once for the shopper-facing reply.
                    nudged = True
                    if response.content:
                        messages.append({"role": "assistant", "content": response.content})
                    messages.append({"role": "user", "content": NUDGE})
                    continue
                # Echo the assistant turn unchanged: thinking blocks must go
                # back with the tool results.
                messages.append({"role": "assistant", "content": response.content})
                results = await asyncio.gather(*[execute(call.name, dict(call.input or {})) for call in calls])
                # All results go back in one user message, matched by id.
                messages.append({"role": "user", "content": [
                    {"type": "tool_result", "tool_use_id": call.id, "content": json.dumps(result, default=str)}
                    for call, result in zip(calls, results)
                ]})
        raise ToolCallingError("Tool budget exhausted")

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
                started = time.monotonic()
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
                record_usage("openai", settings.openai_model, "tool_calling", data.get("usage"),
                             latency_ms=round((time.monotonic() - started) * 1000), attempts=1)
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


def _parse_arguments(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    try:
        parsed = json.loads(raw or "{}")
    except (TypeError, ValueError):
        return {}
    return parsed if isinstance(parsed, dict) else {}
