"""Backfill derived search attributes without modifying ecommerce products."""

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))

from app.config.settings import settings
from app.database.mongodb import close_mongo_connection, connect_to_mongo, get_ecommerce_database
from app.services.catalog_indexer import CatalogIndexer


async def run(limit: int | None, passes: int) -> None:
    await connect_to_mongo()
    try:
        indexer = CatalogIndexer(get_ecommerce_database())
        await indexer.ensure_indexes()
        total = 0
        for _ in range(max(1, passes)):
            count = await indexer.run_once(limit=limit)
            total += count
            print(f"indexed={count} total={total}")
            if count == 0:
                break
        print(f"catalogue backfill complete: {total} records updated")
    finally:
        await close_mongo_connection()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int, default=None, help="maximum products per pass")
    parser.add_argument("--passes", type=int, default=100, help="maximum indexing passes")
    args = parser.parse_args()
    asyncio.run(run(args.limit, args.passes))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
