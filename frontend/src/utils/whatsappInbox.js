// Rules for sorting WhatsApp chats into the admin inbox queues. Pure functions:
// the current time is always passed in.

// The AI normally replies within this time, so a customer message only counts
// as waiting on the team once it has gone unanswered for longer.
export const AI_REPLY_GRACE_MS = 2 * 60 * 1000;
export const REPLY_WINDOW_MS = 24 * 60 * 60 * 1000;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const time = (value) => {
  if (value == null) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
};

// The AI service keeps answering closed chats, so a message newer than the
// closing time means the customer came back and the chat is active again.
export const isClosed = (chat) => {
  if (chat?.status !== "closed") return false;
  const closedAt = time(chat.closed_at);
  const lastAt = time(chat.last_message_at);
  return closedAt == null || lastAt == null || lastAt <= closedAt;
};

// A customer's team request doesn't pause the AI: that needs an owner.
export const isClaimed = (chat) => chat?.status === "handoff" && chat?.handoff_status === "assigned";
export const isUnclaimed = (chat) => chat?.status === "handoff" && chat?.handoff_status !== "assigned";
export const isAiHandling = (chat) => !isClosed(chat) && chat?.status !== "handoff";

export const isMine = (chat, userId) =>
  Boolean(userId) && isClaimed(chat) && String(chat.handoff_assigned_to) === String(userId);

export const isOwnedByOther = (chat, userId) => isClaimed(chat) && !isMine(chat, userId);

export const waitingSince = (chat) =>
  !isClosed(chat) && chat?.last_message?.sender === "customer" ? chat.last_message.created_at : null;

export const needsReply = (chat, now) => {
  const since = time(waitingSince(chat));
  if (since == null) return false;
  return chat.status === "handoff" || now - since >= AI_REPLY_GRACE_MS;
};

export const QUEUES = [
  { id: "needs_reply", label: "Needs reply", empty: "All caught up. No customer is waiting." },
  { id: "unclaimed", label: "Unclaimed", empty: "No team requests are waiting for an owner." },
  { id: "mine", label: "Mine", empty: "You don't own any chats right now." },
  { id: "ai", label: "AI handling", empty: "The AI isn't handling any chats right now." },
  { id: "customization", label: "Customization", empty: "No customization leads yet." },
  { id: "closed", label: "Closed", empty: "No closed chats." },
  { id: "all", label: "All", empty: "No WhatsApp chats yet." },
];

export const inQueue = (queueId, chat, { now, userId }) => {
  switch (queueId) {
    case "needs_reply": return needsReply(chat, now);
    case "unclaimed": return isUnclaimed(chat);
    case "mine": return isMine(chat, userId);
    case "ai": return isAiHandling(chat);
    case "customization": return chat.lead_type === "customization";
    case "closed": return isClosed(chat);
    default: return true;
  }
};

const lastActivity = (chat) => time(chat.last_message_at) ?? time(chat.created_at) ?? 0;

// The "Needs reply" queue puts the longest wait first; the others put recent chats first.
export const sortForQueue = (queueId, chats) => [...chats].sort((a, b) => (
  queueId === "needs_reply"
    ? (time(waitingSince(a)) ?? 0) - (time(waitingSince(b)) ?? 0)
    : lastActivity(b) - lastActivity(a)
));

export const aiStatus = (chat) => {
  if (isClosed(chat)) return { label: "Chat closed", tone: "neutral" };
  if (isClaimed(chat)) return { label: `AI paused · ${chat.handoff_assigned_name || "Team"} owns this chat`, tone: "warning" };
  if (isUnclaimed(chat)) return { label: "Team requested · AI still answering", tone: "danger" };
  return { label: "AI answering", tone: "success" };
};

export const formatDuration = (ms) => {
  const value = Math.max(0, Number(ms) || 0);
  if (value < MINUTE) return "<1m";
  if (value < HOUR) return `${Math.floor(value / MINUTE)}m`;
  if (value < DAY) return `${Math.floor(value / HOUR)}h`;
  return `${Math.floor(value / DAY)}d`;
};

// How urgent a customer's wait looks in the list.
export const waitTone = (ms) => {
  if (ms >= HOUR) return "danger";
  if (ms >= 15 * MINUTE) return "warning";
  return "neutral";
};

// WhatsApp allows free-form replies only within 24 hours of the customer's last message.
export const replyWindow = (messages, now) => {
  const last = [...(messages || [])].reverse().find((message) => message.sender === "customer");
  const lastAt = time(last?.created_at);
  if (lastAt == null) return { open: false, remainingMs: 0 };
  const remainingMs = lastAt + REPLY_WINDOW_MS - now;
  return { open: remainingMs > 0, remainingMs: Math.max(0, remainingMs) };
};
