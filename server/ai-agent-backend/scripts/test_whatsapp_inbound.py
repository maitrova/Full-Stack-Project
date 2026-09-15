import asyncio
import os
import sys
import uuid
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.database.mongodb import close_mongo_connection, connect_to_mongo, get_database
from app.services.whatsapp_service import WhatsAppService


async def main() -> None:
    to_phone = os.getenv("TEST_WHATSAPP_TO")
    if not to_phone:
        raise SystemExit("Set TEST_WHATSAPP_TO to your WhatsApp number, for example: $env:TEST_WHATSAPP_TO='917816085630'")

    await connect_to_mongo()
    service = WhatsAppService(get_database())
    payload = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "metadata": {
                                "phone_number_id": service.client.phone_number_id,
                            },
                            "contacts": [
                                {
                                    "wa_id": to_phone,
                                    "profile": {"name": "Test Customer"},
                                }
                            ],
                            "messages": [
                                {
                                    "from": to_phone,
                                    "id": f"local-test-{uuid.uuid4().hex}",
                                    "timestamp": "1724839800",
                                    "type": "text",
                                    "text": {"body": "show sarees under 2000"},
                                }
                            ],
                        }
                    }
                ]
            }
        ],
    }
    result = await service.handle_webhook(payload)
    print(result)
    await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(main())
