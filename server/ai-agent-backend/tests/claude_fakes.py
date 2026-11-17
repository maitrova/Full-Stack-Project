"""Offline stand-in for the Anthropic Messages API.

The real SDK client is used with a mock transport, so request serialization
and error mapping are exercised without any network call.
"""

import json

import anthropic
import httpx2


def message(content, stop_reason="end_turn", model="claude-haiku-5-5", input_tokens=10, output_tokens=5):
    return {
        "id": "msg_test", "type": "message", "role": "assistant", "model": model,
        "content": content, "stop_reason": stop_reason, "stop_sequence": None,
        "usage": {"input_tokens": input_tokens, "output_tokens": output_tokens},
    }


def text(value):
    return {"type": "text", "text": value}


def thinking():
    return {"type": "thinking", "thinking": "", "signature": "sig"}


def tool_use(name, tool_input, tool_id="toolu_1"):
    return {"type": "tool_use", "id": tool_id, "name": name, "input": tool_input}


def error(status, error_type):
    return status, {"type": "error", "error": {"type": error_type, "message": "test"}}


OK = (200, message([text("hello")]))
RATE_LIMITED = error(429, "rate_limit_error")
OVERLOADED = error(529, "overloaded_error")


class FakeClaude:
    """Answers from a per-model script and records each request body."""

    def __init__(self, script):
        self.script = {model: list(responses) for model, responses in script.items()}
        self.bodies = []

    @property
    def calls(self):
        return [body["model"] for body in self.bodies]

    def _handle(self, request):
        body = json.loads(request.content)
        self.bodies.append(body)
        status, payload = self.script[body["model"]].pop(0)
        return httpx2.Response(status, json=payload, headers={"request-id": "req_test"})

    def make_client(self, api_key, timeout):
        transport = httpx2.MockTransport(self._handle)
        return anthropic.AsyncAnthropic(
            api_key=api_key, max_retries=0,
            http_client=anthropic.DefaultAsyncHttpxClient(transport=transport),
        )
