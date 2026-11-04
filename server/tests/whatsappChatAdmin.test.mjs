import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  addWhatsAppChatNote,
  getWhatsAppChat,
  listWhatsAppAdmins,
  sendWhatsAppReply,
  updateWhatsAppChat,
} from "../controllers/whatsappChatAdminController.js";

const CHAT_ID = new mongoose.Types.ObjectId();
const ME = new mongoose.Types.ObjectId();
const OTHER = new mongoose.Types.ObjectId();
const THIRD = new mongoose.Types.ObjectId();
const CUSTOMER = new mongoose.Types.ObjectId();

const USERS = [
  { _id: ME, name: "Me", role: "admin" },
  { _id: OTHER, name: "Ravi", role: "admin" },
  { _id: THIRD, email: "sana@example.com", role: "admin" },
  { _id: CUSTOMER, name: "Customer", role: "user" },
];

// Applies just enough of the update filter to exercise the ownership check.
const blockedByOwner = (filter, chat) => (filter.$nor || []).some((rule) =>
  chat.status === rule.status
  && chat.handoff_status === rule.handoff_status
  && !rule.handoff_assigned_to.$nin.some((id) => (
    id === null ? chat.handoff_assigned_to == null : String(id) === String(chat.handoff_assigned_to)
  )));

const cursorOver = (source) => {
  let rows = [...source];
  const cursor = {
    sort: ({ created_at: direction }) => {
      rows.sort((a, b) => direction * (a.created_at - b.created_at));
      return cursor;
    },
    limit: (count) => { rows = rows.slice(0, count); return cursor; },
    toArray: async () => rows,
  };
  return cursor;
};

const fakeDb = (chat, { messages = [], alerts = [], failLogging = false } = {}) => {
  const db = {
    chat,
    alerts,
    alertUpdates: [],
    activity: [],
    notes: [],
    collection(name) {
      if (name === "conversations") {
        return {
          findOne: async () => chat,
          updateOne: async (_filter, update) => { Object.assign(chat, update.$set); },
          findOneAndUpdate: async (filter, update) => {
            if (!chat || blockedByOwner(filter, chat)) return null;
            const before = { ...chat };
            Object.assign(chat, update.$set);
            return before;
          },
        };
      }
      if (name === "whatsapp_handoff_alerts") {
        return {
          find: () => cursorOver(alerts),
          updateMany: async (_filter, update) => { db.alertUpdates.push(update.$set); return { matchedCount: 1 }; },
          insertOne: async (doc) => { db.alertUpdates.push(doc); },
        };
      }
      if (name === "messages") return { find: () => cursorOver(messages) };
      if (name === "users") {
        return {
          find: (filter) => cursorOver(USERS.filter((user) => user.role === filter.role)),
          findOne: async (filter) => USERS.find((user) => (
            String(user._id) === String(filter._id) && user.role === filter.role
          )) || null,
        };
      }
      if (name === "whatsapp_chat_activity" || name === "whatsapp_chat_notes") {
        const rows = name === "whatsapp_chat_activity" ? db.activity : db.notes;
        return {
          createIndex: async () => "ok",
          find: () => cursorOver(rows),
          insertOne: async (doc) => {
            if (failLogging && name === "whatsapp_chat_activity") throw new Error("write failed");
            rows.push({ _id: new mongoose.Types.ObjectId(), ...doc });
          },
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    },
  };
  return db;
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

const openChat = () => ({ _id: CHAT_ID, channel: "whatsapp", status: "open" });
const ownedBy = (id, name) => ({
  _id: CHAT_ID,
  channel: "whatsapp",
  status: "handoff",
  handoff_status: "assigned",
  handoff_assigned_to: id,
  handoff_assigned_name: name,
});
const ownedByOther = () => ownedBy(OTHER, "Ravi");

test("claiming a chat another admin owns is refused and leaves the owner in place", async () => {
  const db = fakeDb(ownedByOther());
  const res = await call(updateWhatsAppChat, db, { body: { assignToMe: true } });
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, "owned_by_other");
  assert.equal(res.body.owner_name, "Ravi");
  assert.equal(String(db.chat.handoff_assigned_to), String(OTHER));
  assert.equal(db.activity.length, 0);
});

test("pausing the AI on a chat another admin owns is refused too", async () => {
  const db = fakeDb(ownedByOther());
  const res = await call(updateWhatsAppChat, db, { body: { conversationStatus: "handoff" } });
  assert.equal(res.statusCode, 409);
});

test("confirming the takeover moves the chat and records who it came from", async () => {
  const db = fakeDb(ownedByOther());
  const res = await call(updateWhatsAppChat, db, { body: { assignToMe: true, confirmTakeover: true } });
  assert.equal(res.statusCode, 200);
  assert.equal(String(db.chat.handoff_assigned_to), String(ME));
  assert.equal(db.chat.handoff_assigned_name, "Me");
  assert.equal(db.activity.length, 1);
  assert.equal(db.activity[0].type, "taken_over");
  assert.equal(db.activity[0].from_name, "Ravi");
  assert.equal(db.activity[0].actor_name, "Me");
});

test("an unclaimed team request can be claimed without confirmation", async () => {
  const db = fakeDb({ _id: CHAT_ID, channel: "whatsapp", status: "handoff" });
  const res = await call(updateWhatsAppChat, db, { body: { assignToMe: true } });
  assert.equal(res.statusCode, 200);
  assert.equal(db.chat.handoff_status, "assigned");
  assert.equal(db.activity[0].type, "claimed");
});

test("a stale owner on a resumed chat does not block a new claim", async () => {
  const db = fakeDb({ ...ownedByOther(), status: "open", handoff_status: "resumed" });
  const res = await call(updateWhatsAppChat, db, { body: { assignToMe: true } });
  assert.equal(res.statusCode, 200);
  assert.equal(String(db.chat.handoff_assigned_to), String(ME));
  assert.equal(db.activity[0].type, "claimed");
});

test("re-claiming your own chat changes nothing in the history", async () => {
  const db = fakeDb(ownedBy(ME, "Me"));
  const res = await call(updateWhatsAppChat, db, { body: { assignToMe: true } });
  assert.equal(res.statusCode, 200);
  assert.equal(db.activity.length, 0);
});

test("other updates to a chat someone owns are not treated as takeovers", async () => {
  const db = fakeDb(ownedByOther());
  const res = await call(updateWhatsAppChat, db, { body: { leadStatus: "qualified" } });
  assert.equal(res.statusCode, 200);
  assert.equal(db.chat.lead_status, "qualified");
  assert.equal(String(db.chat.handoff_assigned_to), String(OTHER));
  assert.deepEqual(db.activity.map((event) => event.type), ["lead_status"]);
  assert.equal(db.activity[0].to_status, "qualified");
});

test("saving the same lead status isn't recorded as a change", async () => {
  const db = fakeDb({ ...openChat(), lead_status: "contacted" });
  await call(updateWhatsAppChat, db, { body: { leadStatus: "contacted" } });
  assert.equal(db.activity.length, 0);
});

test("a missing chat is a 404, not an ownership conflict", async () => {
  const res = await call(updateWhatsAppChat, fakeDb(null), { body: { assignToMe: true } });
  assert.equal(res.statusCode, 404);
});

test("closing and reopening a chat are recorded and resolve open alerts", async () => {
  const db = fakeDb(ownedByOther());
  const closed = await call(updateWhatsAppChat, db, { body: { conversationStatus: "closed" } });
  assert.equal(closed.statusCode, 200);
  assert.equal(db.chat.status, "closed");
  assert.ok(db.chat.closed_at instanceof Date);
  assert.equal(db.chat.handoff_status, "resolved");
  assert.equal(db.alertUpdates.at(-1).status, "resolved");

  await call(updateWhatsAppChat, db, { body: { conversationStatus: "open" } });
  assert.deepEqual(db.activity.map((event) => event.type), ["closed", "reopened"]);
});

test("resuming the AI is recorded", async () => {
  const db = fakeDb(ownedBy(ME, "Me"));
  await call(updateWhatsAppChat, db, { body: { conversationStatus: "open" } });
  assert.deepEqual(db.activity.map((event) => event.type), ["ai_resumed"]);
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

test("assigning an unowned chat pauses the AI and records the new owner", async () => {
  const db = fakeDb(openChat());
  const res = await call(updateWhatsAppChat, db, { body: { assignTo: String(OTHER) } });
  assert.equal(res.statusCode, 200);
  assert.equal(db.chat.status, "handoff");
  assert.equal(db.chat.handoff_status, "assigned");
  assert.equal(String(db.chat.handoff_assigned_to), String(OTHER));
  assert.equal(db.chat.handoff_assigned_name, "Ravi");
  assert.equal(db.activity[0].type, "assigned");
  assert.equal(db.activity[0].to_name, "Ravi");
  assert.equal(db.activity[0].actor_name, "Me");
});

test("the owner can hand their chat to a teammate without a warning", async () => {
  const db = fakeDb(ownedBy(ME, "Me"));
  const res = await call(updateWhatsAppChat, db, { body: { assignTo: String(OTHER) } });
  assert.equal(res.statusCode, 200);
  assert.equal(db.activity[0].type, "reassigned");
  assert.equal(db.activity[0].from_name, "Me");
  assert.equal(db.activity[0].to_name, "Ravi");
});

test("reassigning someone else's chat needs confirmation", async () => {
  const db = fakeDb(ownedByOther());
  const refused = await call(updateWhatsAppChat, db, { body: { assignTo: String(THIRD) } });
  assert.equal(refused.statusCode, 409);
  assert.equal(String(db.chat.handoff_assigned_to), String(OTHER));

  const confirmed = await call(updateWhatsAppChat, db, { body: { assignTo: String(THIRD), confirmTakeover: true } });
  assert.equal(confirmed.statusCode, 200);
  assert.equal(String(db.chat.handoff_assigned_to), String(THIRD));
  assert.equal(db.chat.handoff_assigned_name, "sana@example.com");
});

test("assigning to the current owner is not a conflict and isn't recorded", async () => {
  const db = fakeDb(ownedByOther());
  const res = await call(updateWhatsAppChat, db, { body: { assignTo: String(OTHER) } });
  assert.equal(res.statusCode, 200);
  assert.equal(db.activity.length, 0);
});

test("chats can only be assigned to admins", async () => {
  const db = fakeDb(openChat());
  const customer = await call(updateWhatsAppChat, db, { body: { assignTo: String(CUSTOMER) } });
  assert.equal(customer.statusCode, 400);
  const invalid = await call(updateWhatsAppChat, db, { body: { assignTo: "not-an-id" } });
  assert.equal(invalid.statusCode, 400);
  assert.equal(db.chat.status, "open");
});

test("a failed activity write doesn't fail the change itself", async () => {
  const db = fakeDb(openChat(), { failLogging: true });
  const originalError = console.error;
  console.error = () => {};
  try {
    const res = await call(updateWhatsAppChat, db, { body: { assignToMe: true } });
    assert.equal(res.statusCode, 200);
    assert.equal(db.chat.handoff_status, "assigned");
  } finally {
    console.error = originalError;
  }
});

test("the team list only includes admins", async () => {
  const res = await call(listWhatsAppAdmins, fakeDb(null));
  assert.deepEqual(res.body.admins.map((admin) => admin.name).sort(), ["Me", "Ravi", "sana@example.com"]);
  assert.ok(res.body.admins.every((admin) => Object.keys(admin).length === 2));
});

test("the team list is admin only", async () => {
  const res = await call(listWhatsAppAdmins, fakeDb(null), { user: { _id: CUSTOMER, role: "user" } });
  assert.equal(res.statusCode, 403);
});

test("notes keep their author and every earlier note", async () => {
  const db = fakeDb(openChat());
  const first = await call(addWhatsAppChatNote, db, { body: { text: "  Wants size L  " } });
  await call(addWhatsAppChatNote, db, { body: { text: "Budget is 2000" } });
  assert.equal(first.statusCode, 201);
  assert.equal(first.body.note.text, "Wants size L");
  assert.equal(first.body.note.author_name, "Me");
  assert.equal(db.notes.length, 2);
  assert.deepEqual(db.activity.map((event) => event.type), ["note_added", "note_added"]);
});

test("empty, oversized and orphan notes are refused", async () => {
  const db = fakeDb(openChat());
  assert.equal((await call(addWhatsAppChatNote, db, { body: { text: "   " } })).statusCode, 400);
  assert.equal((await call(addWhatsAppChatNote, db, { body: { text: "x".repeat(2001) } })).statusCode, 400);
  assert.equal((await call(addWhatsAppChatNote, fakeDb(null), { body: { text: "hi" } })).statusCode, 404);
  assert.equal(db.notes.length, 0);
});

test("non-admins cannot add notes", async () => {
  const db = fakeDb(openChat());
  const res = await call(addWhatsAppChatNote, db, { body: { text: "hi" }, user: { _id: ME, role: "user" } });
  assert.equal(res.statusCode, 403);
  assert.equal(db.notes.length, 0);
});

test("long chats return the newest 1000 messages, oldest first", async () => {
  const messages = Array.from({ length: 1200 }, (_, index) => ({
    _id: String(index),
    created_at: new Date(2026, 0, 1, 0, index),
  }));
  const res = await call(getWhatsAppChat, fakeDb({ _id: CHAT_ID }, { messages }));
  assert.equal(res.body.messages.length, 1000);
  assert.equal(res.body.messages[0]._id, "200");
  assert.equal(res.body.messages.at(-1)._id, "1199");
});

test("a chat's history includes what the AI service did, oldest first, and skips team-made alerts", async () => {
  const at = (minute) => new Date(2026, 0, 1, 0, minute);
  const alerts = [
    { _id: "customer", reason: "customer_requested_team", created_at: at(1), auto_resumed: true, resolved_at: at(9) },
    { _id: "lead", reason: "customization", lead_type: "customization", created_at: at(20) },
    { _id: "team", reason: "team_paused_ai", created_at: at(30) },
    { _id: "started", reason: "team_started", created_at: at(40) },
  ];
  const db = fakeDb(openChat(), { alerts });
  db.activity.push({ _id: "logged", type: "claimed", actor_name: "Me", created_at: at(5) });
  const res = await call(getWhatsAppChat, db);
  assert.deepEqual(res.body.activity.map((event) => event.type), [
    "team_requested",
    "claimed",
    "ai_auto_resumed",
    "customization_lead",
  ]);
});

const withAiService = async (status, run) => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.WHATSAPP_COMMERCE_KEY;
  process.env.WHATSAPP_COMMERCE_KEY = "test-key";
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: status < 300 }), { status });
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.WHATSAPP_COMMERCE_KEY;
    else process.env.WHATSAPP_COMMERCE_KEY = originalKey;
  }
};

test("the first reply on an unowned chat is recorded as claiming it", () => withAiService(200, async () => {
  const db = fakeDb(openChat());
  const res = await call(sendWhatsAppReply, db, { body: { text: "Hello" } });
  assert.equal(res.statusCode, 200);
  assert.equal(db.activity[0].type, "claimed");
  assert.equal(db.activity[0].via, "reply");
}));

test("replying to an owned chat doesn't change the history", () => withAiService(200, async () => {
  const db = fakeDb(ownedByOther());
  await call(sendWhatsAppReply, db, { body: { text: "Hello" } });
  assert.equal(db.activity.length, 0);
}));

test("a reply WhatsApp refused isn't recorded as claiming the chat", () => withAiService(409, async () => {
  const db = fakeDb(openChat());
  const res = await call(sendWhatsAppReply, db, { body: { text: "Hello" } });
  assert.equal(res.statusCode, 409);
  assert.equal(db.activity.length, 0);
}));
