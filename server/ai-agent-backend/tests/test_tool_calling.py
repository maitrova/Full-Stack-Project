import time
import unittest
from unittest.mock import AsyncMock, patch

from app.ai.tool_calling import ProviderRateLimited, ToolCallingClient, ToolCallingError, ToolSpec
from app.ai.usage import consume_usage, start_usage_tracking
from tests.claude_fakes import (
    OK, OVERLOADED, RATE_LIMITED, FakeClaude, message, text, thinking, tool_use,
)

SEARCH = ToolSpec(
    name="search_products",
    description="Search the catalogue.",
    parameters={"type": "object", "properties": {"query": {"type": "string"}}},
)


class ClaudeToolCallingTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        patcher = patch.multiple(
            "app.ai.anthropic_provider.settings",
            anthropic_model="main-model",
            anthropic_fallback_models="backup-model",
            anthropic_effort="low",
        )
        patcher.start()
        self.addCleanup(patcher.stop)

    async def run_with(self, fake, history=None, tools=(), execute=None, openai_api_key="", deadline_seconds=None):
        sleep = AsyncMock()
        patches = [
            patch("app.ai.tool_calling.make_client", fake.make_client),
            patch("app.ai.anthropic_provider.asyncio.sleep", sleep),
        ]
        if deadline_seconds is not None:
            patches.append(patch("app.ai.tool_calling.settings.web_agent_total_timeout_seconds", deadline_seconds))
        for item in patches:
            item.start()
        try:
            client = ToolCallingClient(anthropic_api_key="k", openai_api_key=openai_api_key)
            reply = await client.run("system", history or [], "hi", list(tools), execute or AsyncMock())
        finally:
            for item in reversed(patches):
                item.stop()
        return reply, sleep

    async def test_plain_reply_uses_haiku_settings(self):
        fake = FakeClaude({"main-model": [OK]})
        reply, _ = await self.run_with(fake, tools=[SEARCH])
        self.assertEqual(reply, "hello")
        body = fake.bodies[0]
        self.assertEqual(body["output_config"], {"effort": "low"})
        self.assertEqual(body["max_tokens"], 4096)
        self.assertEqual(body["system"], "system")
        self.assertNotIn("temperature", body)
        self.assertEqual(body["tools"][0]["name"], "search_products")
        self.assertEqual(body["tools"][0]["input_schema"], SEARCH.parameters)

    async def test_conversation_starts_with_a_user_turn(self):
        fake = FakeClaude({"main-model": [OK]})
        history = [{"role": "assistant", "text": "Welcome!"}, {"role": "user", "text": "hello"},
                   {"role": "assistant", "text": "Hi there"}]
        await self.run_with(fake, history=history)
        roles = [item["role"] for item in fake.bodies[0]["messages"]]
        self.assertEqual(roles, ["user", "assistant", "user"])

    async def test_tool_round_echoes_thinking_and_returns_results_together(self):
        fake = FakeClaude({"main-model": [
            (200, message([thinking(), tool_use("search_products", {"query": "kurta"}, "toolu_a"),
                           tool_use("search_products", {"query": "shirt"}, "toolu_b")], "tool_use")),
            (200, message([text("Here are two options.")])),
        ]})
        execute = AsyncMock(side_effect=lambda name, args: {"products": [args["query"]]})
        reply, _ = await self.run_with(fake, tools=[SEARCH], execute=execute)
        self.assertEqual(reply, "Here are two options.")
        self.assertEqual(execute.await_count, 2)
        assistant, results = fake.bodies[1]["messages"][-2:]
        self.assertEqual(assistant["role"], "assistant")
        self.assertEqual([block["type"] for block in assistant["content"]], ["thinking", "tool_use", "tool_use"])
        self.assertEqual(results["role"], "user")
        self.assertEqual([block["tool_use_id"] for block in results["content"]], ["toolu_a", "toolu_b"])

    async def test_empty_reply_after_tools_is_nudged_once(self):
        fake = FakeClaude({"main-model": [
            (200, message([tool_use("search_products", {"query": "x"})], "tool_use")),
            (200, message([thinking()])),
            (200, message([text("Final answer")])),
        ]})
        reply, _ = await self.run_with(fake, tools=[SEARCH], execute=AsyncMock(return_value={}))
        self.assertEqual(reply, "Final answer")
        self.assertEqual(fake.bodies[2]["messages"][-1]["content"],
                         "Now write your reply to the shopper using the tool results.")

    async def test_rate_limit_backs_off_on_the_same_model_first(self):
        fake = FakeClaude({"main-model": [RATE_LIMITED, OK], "backup-model": []})
        reply, sleep = await self.run_with(fake)
        self.assertEqual(reply, "hello")
        self.assertEqual(fake.calls, ["main-model", "main-model"])
        sleep.assert_awaited_once()

    async def test_rate_limit_near_deadline_tries_backup_without_waiting(self):
        fake = FakeClaude({"main-model": [RATE_LIMITED], "backup-model": [OK]})
        reply, sleep = await self.run_with(fake, deadline_seconds=3)
        self.assertEqual(reply, "hello")
        self.assertEqual(fake.calls, ["main-model", "backup-model"])
        sleep.assert_not_called()

    async def test_overloaded_model_switches_to_backup(self):
        fake = FakeClaude({"main-model": [OVERLOADED, OVERLOADED], "backup-model": [OK]})
        reply, _ = await self.run_with(fake)
        self.assertEqual(reply, "hello")
        self.assertEqual(fake.calls, ["main-model", "main-model", "backup-model"])

    async def test_every_model_rate_limited_reports_rate_limited(self):
        fake = FakeClaude({"main-model": [RATE_LIMITED] * 3, "backup-model": [RATE_LIMITED] * 3})
        with self.assertRaises(ProviderRateLimited):
            await self.run_with(fake)
        self.assertEqual(len(fake.calls), 6)

    async def test_invalid_key_is_not_retried(self):
        fake = FakeClaude({"main-model": [(401, {"type": "error", "error": {"type": "authentication_error", "message": "x"}})]})
        with self.assertRaises(ToolCallingError):
            await self.run_with(fake)
        self.assertEqual(fake.calls, ["main-model"])

    async def test_refusal_is_an_error_without_a_backup_provider(self):
        fake = FakeClaude({"main-model": [(200, message([], "refusal"))]})
        with self.assertRaisesRegex(ToolCallingError, "refused"):
            await self.run_with(fake)

    async def test_refusal_falls_back_to_openai_when_configured(self):
        fake = FakeClaude({"main-model": [(200, message([], "refusal"))]})
        with patch.object(ToolCallingClient, "_run_openai", AsyncMock(return_value="from openai")) as openai:
            reply, _ = await self.run_with(fake, openai_api_key="sk-test")
        self.assertEqual(reply, "from openai")
        openai.assert_awaited_once()

    async def test_usage_records_call_time_and_request_count(self):
        fake = FakeClaude({"main-model": [RATE_LIMITED, (200, message([text("hi")], input_tokens=120, output_tokens=30))]})
        start_usage_tracking()
        await self.run_with(fake)
        [entry] = consume_usage()
        self.assertEqual((entry["provider"], entry["model"], entry["attempts"]), ("anthropic", "main-model", 2))
        self.assertEqual((entry["input_tokens"], entry["output_tokens"]), (120, 30))
        self.assertIsInstance(entry["latency_ms"], int)

    async def test_run_passes_the_total_deadline(self):
        from app.ai import anthropic_provider

        create = AsyncMock(wraps=anthropic_provider.create_message)
        fake = FakeClaude({"main-model": [OK]})
        with patch("app.ai.tool_calling.create_message", create), \
                patch("app.ai.tool_calling.make_client", fake.make_client), \
                patch("app.ai.tool_calling.settings.web_agent_total_timeout_seconds", 60.0):
            started = time.monotonic()
            reply = await ToolCallingClient(anthropic_api_key="k", openai_api_key="").run("system", [], "hi", [], AsyncMock())
        self.assertEqual(reply, "hello")
        self.assertAlmostEqual(create.await_args.kwargs["deadline"] - started, 60.0, delta=1)


if __name__ == "__main__":
    unittest.main()
