"""Local WhatsApp simulator: send signed webhooks, capture what the bot sends.

Nothing reaches Meta. Start a separate AI-service instance whose Graph API
calls go to this simulator's fake Meta server and whose WhatsApp queue lives
in its own database, so a normal server's worker can never pick up (and
really send) a simulated message:

    MONGODB_DB_NAME=appdb_wa_test \\
    WHATSAPP_GRAPH_API_BASE_URL=http://127.0.0.1:8020 \\
    WHATSAPP_AGENT_MODE=tools \\
    uvicorn app.main:app --port 8011

Then:
    python scripts/whatsapp_simulator.py "show me hoodies" "2"     # one conversation
    python scripts/whatsapp_simulator.py --interactive              # type messages

The library API (Simulator) is used by the WhatsApp regression tests.
"""

import argparse
import hashlib
import hmac
import itertools
import json
import sys
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import httpx

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.config.settings import settings  # noqa: E402

_counter = itertools.count(1)


class FakeMeta:
    """Records Graph API calls and answers like Meta would."""

    def __init__(self, port: int = 8020):
        self.port = port
        self.sent: list[dict] = []
        self.lock = threading.Lock()
        outer = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):  # keep the console quiet
                pass

            def _json(self, status: int, body: dict):
                data = json.dumps(body).encode()
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

            def do_POST(self):
                length = int(self.headers.get("Content-Length") or 0)
                raw = self.rfile.read(length) if length else b""
                if self.path.endswith("/media"):  # image upload
                    return self._json(200, {"id": f"mock-media-{next(_counter)}"})
                try:
                    body = json.loads(raw or b"{}")
                except ValueError:
                    body = {}
                message_id = f"wamid.mock.{next(_counter)}"
                with outer.lock:
                    outer.sent.append({"id": message_id, "at": time.time(), **body})
                return self._json(200, {"messages": [{"id": message_id}]})

            def do_GET(self):
                return self._json(404, {"error": {"message": "media download is not simulated"}})

        self.server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def messages_to(self, phone: str, since: float = 0) -> list[dict]:
        with self.lock:
            return [item for item in self.sent if item.get("to") == phone and item["at"] >= since]

    def stop(self):
        self.server.shutdown()


def describe(message: dict) -> str:
    """One readable line per outbound WhatsApp message."""
    kind = message.get("type")
    if kind == "text":
        return message["text"]["body"]
    if kind == "image":
        image = message.get("image", {})
        return f"[photo {image.get('link') or image.get('id')}] {image.get('caption', '')}"
    if kind == "interactive":
        interactive = message.get("interactive", {})
        body = interactive.get("body", {}).get("text", "")
        action = interactive.get("action", {})
        if interactive.get("type") == "button":
            titles = [button["reply"]["title"] for button in action.get("buttons", [])]
            return f"{body}\n[buttons: {' | '.join(titles)}]"
        rows = [row["title"] for section in action.get("sections", []) for row in section.get("rows", [])]
        return f"{body}\n[list: {' | '.join(rows)}]"
    return json.dumps(message)[:200]


class Simulator:
    def __init__(self, ai_url: str = "http://127.0.0.1:8011/api", meta: FakeMeta | None = None,
                 phone: str | None = None, name: str = "Test Shopper", allow_remote: bool = False):
        if not allow_remote and not ai_url.startswith(("http://127.0.0.1", "http://localhost")):
            raise SystemExit("Refusing: the simulator only talks to a local AI service.")
        if not settings.whatsapp_app_secret:
            raise SystemExit("WHATSAPP_APP_SECRET is needed to sign simulated webhooks.")
        self.ai_url = ai_url.rstrip("/")
        self.meta = meta or FakeMeta()
        # A reserved-looking number so a mistake can't message a real person.
        self.phone = phone or f"9100000{uuid.uuid4().int % 100000:05d}"
        self.name = name
        self.last_outbound: list[dict] = []
        self.http = httpx.Client(timeout=30)

    def _payload(self, message: dict) -> dict:
        return {
            "object": "whatsapp_business_account",
            "entry": [{"id": settings.whatsapp_waba_id or "waba", "changes": [{"field": "messages", "value": {
                "messaging_product": "whatsapp",
                "metadata": {"display_phone_number": "910000000000", "phone_number_id": settings.whatsapp_phone_number_id},
                "contacts": [{"wa_id": self.phone, "profile": {"name": self.name}}],
                "messages": [message],
            }}]}],
        }

    def send(self, text: str | None = None, *, button: dict | None = None, quote: str | None = None,
             wait: float = 90.0) -> list[dict]:
        """Send one message (text, or a button/list reply) and return the bot's replies."""
        message_id = f"wamid.sim.{uuid.uuid4().hex}"
        message = {"from": self.phone, "id": message_id, "timestamp": str(int(time.time()))}
        if button:
            message.update({"type": "interactive", "interactive": button})
        else:
            message.update({"type": "text", "text": {"body": text or ""}})
        if quote:
            message["context"] = {"from": "910000000000", "id": quote}
        raw = json.dumps(self._payload(message)).encode()
        signature = "sha256=" + hmac.new(settings.whatsapp_app_secret.encode(), raw, hashlib.sha256).hexdigest()
        started = time.time()
        response = self.http.post(f"{self.ai_url}/whatsapp/webhook", content=raw,
                                  headers={"Content-Type": "application/json", "X-Hub-Signature-256": signature})
        response.raise_for_status()
        # Replies arrive asynchronously from the queue worker: wait until they stop.
        replies: list[dict] = []
        quiet_since = None
        while time.time() - started < wait:
            current = self.meta.messages_to(self.phone, started)
            if len(current) != len(replies):
                replies, quiet_since = current, time.time()
            elif replies and quiet_since and time.time() - quiet_since > 4:
                break
            time.sleep(0.5)
        self.last_outbound = replies
        return replies

    def tap(self, title: str, wait: float = 90.0) -> list[dict]:
        """Tap a reply button or list row from the last bot message, by title."""
        for message in reversed(self.last_outbound):
            interactive = message.get("interactive") or {}
            action = interactive.get("action", {})
            for button in action.get("buttons", []):
                if button["reply"]["title"].lower() == title.lower():
                    return self.send(button={"type": "button_reply", "button_reply": button["reply"]}, wait=wait)
            for section in action.get("sections", []):
                for row in section.get("rows", []):
                    if row["title"].lower() == title.lower():
                        return self.send(button={"type": "list_reply", "list_reply": {"id": row["id"], "title": row["title"]}}, wait=wait)
        raise ValueError(f"No button or list row titled {title!r} in the last reply")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("messages", nargs="*", help="messages to send in order (one conversation)")
    parser.add_argument("--ai-url", default="http://127.0.0.1:8011/api")
    parser.add_argument("--meta-port", type=int, default=8020)
    parser.add_argument("--phone", help="sender number (default: a random test number)")
    parser.add_argument("--interactive", action="store_true")
    args = parser.parse_args()

    meta = FakeMeta(args.meta_port)
    sim = Simulator(args.ai_url, meta, phone=args.phone)
    print(f"Simulating WhatsApp customer {sim.phone}\n")

    def show(text: str, replies: list[dict]):
        print(f"you > {text}")
        for reply in replies or [{"type": "text", "text": {"body": "(no reply)"}}]:
            print("bot > " + describe(reply).replace("\n", "\n      "))
        print()

    try:
        for text in args.messages:
            show(text, sim.send(text))
        while args.interactive:
            text = input("you > ").strip()
            if not text:
                break
            if text.startswith("/tap "):
                replies = sim.tap(text[5:])
            else:
                replies = sim.send(text)
            for reply in replies:
                print("bot > " + describe(reply).replace("\n", "\n      "))
    finally:
        meta.stop()
    return 0


if __name__ == "__main__":
    sys.exit(main())
