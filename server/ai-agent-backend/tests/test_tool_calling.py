import time
import unittest
from unittest.mock import AsyncMock, patch

import httpx

from app.ai.tool_calling import ProviderRateLimited, ToolCallingClient
from app.ai.usage import consume_usage, start_usage_tracking

OK_BODY = {"candidates": [{"content": {"parts": [{"text": "hello"}]}}], "usageMetadata": {}}
DAILY_429 = {"error": {"status": "RESOURCE_EXHAUSTED", "details": [{"violations": [
    {"quotaId": "GenerateRequestsPerDayPerProjectPerModel-FreeTier", "quotaValue": "500"}]}]}}
MINUTE_429 = {"error": {"status": "RESOURCE_EXHAUSTED", "details": [{"violations": [
    {"quotaId": "GenerateRequestsPerMinutePerProjectPerModel-FreeTier"}]}]}}


class FakeHttp:
    """Answers per model from a script and records the order of calls."""

    def __init__(self, script):
        self.script = {model: list(responses) for model, responses in script.items()}
        self.calls = []

    async def post(self, url, headers=None, json=None):
        model = url.split("/models/")[1].split(":")[0]
        self.calls.append(model)
        status, body = self.script[model].pop(0)
        return httpx.Response(status, json=body, request=httpx.Request("POST", url))


class GeminiFailoverTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        from app.ai import tool_calling
        tool_calling._exhausted_until.clear()

    def settings(self, fallbacks="backup-model"):
        return patch.multiple("app.ai.tool_calling.settings", gemini_model="main-model", gemini_fallback_models=fallbacks)

    async def test_daily_quota_switches_to_backup_model_without_waiting(self):
        http = FakeHttp({"main-model": [(429, DAILY_429)], "backup-model": [(200, OK_BODY)]})
        with self.settings(), patch("app.ai.tool_calling.asyncio.sleep") as sleep:
            data = await ToolCallingClient(gemini_api_key="k", openai_api_key="")._post_gemini(http, {})
        self.assertEqual(data, OK_BODY)
        self.assertEqual(http.calls, ["main-model", "backup-model"])
        sleep.assert_not_called()

    async def test_exhausted_model_is_skipped_on_later_requests(self):
        http = FakeHttp({"main-model": [(429, DAILY_429)], "backup-model": [(200, OK_BODY), (200, OK_BODY)]})
        with self.settings(), patch("app.ai.tool_calling.asyncio.sleep"):
            client = ToolCallingClient(gemini_api_key="k", openai_api_key="")
            await client._post_gemini(http, {})
            await client._post_gemini(http, {})
        self.assertEqual(http.calls, ["main-model", "backup-model", "backup-model"])

    async def test_per_minute_limit_backs_off_on_the_same_model_first(self):
        http = FakeHttp({"main-model": [(429, MINUTE_429), (200, OK_BODY)], "backup-model": []})
        with self.settings(), patch("app.ai.tool_calling.asyncio.sleep") as sleep:
            await ToolCallingClient(gemini_api_key="k", openai_api_key="")._post_gemini(http, {})
        self.assertEqual(http.calls, ["main-model", "main-model"])
        sleep.assert_awaited_once()

    async def test_per_minute_limit_near_deadline_tries_backup_without_waiting(self):
        http = FakeHttp({"main-model": [(429, MINUTE_429)], "backup-model": [(200, OK_BODY)]})
        with self.settings(), patch("app.ai.tool_calling.asyncio.sleep") as sleep:
            data = await ToolCallingClient(gemini_api_key="k", openai_api_key="")._post_gemini(
                http, {}, deadline=time.monotonic() + 3,
            )
        self.assertEqual(data, OK_BODY)
        self.assertEqual(http.calls, ["main-model", "backup-model"])
        sleep.assert_not_called()

    async def test_per_minute_limit_with_time_left_still_backs_off(self):
        http = FakeHttp({"main-model": [(429, MINUTE_429), (200, OK_BODY)], "backup-model": []})
        with self.settings(), patch("app.ai.tool_calling.asyncio.sleep") as sleep:
            await ToolCallingClient(gemini_api_key="k", openai_api_key="")._post_gemini(
                http, {}, deadline=time.monotonic() + 60,
            )
        self.assertEqual(http.calls, ["main-model", "main-model"])
        sleep.assert_awaited_once()

    async def test_usage_records_call_time_and_request_count(self):
        http = FakeHttp({"main-model": [(429, MINUTE_429), (200, OK_BODY)], "backup-model": []})
        start_usage_tracking()
        with self.settings(), patch("app.ai.tool_calling.asyncio.sleep"):
            await ToolCallingClient(gemini_api_key="k", openai_api_key="")._post_gemini(http, {})
        [entry] = consume_usage()
        self.assertEqual((entry["model"], entry["attempts"]), ("main-model", 2))
        self.assertIsInstance(entry["latency_ms"], int)

    async def test_run_allows_room_for_thinking_and_passes_the_total_deadline(self):
        post = AsyncMock(return_value=OK_BODY)
        client = ToolCallingClient(gemini_api_key="k", openai_api_key="")
        with patch.object(client, "_post_gemini", post), \
                patch("app.ai.tool_calling.settings.web_agent_total_timeout_seconds", 60.0):
            started = time.monotonic()
            reply = await client.run("system", [], "hi", [], AsyncMock())
        self.assertEqual(reply, "hello")
        body, deadline = post.await_args.args[1], post.await_args.args[2]
        self.assertEqual(body["generationConfig"]["maxOutputTokens"], 2048)
        self.assertAlmostEqual(deadline - started, 60.0, delta=1)

    async def test_every_model_exhausted_reports_rate_limited(self):
        http = FakeHttp({"main-model": [(429, DAILY_429)], "backup-model": [(429, DAILY_429)]})
        with self.settings(), patch("app.ai.tool_calling.asyncio.sleep"):
            with self.assertRaises(ProviderRateLimited):
                await ToolCallingClient(gemini_api_key="k", openai_api_key="")._post_gemini(http, {})


if __name__ == "__main__":
    unittest.main()
