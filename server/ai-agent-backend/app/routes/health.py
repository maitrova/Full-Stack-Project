from fastapi import APIRouter, HTTPException, status
from pymongo.errors import PyMongoError

from app.config.settings import settings
from app.database.mongodb import get_database, get_ecommerce_database

router = APIRouter(tags=["health"])


@router.get("/health", status_code=status.HTTP_200_OK)
async def health_check():
    return {
        "status": "ok",
        "service": settings.app_name,
        "environment": settings.app_env,
    }


@router.get("/health/db", status_code=status.HTTP_200_OK)
async def database_health_check():
    db = get_database()
    try:
        await db.command("ping")
    except PyMongoError:
        raise

    return {
        "status": "ok",
        "database": settings.mongodb_db_name,
    }


@router.get("/health/ready", status_code=status.HTTP_200_OK)
async def readiness_check():
    """Readiness requires both conversation and catalogue databases."""
    try:
        await get_database().command("ping")
        await get_ecommerce_database().command("ping")
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail="database unavailable") from exc

    missing = []
    if not settings.gemini_api_key and not settings.openai_api_key:
        missing.append("AI provider")
    if not settings.whatsapp_access_token or not settings.whatsapp_phone_number_id:
        missing.append("WhatsApp")
    if missing and settings.app_env.lower() == "production":
        raise HTTPException(status_code=503, detail=f"missing configuration: {', '.join(missing)}")
    return {"status": "ready", "service": settings.app_name}
