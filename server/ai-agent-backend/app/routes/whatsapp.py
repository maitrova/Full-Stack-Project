from typing import Any
import hashlib
import hmac
import json

from fastapi import APIRouter, Depends, Query, Request, HTTPException
from app.config.settings import settings
from app.services.whatsapp_queue import enqueue
from fastapi.responses import PlainTextResponse

from app.database.mongodb import get_database
from app.services.whatsapp_service import WhatsAppService

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])


def get_whatsapp_service() -> WhatsAppService:
    return WhatsAppService(get_database())


@router.get("/webhook")
async def verify_webhook(
    hub_mode: str | None = Query(default=None, alias="hub.mode"),
    hub_verify_token: str | None = Query(default=None, alias="hub.verify_token"),
    hub_challenge: str | None = Query(default=None, alias="hub.challenge"),
    whatsapp_service: WhatsAppService = Depends(get_whatsapp_service),
):
    return PlainTextResponse(whatsapp_service.verify_webhook(hub_mode, hub_verify_token, hub_challenge))


@router.post("/webhook")
async def receive_webhook(
    request: Request,
):
    if not settings.whatsapp_app_secret:
        raise HTTPException(503, "WhatsApp webhook signature verification is not configured")
    raw = await request.body()
    if len(raw) > 1024 * 1024:
        raise HTTPException(413, "Webhook payload too large")
    expected = "sha256=" + hmac.new(settings.whatsapp_app_secret.encode(), raw, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, request.headers.get("x-hub-signature-256", "")):
        raise HTTPException(403, "Invalid webhook signature")
    try:
        payload = json.loads(raw)
        if not isinstance(payload, dict):
            raise ValueError()
    except ValueError:
        raise HTTPException(400, "Invalid JSON")
    count = await enqueue(get_database(), payload)
    return {"status": "accepted", "queued": count}
