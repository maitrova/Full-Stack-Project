import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from bson import ObjectId

from app.ai.web_agent import whatsapp_tools_enabled
from app.config.settings import settings
from app.services.web_agent_monitor import web_agent_summary
from app.services.whatsapp_monitor import whatsapp_health
from app.services.whatsapp_queue import record_delivery_failures

TEST_DB = "appdb_w5_unittest"


class RolloutTests(unittest.TestCase):
    def test_allowlisted_numbers_get_the_new_agent_first(self):
        with patch.object(settings, "whatsapp_agent_mode", "rules"), patch.object(settings, "whatsapp_agent_rollout_percent", 0), \
                patch.object(settings, "whatsapp_agent_allowlist", "+91 90000 11111, 9876543210"):
            self.assertTrue(whatsapp_tools_enabled("919000011111"))
            self.assertTrue(whatsapp_tools_enabled("919876543210"))
            self.assertFalse(whatsapp_tools_enabled("919000022222"))
        with patch.object(settings, "whatsapp_agent_mode", "rules"), patch.object(settings, "whatsapp_agent_rollout_percent", 100), \
                patch.object(settings, "whatsapp_agent_allowlist", ""):
            self.assertTrue(whatsapp_tools_enabled("919000022222"))


class MonitorTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        from motor.motor_asyncio import AsyncIOMotorClient

        self.mongo = AsyncIOMotorClient("mongodb://127.0.0.1:27017", serverSelectionTimeoutMS=1500)
        try:
            await self.mongo.admin.command("ping")
        except Exception:
            self.skipTest("local MongoDB is not running")
        await self.mongo.drop_database(TEST_DB)
        self.db = self.mongo[TEST_DB]
        self.business = ObjectId()
        self.since = datetime.now(timezone.utc) - timedelta(hours=24)

    async def asyncTearDown(self):
        await self.mongo.drop_database(TEST_DB)
        self.mongo.close()

    async def test_agent_metrics_are_split_by_channel(self):
        now = datetime.now(timezone.utc)
        rows = [
            {"agent_mode": "tools", "latency_ms": 900},  # older rows have no channel: website
            {"agent_mode": "tools", "channel": "web", "latency_ms": 1100},
            {"agent_mode": "tools", "channel": "whatsapp", "latency_ms": 2000, "account_links_sent": 1},
            {"agent_mode": "tools_fallback", "channel": "whatsapp", "reason": "whatsapp_commerce"},
        ]
        await self.db.ai_agent_metrics.insert_many([{**row, "business_id": self.business, "created_at": now} for row in rows])
        web = await web_agent_summary(self.db, self.business, self.since)
        whatsapp = await web_agent_summary(self.db, self.business, self.since, channel="whatsapp")
        self.assertEqual((web["replies"], web["fallbacks"]), (2, 0))
        self.assertEqual((whatsapp["replies"], whatsapp["fallbacks"], whatsapp["account_links_sent"]), (1, 1, 1))
        self.assertTrue(all(alert["code"].startswith("whatsapp_") for alert in whatsapp["alerts"]))

    async def test_failed_deliveries_are_recorded_once_without_personal_data(self):
        statuses = [
            {"id": "wamid.1", "status": "failed", "recipient_id": "919000011111", "errors": [{"code": 132001, "title": "Template name does not exist"}]},
            {"id": "wamid.1", "status": "failed", "errors": [{"code": 132001}]},
            {"id": "wamid.2", "status": "delivered"},
        ]
        await record_delivery_failures(self.db, statuses)
        rows = await self.db.whatsapp_delivery_failures.find().to_list(10)
        self.assertEqual(len(rows), 1)
        self.assertNotIn("recipient_id", rows[0])
        self.assertEqual(rows[0]["error_code"], 132001)

    async def test_health_flags_templates_window_skips_queue_and_waiting_customers(self):
        now = datetime.now(timezone.utc)
        await record_delivery_failures(self.db, [
            {"id": "wamid.t", "status": "failed", "errors": [{"code": 132001}]},
            {"id": "wamid.w", "status": "failed", "errors": [{"code": 131047}]},
        ])
        await self.db.whatsapp_notification_log.insert_many([
            {"_id": "a", "status": "sent", "kind": "text", "created_at": now},
            {"_id": "b", "status": "skipped", "reason": "template_required", "created_at": now},
            {"_id": "c", "status": "failed", "reason": "meta_http_400", "created_at": now},
        ])
        await self.db.whatsapp_jobs.insert_one({"_id": "job", "status": "ready", "created_at": now - timedelta(minutes=10)})
        await self.db.whatsapp_handoff_alerts.insert_one({"business_id": self.business, "channel": "whatsapp", "status": "open",
                                                          "created_at": now - timedelta(hours=3)})
        health = await whatsapp_health(self.db, self.db, self.business, self.since)
        self.assertEqual((health["template_failures"], health["window_closed_failures"]), (1, 1))
        self.assertEqual(health["order_updates"]["sent_text"], 1)
        self.assertEqual(health["order_updates"]["skipped_window_closed"], 1)
        self.assertEqual(health["handoffs"]["waiting"], 1)
        codes = {alert["code"] for alert in health["alerts"]}
        self.assertEqual(codes, {"whatsapp_queue_stuck", "whatsapp_template_rejected", "whatsapp_updates_need_template",
                                 "whatsapp_updates_failed", "whatsapp_handoff_waiting"})

    async def test_quiet_day_has_no_alerts(self):
        health = await whatsapp_health(self.db, self.db, self.business, self.since)
        self.assertEqual(health["alerts"], [])


if __name__ == "__main__":
    unittest.main()
