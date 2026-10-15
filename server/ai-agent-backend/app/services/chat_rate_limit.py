"""Fixed-window rate limits for the public website chat."""

import hashlib
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.config.settings import settings

COLLECTION = "ai_chat_rate_limits"


def client_ip(request: Request) -> str:
    """Best-effort client address behind the ingress.

    X-Real-IP is set by the ingress from the connecting address. The
    left-most X-Forwarded-For entry can be supplied by the client, so it is
    only used when X-Real-IP is absent.
    """
    real_ip = (request.headers.get("x-real-ip") or "").strip()
    if real_ip:
        return real_ip
    forwarded = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    if forwarded:
        return forwarded
    return request.client.host if request.client else "unknown"


async def _hit(database: AsyncIOMotorDatabase, scope: str, key: str, window: str, now: datetime) -> int:
    if window == "minute":
        bucket, ttl = now.strftime("%Y%m%d%H%M"), timedelta(minutes=2)
    else:
        bucket, ttl = now.strftime("%Y%m%d"), timedelta(days=2)
    record_id = hashlib.sha256(f"{scope}:{key}:{window}:{bucket}".encode()).hexdigest()
    record = await database[COLLECTION].find_one_and_update(
        {"_id": record_id},
        {"$inc": {"count": 1}, "$setOnInsert": {"created_at": now, "expires_at": now + ttl}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return int(record.get("count") or 0)


async def enforce_chat_rate_limit(database: AsyncIOMotorDatabase, request: Request, session_id: str) -> None:
    """Raise 429 when a browser session or client address sends too much."""
    now = datetime.now(timezone.utc)
    ip = client_ip(request)
    limits = [
        ("session", session_id, "minute", settings.ai_chat_session_messages_per_minute),
        ("session", session_id, "day", settings.ai_chat_session_messages_per_day),
        ("ip", ip, "minute", settings.ai_chat_ip_messages_per_minute),
        ("ip", ip, "day", settings.ai_chat_ip_messages_per_day),
    ]
    for scope, key, window, limit in limits:
        if limit > 0 and await _hit(database, scope, key, window, now) > limit:
            detail = (
                "You're sending messages too quickly. Please wait a minute and try again."
                if window == "minute"
                else "You've reached today's chat limit. Please try again tomorrow or contact our team."
            )
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=detail)
