import asyncio
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.database.mongodb import close_mongo_connection, connect_to_mongo, get_database


async def main() -> None:
    await connect_to_mongo()
    businesses = await get_database().businesses.find({}, {"business_name": 1}).to_list(length=50)
    for business in businesses:
        print(f"{business.get('business_name', '<unnamed>')} {business['_id']}")
    await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(main())
