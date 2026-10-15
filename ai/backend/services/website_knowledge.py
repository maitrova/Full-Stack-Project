"""Read-only synchronization of public website content for store answers."""

import asyncio
import hashlib
import logging
import re
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit

import httpx
from pymongo import ReturnDocument

from app.config.settings import settings
from app.ai.gemini_client import GeminiClient

logger = logging.getLogger(__name__)


class WebsiteKnowledgeSync:
    def __init__(self, database):
        self.database = database
        self.collection = database.ai_website_knowledge
        self.locks = database.ai_background_locks
        self.embedding_client = GeminiClient()

    async def ensure_indexes(self) -> None:
        await self.collection.create_index([("source_url", 1), ("chunk_index", 1)], unique=True)
        await self.collection.create_index([("status", 1), ("updated_at", -1)])
        await self.collection.create_index("source_url")

    @staticmethod
    def configured_urls() -> list[str]:
        urls = [item.strip() for item in settings.website_knowledge_urls.split(",") if item.strip()]
        return [url for url in urls if urlsplit(url).scheme in {"http", "https"}]

    @staticmethod
    def clean_html(html: str) -> str:
        text = re.sub(r"<(script|style|noscript)\b[^>]*>.*?</\1>", " ", html, flags=re.I | re.S)
        text = re.sub(r"<[^>]+>", " ", text)
        text = re.sub(r"\s+", " ", text)
        return text.strip()

    @staticmethod
    def chunk_text(text: str, size: int | None = None) -> list[str]:
        chunk_size = size or settings.website_knowledge_chunk_size
        return [text[index:index + chunk_size].strip() for index in range(0, len(text), chunk_size) if text[index:index + chunk_size].strip()]

    async def sync_once(self) -> dict:
        if not self.configured_urls():
            return {"configured_urls": 0, "synced_chunks": 0, "failed_urls": 0}
        if not await self._acquire_lease():
            return {"configured_urls": len(self.configured_urls()), "synced_chunks": 0, "failed_urls": 0, "skipped": True}

        synced = 0
        failed = 0
        active_keys: list[dict] = []
        async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
            for url in self.configured_urls():
                try:
                    response = await client.get(url, headers={"User-Agent": "Maitrova-AI-Knowledge-Sync/1.0"})
                    response.raise_for_status()
                    content = self.clean_html(response.text)
                    if not content:
                        continue
                    title_match = re.search(r"<title[^>]*>(.*?)</title>", response.text, flags=re.I | re.S)
                    title = self.clean_html(title_match.group(1)) if title_match else url
                    for index, chunk in enumerate(self.chunk_text(content)):
                        key = {"source_url": url, "chunk_index": index}
                        active_keys.append(key)
                        fingerprint = hashlib.sha256(chunk.encode("utf-8")).hexdigest()
                        existing = await self.collection.find_one(key, {"content_hash": 1, "embedding": 1})
                        update = {
                            "source_url": url,
                            "title": title[:200],
                            "content": chunk,
                            "content_hash": fingerprint,
                            "status": "active",
                            "fetched_at": datetime.now(timezone.utc),
                            "updated_at": datetime.now(timezone.utc),
                        }
                        if not (
                            existing
                            and existing.get("content_hash") == fingerprint
                            and existing.get("embedding")
                        ) and self.embedding_client.supports_embeddings:
                            try:
                                update["embedding"] = await self.embedding_client.embed_content(
                                    text=f"{title}\n{chunk}"
                                )
                                update["embedding_model"] = settings.gemini_embedding_model
                                update["embedding_status"] = "ready"
                            except Exception as exc:
                                # Knowledge remains usable through keyword
                                # retrieval even when embeddings are unavailable.
                                logger.warning(
                                    "Website knowledge embedding failed for %s: %s",
                                    url,
                                    exc.__class__.__name__,
                                )
                                update["embedding_status"] = "unavailable"
                                update["embedding_error"] = exc.__class__.__name__
                        elif not existing or not existing.get("embedding"):
                            update["embedding_status"] = "unavailable"
                            update["embedding_error"] = "provider_not_configured"
                        await self.collection.update_one(key, {"$set": update}, upsert=True)
                        synced += 1
                except Exception as exc:
                    failed += 1
                    logger.warning("Website knowledge sync failed for %s: %s", url, exc.__class__.__name__)
        if active_keys:
            await self.collection.update_many(
                {"source_url": {"$in": self.configured_urls()}, "_id": {"$nin": [key for key in []]}},
                {"$set": {"status": "stale"}},
            )
            # Restore only keys observed in this run; stale chunks are never
            # returned to customers until their source is successfully fetched.
            for key in active_keys:
                await self.collection.update_one(key, {"$set": {"status": "active"}})
        await self.locks.delete_one({"_id": "website-knowledge-sync"})
        return {"configured_urls": len(self.configured_urls()), "synced_chunks": synced, "failed_urls": failed}

    async def _acquire_lease(self) -> bool:
        now = datetime.now(timezone.utc)
        lease = await self.locks.find_one_and_update(
            {"_id": "website-knowledge-sync", "$or": [{"expires_at": {"$lte": now}}, {"expires_at": {"$exists": False}}]},
            {"$set": {"expires_at": now + timedelta(minutes=5), "updated_at": now}},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        return bool(lease)


async def website_knowledge_worker(database) -> None:
    sync = WebsiteKnowledgeSync(database)
    await sync.ensure_indexes()
    while True:
        try:
            result = await sync.sync_once()
            if result.get("synced_chunks"):
                logger.info("Synchronized %s website knowledge chunks", result["synced_chunks"])
        except Exception as exc:
            logger.warning("Website knowledge sync pass failed: %s", exc.__class__.__name__)
        await asyncio.sleep(max(300, settings.website_knowledge_sync_interval_seconds))
