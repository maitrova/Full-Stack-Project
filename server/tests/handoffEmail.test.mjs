import test from "node:test";
import assert from "node:assert/strict";
import { buildHandoffEmailParams, sendHandoffEmail } from "../services/handoffEmailService.js";

test("handoff params fill every template variable and tidy the values", () => {
  const params = buildHandoffEmailParams({
    customer_name: "Ravi",
    phone: "919000011111",
    email: "ravi@example.com",
    channel: "whatsapp",
    order_id: "44FE2A88",
    customer_message: "I want to talk to a person",
    summary: "x".repeat(600),
  });
  assert.deepEqual(Object.keys(params).sort(), [
    "CHANNEL", "CONVERSATION_SUMMARY", "CUSTOMER_EMAIL", "CUSTOMER_MESSAGE",
    "CUSTOMER_NAME", "CUSTOMER_PHONE", "ORDER_ID", "REQUESTED_AT",
  ]);
  assert.equal(params.CHANNEL, "WhatsApp");
  assert.equal(params.ORDER_ID, "#44FE2A88");
  assert.equal(params.CUSTOMER_MESSAGE, "I want to talk to a person");
  assert.equal(params.CONVERSATION_SUMMARY.length, 500);
  assert.ok(params.REQUESTED_AT);
});

test("the customer's account fills details the chat did not capture", () => {
  const params = buildHandoffEmailParams(
    { channel: "web", email: "chat@example.com" },
    { name: "Ravi", phone: "9000011111", email: "account@example.com" },
  );
  assert.equal(params.CHANNEL, "website");
  assert.equal(params.CUSTOMER_NAME, "Ravi");
  assert.equal(params.CUSTOMER_PHONE, "9000011111");
  assert.equal(params.CUSTOMER_EMAIL, "chat@example.com");
});

test("missing values show a dash instead of a blank in the email", () => {
  const params = buildHandoffEmailParams({});
  assert.equal(params.CUSTOMER_NAME, "-");
  assert.equal(params.CUSTOMER_PHONE, "-");
  assert.equal(params.ORDER_ID, "-");
});

test("nothing is sent when the template or recipient is not configured", async () => {
  delete process.env.BREVO_HANDOFF_ADMIN_TEMPLATE_ID;
  delete process.env.ADMIN_HANDOFF_EMAIL;
  assert.deepEqual(await sendHandoffEmail({}), { sent: false, reason: "not_configured" });
});
