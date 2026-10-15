from typing import Any
import hashlib
import hmac
import json

from fastapi import APIRouter, Depends, Query, Request, HTTPException
from app.config.settings import settings
from app.services.whatsapp_queue import enqueue
from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import BaseModel, Field

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


def require_internal_key(request: Request) -> None:
    """Calls from the store backend, authenticated with the shared commerce key."""
    expected = settings.whatsapp_commerce_key or ""
    if not expected or not hmac.compare_digest(expected, request.headers.get("x-commerce-key", "")):
        raise HTTPException(401, "Unauthorized")


def get_outbound():
    from app.database.mongodb import get_ecommerce_database
    from app.services.whatsapp_outbound import WhatsAppOutbound

    return WhatsAppOutbound(get_database(), get_ecommerce_database())


class TeamReply(BaseModel):
    conversation_id: str
    text: str = Field(min_length=1, max_length=4096)
    admin_id: str | None = None
    admin_name: str | None = Field(default=None, max_length=120)


class OrderUpdate(BaseModel):
    user_id: str
    order_id: str
    event: str = Field(min_length=1, max_length=40)
    total: str | None = Field(default=None, max_length=40)


@router.post("/internal/team-reply", dependencies=[Depends(require_internal_key)])
async def team_reply(payload: TeamReply, outbound=Depends(get_outbound)):
    from app.services.whatsapp_outbound import OutboundError

    try:
        return await outbound.team_reply(payload.conversation_id, payload.text, payload.admin_id, payload.admin_name)
    except OutboundError as exc:
        return JSONResponse({"message": exc.message, **exc.extra}, status_code=exc.status_code)


@router.post("/internal/order-update", dependencies=[Depends(require_internal_key)])
async def order_update(payload: OrderUpdate, outbound=Depends(get_outbound)):
    from app.services.whatsapp_outbound import OutboundError

    try:
        return await outbound.order_update(payload.user_id, payload.order_id, payload.event, payload.total)
    except OutboundError as exc:
        return JSONResponse({"message": exc.message, **exc.extra}, status_code=exc.status_code)
