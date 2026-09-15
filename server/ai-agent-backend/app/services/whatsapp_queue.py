"""Durable, bounded retries; per-customer leases serialize conversations."""
import asyncio
import hashlib
import logging
from datetime import datetime, timedelta, timezone
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError
from app.config.settings import settings
from app.utils.object_id import parse_object_id

logger = logging.getLogger(__name__)


async def enqueue(db, payload):
    count = 0
    if payload.get("object") != "whatsapp_business_account":
        return count
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            for message in value.get("messages", []):
                if not message.get("id") or not message.get("from"):
                    continue
                now = datetime.now(timezone.utc)
                item = {"object": payload["object"], "entry": [{"id": entry.get("id"), "changes": [{"value": {**value, "messages": [message]}}]}]}
                try:
                    business_id = parse_object_id(settings.whatsapp_business_id) if settings.whatsapp_business_id else None
                    await db.whatsapp_jobs.insert_one({"_id": message["id"], "business_id": business_id, "sender": hashlib.sha256(message["from"].encode()).hexdigest(), "payload": item, "status": "ready", "attempts": 0, "available_at": now, "created_at": now})
                    count += 1
                except DuplicateKeyError:
                    pass
    return count


async def worker(db):
    from app.services.whatsapp_service import WhatsAppService
    await db.whatsapp_jobs.create_index([("status", 1), ("available_at", 1)])
    await db.whatsapp_sender_locks.create_index("expires_at", expireAfterSeconds=0)
    while True:
        job = None
        locked = False
        try:
            now = datetime.now(timezone.utc)
            await db.whatsapp_jobs.update_many({"status": "processing", "lease_until": {"$lte": now}, "attempts": {"$gte": 5}}, {"$set": {"status": "failed", "error_type": "LeaseExpired"}})
            job = await db.whatsapp_jobs.find_one_and_update(
                {"$or": [{"status": "ready", "available_at": {"$lte": now}}, {"status": "processing", "lease_until": {"$lte": now}}], "attempts": {"$lt": 5}},
                {"$set": {"status": "processing", "lease_until": now + timedelta(minutes=5)}, "$inc": {"attempts": 1}},
                sort=[("created_at", 1)], return_document=ReturnDocument.AFTER,
            )
            if not job:
                await asyncio.sleep(1)
                continue
            earlier = await db.whatsapp_jobs.find_one({"sender": job["sender"], "created_at": {"$lt": job["created_at"]}, "status": {"$in": ["ready", "processing"]}})
            if earlier:
                await db.whatsapp_jobs.update_one({"_id": job["_id"]}, {"$set": {"status": "ready", "available_at": now + timedelta(seconds=5)}, "$inc": {"attempts": -1}})
                continue
            try:
                await db.whatsapp_sender_locks.insert_one({"_id": job["sender"], "expires_at": now + timedelta(minutes=5)})
                locked = True
            except DuplicateKeyError:
                await db.whatsapp_jobs.update_one({"_id": job["_id"]}, {"$set": {"status": "ready", "available_at": now + timedelta(seconds=5)}, "$inc": {"attempts": -1}})
                continue
            result = await asyncio.wait_for(WhatsAppService(db).handle_webhook(job["payload"]), timeout=180)
            if result.get("status") == "configuration_error":
                raise RuntimeError("WhatsApp business configuration missing")
            await db.whatsapp_jobs.update_one({"_id": job["_id"]}, {"$set": {"status": "complete", "completed_at": datetime.now(timezone.utc)}})
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.error("WhatsApp job failed (%s)", type(exc).__name__)
            if job:
                await db.whatsapp_jobs.update_one({"_id": job["_id"]}, {"$set": {"status": "failed" if job["attempts"] >= 5 else "ready", "available_at": datetime.now(timezone.utc) + timedelta(seconds=min(60, 2 ** job["attempts"])), "error_type": type(exc).__name__}})
            await asyncio.sleep(1)
        finally:
            if job and locked:
                await db.whatsapp_sender_locks.delete_one({"_id": job["sender"]})
