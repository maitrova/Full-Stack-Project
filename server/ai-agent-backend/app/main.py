from contextlib import asynccontextmanager
import logging
import asyncio
from contextlib import suppress
from app.services.whatsapp_queue import worker
from app.services.catalog_indexer import catalog_index_worker

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config.settings import settings
from app.database.mongodb import close_mongo_connection, connect_to_mongo, get_database, get_ecommerce_database
from app.middleware.error_handlers import register_error_handlers
from app.repositories.business_repository import BusinessRepository
from app.repositories.conversation_repository import ConversationRepository
from app.repositories.message_repository import MessageRepository
from app.repositories.order_repository import OrderRepository
from app.repositories.product_repository import ProductRepository
from app.repositories.user_repository import UserRepository
from app.routes import ai, auth, business, conversations, health, orders, products, whatsapp

logging.basicConfig(
    level=settings.logging_level,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting %s", settings.app_name)
    await connect_to_mongo()
    await UserRepository(get_database()).ensure_indexes()
    business_repository = BusinessRepository(get_database())
    await business_repository.ensure_indexes()
    if settings.whatsapp_business_id:
        business, created = await business_repository.ensure_whatsapp_business(
            business_id=settings.whatsapp_business_id,
            business_name=settings.whatsapp_business_name,
            business_type=settings.whatsapp_business_type,
        )
        if created:
            logger.info("Created configured WhatsApp business %s", business["_id"])
    await ProductRepository(get_database()).ensure_indexes()
    await ConversationRepository(get_database()).ensure_indexes()
    await MessageRepository(get_database()).ensure_indexes()
    await OrderRepository(get_database()).ensure_indexes()
    await get_database().whatsapp_outbound_context.create_index("expires_at", expireAfterSeconds=0)
    await get_ecommerce_database().whatsapp_link_requests.create_index("expiresAt", expireAfterSeconds=0)
    await get_ecommerce_database().whatsapp_account_links.create_index("expiresAt", expireAfterSeconds=0)
    await get_ecommerce_database().whatsapp_order_subscriptions.create_index("user", unique=False)
    await get_ecommerce_database().whatsapp_notification_log.create_index("sentAt", expireAfterSeconds=15552000)
    await get_ecommerce_database().whatsapp_link_rate_limits.create_index("expiresAt", expireAfterSeconds=0)
    await get_database().whatsapp_rate_limits.create_index("expires_at", expireAfterSeconds=0)
    await get_database().whatsapp_handoff_alerts.create_index([("business_id", 1), ("status", 1), ("created_at", -1)])
    await get_database().ai_agent_metrics.create_index([("business_id", 1), ("created_at", -1)])
    await get_database().ai_agent_metrics.create_index("created_at", expireAfterSeconds=15552000)
    whatsapp_worker = asyncio.create_task(worker(get_database()))
    catalogue_worker = asyncio.create_task(catalog_index_worker(get_ecommerce_database()))
    try:
        yield
    finally:
        whatsapp_worker.cancel()
        catalogue_worker.cancel()
        with suppress(asyncio.CancelledError):
            await whatsapp_worker
        with suppress(asyncio.CancelledError):
            await catalogue_worker
        await close_mongo_connection()
    logger.info("Stopped %s", settings.app_name)


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        debug=settings.debug,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_error_handlers(app)
    app.include_router(health.router, prefix=settings.api_prefix)
    app.include_router(auth.router, prefix=settings.api_prefix)
    app.include_router(business.router, prefix=settings.api_prefix)
    app.include_router(products.router, prefix=settings.api_prefix)
    app.include_router(conversations.router, prefix=settings.api_prefix)
    app.include_router(ai.router, prefix=settings.api_prefix)
    app.include_router(orders.router, prefix=settings.api_prefix)
    app.include_router(whatsapp.router, prefix=settings.api_prefix)

    return app


app = create_app()
