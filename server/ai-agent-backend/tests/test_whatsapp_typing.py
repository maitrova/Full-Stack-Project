import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.services.whatsapp_service import WhatsAppClient, WhatsAppService


class TypingIndicatorTests(unittest.IsolatedAsyncioTestCase):
    async def test_marks_message_read_with_typing_indicator(self):
        client = WhatsAppClient(access_token="token", phone_number_id="phone")
        with patch.object(client, "_send_message_payload", AsyncMock()) as send:
            await client.send_typing_indicator("wamid.1")
        send.assert_awaited_once_with({
            "messaging_product": "whatsapp",
            "status": "read",
            "message_id": "wamid.1",
            "typing_indicator": {"type": "text"},
        })

    async def test_skipped_when_sender_not_configured(self):
        client = WhatsAppClient(access_token="token", phone_number_id="phone")
        client.access_token = None
        with patch.object(client, "_send_message_payload", AsyncMock()) as send:
            await client.send_typing_indicator("wamid.1")
        send.assert_not_awaited()

    async def test_failure_never_blocks_the_reply(self):
        service = WhatsAppService.__new__(WhatsAppService)
        service.client = SimpleNamespace(send_typing_indicator=AsyncMock(side_effect=RuntimeError("meta down")))
        await service._show_typing("wamid.1")  # must not raise

    async def test_indicator_timeout_is_swallowed(self):
        service = WhatsAppService.__new__(WhatsAppService)
        service.client = SimpleNamespace(send_typing_indicator=AsyncMock(side_effect=asyncio.TimeoutError))
        await service._show_typing("wamid.1")
        service.client.send_typing_indicator.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()
