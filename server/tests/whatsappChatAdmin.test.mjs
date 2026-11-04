import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  getWhatsAppChat,
  updateWhatsAppChat,
} from "../controllers/whatsappChatAdminController.js";

const CHAT_ID = new mongoose.Types.ObjectId();
const ME = new mongoose.Types.ObjectId();
const OTHER = new mongoose.Types.ObjectId();

// Applies just enough of the update filter to exercise the ownership check.
const blockedByOwner = (filter, chat) => (filter.$nor || []).some((rule) =>
  chat.status === rule.status
  && chat.handoff_status === rule.handoff_status
  && !rule.handoff_assigned_to.$nin.some((id) => (
    id === null ? chat.handoff_assigned_to == null : String(id) === String(chat.handoff_assigned_to)
  )));

const fakeDb = (chat, messages = []) => {
  const alerts = [];
  return {
    alerts,
    chat,
    collection(name) {
      if (name === "conversations") {
        return {
          findOne: async () => chat,
          updateOne: async (_filter, update) => { Object.assign(chat, update.$set); },
          findOneAndUpdate: async (filter, update) => {
            if (!chat || blockedByOwner(filter, chat)) return null;
            Object.assign(chat, update.$set);
            return chat;
          },
        };
      }
      if (name === "whatsapp_handoff_alerts") {
        return {
          updateMany: async (_filter, update) => { alerts.push(update.$set); return { matchedCount: 1 }; },
          insertOne: async (doc) => { alerts.push(doc); },
        };
      }
      if (name === "messages") {
        return {
          find: () => {
            let rows = [...messages];
            const cursor = {
              sort: ({ created_at: direction }) => {
                rows.sort((a, b) => direction * (a.created_at - b.created_at));
                return cursor;
              },
              limit: (count) => { rows = rows.slice(0, count); return cursor; },
              toArray: async () => rows,
            };
            return cursor;
          },
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    },
  };
};

const call = async (handler, db, { body, user = { _id: ME, role: "admin", name: "Me" } } = {}) => {
  Object.defineProperty(mongoose.connection, "db", { value: db, configurable: true, writable: true });
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  await handler({ params: { id: String(CHAT_ID) }, body, user }, res);
  return res;
};

const ownedByOther = () => ({
  _id: CHAT_ID,
  channel: "whatsapp",
  status: "handoff",
  handoff_status: "assigned",
  handoff_assigned_to: OTHER,
  handoff_assigned_name: "Ravi",
});

test("claiming a chat another admin owns is refused and leaves the owner in place", async () => {
  const db = fakeDb(ownedByOther());
  const res = await call(updateWhatsAppChat, db, { body: { assignToMe: true } });
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, "owned_by_other");
  assert.equal(res.body.owner_name, "Ravi");
  assert.equal(String(db.chat.handoff_assigned_to), String(OTHER));
});

test("pausing the AI on a chat another admin owns is refused too", async () => {
  const db = fakeDb(ownedByOther());
  const res = await call(updateWhatsAppChat, db, { body: { conversationStatus: "handoff" } });
  assert.equal(res.statusCode, 409);
});

test("confirming the takeover moves the chat to the new owner", async () => {
  const db = fakeDb(ownedByOther());
  const res = await call(updateWhatsAppChat, db, { body: { assignToMe: true, confirmTakeover: true } });
  assert.equal(res.statusCode, 200);
  assert.equal(String(db.chat.handoff_assigned_to), String(ME));
  assert.equal(db.chat.handoff_assigned_name, "Me");
});

test("an unclaimed team request can be claimed without confirmation", async () => {
  const db = fakeDb({ _id: CHAT_ID, channel: "whatsapp", status: "handoff" });
  const res = await call(updateWhatsAppChat, db, { body: { assignToMe: true } });
  assert.equal(res.statusCode, 200);
  assert.equal(db.chat.handoff_status, "assigned");
});

test("a stale owner on a resumed chat does not block a new claim", async () => {
  const db = fakeDb({ ...ownedByOther(), status: "open", handoff_status: "resumed" });
  const res = await call(updateWhatsAppChat, db, { body: { assignToMe: true } });
  assert.equal(res.statusCode, 200);
  assert.equal(String(db.chat.handoff_assigned_to), String(ME));
});

test("an admin can re-claim their own chat", async () => {
  const db = fakeDb({ ...ownedByOther(), handoff_assigned_to: ME });
  const res = await call(updateWhatsAppChat, db, { body: { assignToMe: true } });
  assert.equal(res.statusCode, 200);
});

test("other updates to a chat someone owns are not treated as takeovers", async () => {
  const db = fakeDb(ownedByOther());
  const res = await call(updateWhatsAppChat, db, { body: { leadStatus: "qualified" } });
  assert.equal(res.statusCode, 200);
  assert.equal(db.chat.lead_status, "qualified");
  assert.equal(String(db.chat.handoff_assigned_to), String(OTHER));
});

test("a missing chat is a 404, not an ownership conflict", async () => {
  const res = await call(updateWhatsAppChat, fakeDb(null), { body: { assignToMe: true } });
  assert.equal(res.statusCode, 404);
});

test("closing a chat records the time and resolves open alerts", async () => {
  const db = fakeDb(ownedByOther());
  const res = await call(updateWhatsAppChat, db, { body: { conversationStatus: "closed" } });
  assert.equal(res.statusCode, 200);
  assert.equal(db.chat.status, "closed");
  assert.ok(db.chat.closed_at instanceof Date);
  assert.equal(db.chat.handoff_status, "resolved");
  assert.equal(db.alerts.at(-1).status, "resolved");
});

test("non-admins cannot update a chat", async () => {
  const db = fakeDb(ownedByOther());
  const res = await call(updateWhatsAppChat, db, {
    body: { assignToMe: true, confirmTakeover: true },
    user: { _id: ME, role: "user" },
  });
  assert.equal(res.statusCode, 403);
  assert.equal(String(db.chat.handoff_assigned_to), String(OTHER));
});

test("long chats return the newest 1000 messages, oldest first", async () => {
  const messages = Array.from({ length: 1200 }, (_, index) => ({
    _id: String(index),
    created_at: new Date(2026, 0, 1, 0, index),
  }));
  const res = await call(getWhatsAppChat, fakeDb({ _id: CHAT_ID }, messages));
  assert.equal(res.body.messages.length, 1000);
  assert.equal(res.body.messages[0]._id, "200");
  assert.equal(res.body.messages.at(-1)._id, "1199");
});
