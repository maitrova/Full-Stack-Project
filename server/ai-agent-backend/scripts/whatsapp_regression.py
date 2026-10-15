"""End-to-end regression run for the WhatsApp agent.

Plays WhatsApp customers through the simulator (signed webhooks in, a fake
Meta server capturing everything the bot sends), then checks the texts,
photos, buttons, tools, the store cart, handoff alerts and order updates
against tests/fixtures/whatsapp_scenarios.json.

Prerequisites (local stack):
  - an AI service instance whose WhatsApp messages go to the fake Meta server:
      MONGODB_DB_NAME=appdb_wa_test WHATSAPP_GRAPH_API_BASE_URL=http://127.0.0.1:8020 \\
      WHATSAPP_AGENT_MODE=tools uvicorn app.main:app --port 8011
    (add WHATSAPP_ORDER_UPDATE_TEMPLATE=order_update to test templates)
  - the store API on 5000 with the same WHATSAPP_COMMERCE_KEY
  - node server/scripts/seedAiTestProducts.js and seedAiTestOrders.js, and the policy pages

Usage:
  python scripts/whatsapp_regression.py                       # every scenario
  python scripts/whatsapp_regression.py --groups cart,orders --save
  python scripts/whatsapp_regression.py --ids WK03,WH03

Customers use numbers starting 999 (no such country code), so even a
misconfigured instance can't message a real person. It creates a temporary
shopper, links test numbers to accounts, changes that shopper's cart and
creates alerts; everything is removed or closed afterwards. Exits 1 when the
pass rate is below --min-pass, so it can gate a deploy.
"""

import argparse
import asyncio
import hashlib
import json
import re
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
from bson import ObjectId
from pymongo import MongoClient

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.config.settings import settings  # noqa: E402
from scripts.web_agent_regression import Context  # noqa: E402
from scripts.whatsapp_simulator import FakeMeta, Simulator  # noqa: E402

FIXTURE = Path(__file__).resolve().parents[1] / "tests" / "fixtures" / "whatsapp_scenarios.json"
SHOPPER_EMAIL = "whatsapp-regression@example.test"
LINK_RE = re.compile(r"https://\S+/whatsapp-connect\?token=")
MARKDOWN_RE = re.compile(r"(^#{1,6}\s|\*\*|^\|.*\|$)", re.MULTILINE)


def outbound_text(message: dict) -> str:
    kind = message.get("type")
    if kind == "text":
        return message["text"]["body"]
    if kind == "image":
        return message.get("image", {}).get("caption", "")
    if kind == "interactive":
        return message.get("interactive", {}).get("body", {}).get("text", "")
    if kind == "template":
        return " ".join(p.get("text", "") for c in message["template"].get("components", []) for p in c.get("parameters", []))
    return ""


def buttons_of(message: dict) -> list[str]:
    action = (message.get("interactive") or {}).get("action") or {}
    return [b["reply"]["title"] for b in action.get("buttons", [])] + [
        row["title"] for section in action.get("sections", []) for row in section.get("rows", [])]


class Run:
    def __init__(self, args, ctx: Context, store, wa_db):
        self.args, self.ctx, self.store, self.wa_db = args, ctx, store, wa_db
        self.business_id = str(settings.whatsapp_business_id)
        self.meta = FakeMeta(args.meta_port)
        self.code = f"{int(time.time()) % 10000:04d}"
        self.counter = 0
        self.phones: list[str] = []
        now = datetime.now(timezone.utc)
        self.store.users.delete_many({"email": SHOPPER_EMAIL})
        self.shopper = self.store.users.insert_one({"name": "WhatsApp Regression", "email": SHOPPER_EMAIL, "role": "user",
                                                   "phone": "", "createdAt": now, "updatedAt": now}).inserted_id
        self.http = httpx.Client(timeout=30)

    def account(self, phone: str) -> str:
        return hashlib.sha256(f"{self.business_id}:{phone}".encode()).hexdigest()

    def customer(self, kind: str) -> Simulator:
        self.counter += 1
        phone = f"999{self.code}{self.counter:05d}"  # 12 digits, never a real number
        self.phones.append(phone)
        now = datetime.now(timezone.utc)
        if kind in {"linked", "owner"}:
            user = self.shopper if kind == "linked" else self.ctx.user["_id"]
            self.store.whatsapp_account_links.replace_one(
                {"_id": self.account(phone)}, {"user": user, "expiresAt": now + timedelta(hours=2)}, upsert=True)
        if kind == "phone_match":
            self.store.users.update_one({"_id": self.shopper}, {"$set": {"phone": phone[-10:]}})
        self.store.carts.delete_many({"user": self.shopper})
        return Simulator(self.args.ai_url, self.meta, phone=phone)

    def prefill(self, phone: str, items: list) -> None:
        from motor.motor_asyncio import AsyncIOMotorClient

        from app.repositories.ecommerce_product_repository import EcommerceProductRepository
        from app.tools.product_tools import ProductTools

        async def prices():
            client = AsyncIOMotorClient(self.args.mongo_url)
            tools = ProductTools(EcommerceProductRepository(client[settings.ecommerce_mongodb_db_name]))
            found = []
            for title, size, qty in items:
                product_id = str(self.store.readymadeproducts.find_one({"title": title})["_id"])
                product = await tools.get_product_details(self.business_id, product_id)
                variant = next(v for v in product.attributes["variants"] if v["size"] == size)
                found.append((product_id, size, qty, variant["effective_price"]))
            client.close()
            return found

        for product_id, size, qty, price in asyncio.run(prices()):
            response = self.http.post(f"{self.args.shop_url}/whatsapp-commerce/cart", json={
                "product_id": product_id, "size": size, "quantity": qty, "expected_price": price, "operation_id": uuid.uuid4().hex,
            }, headers={"x-commerce-key": settings.whatsapp_commerce_key, "x-whatsapp-account": self.account(phone)})
            if response.status_code >= 400:
                raise RuntimeError(f"prefill failed: {response.status_code} {response.text[:120]}")

    def cart(self) -> list[dict]:
        cart = self.store.carts.find_one({"user": self.shopper, "status": "ACTIVE"}) or {}
        rows = []
        for item in cart.get("items", []):
            product = self.store.readymadeproducts.find_one({"_id": item.get("readymadeProduct")}, {"title": 1}) or {}
            dropped = self.store.dropproducts.find_one({"_id": item.get("dropproduct")}, {"name": 1}) or {}
            rows.append({"name": product.get("title") or dropped.get("name") or item.get("comboName") or "Item",
                         "size": item.get("size"), "qty": item.get("qty")})
        return rows

    def conversation(self, phone: str) -> dict | None:
        return self.wa_db.conversations.find_one({"external_customer_ref": phone, "channel": "whatsapp"})

    def internal(self, path: str, body: dict) -> tuple[int, dict]:
        response = self.http.post(f"{self.args.ai_url}/whatsapp/internal/{path}", json=body,
                                  headers={"x-commerce-key": settings.whatsapp_commerce_key})
        return response.status_code, response.json()

    def play(self, sim: Simulator, spec: dict, state: dict) -> dict:
        phone = sim.phone
        started = time.time()
        started_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        turn: dict = {"update_result": None, "delivered": None}
        if "message" in spec:
            text = self.ctx.fill(spec["message"])
            out = sim.send(text, wait=spec.get("wait", 90))
        elif "tap" in spec:
            out = sim.tap(spec["tap"])
        elif "team_reply" in spec:
            conversation = self.conversation(phone)
            status, _ = self.internal("team-reply", {"conversation_id": str(conversation["_id"]), "text": spec["team_reply"],
                                                     "admin_name": "Regression test"})
            time.sleep(1)
            out = self.meta.messages_to(phone, started)
            turn["delivered"] = status == 200 and any(spec["team_reply"] in outbound_text(m) for m in out)
        elif "age_handoff" in spec:
            conversation = self.conversation(phone)
            stale = datetime.now(timezone.utc) - timedelta(hours=spec["age_handoff"])
            self.wa_db.whatsapp_handoff_alerts.update_many({"conversation_id": conversation["_id"]},
                                                           {"$set": {"assigned_at": stale, "last_human_reply_at": stale}})
            out = []
        elif "order_update" in spec:
            now = datetime.now(timezone.utc)
            self.store.whatsapp_order_subscriptions.replace_one({"_id": self.account(phone)}, {
                "account": self.account(phone), "user": self.shopper, "recipient": phone, "active": True, "updatedAt": now,
                "customer_window_expires_at": now + (timedelta(hours=3) if spec.get("window_open") else -timedelta(hours=1)),
            }, upsert=True)
            if not spec.get("same_order"):
                state["order_id"] = str(ObjectId())
            state.setdefault("order_ids", []).append(state["order_id"])
            _, result = self.internal("order-update", {"user_id": str(self.shopper), "order_id": state["order_id"],
                                                       "event": spec["order_update"], "total": "INR 999.00"})
            turn["update_result"] = result.get("kind") or result.get("reason")
            time.sleep(1.5)
            out = self.meta.messages_to(phone, started)
        else:
            raise ValueError(f"unknown turn {spec}")

        conversation = self.conversation(phone)
        ai_message = None
        alert = None
        if conversation:
            ai_message = self.wa_db.messages.find_one(
                {"conversation_id": conversation["_id"], "sender": "ai", "created_at": {"$gte": started_at}}, sort=[("created_at", -1)])
            alert = self.wa_db.whatsapp_handoff_alerts.find_one(
                {"conversation_id": conversation["_id"], "created_at": {"$gte": started_at}})
        metadata = (ai_message or {}).get("metadata") or {}
        turn.update({
            "messages": out,
            "text": "\n".join(outbound_text(m) for m in out),
            "photos": sum(m.get("type") == "image" for m in out),
            "buttons": [title for m in out for title in buttons_of(m)],
            "tools": [call["name"] for call in metadata.get("tool_calls") or []],
            # The takeover note ("our team has your message") isn't an agent reply.
            "agent": None if metadata.get("handoff_ack") else metadata.get("agent_mode") or ("rules" if ai_message else None),
            "alert": alert,
            "cart": self.cart(),
            "latency_ms": round((time.time() - started) * 1000),
        })
        return turn


def run_checks(checks: dict, turn: dict, ctx: Context) -> dict[str, str | None]:
    text = turn["text"].lower()
    results: dict[str, str | None] = {}

    def has(word):
        return ctx.fill(word).lower() in text

    for name, expected in checks.items():
        failure = None
        if name in {"says_any", "also_says_any"}:
            failure = None if any(has(word) for word in expected) else f"reply lacks any of {expected}"
        elif name == "never_says":
            hits = [word for word in expected if has(word)]
            failure = f"reply contains {hits}" if hits else None
        elif name == "photos_min":
            failure = None if turn["photos"] >= expected else f"{turn['photos']} photo(s), expected at least {expected}"
        elif name == "photos_max":
            failure = None if turn["photos"] <= expected else f"{turn['photos']} photos, expected at most {expected}"
        elif name == "no_photos":
            failure = f"{turn['photos']} photo(s) sent" if turn["photos"] else None
        elif name == "buttons_include":
            missing = [title for title in expected if title not in turn["buttons"]]
            failure = f"buttons {turn['buttons']} lack {missing}" if missing else None
        elif name == "no_buttons":
            failure = f"buttons sent: {turn['buttons']}" if turn["buttons"] else None
        elif name == "person_offered":
            failure = None if "Talk to a person" in turn["buttons"] or turn["alert"] else "no Talk to a person button and no alert"
        elif name == "tools_any":
            failure = None if set(expected) & set(turn["tools"]) else f"none of {expected} called (tools: {turn['tools']})"
        elif name == "no_tools":
            failure = f"tools called: {turn['tools']}" if turn["tools"] else None
        elif name == "agent":
            failure = None if turn["agent"] == expected else f"answered by {turn['agent']}, expected {expected}"
        elif name == "link":
            failure = None if LINK_RE.search(turn["text"]) else "no secure link in the reply"
        elif name == "cart_has":
            title, size, qty = expected
            item = next((i for i in turn["cart"] if title.lower() in i["name"].lower() and i["size"] == size), None)
            failure = None if item and item["qty"] == qty else f"cart lacks {title} {size} x{qty} (cart: {turn['cart']})"
        elif name == "cart_lacks":
            failure = f"cart still has {expected}" if any(expected.lower() in i["name"].lower() for i in turn["cart"]) else None
        elif name == "cart_empty":
            failure = f"cart not empty: {turn['cart']}" if turn["cart"] else None
        elif name == "alert":
            failure = None if turn["alert"] else "no handoff alert created"
        elif name == "no_alert":
            failure = "unexpected handoff alert" if turn["alert"] else None
        elif name == "no_reply":
            failure = f"{len(turn['messages'])} message(s) sent" if turn["messages"] else None
        elif name == "replies_max":
            failure = None if len(turn["messages"]) <= expected else f"{len(turn['messages'])} messages, expected at most {expected}"
        elif name == "replies_min":
            failure = None if len(turn["messages"]) >= expected else f"{len(turn['messages'])} messages"
        elif name == "max_chars":
            longest = max((len(outbound_text(m)) for m in turn["messages"]), default=0)
            failure = None if longest <= expected else f"a message has {longest} characters (limit {expected})"
        elif name == "no_markdown":
            failure = "markdown in the reply" if MARKDOWN_RE.search(turn["text"]) else None
        elif name == "delivered":
            failure = None if turn["delivered"] else "team reply not delivered"
        elif name == "update_result":
            failure = None if turn["update_result"] in expected else f"order update result {turn['update_result']}, expected {expected}"
        else:
            failure = f"unknown check {name}"
        results[name] = failure
    # Messages the tool-calling agent should answer.
    if turn["agent"] not in (None, "tools") and "agent" not in checks:
        results["answered_by_tools_agent"] = f"answered by {turn['agent']}"
    return results


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--ai-url", default="http://127.0.0.1:8011/api")
    parser.add_argument("--shop-url", default="http://127.0.0.1:5000/api")
    parser.add_argument("--mongo-url", default=settings.primary_mongodb_url)
    parser.add_argument("--ai-db", default="appdb_wa_test", help="database of the simulator AI instance")
    parser.add_argument("--meta-port", type=int, default=8020)
    parser.add_argument("--groups")
    parser.add_argument("--ids")
    parser.add_argument("--delay", type=float, default=3.0, help="seconds between messages (Gemini per-minute limits)")
    parser.add_argument("--min-pass", type=float, default=0.9)
    parser.add_argument("--save", action="store_true", help="store the run in ai_agent_evaluations for the admin page")
    args = parser.parse_args()

    for url in (args.ai_url, args.shop_url):
        if not re.match(r"https?://(127\.0\.0\.1|localhost)(:\d+)?/", url + "/"):
            raise SystemExit("Refusing: the WhatsApp regression only runs against a local stack.")
    if args.ai_db == settings.mongodb_db_name:
        raise SystemExit("Refusing: --ai-db must be the simulator instance's database, not the main one.")
    if not settings.whatsapp_commerce_key or not settings.whatsapp_business_id:
        raise SystemExit("WHATSAPP_COMMERCE_KEY and WHATSAPP_BUSINESS_ID are needed.")

    fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
    client = MongoClient(args.mongo_url)
    store, wa_db = client[settings.ecommerce_mongodb_db_name], client[args.ai_db]
    ctx = Context(store)
    scenarios = fixture["scenarios"]
    if args.groups:
        scenarios = [s for s in scenarios if s["group"] in set(args.groups.split(","))]
    if args.ids:
        scenarios = [s for s in scenarios if s["id"] in set(args.ids.split(","))]
    run_started = datetime.now(timezone.utc)
    run = Run(args, ctx, store, wa_db)
    print(f"Running {len(scenarios)} WhatsApp scenarios against {args.ai_url}\n")

    results = []
    try:
        for scenario in scenarios:
            sim = run.customer(scenario.get("account", "guest"))
            if scenario.get("prefill_cart"):
                run.prefill(sim.phone, scenario["prefill_cart"])
            checks: dict[str, bool] = {}
            failures: list[str] = []
            turns = []
            state: dict = {}
            for index, spec in enumerate(scenario["turns"], start=1):
                try:
                    turn = run.play(sim, spec, state)
                except Exception as exc:  # a broken turn fails the scenario, not the run
                    checks[f"turn{index}:run"] = False
                    failures.append(f"turn {index}: {type(exc).__name__}: {str(exc)[:150]}")
                    break
                for name, failure in run_checks(spec.get("checks", {}), turn, ctx).items():
                    checks[f"turn{index}:{name}"] = failure is None
                    if failure:
                        failures.append(f"turn {index} ({name}): {failure}")
                turns.append({"sent": spec.get("message") or spec.get("tap") or next(iter(k for k in spec if k != "checks")),
                              "reply": turn["text"][:1500], "photos": turn["photos"], "buttons": turn["buttons"],
                              "tools": turn["tools"], "latency_ms": turn["latency_ms"]})
                if "message" in spec:
                    time.sleep(args.delay)
            store.whatsapp_notification_log.delete_many({"order": {"$in": state.get("order_ids", [])}})
            passed = bool(checks) and all(checks.values())
            latencies = [t["latency_ms"] for t in turns if t["latency_ms"]]
            first = scenario["turns"][0]
            results.append({
                "id": scenario["id"], "group": scenario["group"], "passed": passed,
                "message": ctx.fill(first.get("message") or first.get("tap") or next(k for k in first if k != "checks")),
                "latency_ms": round(sum(latencies) / len(latencies)) if latencies else 0,
                "checks": checks, "failures": failures,
                "actual": {"route": "whatsapp", "turns": turns},
            })
            print(f"[{'PASS' if passed else 'FAIL'}] {scenario['id']:5s} {scenario['group']:14s} {results[-1]['message'][:60]}")
            for failure in failures:
                print(f"        {failure}")
    finally:
        accounts = [run.account(phone) for phone in run.phones]
        store.whatsapp_account_links.delete_many({"_id": {"$in": accounts}})
        store.whatsapp_order_subscriptions.delete_many({"_id": {"$in": accounts}})
        store.whatsapp_link_requests.delete_many({"account": {"$in": accounts}})
        store.carts.delete_many({"user": run.shopper})
        store.users.delete_many({"_id": run.shopper})
        closed = wa_db.whatsapp_handoff_alerts.update_many(
            {"external_customer_ref": {"$in": run.phones}, "status": {"$in": ["open", "assigned"]}},
            {"$set": {"status": "resumed", "resolved_by": "regression_test", "resolved_at": datetime.now(timezone.utc)}},
        ).modified_count
        run.meta.stop()

    passed = sum(result["passed"] for result in results)
    by_group: dict[str, list[int]] = {}
    for result in results:
        counts = by_group.setdefault(result["group"], [0, 0])
        counts[0] += result["passed"]
        counts[1] += 1
    report = {
        "name": f"WhatsApp agent regression {run_started:%Y-%m-%d %H:%M}",
        "channel": "whatsapp",
        "created_at": run_started,
        "total_cases": len(results),
        "passed_cases": passed,
        "failed_cases": len(results) - passed,
        "pass_rate": round(passed / len(results), 4) if results else 0,
        "average_latency_ms": round(sum(r["latency_ms"] for r in results) / len(results)) if results else 0,
        "by_group": {group: {"passed": c[0], "total": c[1]} for group, c in by_group.items()},
        "results": results,
    }
    out_dir = Path(__file__).resolve().parents[1] / "outputs"
    out_dir.mkdir(exist_ok=True)
    report_path = out_dir / f"whatsapp_regression_{run_started:%Y%m%d_%H%M%S}.json"
    report_path.write_text(json.dumps(report, default=str, ensure_ascii=False, indent=1), encoding="utf-8")
    if args.save:
        client[settings.mongodb_db_name].ai_agent_evaluations.insert_one({**report, "business_id": ObjectId(run.business_id)})

    print("\nBy group:")
    for group, counts in report["by_group"].items():
        print(f"  {group:15s} {counts['passed']}/{counts['total']}")
    print(f"\n{passed}/{len(results)} scenarios passed ({report['pass_rate']:.0%}), "
          f"average {report['average_latency_ms']} ms per turn. Closed {closed} test alert(s).")
    print(f"Report: {report_path}")
    return 0 if report["pass_rate"] >= args.min_pass else 1


if __name__ == "__main__":
    sys.exit(main())
