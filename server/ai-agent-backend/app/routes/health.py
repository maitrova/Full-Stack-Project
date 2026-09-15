from fastapi import APIRouter, status
from pymongo.errors import PyMongoError

from app.config.settings import settings
from app.database.mongodb import get_database

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
