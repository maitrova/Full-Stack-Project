"""Move website chat data from per-shopper storefront records to the real store.

Before the website chat used a configured storefront tenant, every signed-in
shopper who opened the chat got their own "Maitrova" business record, and their
conversations, leads, and metrics were filed under it. This script moves that
data to STOREFRONT_BUSINESS_ID (or WHATSAPP_BUSINESS_ID).

Usage:
    python scripts/merge_shopper_storefronts.py            # dry run, prints what would move
    python scripts/merge_shopper_storefronts.py --apply    # move the data
    python scripts/merge_shopper_storefronts.py --apply --delete-empty
                                                           # also delete the emptied records

A record is only deleted when it was auto-created by the chat (its description
matches) and has no merchant settings such as ai_prompt_config.
"""

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.config.settings import settings
from app.database.mongodb import close_mongo_connection, connect_to_mongo, get_database
from app.utils.object_id import parse_object_id

AUTO_DESCRIPTION = "Maitrova storefront AI sales agent"
MOVED_COLLECTIONS = ("conversations", "messages", "whatsapp_handoff_alerts", "ai_agent_metrics", "ai_action_audit")
MERCHANT_FIELDS = ("ai_prompt_config", "phone", "email", "website")


async def main(apply: bool, delete_empty: bool) -> None:
    target_id = settings.resolved_storefront_business_id
    if not target_id:
        raise SystemExit("Set STOREFRONT_BUSINESS_ID or WHATSAPP_BUSINESS_ID first.")
    await connect_to_mongo()
    try:
        database = get_database()
        target = parse_object_id(target_id)
        if await database.businesses.find_one({"_id": target}) is None:
            raise SystemExit(f"Storefront business {target_id} does not exist.")

        sources = await database.businesses.find(
            {"description": AUTO_DESCRIPTION, "_id": {"$ne": target}}
        ).to_list(length=None)
        print(f"Target storefront: {target_id}")
        print(f"Auto-created shopper storefronts: {len(sources)}")

        for source in sources:
            source_id = source["_id"]
            counts = {
                name: await database[name].count_documents({"business_id": source_id})
                for name in MOVED_COLLECTIONS
            }
            has_merchant_data = any(source.get(field) for field in MERCHANT_FIELDS)
            print(f"- {source_id} owner={source.get('owner_id')} {counts}"
                  + (" [has merchant settings, will not delete]" if has_merchant_data else ""))
            if not apply:
                continue
            for name in MOVED_COLLECTIONS:
                if counts[name]:
                    await database[name].update_many(
                        {"business_id": source_id},
                        {"$set": {"business_id": target, "migrated_from_business_id": source_id}},
                    )
            # Link the moved web conversations to the shopper who owned the record.
            await database.conversations.update_many(
                {"business_id": target, "migrated_from_business_id": source_id, "channel": "web", "customer_id": None},
                {"$set": {"customer_id": source.get("owner_id")}},
            )
            if delete_empty and not has_merchant_data:
                await database.businesses.delete_one({"_id": source_id, "description": AUTO_DESCRIPTION})
                print(f"  deleted {source_id}")

        if not apply:
            print("Dry run only. Re-run with --apply to move the data.")
    finally:
        await close_mongo_connection()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true", help="move the data (default is a dry run)")
    parser.add_argument("--delete-empty", action="store_true", help="delete emptied auto-created records")
    args = parser.parse_args()
    asyncio.run(main(args.apply, args.delete_empty))
