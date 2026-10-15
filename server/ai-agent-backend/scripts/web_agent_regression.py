"""End-to-end regression run for the website's tool-calling agent.

Plays the shopper's browser against a running stack: reads the real cart,
sends each message to the AI service, carries out returned cart actions on the
store's cart API (as the chat window does), then checks the reply, tools,
cards, orders, cart and handoff alerts against tests/fixtures/web_agent_scenarios.json.

Prerequisites (local stack):
  - AI service and the store API running, with WEB_AGENT_MODE=tools
  - node server/scripts/seedAiTestProducts.js and seedAiTestOrders.js
  - the store's policy pages in the companydocuments collection

Usage:
  python scripts/web_agent_regression.py                     # every scenario
  python scripts/web_agent_regression.py --groups cart,policy --save
  python scripts/web_agent_regression.py --ids K04,G02 --delay 1

It changes carts and creates handoff alerts, so it refuses a non-local store
API unless --allow-remote. Alerts it creates are closed afterwards. Exits 1
when the pass rate is below --min-pass, so it can gate a deploy.
"""

import argparse
import json
import re
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
import jwt
from bson import ObjectId
from pymongo import MongoClient

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.ai.web_agent import BUSY_REPLY  # noqa: E402
from app.config.settings import settings  # noqa: E402

FIXTURE = Path(__file__).resolve().parents[1] / "tests" / "fixtures" / "web_agent_scenarios.json"
ORDER_LABELS = {"prepared": 1, "shipped": 2, "delivered": 3, "return": 4, "cancelled": 5, "failed": 6}
TEST_MOBILE = "9000012345"
FALSE_CLAIMS = ("i'm adding", "i am adding", "i've added", "has been added", "i'm removing", "i've removed",
                "i'm updating", "i've updated", "cleared your cart")


def item_name(item: dict) -> str:
    for key, field in (("readymadeProduct", "title"), ("dropproduct", "name"), ("design", "title"), ("product", "name")):
        if isinstance(item.get(key), dict) and item[key].get(field):
            return item[key][field]
    return item.get("comboName") or "Item"


class Context:
    """Seeded data the scenarios refer to."""

    def __init__(self, db):
        self.db = db
        orders = {int(order["invoiceNumber"].split("-")[-1]): order
                  for order in db.orders.find({"invoiceNumber": {"$regex": "^AI-TEST-"}})}
        missing = []
        if len(orders) < 6:
            missing.append("test orders (node scripts/seedAiTestOrders.js)")
        if not db.readymadeproducts.find_one({"title": "Charcoal Fleece Hoodie"}) or not db.combopacks.find_one({"slug": {"$regex": "^ai-test-"}}):
            missing.append("test products and combos (node scripts/seedAiTestProducts.js)")
        if not db.companydocuments.find_one({"name": "return-refund-policy"}):
            missing.append("policy pages in companydocuments")
        if missing:
            raise SystemExit("Missing prerequisites: " + "; ".join(missing))
        self.orders = {label: str(orders[number]["_id"])[-8:].upper() for label, number in ORDER_LABELS.items()}
        self.user = db.users.find_one({"_id": orders[1]["user"]})
        self.token = jwt.encode({"id": str(self.user["_id"]), "exp": datetime.now(timezone.utc) + timedelta(hours=3)},
                                settings.jwt_secret, algorithm=settings.jwt_algorithm)

    def fill(self, text: str) -> str:
        text = re.sub(r"\{order:(\w+)\}", lambda match: self.orders[match.group(1)], text)
        return text.replace("{email}", self.user.get("email") or "").replace("{mobile}", TEST_MOBILE)

    def page(self, pages: dict, name: str | None) -> dict:
        page = pages.get(name or "home") or pages["home"]
        if "drop" in page:
            drop = self.db.dropproducts.find_one({"name": page["drop"]})
            return {"page_type": "product_detail", "path": f"/dropproducts/{drop['_id']}", "product_id": str(drop["_id"])}
        return page


class Browser:
    def __init__(self, args, ctx: Context, signed_in: bool):
        self.args, self.ctx, self.signed_in = args, ctx, signed_in
        auth = {"Authorization": f"Bearer {ctx.token}"} if signed_in else {}
        self.shop = httpx.Client(timeout=30, headers=auth)
        self.ai = httpx.Client(timeout=120)
        self.session, self.conversation = str(uuid.uuid4()), None

    def cart(self) -> dict:
        cart = self.shop.get(f"{self.args.shop_url}/cart").json().get("cart") or {}
        items = cart.get("items") or []
        return {
            "items": [{"item_id": item["_id"], "name": item_name(item), "kind": item["kind"], "size": item.get("size"),
                       "qty": item["qty"], "unit_price": item["unitPrice"]} for item in items],
            "subtotal": sum(item["unitPrice"] * item["qty"] for item in items),
            "total_items": len(items),
        }

    def clear(self):
        self.shop.delete(f"{self.args.shop_url}/cart/clear")

    def prefill(self, title: str, size: str, qty: int):
        product = self.ctx.db.readymadeproducts.find_one({"title": title})
        self.shop.post(f"{self.args.shop_url}/cart/add", json={"kind": "READYMADE", "readymadeProductId": str(product["_id"]), "size": size, "qty": qty})

    def say(self, message: str, page: dict, quick_action: str | None) -> dict:
        headers = {"x-ai-session-id": self.session, **({"Authorization": f"Bearer {self.ctx.token}"} if self.signed_in else {})}
        for attempt in range(3):
            body = {"message": message, "conversation_id": self.conversation, "page_context": page, "cart": self.cart(),
                    **({"quick_action": quick_action} if quick_action else {})}
            started = time.time()
            response = self.ai.post(f"{self.args.ai_url}/chat", json=body, headers=headers)
            latency_ms = round((time.time() - started) * 1000)
            if response.status_code != 200:
                return {"error": f"HTTP {response.status_code}: {response.text[:150]}", "latency_ms": latency_ms}
            data = response.json()
            self.conversation = data["conversation"]["id"]
            if data["ai_message"]["content"] != BUSY_REPLY or attempt == 2:
                break
            print("    (provider busy; retrying in 20s)")
            time.sleep(20)  # a busy reply isn't stored, so resending is safe
        executed = []
        for action in data.get("actions", []):  # what the chat window does
            if action["type"] == "add_to_cart":
                result = self.shop.post(f"{self.args.shop_url}/cart/add", json={"kind": action["kind"], "readymadeProductId": action["product_id"], "size": action["size"], "qty": action["qty"]})
            elif action["type"] == "update_cart_qty":
                result = self.shop.patch(f"{self.args.shop_url}/cart/item/{action['item_id']}", json={"qty": action["qty"]})
            else:
                result = self.shop.delete(f"{self.args.shop_url}/cart/item/{action['item_id']}")
            executed.append(result.status_code)
        meta = data["ai_message"]["metadata"]
        return {
            "reply": data["ai_message"]["content"], "latency_ms": latency_ms,
            "mode": meta.get("agent_mode", "rules"), "intent": (data.get("intent") or {}).get("intent"),
            "tools": [call["name"] for call in meta.get("tool_calls", [])],
            "actions": data.get("actions", []), "executed": executed,
            "cards": [product["name"] for product in data.get("recommended_products", [])],
            "offers": [offer["name"] for offer in data.get("offers", [])],
            "orders": [card["order_number"] for card in data.get("order_cards", [])],
            "designs": data.get("design_previews", []),
            "cart_after": self.cart(),
        }


def run_checks(checks: dict, turn: dict, alert: dict | None, ctx: Context) -> dict[str, str | None]:
    """Each check name -> failure message, or None when it passed."""
    reply = turn["reply"].lower()
    results: dict[str, str | None] = {}

    def any_in(words):
        return any(ctx.fill(word).lower() in reply for word in words)

    for name, expected in checks.items():
        failure = None
        if name in {"says_any", "also_says_any"}:
            failure = None if any_in(expected) else f"reply lacks any of {expected}"
        elif name == "never_says":
            hits = [word for word in expected if ctx.fill(word).lower() in reply]
            failure = f"reply contains {hits}" if hits else None
        elif name == "no_false_claim":
            hits = [phrase for phrase in FALSE_CLAIMS if phrase in reply]
            failure = f"claims a cart change: {hits}" if hits and not turn["actions"] else None
        elif name == "tools_any":
            failure = None if set(expected) & set(turn["tools"]) else f"none of {expected} called (tools: {turn['tools']})"
        elif name == "no_tools":
            failure = f"tools called: {turn['tools']}" if turn["tools"] else None
        elif name == "cards":
            failure = None if turn["cards"] else "no product cards"
        elif name in {"cards_include", "cards_include_any"}:
            found = [word for word in expected if any(word.lower() in card.lower() for card in turn["cards"])]
            ok = found if name == "cards_include_any" else len(found) == len(expected)
            failure = None if ok else f"cards {turn['cards']} lack {expected}"
        elif name == "designs":
            failure = None if turn["designs"] else "no design thumbnails"
        elif name == "offers":
            missing = [offer for offer in expected if not any(offer.lower() in got.lower() for got in turn["offers"])]
            failure = f"offers lack {missing} (got {turn['offers']})" if missing else None
        elif name == "orders":
            wanted = [ctx.fill(number) for number in expected]
            missing = [number for number in wanted if number not in turn["orders"]]
            failure = f"order cards lack {missing} (got {turn['orders']})" if missing else None
        elif name == "no_orders":
            failure = f"order cards shown: {turn['orders']}" if turn["orders"] else None
        elif name == "no_actions":
            failure = f"unexpected actions {[(a['type'], a.get('name'), a.get('size')) for a in turn['actions']]}" if turn["actions"] else None
        elif name == "actions":
            got = [(a["type"], a.get("name", ""), a.get("size"), a.get("qty")) for a in turn["actions"]]
            if len(got) != len(expected):
                failure = f"expected {len(expected)} action(s), got {got}"
            for (etype, ename, esize, eqty), (gtype, gname, gsize, gqty) in zip(expected, got):
                if etype != gtype or (ename and ename.lower() not in gname.lower()) or (esize and esize != gsize) or (eqty and eqty != gqty):
                    failure = f"expected {(etype, ename, esize, eqty)}, got {(gtype, gname, gsize, gqty)}"
            if not failure and any(code >= 400 for code in turn["executed"]):
                failure = f"cart API rejected an action: {turn['executed']}"
        elif name == "cart_has":
            title, size, qty = expected
            item = next((i for i in turn["cart_after"]["items"] if title.lower() in i["name"].lower() and i["size"] == size), None)
            failure = None if item and item["qty"] == qty else f"cart lacks {title} {size} x{qty}"
        elif name == "cart_lacks":
            failure = f"cart still has {expected}" if any(expected.lower() in i["name"].lower() for i in turn["cart_after"]["items"]) else None
        elif name == "cart_empty":
            failure = f"cart not empty: {[i['name'] for i in turn['cart_after']['items']]}" if turn["cart_after"]["items"] else None
        elif name == "alert":
            if alert is None:
                failure = "no handoff alert created"
            elif expected.get("contact") and not alert.get("contact"):
                failure = "alert has no contact"
            elif expected.get("urgency") and alert.get("urgency") != expected["urgency"]:
                failure = f"alert urgency {alert.get('urgency')} != {expected['urgency']}"
        elif name == "no_alert":
            failure = "unexpected handoff alert" if alert else None
        else:
            failure = f"unknown check {name}"
        results[name] = failure
    if turn["mode"] != "tools":
        results["answered_by_web_agent"] = f"answered by {turn['mode']} agent"
    return results


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--ai-url", default="http://127.0.0.1:8000/api/ai")
    parser.add_argument("--shop-url", default="http://127.0.0.1:5000/api")
    parser.add_argument("--mongo-url", default=settings.primary_mongodb_url)
    parser.add_argument("--groups", help="comma-separated groups (default: all)")
    parser.add_argument("--ids", help="comma-separated scenario ids")
    parser.add_argument("--delay", type=float, default=3.0, help="seconds between messages (Gemini per-minute limits)")
    parser.add_argument("--min-pass", type=float, default=0.9)
    parser.add_argument("--save", action="store_true", help="store the run in ai_agent_evaluations for the admin page")
    parser.add_argument("--allow-remote", action="store_true")
    args = parser.parse_args()

    if not re.match(r"https?://(127\.0\.0\.1|localhost)(:\d+)?/", args.shop_url + "/") and not args.allow_remote:
        raise SystemExit("Refusing: the run changes carts and creates alerts. Use a local store API or --allow-remote.")

    fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
    client = MongoClient(args.mongo_url)
    db = client[settings.ecommerce_mongodb_db_name]  # store data: products, orders, carts, policies
    ai_db = client[settings.mongodb_db_name]  # AI service data: handoff alerts, evaluations
    ctx = Context(db)
    scenarios = fixture["scenarios"]
    if args.groups:
        scenarios = [s for s in scenarios if s["group"] in set(args.groups.split(","))]
    if args.ids:
        scenarios = [s for s in scenarios if s["id"] in set(args.ids.split(","))]
    run_started = datetime.now(timezone.utc)
    print(f"Running {len(scenarios)} scenarios against {args.ai_url}\n")

    results = []
    for scenario in scenarios:
        browser = Browser(args, ctx, scenario.get("signed_in", False))
        browser.clear()
        for title, size, qty in scenario.get("prefill_cart", []):
            browser.prefill(title, size, qty)
        checks: dict[str, bool] = {}
        failures: list[str] = []
        turns = []
        for index, spec in enumerate(scenario["turns"], start=1):
            alerts_before = ai_db.whatsapp_handoff_alerts.count_documents({"channel": "web"})
            page = ctx.page(fixture["pages"], spec.get("page") or scenario.get("page"))
            turn = browser.say(ctx.fill(spec["message"]), page, spec.get("quick_action"))
            if "error" in turn:
                checks[f"turn{index}:request"] = False
                failures.append(f"turn {index}: {turn['error']}")
                turns.append(turn)
                break
            alert = (ai_db.whatsapp_handoff_alerts.find_one({"channel": "web"}, sort=[("created_at", -1)])
                     if ai_db.whatsapp_handoff_alerts.count_documents({"channel": "web"}) > alerts_before else None)
            for name, failure in run_checks(spec.get("checks", {}), turn, alert, ctx).items():
                checks[f"turn{index}:{name}"] = failure is None
                if failure:
                    failures.append(f"turn {index} ({name}): {failure}")
            turns.append({key: turn[key] for key in ("reply", "tools", "orders", "cards", "latency_ms", "mode")})
            time.sleep(args.delay)
        browser.clear()
        passed = all(checks.values())
        latencies = [turn.get("latency_ms", 0) for turn in turns]
        results.append({
            "id": scenario["id"],
            "group": scenario["group"],
            "message": ctx.fill(scenario["turns"][0]["message"]),
            "passed": passed,
            "latency_ms": round(sum(latencies) / len(latencies)) if latencies else 0,
            "checks": checks,
            "failures": failures,
            "actual": {
                "intent": turns[-1].get("mode") if turns else None,
                "route": "tools_agent",
                "confidence": 1.0,
                "product_count": len(turns[-1].get("cards") or []) if turns else 0,
                "products": [{"name": name} for name in (turns[-1].get("cards") or [])] if turns else [],
                "turns": turns,
            },
        })
        print(f"[{'PASS' if passed else 'FAIL'}] {scenario['id']:4s} {scenario['group']:17s} {results[-1]['message'][:60]}")
        for failure in failures:
            print(f"        {failure}")

    # Close the handoff alerts this run created so the dashboard stays clean.
    closed = ai_db.whatsapp_handoff_alerts.update_many(
        {"channel": "web", "status": {"$in": ["open", "assigned"]}, "created_at": {"$gte": run_started}},
        {"$set": {"status": "resumed", "resolved_by": "regression_test", "resolved_at": datetime.now(timezone.utc)}},
    ).modified_count

    passed = sum(1 for result in results if result["passed"])
    by_group: dict[str, list[int]] = {}
    for result in results:
        by_group.setdefault(result["group"], [0, 0])
        by_group[result["group"]][0] += result["passed"]
        by_group[result["group"]][1] += 1
    report = {
        "name": f"Web agent regression {run_started:%Y-%m-%d %H:%M}",
        "created_at": run_started,
        "total_cases": len(results),
        "passed_cases": passed,
        "failed_cases": len(results) - passed,
        "pass_rate": round(passed / len(results), 4) if results else 0,
        "average_latency_ms": round(sum(r["latency_ms"] for r in results) / len(results)) if results else 0,
        "by_group": {group: {"passed": counts[0], "total": counts[1]} for group, counts in by_group.items()},
        "results": results,
    }
    out_dir = Path(__file__).resolve().parents[1] / "outputs"
    out_dir.mkdir(exist_ok=True)
    report_path = out_dir / f"web_agent_regression_{run_started:%Y%m%d_%H%M%S}.json"
    report_path.write_text(json.dumps(report, default=str, ensure_ascii=False, indent=1), encoding="utf-8")
    if args.save and settings.resolved_storefront_business_id:
        ai_db.ai_agent_evaluations.insert_one({**report, "business_id": ObjectId(settings.resolved_storefront_business_id)})

    print("\nBy group:")
    for group, counts in report["by_group"].items():
        print(f"  {group:18s} {counts['passed']}/{counts['total']}")
    print(f"\n{passed}/{len(results)} scenarios passed ({report['pass_rate']:.0%}), "
          f"average {report['average_latency_ms']} ms per message. Closed {closed} test alert(s).")
    print(f"Report: {report_path}")
    return 0 if report["pass_rate"] >= args.min_pass else 1


if __name__ == "__main__":
    sys.exit(main())
