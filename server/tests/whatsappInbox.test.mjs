import test from "node:test";
import assert from "node:assert/strict";
import {
  AI_REPLY_GRACE_MS,
  activityLabel,
  aiStatus,
  deliveryFailureReason,
  inQueue,
  isClosed,
  needsReply,
  noticeLabel,
  replyWindow,
  sentPhotos,
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

test("history lines name the person, or say You for your own actions", () => {
  const event = { type: "reassigned", actor_id: "a1", actor_name: "Priya", from_name: "Ravi", to_name: "Sana" };
  assert.equal(activityLabel(event, "me"), "Priya moved this chat from Ravi to Sana");
  assert.equal(activityLabel(event, "a1"), "You moved this chat from Ravi to Sana");
  assert.equal(activityLabel({ type: "claimed", actor_name: "Priya", via: "reply" }, "me"), "Priya claimed this chat by replying");
});

test("system events have no person, and unknown events still read properly", () => {
  assert.equal(activityLabel({ type: "ai_auto_resumed" }, "me"), "AI resumed because the team went quiet");
  assert.equal(activityLabel({ type: "team_requested" }, undefined), "Customer asked for the team");
  assert.equal(activityLabel({ type: "something_new" }, "me"), "A team member updated this chat");
});

test("a last reply that wasn't delivered needs the team, until the chat is closed", () => {
  const failed = { status: "open", last_message_failed: true, ...lastFrom("ai", 1) };
  assert.equal(needsReply(failed, NOW), true);
  assert.equal(inQueue("needs_reply", failed, { now: NOW }), true);
  assert.equal(needsReply({ ...failed, status: "closed", closed_at: ago(0) }, NOW), false);
});

test("delivery failures explain known codes and fall back to what WhatsApp said", () => {
  assert.match(deliveryFailureReason({ error_code: 131047 }), /24 hours/);
  assert.equal(deliveryFailureReason({ error_code: 999, error_title: "Odd problem" }), "Odd problem (code 999)");
  assert.equal(deliveryFailureReason({}), "WhatsApp reported a delivery failure");
});

test("an error notice from the service still leaves the customer waiting", () => {
  const notice = (kind) => ({ status: "open", last_message: { sender: "ai", created_at: ago(0), metadata: { system_notice: kind } }, last_message_at: ago(0) });
  assert.equal(needsReply(notice("processing_failed"), NOW), true);
  assert.equal(needsReply(notice("photo_check_failed"), NOW), true);
  assert.equal(needsReply(notice("rate_limited"), NOW), true);
  assert.equal(needsReply(notice("order_update"), NOW), false);
  assert.equal(needsReply({ ...notice("processing_failed"), status: "closed", closed_at: ago(0) }, NOW), false);
});

test("automatic messages get a readable label and AI replies don't", () => {
  assert.equal(noticeLabel({ metadata: { system_notice: "order_update" } }), "Order update");
  assert.equal(noticeLabel({ metadata: { system_notice: "something_new" } }), "Automatic message");
  assert.equal(noticeLabel({ metadata: {} }), null);
});

test("recorded product photos are shown exactly, even when none were sent", () => {
  const photo = { url: "https://cdn.test/a.jpg", caption: "Option 1\nTee", whatsapp_message_id: "wamid.p1" };
  assert.deepEqual(sentPhotos({ sender: "ai", metadata: { whatsapp_images: [photo] } }), { photos: [photo], rebuilt: false });
  const products = [{ id: "p1", name: "Tee", image: "https://cdn.test/a.jpg" }];
  assert.deepEqual(sentPhotos({ sender: "ai", metadata: { whatsapp_images: [], recommended_products: products } }), { photos: [], rebuilt: false });
});

test("older replies rebuild their photos the way the service sent them", () => {
  const products = [1, 2, 3, 4, 5, 6].map((n) => ({ id: `p${n}`, name: `Tee ${n}`, image: `https://cdn.test/${n}.jpg` }));
  const list = sentPhotos({ sender: "ai", metadata: { recommended_products: products } });
  assert.equal(list.rebuilt, true);
  assert.equal(list.photos.length, 5);
  assert.equal(list.photos[1].caption, "Option 2\nTee 2");
  const gallery = sentPhotos({ sender: "ai", metadata: { media_mode: "gallery", recommended_products: products } });
  assert.deepEqual(gallery.photos.map((photo) => photo.url), ["https://cdn.test/1.jpg"]);
  assert.equal(sentPhotos({ sender: "ai", metadata: { media_mode: "none", recommended_products: products } }).photos.length, 0);
  const noImage = [{ id: "p1", name: "Tee", image: null }, { id: "p2", name: "Polo", image: "/local.jpg" }];
  assert.equal(sentPhotos({ sender: "ai", metadata: { recommended_products: noImage } }).photos.length, 0);
  assert.equal(sentPhotos({ sender: "customer", metadata: { recommended_products: products } }).photos.length, 0);
});
