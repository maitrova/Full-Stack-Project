import test from "node:test";
import assert from "node:assert/strict";
import {
  AI_REPLY_GRACE_MS,
  aiStatus,
  inQueue,
  isClosed,
  needsReply,
  replyWindow,
  sortForQueue,
} from "../../frontend/src/utils/whatsappInbox.js";

const NOW = Date.UTC(2026, 10, 4, 12);
const ago = (minutes) => new Date(NOW - minutes * 60000).toISOString();
const lastFrom = (sender, minutes) => ({ last_message: { sender, created_at: ago(minutes) }, last_message_at: ago(minutes) });

test("a chat where the team or AI spoke last doesn't need a reply", () => {
  assert.equal(needsReply({ status: "handoff", handoff_status: "assigned", ...lastFrom("human", 30) }, NOW), false);
  assert.equal(needsReply({ status: "open", ...lastFrom("ai", 30) }, NOW), false);
  assert.equal(needsReply({ status: "open" }, NOW), false);
});

test("the AI gets a grace period to answer before a chat needs the team", () => {
  const fresh = { status: "open", last_message: { sender: "customer", created_at: new Date(NOW - AI_REPLY_GRACE_MS + 1000).toISOString() } };
  const overdue = { status: "open", last_message: { sender: "customer", created_at: new Date(NOW - AI_REPLY_GRACE_MS).toISOString() } };
  assert.equal(needsReply(fresh, NOW), false);
  assert.equal(needsReply(overdue, NOW), true);
});

test("a customer waiting on the team needs a reply straight away", () => {
  assert.equal(needsReply({ status: "handoff", ...lastFrom("customer", 0) }, NOW), true);
});

test("a closed chat becomes active again when the customer returns", () => {
  const closed = { status: "closed", closed_at: ago(60), ...lastFrom("ai", 120) };
  const returned = { status: "closed", closed_at: ago(600), ...lastFrom("customer", 4) };
  assert.equal(isClosed(closed), true);
  assert.equal(inQueue("needs_reply", closed, { now: NOW }), false);
  assert.equal(isClosed(returned), false);
  assert.equal(inQueue("closed", returned, { now: NOW }), false);
  assert.equal(inQueue("needs_reply", returned, { now: NOW }), true);
  assert.equal(inQueue("ai", returned, { now: NOW }), true);
});

test("the AI status matches who is actually answering", () => {
  assert.equal(aiStatus({ status: "open" }).label, "AI answering");
  assert.equal(aiStatus({ status: "handoff" }).label, "Team requested · AI still answering");
  assert.equal(aiStatus({ status: "handoff", handoff_status: "resumed" }).label, "Team requested · AI still answering");
  assert.match(aiStatus({ status: "handoff", handoff_status: "assigned", handoff_assigned_name: "Priya" }).label, /AI paused · Priya/);
});

test("Mine only covers chats the current admin owns", () => {
  const chat = { status: "handoff", handoff_status: "assigned", handoff_assigned_to: "me" };
  assert.equal(inQueue("mine", chat, { now: NOW, userId: "me" }), true);
  assert.equal(inQueue("mine", chat, { now: NOW, userId: "other" }), false);
  assert.equal(inQueue("mine", { ...chat, status: "open" }, { now: NOW, userId: "me" }), false);
});

test("Needs reply lists the longest wait first; other queues the newest first", () => {
  const short = { status: "handoff", ...lastFrom("customer", 5) };
  const long = { status: "handoff", ...lastFrom("customer", 50) };
  assert.deepEqual(sortForQueue("needs_reply", [short, long]), [long, short]);
  assert.deepEqual(sortForQueue("all", [long, short]), [short, long]);
});

test("the reply window lasts 24 hours from the customer's last message", () => {
  const messages = (minutes) => [{ sender: "customer", created_at: ago(minutes) }, { sender: "ai", created_at: ago(0) }];
  assert.equal(replyWindow(messages(60), NOW).open, true);
  assert.equal(replyWindow(messages(60), NOW).remainingMs, 23 * 60 * 60 * 1000);
  assert.equal(replyWindow(messages(24 * 60), NOW).open, false);
  assert.equal(replyWindow([{ sender: "ai", created_at: ago(1) }], NOW).open, false);
});
