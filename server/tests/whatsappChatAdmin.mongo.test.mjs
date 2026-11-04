// Runs the chat admin controller against a real local MongoDB, because the
// ownership filter and list lookup can't be proven with a fake. Uses a throwaway
// database that is dropped afterwards, and skips if no local MongoDB is running.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  getWhatsAppChat,
  listWhatsAppChats,
  retryWhatsAppReply,
  sendWhatsAppReply,
  updateWhatsAppChat,
} from "../controllers/whatsappChatAdminController.js";

const DB_NAME = `wa_inbox_test_${process.pid}_${Date.now()}`;
const { ObjectId } = mongoose.Types;

let available = false;
let db;
let aiCalls = 0;
let aiStatus = 200;
const originalFetch = globalThis.fetch;
const originalKey = process.env.WHATSAPP_COMMERCE_KEY;

before(async () => {
  try {
    await mongoose.connect(`mongodb://127.0.0.1:27017/${DB_NAME}`, { serverSelectionTimeoutMS: 1500 });
    db = mongoose.connection.db;
    assert.equal(db.databaseName, DB_NAME);
    available = true;
  } catch {
    await mongoose.disconnect().catch(() => {});
  }
  process.env.WHATSAPP_COMMERCE_KEY = "test-key";
  globalThis.fetch = async () => {
    aiCalls += 1;
    return new Response(JSON.stringify({ sent: aiStatus < 300, message: "from ai service" }), { status: aiStatus });
  };
});

after(async () => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.WHATSAPP_COMMERCE_KEY;
  else process.env.WHATSAPP_COMMERCE_KEY = originalKey;
  if (available) {
    assert.equal(mongoose.connection.db.databaseName, DB_NAME);
    await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
  }
});

const mongoTest = (name, run) => test(name, async (t) => {
  if (!available) return t.skip("No local MongoDB on 127.0.0.1:27017");
  aiCalls = 0;
  aiStatus = 200;
  return run();
});

const admin = (name) => ({ _id: new ObjectId(), name, role: "admin" });

const call = async (handler, { id, messageId, body, user, query = {} }) => {
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  await handler({ params: { id: String(id), messageId: messageId && String(messageId) }, body, user, query }, res);
  return res;
};

const makeChat = async (fields = {}) => {
  const _id = new ObjectId();
  await db.collection("conversations").insertOne({
    _id,
    channel: "whatsapp",
    status: "open",
    external_customer_ref: "919800000001",
    created_at: new Date(),
    last_message_at: new Date(),
    ...fields,
  });
  return _id;
};

const ownedChat = (owner) => makeChat({
  status: "handoff",
  handoff_status: "assigned",
  handoff_assigned_to: owner._id,
  handoff_assigned_name: owner.name,
});

const chatOf = (id) => db.collection("conversations").findOne({ _id: id });
const activityOf = (id) => db.collection("whatsapp_chat_activity").find({ conversation_id: id }).toArray();

mongoTest("the real update refuses a claim on someone else's chat and needs confirmation", async () => {
  const [me, priya] = [admin("Me"), admin("Priya")];
  const id = await ownedChat(priya);

  const refused = await call(updateWhatsAppChat, { id, user: me, body: { assignToMe: true } });
  assert.equal(refused.statusCode, 409);
  assert.equal(refused.body.owner_name, "Priya");
  assert.equal(String((await chatOf(id)).handoff_assigned_to), String(priya._id));

  const confirmed = await call(updateWhatsAppChat, { id, user: me, body: { assignToMe: true, confirmTakeover: true } });
  assert.equal(confirmed.statusCode, 200);
  assert.equal(String((await chatOf(id)).handoff_assigned_to), String(me._id));
  assert.equal((await activityOf(id))[0].type, "taken_over");
});

mongoTest("when many admins claim at once, exactly one wins", async () => {
  const id = await makeChat({ status: "handoff" });
  const admins = Array.from({ length: 8 }, (_, index) => admin(`Admin ${index}`));
  const results = await Promise.all(admins.map((user) => (
    call(updateWhatsAppChat, { id, user, body: { assignToMe: true } })
  )));
  assert.equal(results.filter((res) => res.statusCode === 200).length, 1);
  assert.equal(results.filter((res) => res.statusCode === 409).length, 7);
  assert.equal((await activityOf(id)).length, 1);
});

mongoTest("owner ids stored as text are still recognised", async () => {
  const me = admin("Me");
  const id = await makeChat({ status: "handoff", handoff_status: "assigned", handoff_assigned_to: String(me._id), handoff_assigned_name: "Me" });
  const res = await call(updateWhatsAppChat, { id, user: me, body: { assignToMe: true } });
  assert.equal(res.statusCode, 200);
});

mongoTest("a chat with no owner id, or a stale owner, can be claimed", async () => {
  const [me, priya] = [admin("Me"), admin("Priya")];
  const noOwner = await makeChat({ status: "handoff", handoff_status: "assigned" });
  assert.equal((await call(updateWhatsAppChat, { id: noOwner, user: me, body: { assignToMe: true } })).statusCode, 200);
  const stale = await makeChat({ status: "open", handoff_status: "resumed", handoff_assigned_to: priya._id });
  assert.equal((await call(updateWhatsAppChat, { id: stale, user: me, body: { assignToMe: true } })).statusCode, 200);
});

mongoTest("assigning checks the real users collection", async () => {
  const me = admin("Me");
  const sana = admin("Sana");
  const customer = { _id: new ObjectId(), name: "Customer", role: "user" };
  await db.collection("users").insertMany([sana, customer]);
  const id = await makeChat();

  assert.equal((await call(updateWhatsAppChat, { id, user: me, body: { assignTo: String(customer._id) } })).statusCode, 400);
  assert.equal((await call(updateWhatsAppChat, { id, user: me, body: { assignTo: String(sana._id) } })).statusCode, 200);
  const chat = await chatOf(id);
  assert.equal(chat.handoff_assigned_name, "Sana");
  assert.equal(chat.status, "handoff");
});

const sendFailedReply = async (id, statusFields) => {
  const messageId = new ObjectId();
  const wamid = `wamid.${messageId}`;
  await db.collection("messages").insertOne({
    _id: messageId,
    conversation_id: id,
    sender: "human",
    content: "Your order ships tomorrow",
    message_type: "text",
    metadata: { sent_by: "Priya", whatsapp_message_id: wamid },
    created_at: new Date(),
  });
  if (statusFields) await db.collection("whatsapp_message_status").insertOne({ _id: wamid, ...statusFields });
  return messageId;
};

mongoTest("the chat view picks the furthest delivery step, whatever order statuses arrived in", async () => {
  const me = admin("Me");
  const id = await makeChat();
  const at = new Date();
  const read = await sendFailedReply(id, { sent_at: at, delivered_at: at, read_at: at });
  const delivered = await sendFailedReply(id, { delivered_at: at });
  const failed = await sendFailedReply(id, { failed_at: at, error_code: 131047, error_title: "Re-engagement message" });
  const noStatusYet = await sendFailedReply(id, null);
  const customerId = new ObjectId();
  await db.collection("messages").insertOne({
    _id: customerId, conversation_id: id, sender: "customer", content: "Hi", metadata: { whatsapp_message_id: "wamid.in" }, created_at: at,
  });

  const res = await call(getWhatsAppChat, { id, user: me });
  const byId = new Map(res.body.messages.map((message) => [message._id, message]));
  assert.equal(byId.get(String(read)).delivery.status, "read");
  assert.equal(byId.get(String(delivered)).delivery.status, "delivered");
  assert.equal(byId.get(String(failed)).delivery.status, "failed");
  assert.equal(byId.get(String(failed)).delivery.error_code, 131047);
  assert.equal(byId.get(String(noStatusYet)).delivery.status, "sent");
  assert.equal(byId.get(String(customerId)).delivery, undefined);
});

mongoTest("the chat list flags a last message that failed, and only that", async () => {
  const me = admin("Me");
  const failedChat = await makeChat({ last_message_at: new Date(Date.now() + 5000) });
  await sendFailedReply(failedChat, { failed_at: new Date(), error_code: 131026 });
  const fineChat = await makeChat({ last_message_at: new Date(Date.now() + 4000) });
  await sendFailedReply(fineChat, { delivered_at: new Date() });
  const earlierFailureChat = await makeChat({ last_message_at: new Date(Date.now() + 3000) });
  await sendFailedReply(earlierFailureChat, { failed_at: new Date() });
  await db.collection("messages").insertOne({
    conversation_id: earlierFailureChat, sender: "customer", content: "Hello?", metadata: {}, created_at: new Date(Date.now() + 1000),
  });

  const res = await call(listWhatsAppChats, { user: me });
  assert.equal(res.statusCode, 200);
  const flag = (id) => res.body.conversations.find((chat) => chat._id === String(id)).last_message_failed;
  assert.equal(flag(failedChat), true);
  assert.equal(flag(fineChat), false);
  assert.equal(flag(earlierFailureChat), false);
  assert.equal(res.body.conversations[0].last_delivery, undefined);
});

mongoTest("a failed reply can be retried, using the stored text", async () => {
  const me = admin("Me");
  const id = await makeChat();
  const messageId = await sendFailedReply(id, { failed_at: new Date(), error_code: 131026 });

  const res = await call(retryWhatsAppReply, { id, messageId, user: me });
  assert.equal(res.statusCode, 200);
  assert.equal(aiCalls, 1);
  const stored = await db.collection("messages").findOne({ _id: messageId });
  assert.ok(stored.metadata.retried_at instanceof Date);
  assert.equal(stored.metadata.retried_by, "Me");
  assert.ok((await activityOf(id)).some((event) => event.type === "reply_retried"));
});

mongoTest("double clicking retry only sends the reply once", async () => {
  const me = admin("Me");
  const id = await makeChat();
  const messageId = await sendFailedReply(id, { failed_at: new Date() });
  const results = await Promise.all(Array.from({ length: 5 }, () => call(retryWhatsAppReply, { id, messageId, user: me })));
  assert.equal(aiCalls, 1);
  assert.equal(results.filter((res) => res.statusCode === 200).length, 1);
  assert.equal(results.filter((res) => res.statusCode === 409).length, 4);
});

mongoTest("a retry WhatsApp refuses can be tried again later", async () => {
  const me = admin("Me");
  const id = await makeChat();
  const messageId = await sendFailedReply(id, { failed_at: new Date() });

  aiStatus = 409;
  const refused = await call(retryWhatsAppReply, { id, messageId, user: me });
  assert.equal(refused.statusCode, 409);
  assert.equal((await db.collection("messages").findOne({ _id: messageId })).metadata.retried_at, undefined);

  aiStatus = 200;
  assert.equal((await call(retryWhatsAppReply, { id, messageId, user: me })).statusCode, 200);
});

mongoTest("retry is refused for delivered replies, customer messages and other chats", async () => {
  const me = admin("Me");
  const id = await makeChat();
  const otherChat = await makeChat();
  const delivered = await sendFailedReply(id, { failed_at: new Date(), delivered_at: new Date() });
  const failed = await sendFailedReply(id, { failed_at: new Date() });
  const customerId = new ObjectId();
  await db.collection("messages").insertOne({ _id: customerId, conversation_id: id, sender: "customer", content: "Hi", metadata: {}, created_at: new Date() });

  assert.equal((await call(retryWhatsAppReply, { id, messageId: delivered, user: me })).statusCode, 409);
  assert.equal((await call(retryWhatsAppReply, { id, messageId: customerId, user: me })).statusCode, 404);
  assert.equal((await call(retryWhatsAppReply, { id: otherChat, messageId: failed, user: me })).statusCode, 404);
  assert.equal((await call(retryWhatsAppReply, { id, messageId: failed, user: { _id: me._id, role: "user" } })).statusCode, 403);
  assert.equal(aiCalls, 0);
});

mongoTest("a normal reply still reaches the AI service and records a first claim", async () => {
  const me = admin("Me");
  const id = await makeChat();
  const res = await call(sendWhatsAppReply, { id, user: me, body: { text: "Hello" } });
  assert.equal(res.statusCode, 200);
  assert.equal(aiCalls, 1);
  assert.equal((await activityOf(id))[0].via, "reply");
});
