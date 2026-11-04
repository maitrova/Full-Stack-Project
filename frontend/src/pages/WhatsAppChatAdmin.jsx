import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  Activity,
  ArrowDown,
  ArrowLeft,
  Bot,
  Bug,
  ChevronLeft,
  ExternalLink,
  Info,
  Loader2,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  UserRound,
  Users,
} from "lucide-react";
import { useSelector } from "react-redux";
import { Badge, Button, EmptyState, Modal, Select, Skeleton, Textarea, cx } from "../components/ui/index.js";
import { selectCurrentToken, selectCurrentUser } from "../redux/slices/Userslice.js";
import {
  QUEUES,
  activityLabel,
  aiStatus,
  formatDuration,
  inQueue,
  isClaimed,
  isClosed,
  isMine,
  isOwnedByOther,
  isUnclaimed,
  needsReply,
  replyWindow,
  sortForQueue,
  waitTone,
  waitingSince,
} from "../utils/whatsappInbox.js";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/$/, "");
const LEAD_STATUS_OPTIONS = ["new", "contacted", "qualified", "converted", "closed"].map((value) => ({
  value,
  label: value[0].toUpperCase() + value.slice(1),
}));
const CHAT_REFRESH_MS = 10000;
const LIST_REFRESH_MS = 15000;

const QUICK_REPLIES = [
  { label: "Greeting", text: (name) => `Hi${name ? ` ${name}` : ""}, this is the Maitrova team. How can we help you today?` },
  { label: "Checking", text: () => "Thanks for your patience. We're checking this now and will update you shortly." },
  { label: "Order number", text: () => "Could you please share your order number so we can look into this?" },
  { label: "Anything else", text: () => "Is there anything else we can help you with?" },
];

const withoutKey = (object, key) => Object.fromEntries(Object.entries(object).filter(([name]) => name !== key));

const dayKey = (value) => new Date(value).toDateString();

const formatTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(date);
};

const formatDay = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(date);
};

const formatListDate = (value, now) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  if (dayKey(value) === dayKey(now)) return formatTime(value);
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(date);
};

const formatSeconds = (ms) => (ms == null ? "—" : `${(Number(ms) / 1000).toFixed(1)} s`);

const phoneLabel = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? `+${digits}` : "Unknown number";
};

const whatsappLink = (conversation) => {
  const digits = String(conversation?.external_customer_ref || "").replace(/\D/g, "");
  if (!digits) return "";
  const name = conversation?.customer_name ? ` ${conversation.customer_name}` : "";
  const text = encodeURIComponent(`Hi${name}, this is the Maitrova team. You asked us for help with your enquiry.`);
  return `https://wa.me/${digits}?text=${text}`;
};

const previewPrefix = { human: "Team: ", ai: "AI: ", assistant: "AI: " };

const ChatImage = ({ conversationId, messageId, headers, onLoad }) => {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    axios.get(
      `${API_URL}/admin/whatsapp-chats/${conversationId}/media/${messageId}`,
      { headers, responseType: "blob" }
    ).then(({ data }) => {
      objectUrl = URL.createObjectURL(data);
      if (active) setSrc(objectUrl);
      else URL.revokeObjectURL(objectUrl);
    }).catch(() => {
      if (active) setSrc("");
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [conversationId, headers, messageId]);

  if (!src) return <p className="mb-1 text-xs text-mt-muted">Image preview unavailable</p>;
  return <img src={src} alt="Customer attachment" onLoad={onLoad} className="mb-2 max-h-72 w-auto max-w-full rounded-mt-card object-contain" />;
};

const ChatRow = ({ chat, selected, now, userId, onSelect }) => {
  const waiting = needsReply(chat, now) ? now - new Date(waitingSince(chat)).getTime() : null;
  const name = chat.customer_name || phoneLabel(chat.external_customer_ref);
  const prefix = previewPrefix[chat.last_message?.sender] || "";
  return (
    <button
      type="button"
      onClick={() => onSelect(chat._id)}
      aria-current={selected ? "true" : undefined}
      className={cx(
        "block w-full border-b border-mt-line px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-mt-text",
        selected ? "bg-mt-tint/10" : "hover:bg-mt-tint/5"
      )}
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-medium text-mt-text">{name}</span>
        <span className="shrink-0 text-xs text-mt-subtle">{formatListDate(chat.last_message_at, now)}</span>
      </span>
      <span className="mt-1 line-clamp-2 block break-words text-xs leading-relaxed text-mt-muted">
        {chat.last_message?.content ? `${prefix}${chat.last_message.content}` : "Conversation started"}
      </span>
      <span className="mt-2 flex flex-wrap items-center gap-1.5">
        {waiting != null && <Badge variant={waitTone(waiting)}>Waiting {formatDuration(waiting)}</Badge>}
        {isUnclaimed(chat) && <Badge variant="danger">Unclaimed</Badge>}
        {isClaimed(chat) && (
          <Badge variant="outline">{isMine(chat, userId) ? "You" : chat.handoff_assigned_name || "Team"}</Badge>
        )}
        {isClosed(chat) && <Badge>Closed</Badge>}
        {chat.lead_type === "customization" && <Badge>Customization</Badge>}
      </span>
    </button>
  );
};

const senderLabel = (message) => {
  if (message.sender === "customer") return "Customer";
  if (message.sender === "human") return message.metadata?.sent_by || "Team";
  return "AI assistant";
};

const MessageBubble = ({ message, conversationId, headers, showDebug, onImageLoad }) => {
  const customer = message.sender === "customer";
  const human = message.sender === "human";
  const SenderIcon = customer ? UserRound : human ? Users : Bot;
  return (
    <div className={cx("flex", customer ? "justify-start" : "justify-end")}>
      <div
        className={cx(
          "max-w-[88%] rounded-mt-card px-3 py-2 sm:max-w-[72%]",
          customer && "border border-mt-line bg-mt-surface text-mt-text",
          human && "bg-mt-btn text-mt-btn-text",
          !customer && !human && "bg-mt-surface-raised text-mt-text"
        )}
      >
        <p className={cx("mb-1 flex items-center gap-1.5 text-xs font-medium", human ? "opacity-75" : "text-mt-muted")}>
          <SenderIcon className="h-3 w-3" aria-hidden="true" />
          {senderLabel(message)}
        </p>
        {message.message_type === "image" && (
          <ChatImage conversationId={conversationId} messageId={message._id} headers={headers} onLoad={onImageLoad} />
        )}
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.content}</p>
        {showDebug && !customer && (
          <div className="mt-2 rounded-mt-card bg-black/80 p-2 font-mono text-[10px] text-white">
            <p>phase: {message.metadata?.flow_phase || "unknown"}</p>
            <p>intent: {message.metadata?.intent?.intent || "unknown"}</p>
            <p>action: {message.metadata?.intent?.action || "none"}</p>
            <p>tools: {(message.metadata?.tool_calls || []).map((item) => item.name).join(", ") || "none"}</p>
          </div>
        )}
        <p className={cx("mt-1 text-right text-[11px]", human ? "opacity-75" : "text-mt-subtle")}>{formatTime(message.created_at)}</p>
      </div>
    </div>
  );
};

// Follows new messages unless the admin has scrolled up to read older ones.
// Mounted once per chat (keyed by id), so it always opens at the newest message.
const Thread = ({ conversationId, messages, activity, userId, headers, showDebug }) => {
  const scrollRef = useRef(null);
  const [pinned, setPinned] = useState(true);
  const lastId = messages.at(-1)?._id;
  const [seenId, setSeenId] = useState(lastId);
  const timeline = useMemo(() => [
    ...messages.map((item) => ({ kind: "message", item })),
    ...activity.map((item) => ({ kind: "activity", item })),
  ].sort((a, b) => new Date(a.item.created_at) - new Date(b.item.created_at)), [activity, messages]);
  const lastEntryId = timeline.at(-1)?.item._id;

  const scrollToEnd = useCallback(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, []);

  useLayoutEffect(() => {
    if (pinned) scrollToEnd();
  }, [lastEntryId, pinned, scrollToEnd]);

  const handleScroll = (event) => {
    const element = event.currentTarget;
    const atEnd = element.scrollHeight - element.scrollTop - element.clientHeight < 48;
    setPinned(atEnd);
    if (atEnd) setSeenId(lastId);
  };

  const handleImageLoad = () => {
    if (pinned) scrollToEnd();
  };

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={scrollRef} onScroll={handleScroll} className="h-full space-y-2 overflow-y-auto bg-mt-bg p-3 sm:p-5" aria-live="polite">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-mt-muted">No messages in this chat yet.</p>}
        {timeline.map(({ kind, item }, index) => {
          const newDay = index === 0 || dayKey(timeline[index - 1].item.created_at) !== dayKey(item.created_at);
          return (
            <div key={`${kind}-${item._id}`}>
              {newDay && (
                <p className="py-3 text-center text-xs text-mt-subtle">{formatDay(item.created_at)}</p>
              )}
              {kind === "activity" ? (
                <p className="py-1 text-center text-xs text-mt-muted">
                  {activityLabel(item, userId)} · {formatTime(item.created_at)}
                </p>
              ) : (
                <MessageBubble
                  message={item}
                  conversationId={conversationId}
                  headers={headers}
                  showDebug={showDebug}
                  onImageLoad={handleImageLoad}
                />
              )}
            </div>
          );
        })}
      </div>
      {!pinned && lastId !== seenId && (
        <Button size="sm" leadingIcon={ArrowDown} onClick={scrollToEnd} className="absolute bottom-3 left-1/2 -translate-x-1/2 shadow-lg">
          New messages
        </Button>
      )}
    </div>
  );
};

const Composer = ({ conversation, messages, now, userId, value, onChange, onSubmit, sending, saving, onReopen }) => {
  const window24h = replyWindow(messages, now);
  const closed = isClosed(conversation);
  const canReply = window24h.open && !closed;

  let hint = "Replying pauses the AI until you resume it, or after 12 hours without a team reply.";
  if (isOwnedByOther(conversation, userId)) {
    hint = `${conversation.handoff_assigned_name || "A teammate"} owns this chat. Your reply goes out under your name and they stay the owner.`;
  } else if (isMine(conversation, userId)) {
    hint = "The AI stays paused until you resume it, or after 12 hours without a team reply.";
  }

  if (closed) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-mt-line bg-mt-surface p-3">
        <p className="text-sm text-mt-muted">This chat is closed. Reopen it to reply.</p>
        <Button size="sm" variant="outline" onClick={onReopen} disabled={saving}>Reopen chat</Button>
      </div>
    );
  }

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) onSubmit(event);
  };

  const insertQuickReply = (text) => onChange(value.trim() ? `${value.trimEnd()}\n${text}` : text);

  return (
    <form onSubmit={onSubmit} className="border-t border-mt-line bg-mt-surface p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
        <p className={canReply ? "text-mt-muted" : "text-mt-warning"}>
          {canReply
            ? hint
            : "WhatsApp only allows replies within 24 hours of the customer's last message. Wait for them to write again."}
        </p>
        {canReply && (
          <span className={cx("shrink-0 font-medium", window24h.remainingMs < 2 * 60 * 60 * 1000 ? "text-mt-warning" : "text-mt-muted")}>
            Reply window: {formatDuration(window24h.remainingMs)} left
          </span>
        )}
      </div>
      {canReply && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {QUICK_REPLIES.map((reply) => (
            <button
              key={reply.label}
              type="button"
              onClick={() => insertQuickReply(reply.text(conversation.customer_name))}
              className="rounded-mt-btn border border-mt-line px-2 py-1 text-xs text-mt-muted transition-colors hover:border-mt-line-strong hover:text-mt-text focus-visible:outline-2 focus-visible:outline-mt-text"
            >
              {reply.label}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          maxLength={4096}
          disabled={!canReply}
          readOnly={sending}
          aria-label="Reply to customer"
          placeholder={canReply ? "Reply as the store team (Shift+Enter for a new line)" : "Reply window closed"}
          className="min-w-0 flex-1"
          textareaClassName="resize-none"
        />
        <Button type="submit" leadingIcon={Send} loading={sending} disabled={!canReply || !value.trim()}>
          Send
        </Button>
      </div>
    </form>
  );
};

const COLLAPSED_ACTIVITY_COUNT = 5;

const OwnerSelect = ({ conversation, admins, userId, disabled, onAssign }) => {
  const claimed = isClaimed(conversation);
  const ownerId = claimed ? String(conversation.handoff_assigned_to) : "";
  const options = admins.map((admin) => ({
    value: admin._id,
    label: String(admin._id) === String(userId) ? `${admin.name} (you)` : admin.name,
  }));
  // The owner may no longer be an admin, but the chat should still show who has it.
  if (ownerId && !options.some((option) => option.value === ownerId)) {
    options.unshift({ value: ownerId, label: conversation.handoff_assigned_name || "Team", disabled: true });
  }
  return (
    <Select
      label="Owner"
      hint="Assigning pauses the AI. The new owner isn't notified, but the chat appears in their Mine queue."
      value={ownerId}
      placeholder="Unassigned"
      options={options}
      disabled={disabled}
      onChange={(event) => onAssign(event.target.value)}
    />
  );
};

const NotesSection = ({ conversation, notes, value, onChange, onAdd, saving }) => (
  <section aria-labelledby="chat-notes-heading" className="space-y-2">
    <h2 id="chat-notes-heading" className="text-sm font-medium text-mt-text">Team notes</h2>
    <Textarea
      aria-label="New team note"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      rows={3}
      maxLength={2000}
      placeholder="Sizing, design, budget or follow-up notes"
      textareaClassName="resize-none"
    />
    <Button variant="outline" size="sm" fullWidth disabled={saving || !value.trim()} onClick={onAdd}>
      Add note
    </Button>
    {notes.length > 0 && (
      <ul className="space-y-2 pt-1">
        {notes.map((note) => (
          <li key={note._id} className="rounded-mt-card border border-mt-line p-2.5 text-xs">
            <p className="whitespace-pre-wrap break-words leading-relaxed text-mt-text">{note.text}</p>
            <p className="mt-1 text-mt-subtle">{note.author_name} · {formatDay(note.created_at)}, {formatTime(note.created_at)}</p>
          </li>
        ))}
      </ul>
    )}
    {conversation.lead_note && (
      <div className="rounded-mt-card border border-mt-line p-2.5 text-xs">
        <p className="whitespace-pre-wrap break-words leading-relaxed text-mt-text">{conversation.lead_note}</p>
        <p className="mt-1 text-mt-subtle">Earlier note, author not recorded</p>
      </div>
    )}
  </section>
);

const ActivitySection = ({ activity, userId }) => {
  const [expanded, setExpanded] = useState(false);
  if (activity.length === 0) return null;
  const newestFirst = [...activity].reverse();
  const visible = expanded ? newestFirst : newestFirst.slice(0, COLLAPSED_ACTIVITY_COUNT);
  return (
    <section aria-labelledby="chat-activity-heading" className="space-y-2">
      <h2 id="chat-activity-heading" className="text-sm font-medium text-mt-text">Activity</h2>
      <ol className="space-y-2 border-l border-mt-line pl-3 text-xs">
        {visible.map((event) => (
          <li key={event._id}>
            <p className="break-words text-mt-text">{activityLabel(event, userId)}</p>
            <p className="text-mt-subtle">{formatDay(event.created_at)}, {formatTime(event.created_at)}</p>
          </li>
        ))}
      </ol>
      {newestFirst.length > COLLAPSED_ACTIVITY_COUNT && (
        <Button variant="link" className="text-xs" onClick={() => setExpanded((value) => !value)}>
          {expanded ? "Show less" : `Show all ${newestFirst.length}`}
        </Button>
      )}
    </section>
  );
};

const DetailsPanel = ({
  conversation,
  leadType,
  userId,
  now,
  saving,
  admins,
  notes,
  activity,
  noteDraft,
  onNoteChange,
  onAddNote,
  onUpdate,
  onOpenWhatsApp,
  showDebug,
}) => {
  const closed = isClosed(conversation);
  const status = aiStatus(conversation);
  const statusColor = { success: "text-mt-success", warning: "text-mt-warning", danger: "text-mt-danger", neutral: "text-mt-muted" }[status.tone];

  return (
    <div className="space-y-6 p-4">
      <section aria-labelledby="chat-status-heading" className="space-y-3">
        <h2 id="chat-status-heading" className="text-sm font-medium text-mt-text">Chat status</h2>
        <p className={cx("text-sm", statusColor)}>{status.label}</p>

        {isUnclaimed(conversation) && (
          <p className="text-xs leading-relaxed text-mt-muted">The AI keeps replying until a team member claims this chat.</p>
        )}

        {isOwnedByOther(conversation, userId) && (
          <Button variant="outline" size="sm" fullWidth disabled={saving} onClick={() => onUpdate({ assignToMe: true })}>
            Take over chat
          </Button>
        )}
        {isClaimed(conversation) && (
          <Button variant="outline" size="sm" fullWidth disabled={saving} onClick={() => onUpdate({ conversationStatus: "open" })}>
            Resume AI
          </Button>
        )}
        {!closed && !isClaimed(conversation) && (
          <Button size="sm" fullWidth disabled={saving} onClick={() => onUpdate({ assignToMe: true })}>
            Claim chat and pause AI
          </Button>
        )}
        {!closed && admins.length > 0 && (
          <OwnerSelect
            conversation={conversation}
            admins={admins}
            userId={userId}
            disabled={saving}
            onAssign={(id) => onUpdate({ assignTo: id })}
          />
        )}
        {!closed && (
          <Button variant="ghost" size="sm" fullWidth disabled={saving} onClick={() => onUpdate({ conversationStatus: "closed" })}>
            Close chat
          </Button>
        )}
      </section>

      {conversation.status === "handoff" && (conversation.handoff_reason || conversation.handoff_summary) && (
        <section className="rounded-mt-card border border-mt-line bg-mt-surface-raised p-3 text-xs leading-relaxed text-mt-text">
          <h2 className="font-medium capitalize">{String(conversation.handoff_reason || "Team help").replaceAll("_", " ")}</h2>
          <p className="mt-1 whitespace-pre-wrap text-mt-muted">{conversation.handoff_summary || "No summary available."}</p>
        </section>
      )}

      <section aria-labelledby="chat-customer-heading" className="space-y-2">
        <h2 id="chat-customer-heading" className="text-sm font-medium text-mt-text">Customer</h2>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
          <dt className="text-mt-subtle">Number</dt>
          <dd className="break-words text-mt-text">{phoneLabel(conversation.external_customer_ref)}</dd>
          <dt className="text-mt-subtle">First chat</dt>
          <dd className="text-mt-text">{conversation.created_at ? formatDay(conversation.created_at) : "—"}</dd>
          <dt className="text-mt-subtle">Last activity</dt>
          <dd className="text-mt-text">
            {conversation.last_message_at ? `${formatListDate(conversation.last_message_at, now)}, ${formatDuration(now - new Date(conversation.last_message_at).getTime())} ago` : "—"}
          </dd>
          {leadType && (
            <>
              <dt className="text-mt-subtle">Lead type</dt>
              <dd className="capitalize text-mt-text">{leadType}</dd>
            </>
          )}
        </dl>
        <Button
          variant="outline"
          size="sm"
          fullWidth
          leadingIcon={ExternalLink}
          disabled={!whatsappLink(conversation)}
          onClick={onOpenWhatsApp}
        >
          Open in WhatsApp
        </Button>
        <p className="text-xs leading-relaxed text-mt-subtle">
          {isClaimed(conversation)
            ? "Opens the chat in your own WhatsApp."
            : "Opens the chat in your own WhatsApp, claims it and pauses the AI."}
        </p>
      </section>

      <Select
        label="Lead status"
        value={conversation.lead_status || "new"}
        options={LEAD_STATUS_OPTIONS}
        disabled={saving}
        onChange={(event) => onUpdate({ leadStatus: event.target.value })}
      />

      <NotesSection
        conversation={conversation}
        notes={notes}
        value={noteDraft}
        onChange={onNoteChange}
        onAdd={onAddNote}
        saving={saving}
      />

      <ActivitySection activity={activity} userId={userId} />

      {showDebug && (
        <section className="rounded-mt-card bg-black/80 p-3 font-mono text-[11px] text-white">
          <h2 className="mb-2 font-medium">Conversation flow</h2>
          <p>current: {conversation.conversation_state?.flow_phase || "unknown"}</p>
          <p>previous: {conversation.conversation_state?.flow_previous_phase || "none"}</p>
          <p>intent: {conversation.current_intent || "none"}</p>
          <p>selected: {conversation.selected_product_id || conversation.conversation_state?.selected_product_id || "none"}</p>
          <p>purchase: {conversation.conversation_state?.purchase ? "pending" : "none"}</p>
        </section>
      )}
    </div>
  );
};

const HealthDialog = ({ open, onClose, overview, now }) => {
  const groups = overview ? [
    { title: "Team", items: [
      ["Open chats", overview.open_chats ?? 0],
      ["Open handoffs", overview.active_handoffs ?? 0],
      ["Oldest open handoff", overview.oldest_handoff_at ? formatDuration(now - new Date(overview.oldest_handoff_at).getTime()) : "—"],
    ] },
    { title: "AI speed", items: [
      ["Requests", overview.requests ?? 0],
      ["Avg reply time", formatSeconds(overview.average_latency_ms)],
      ["Slowest 10% over", formatSeconds(overview.p90_latency_ms)],
      ["Timed out", overview.timed_out ?? 0],
      ["Avg AI model time", formatSeconds(overview.average_model_ms)],
      ["Avg lookup time", formatSeconds(overview.average_tool_ms)],
    ] },
    { title: "Problems", items: [
      ["Image failures", overview.image_failures ?? 0],
      ["Delivery errors", overview.delivery_errors ?? 0],
      ["Not delivered by Meta", overview.meta_delivery_failures ?? 0],
      ["Order updates not sent", overview.order_updates_not_sent ?? 0],
    ] },
    { title: "Cost", items: [
      ["AI cost", `$${Number(overview.estimated_cost_usd || 0).toFixed(4)}`],
    ] },
  ] : [];

  return (
    <Modal open={open} onClose={onClose} title="AI and delivery health" size="lg">
      {!overview ? (
        <p className="text-sm text-mt-muted">Health data isn't available right now.</p>
      ) : (
        <div className="space-y-5">
          <p className="flex items-center gap-2 text-sm text-mt-muted">
            <Badge variant={overview.status === "degraded" ? "danger" : "success"} className="capitalize">{overview.status}</Badge>
            Last {overview.window_hours ?? 24} hours
          </p>
          {groups.map((group) => (
            <section key={group.title}>
              <h3 className="mb-2 text-sm font-medium text-mt-text">{group.title}</h3>
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {group.items.map(([label, value]) => (
                  <div key={label} className="rounded-mt-card border border-mt-line p-3">
                    <dt className="text-xs text-mt-muted">{label}</dt>
                    <dd className="mt-1 text-lg font-medium tabular-nums text-mt-text">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      )}
    </Modal>
  );
};

export default function WhatsAppChatAdmin() {
  const token = useSelector(selectCurrentToken);
  const currentUser = useSelector(selectCurrentUser);
  const userId = currentUser?._id;

  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [activeQueue, setActiveQueue] = useState("needs_reply");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [mobilePane, setMobilePane] = useState("list");
  const [overview, setOverview] = useState(null);
  const [healthOpen, setHealthOpen] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [takeover, setTakeover] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [now, setNow] = useState(() => Date.now());
  // Unsent text is kept per chat, so refreshes can't wipe it and a draft can't
  // follow the admin to a different customer.
  const [replyDrafts, setReplyDrafts] = useState({});
  const [noteDrafts, setNoteDrafts] = useState({});
  const latestDetailId = useRef("");

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const loadChats = useCallback(async ({ quiet = false } = {}) => {
    if (!token) return;
    if (!quiet) setLoading(true);
    try {
      const { data } = await axios.get(`${API_URL}/admin/whatsapp-chats`, { headers });
      setConversations(Array.isArray(data?.conversations) ? data.conversations : []);
      setNow(Date.now());
      setLoadError("");
    } catch (requestError) {
      setLoadError(requestError.response?.data?.message || "Could not load WhatsApp chats.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [headers, token]);

  const loadOverview = useCallback(async () => {
    if (!token) return;
    try {
      const { data } = await axios.get(`${API_URL}/admin/whatsapp-chats/overview`, { headers });
      setOverview(data);
    } catch {
      // Chat management remains available if monitoring is temporarily unavailable.
    }
  }, [headers, token]);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    axios.get(`${API_URL}/admin/whatsapp-chats/admins`, { headers })
      .then(({ data }) => {
        if (active) setAdmins(Array.isArray(data?.admins) ? data.admins : []);
      })
      .catch(() => {
        // Assigning stays hidden; claiming and replying don't need the team list.
      });
    return () => {
      active = false;
    };
  }, [headers, token]);

  const loadDetail = useCallback(async (id) => {
    if (!id || !token) return;
    latestDetailId.current = id;
    try {
      const { data } = await axios.get(`${API_URL}/admin/whatsapp-chats/${id}`, { headers });
      // A slow response must not replace the chat the admin has since switched to.
      if (latestDetailId.current !== id) return;
      setDetail(data);
      setNow(Date.now());
      setLoadError("");
    } catch (requestError) {
      if (latestDetailId.current !== id) return;
      setLoadError(requestError.response?.data?.message || "Could not load this conversation.");
    }
  }, [headers, token]);

  useEffect(() => {
    const initial = window.setTimeout(() => {
      loadChats();
      loadOverview();
    }, 0);
    const timer = window.setInterval(() => {
      loadChats({ quiet: true });
      loadOverview();
    }, LIST_REFRESH_MS);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [loadChats, loadOverview]);

  useEffect(() => {
    if (!selectedId) return undefined;
    const initial = window.setTimeout(() => loadDetail(selectedId), 0);
    const timer = window.setInterval(() => loadDetail(selectedId), CHAT_REFRESH_MS);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [loadDetail, selectedId]);

  const context = useMemo(() => ({ now, userId }), [now, userId]);

  const counts = useMemo(() => Object.fromEntries(
    QUEUES.map((queue) => [queue.id, conversations.filter((chat) => inQueue(queue.id, chat, context)).length])
  ), [context, conversations]);

  const oldestWaitMs = useMemo(() => {
    const waits = conversations
      .filter((chat) => needsReply(chat, now))
      .map((chat) => now - new Date(waitingSince(chat)).getTime());
    return waits.length ? Math.max(...waits) : null;
  }, [conversations, now]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const queryDigits = query.replace(/\D/g, "");
    const rows = conversations.filter((chat) => {
      if (!query) return inQueue(activeQueue, chat, context);
      // Searching covers every chat, so nobody is hidden by the current queue.
      return [chat.customer_name, chat.last_message?.content]
        .some((value) => String(value || "").toLowerCase().includes(query))
        || (queryDigits && String(chat.external_customer_ref || "").includes(queryDigits));
    });
    return sortForQueue(query ? "all" : activeQueue, rows);
  }, [activeQueue, context, conversations, search]);

  const activeDetail = detail?.conversation?._id === selectedId ? detail : null;
  const selectedConversation = activeDetail?.conversation;
  const messages = activeDetail?.messages || [];
  const selectedRow = conversations.find((chat) => chat._id === selectedId);
  const replyText = replyDrafts[selectedId] ?? "";
  const noteDraft = noteDrafts[selectedId] ?? "";
  const notes = activeDetail?.notes || [];
  const activity = activeDetail?.activity || [];

  const refreshAfterChange = (id) => Promise.all([loadChats({ quiet: true }), loadDetail(id)]);

  const updateConversation = async (changes) => {
    if (!selectedId) return false;
    setSaving(true);
    try {
      await axios.patch(`${API_URL}/admin/whatsapp-chats/${selectedId}`, changes, { headers });
      await refreshAfterChange(selectedId);
      setActionError("");
      return true;
    } catch (requestError) {
      const response = requestError.response;
      if (response?.status === 409 && response.data?.code === "owned_by_other") {
        const target = admins.find((admin) => admin._id === changes.assignTo);
        const toOtherAdmin = target && String(target._id) !== String(userId);
        setTakeover({ changes, ownerName: response.data.owner_name, targetName: toOtherAdmin ? target.name : null });
      } else {
        setActionError(response?.data?.message || "Could not update the conversation.");
      }
      return false;
    } finally {
      setSaving(false);
    }
  };

  const confirmTakeover = async () => {
    const { changes } = takeover;
    setTakeover(null);
    await updateConversation({ ...changes, confirmTakeover: true });
  };

  const addNote = async () => {
    const id = selectedId;
    const text = noteDraft.trim();
    if (!id || !text) return;
    setSaving(true);
    try {
      await axios.post(`${API_URL}/admin/whatsapp-chats/${id}/notes`, { text }, { headers });
      setNoteDrafts((drafts) => withoutKey(drafts, id));
      await loadDetail(id);
      setActionError("");
    } catch (requestError) {
      setActionError(requestError.response?.data?.message || "Could not save the note.");
    } finally {
      setSaving(false);
    }
  };

  const openTeamWhatsApp = async () => {
    const url = whatsappLink(selectedConversation);
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
    const leadStatus = !selectedConversation.lead_status || selectedConversation.lead_status === "new"
      ? "contacted"
      : selectedConversation.lead_status;
    // Messaging a customer shouldn't take the chat from the teammate who owns it.
    await updateConversation(isClaimed(selectedConversation)
      ? { leadStatus }
      : { leadStatus, conversationStatus: "handoff" });
  };

  const sendReply = async (event) => {
    event.preventDefault();
    const id = selectedId;
    const text = replyText.trim();
    if (!id || !text || sending) return;
    setSending(true);
    try {
      await axios.post(`${API_URL}/admin/whatsapp-chats/${id}/reply`, { text }, { headers });
      setReplyDrafts((drafts) => withoutKey(drafts, id));
      await refreshAfterChange(id);
      setActionError("");
    } catch (requestError) {
      setActionError(requestError.response?.data?.message || "Could not send the reply.");
    } finally {
      setSending(false);
    }
  };

  const selectChat = (id) => {
    setSelectedId(id);
    setMobilePane("chat");
  };

  const summary = `${counts.needs_reply ?? 0} need a reply · ${counts.unclaimed ?? 0} unclaimed`;

  const error = actionError || loadError;
  const emptyMessage = search.trim()
    ? "No chats match your search."
    : QUEUES.find((queue) => queue.id === activeQueue)?.empty;

  return (
    <main className="flex h-dvh flex-col bg-mt-bg font-brand text-mt-text">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-mt-line bg-mt-surface px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Button to="/adminpage" variant="ghost" size="sm" leadingIcon={ArrowLeft} aria-label="Back to admin" />
          <div className="min-w-0">
            <h1 className="text-base font-medium leading-tight sm:text-lg">Support inbox</h1>
            <p className="truncate text-xs text-mt-muted" aria-live="polite">
              {loading ? "Loading chats" : summary}
              {!loading && oldestWaitMs != null && <span className="hidden sm:inline"> · longest wait {formatDuration(oldestWaitMs)}</span>}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center sm:gap-1">
          <Button variant="ghost" size="sm" leadingIcon={Activity} onClick={() => setHealthOpen(true)}>
            <span className="inline-flex items-center gap-1.5">
              <span className="sr-only sm:not-sr-only">Health</span>
              {overview?.status === "degraded" && <span className="h-2 w-2 rounded-full bg-mt-danger" role="img" aria-label="Degraded" />}
            </span>
          </Button>
          <Button variant="ghost" size="sm" leadingIcon={Bug} aria-pressed={showDebug} onClick={() => setShowDebug((value) => !value)}>
            <span className="sr-only sm:not-sr-only">{showDebug ? "Hide flow" : "Debug flow"}</span>
          </Button>
          <Button variant="ghost" size="sm" leadingIcon={RefreshCw} onClick={() => { loadChats(); loadOverview(); if (selectedId) loadDetail(selectedId); }}>
            <span className="sr-only sm:not-sr-only">Refresh</span>
          </Button>
        </div>
      </header>

      {error && (
        <div role="alert" className="flex shrink-0 items-center justify-between gap-3 border-b border-mt-danger/30 bg-mt-danger/10 px-4 py-2 text-sm text-mt-danger">
          <span>{error}</span>
          {actionError && <Button variant="ghost" size="sm" onClick={() => setActionError("")}>Dismiss</Button>}
        </div>
      )}

      <div className="grid min-h-0 flex-1 lg:grid-cols-[320px_minmax(0,1fr)_300px]">
        <aside className={cx(mobilePane === "list" ? "flex" : "hidden", "min-h-0 flex-col border-mt-line bg-mt-surface lg:flex lg:border-r")} aria-label="Conversations">
          <div className="space-y-3 border-b border-mt-line p-3">
            <label className="flex h-9 items-center gap-2 rounded-mt-btn border border-mt-line px-2.5 focus-within:border-mt-text">
              <Search className="h-4 w-4 shrink-0 text-mt-subtle" aria-hidden="true" />
              <span className="sr-only">Search chats</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full bg-transparent text-sm text-mt-text outline-none placeholder:text-mt-subtle"
                placeholder="Search all chats"
              />
            </label>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Queues">
              {QUEUES.map((queue) => {
                const active = activeQueue === queue.id && !search.trim();
                return (
                  <button
                    key={queue.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => { setActiveQueue(queue.id); setSearch(""); }}
                    className={cx(
                      "inline-flex items-center gap-1.5 rounded-mt-btn border px-2 py-1 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-mt-text",
                      active ? "border-mt-btn bg-mt-btn text-mt-btn-text" : "border-mt-line text-mt-muted hover:border-mt-line-strong hover:text-mt-text"
                    )}
                  >
                    {queue.label}
                    <span className="font-medium tabular-nums">{counts[queue.id] ?? 0}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="space-y-3 p-4" aria-hidden="true">
                {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-16 w-full" />)}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState icon={MessageCircle} description={emptyMessage} />
            ) : filtered.map((chat) => (
              <ChatRow key={chat._id} chat={chat} selected={selectedId === chat._id} now={now} userId={userId} onSelect={selectChat} />
            ))}
          </div>
        </aside>

        <section className={cx(mobilePane === "chat" ? "flex" : "hidden", "min-h-0 min-w-0 flex-col lg:flex")} aria-label="Conversation">
          {!selectedId ? (
            <EmptyState className="m-auto" icon={MessageCircle} title="Select a chat" description="Pick a customer from the list to read the conversation and reply." />
          ) : !selectedConversation ? (
            <div className="m-auto flex items-center gap-2 text-sm text-mt-muted">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading conversation
            </div>
          ) : (
            <>
              <div className="flex shrink-0 items-center gap-2 border-b border-mt-line bg-mt-surface px-3 py-2">
                <Button variant="ghost" size="sm" leadingIcon={ChevronLeft} aria-label="Back to conversations" className="lg:hidden" onClick={() => setMobilePane("list")} />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-medium">{selectedConversation.customer_name || phoneLabel(selectedConversation.external_customer_ref)}</h2>
                  <p className="truncate text-xs text-mt-muted">{phoneLabel(selectedConversation.external_customer_ref)} · {aiStatus(selectedConversation).label}</p>
                </div>
                <Button variant="ghost" size="sm" leadingIcon={Info} className="lg:hidden" onClick={() => setMobilePane("details")}>
                  Details
                </Button>
              </div>
              <Thread key={selectedId} conversationId={selectedId} messages={messages} activity={activity} userId={userId} headers={headers} showDebug={showDebug} />
              <Composer
                conversation={selectedConversation}
                messages={messages}
                now={now}
                userId={userId}
                value={replyText}
                onChange={(text) => setReplyDrafts((drafts) => ({ ...drafts, [selectedId]: text }))}
                onSubmit={sendReply}
                sending={sending}
                saving={saving}
                onReopen={() => updateConversation({ conversationStatus: "open" })}
              />
            </>
          )}
        </section>

        <aside className={cx(mobilePane === "details" ? "block" : "hidden", "min-h-0 overflow-y-auto border-mt-line bg-mt-surface lg:block lg:border-l")} aria-label="Chat details">
          {mobilePane === "details" && (
            <div className="border-b border-mt-line p-2 lg:hidden">
              <Button variant="ghost" size="sm" leadingIcon={ChevronLeft} onClick={() => setMobilePane("chat")}>Back to chat</Button>
            </div>
          )}
          {selectedConversation ? (
            <DetailsPanel
              key={selectedId}
              conversation={selectedConversation}
              leadType={selectedRow?.lead_type || selectedConversation.lead_type}
              userId={userId}
              now={now}
              saving={saving}
              admins={admins}
              notes={notes}
              activity={activity}
              noteDraft={noteDraft}
              onNoteChange={(text) => setNoteDrafts((drafts) => ({ ...drafts, [selectedId]: text }))}
              onAddNote={addNote}
              onUpdate={updateConversation}
              onOpenWhatsApp={openTeamWhatsApp}
              showDebug={showDebug}
            />
          ) : (
            <p className="p-4 text-sm text-mt-muted">Select a chat to manage it.</p>
          )}
        </aside>
      </div>

      <HealthDialog open={healthOpen} onClose={() => setHealthOpen(false)} overview={overview} now={now} />

      <Modal
        open={Boolean(takeover)}
        onClose={() => setTakeover(null)}
        title={takeover?.targetName ? "Reassign this chat?" : "Take over this chat?"}
        size="sm"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setTakeover(null)}>Cancel</Button>
            <Button onClick={confirmTakeover}>{takeover?.targetName ? "Reassign" : "Take over"}</Button>
          </>
        )}
      >
        <p className="text-sm leading-relaxed text-mt-muted">
          {takeover?.targetName
            ? `${takeover.ownerName} owns this chat. It will move to ${takeover.targetName}, and neither of them will be notified.`
            : `${takeover?.ownerName} owns this chat. If you take over, you become the owner instead and they won't be notified.`}
        </p>
      </Modal>
    </main>
  );
}
