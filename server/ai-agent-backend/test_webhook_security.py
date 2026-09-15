import hashlib
import hmac
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.routes.whatsapp import router


class WebhookSecurity(unittest.TestCase):
    def test_signed_payload_only(self):
        app = FastAPI()
        app.include_router(router)
        client = TestClient(app)
        body = b'{"object":"whatsapp_business_account","entry":[]}'
        signature = "sha256=" + hmac.new(b"test-secret", body, hashlib.sha256).hexdigest()
        with patch("app.routes.whatsapp.settings", SimpleNamespace(whatsapp_app_secret="test-secret")), patch("app.routes.whatsapp.get_database", return_value=None), patch("app.routes.whatsapp.enqueue", new=AsyncMock(return_value=0)) as queue:
            self.assertEqual(client.post("/whatsapp/webhook", content=body).status_code, 403)
            queue.assert_not_awaited()
            self.assertEqual(client.post("/whatsapp/webhook", content=body, headers={"x-hub-signature-256": signature}).status_code, 200)
            self.assertEqual(queue.await_count, 1)
            self.assertEqual(client.post("/whatsapp/webhook", content=body + b" ", headers={"x-hub-signature-256": signature}).status_code, 403)

    def test_missing_secret_fails_closed(self):
        app = FastAPI()
        app.include_router(router)
        with patch("app.routes.whatsapp.settings", SimpleNamespace(whatsapp_app_secret=None)):
            self.assertEqual(TestClient(app).post("/whatsapp/webhook", json={}).status_code, 503)


if __name__ == "__main__":
    unittest.main()
