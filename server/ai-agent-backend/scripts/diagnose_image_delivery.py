"""Read-only delivery diagnostics; never prints keys, phone numbers or message content."""
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from motor.motor_asyncio import AsyncIOMotorClient
from app.config.settings import settings


async def main():
    print(json.dumps({"configured": {
        "gemini": bool(settings.gemini_api_key),
        "whatsapp_sender": bool(settings.whatsapp_access_token and settings.whatsapp_phone_number_id),
        "business": bool(settings.whatsapp_business_id),
    }}))
    client = None
    try:
        client = AsyncIOMotorClient(settings.primary_mongodb_url, serverSelectionTimeoutMS=5000)
        db = client[settings.mongodb_db_name]
        await client.admin.command("ping")
        jobs = await db.whatsapp_jobs.find({}, {
            "_id": 0, "status": 1, "attempts": 1, "error_type": 1,
            "created_at": 1, "completed_at": 1,
        }).sort("created_at", -1).limit(8).to_list(8)
        print(json.dumps({"recent_jobs": jobs}, default=str))
        statuses = await db.conversations.aggregate([
            {"$group": {"_id": "$status", "count": {"$sum": 1}}}
        ]).to_list(20)
        print(json.dumps({"conversation_status_counts": statuses}, default=str))
    except Exception as exc:
        print(json.dumps({"diagnostic_error": type(exc).__name__}))
        return 1
    finally:
        if client is not None:
            client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
