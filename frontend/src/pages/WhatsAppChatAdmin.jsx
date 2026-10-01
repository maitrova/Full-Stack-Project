import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  MessageCircle,
  Paintbrush,
  RefreshCw,
  Search,
  UserRound,
  Users,
} from "lucide-react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { selectCurrentToken } from "../redux/slices/Userslice.js";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/$/, "");
const LEAD_STATUSES = ["new", "contacted", "qualified", "converted", "closed"];

const formatDate = (value) => {
  if (!value) return "No messages yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

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

const badgeClass = (value) => {
  if (value === "handoff") return "bg-amber-100 text-amber-800";
  if (value === "closed") return "bg-slate-200 text-slate-700";
  if (value === "converted") return "bg-emerald-100 text-emerald-800";
  if (value === "customization") return "bg-violet-100 text-violet-800";
  return "bg-sky-100 text-sky-800";
};

const ChatImage = ({ conversationId, messageId, headers }) => {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    axios.get(
      `${API_URL}/admin/whatsapp-chats/${conversationId}/media/${messageId}`,
      { headers, responseType: "blob" }
    ).then(({ data }) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(data);
      setSrc(objectUrl);
    }).catch(() => {
      if (active) setSrc("");
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [conversationId, headers, messageId]);

  if (!src) return <p className="mb-1 text-xs font-medium text-slate-500">Image preview unavailable</p>;
  return <img src={src} alt="Customer attachment" className="mb-2 max-h-72 w-auto max-w-full rounded-xl object-contain" />;
};

export default function WhatsAppChatAdmin() {
  const token = useSelector(selectCurrentToken);
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [activeView, setActiveView] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [leadNote, setLeadNote] = useState("");

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const loadChats = useCallback(async ({ quiet = false } = {}) => {
    if (!token) return;
    if (!quiet) setLoading(true);
    try {
      const { data } = await axios.get(`${API_URL}/admin/whatsapp-chats`, { headers });
      const rows = Array.isArray(data?.conversations) ? data.conversations : [];
      setConversations(rows);
      setSelectedId((current) => current || rows[0]?._id || "");
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not load WhatsApp chats.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [headers, token]);

  const loadDetail = useCallback(async (id, { quiet = false } = {}) => {
    if (!id || !token) return;
    if (!quiet) setDetailLoading(true);
    try {
      const { data } = await axios.get(`${API_URL}/admin/whatsapp-chats/${id}`, { headers });
      setDetail(data);
      setLeadNote(data?.conversation?.lead_note || "");
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not load this conversation.");
    } finally {
      if (!quiet) setDetailLoading(false);
    }
  }, [headers, token]);

  useEffect(() => {
    loadChats();
    const timer = window.setInterval(() => loadChats({ quiet: true }), 15000);
    return () => window.clearInterval(timer);
  }, [loadChats]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return undefined;
    }
    loadDetail(selectedId);
    const timer = window.setInterval(() => loadDetail(selectedId, { quiet: true }), 10000);
    return () => window.clearInterval(timer);
  }, [loadDetail, selectedId]);

  const stats = useMemo(() => ({
    all: conversations.length,
    customization: conversations.filter((item) => item.lead_type === "customization").length,
    handoff: conversations.filter((item) => item.status === "handoff").length,
  }), [conversations]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return conversations.filter((item) => {
      if (activeView === "customization" && item.lead_type !== "customization") return false;
      if (activeView === "handoff" && item.status !== "handoff") return false;
      if (!query) return true;
      return [item.customer_name, item.external_customer_ref, item.last_message?.content]
        .some((value) => String(value || "").toLowerCase().includes(query));
    });
  }, [activeView, conversations, search]);

  const updateConversation = async (changes) => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await axios.patch(`${API_URL}/admin/whatsapp-chats/${selectedId}`, changes, { headers });
      await Promise.all([loadChats({ quiet: true }), loadDetail(selectedId, { quiet: true })]);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not update the conversation.");
    } finally {
      setSaving(false);
    }
  };

  const openTeamWhatsApp = async () => {
    const url = whatsappLink(detail?.conversation);
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
    await updateConversation({
      leadStatus: detail?.conversation?.lead_status === "new" || !detail?.conversation?.lead_status
        ? "contacted"
        : detail.conversation.lead_status,
      conversationStatus: "handoff",
    });
  };

  const selectedConversation = detail?.conversation;
  const messages = detail?.messages || [];

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-6">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/adminpage" className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" aria-label="Back to admin">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold sm:text-2xl">WhatsApp chats</h1>
              <p className="text-sm text-slate-500">Monitor AI conversations and manage customer leads.</p>
            </div>
          </div>
          <button onClick={() => loadChats()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-[1600px] p-3 sm:p-6">
        {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          {[
            ["all", "All chats", stats.all, MessageCircle],
            ["customization", "Customization leads", stats.customization, Paintbrush],
            ["handoff", "Team requested", stats.handoff, Users],
          ].map(([id, label, count, Icon]) => (
            <button key={id} onClick={() => setActiveView(id)} className={`flex items-center justify-between rounded-2xl border p-4 text-left transition ${activeView === id ? "border-emerald-500 bg-emerald-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"}`}>
              <span className="flex items-center gap-3"><Icon className="h-5 w-5" /><span className="font-semibold">{label}</span></span>
              <span className="rounded-full bg-white px-2.5 py-1 text-sm font-bold shadow-sm">{count}</span>
            </button>
          ))}
        </div>

        <div className="grid min-h-[720px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[360px_minmax(0,1fr)_300px]">
          <aside className="border-b border-slate-200 lg:border-b-0 lg:border-r">
            <div className="border-b border-slate-200 p-3">
              <label className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder="Search name, number, or message" />
              </label>
            </div>
            <div className="max-h-[660px] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading chats</div>
              ) : filtered.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-500">No chats in this view.</p>
              ) : filtered.map((item) => (
                <button key={item._id} onClick={() => setSelectedId(item._id)} className={`w-full border-b border-slate-100 p-4 text-left transition hover:bg-slate-50 ${selectedId === item._id ? "bg-emerald-50" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{item.customer_name || phoneLabel(item.external_customer_ref)}</p>
                      <p className="text-xs text-slate-500">{phoneLabel(item.external_customer_ref)}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-slate-400">{formatDate(item.last_message_at)}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-600">{item.last_message?.content || "Conversation started"}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.lead_type === "customization" && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeClass("customization")}`}>Customization</span>}
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeClass(item.status)}`}>{item.status || "open"}</span>
                    {item.lead_status && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold capitalize text-slate-600">{item.lead_status}</span>}
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <section className="flex min-h-[620px] flex-col bg-[#efeae2]">
            {!selectedId ? (
              <div className="m-auto text-center text-slate-500"><MessageCircle className="mx-auto mb-3 h-10 w-10" /><p>Select a conversation.</p></div>
            ) : detailLoading && !detail ? (
              <div className="m-auto flex items-center gap-2 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading conversation</div>
            ) : (
              <>
                <div className="border-b border-slate-200 bg-white px-4 py-3">
                  <p className="font-semibold">{selectedConversation?.customer_name || phoneLabel(selectedConversation?.external_customer_ref)}</p>
                  <p className="text-xs text-slate-500">{phoneLabel(selectedConversation?.external_customer_ref)} · AI {selectedConversation?.status === "handoff" ? "paused for team" : selectedConversation?.status || "open"}</p>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {messages.map((message) => {
                    const customer = message.sender === "customer";
                    const human = message.sender === "human";
                    return (
                      <div key={message._id} className={`flex ${customer ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] rounded-2xl px-3 py-2 shadow-sm ${customer ? "rounded-br-sm bg-[#d9fdd3]" : human ? "rounded-bl-sm bg-amber-50" : "rounded-bl-sm bg-white"}`}>
                          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                            {customer ? <UserRound className="h-3 w-3" /> : human ? <Users className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                            {customer ? "Customer" : human ? "Team" : "AI"}
                          </div>
                          {message.message_type === "image" && (
                            <ChatImage conversationId={selectedConversation._id} messageId={message._id} headers={headers} />
                          )}
                          <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
                          <p className="mt-1 text-right text-[10px] text-slate-400">{formatDate(message.created_at)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>

          <aside className="border-t border-slate-200 p-4 lg:border-l lg:border-t-0">
            {selectedConversation ? (
              <div className="space-y-5">
                <div>
                  <h2 className="font-bold">Lead actions</h2>
                  <p className="mt-1 text-xs text-slate-500">Contact the customer from a team member's WhatsApp account.</p>
                </div>
                <button disabled={!whatsappLink(selectedConversation)} onClick={openTeamWhatsApp} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                  <MessageCircle className="h-4 w-4" /> Open in WhatsApp <ExternalLink className="h-3.5 w-3.5" />
                </button>

                <label className="block text-sm font-semibold">Lead status
                  <select value={selectedConversation.lead_status || "new"} onChange={(event) => updateConversation({ leadStatus: event.target.value })} disabled={saving} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-normal capitalize outline-none focus:border-emerald-500">
                    {LEAD_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </label>

                <div>
                  <p className="text-sm font-semibold">AI conversation</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button onClick={() => updateConversation({ conversationStatus: "open" })} disabled={saving || selectedConversation.status === "open"} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50">Resume AI</button>
                    <button onClick={() => updateConversation({ conversationStatus: "handoff" })} disabled={saving || selectedConversation.status === "handoff"} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 disabled:opacity-50">Pause AI</button>
                  </div>
                </div>

                <label className="block text-sm font-semibold">Team note
                  <textarea value={leadNote} onChange={(event) => setLeadNote(event.target.value)} rows={5} maxLength={2000} className="mt-2 w-full resize-none rounded-xl border border-slate-200 p-3 text-sm font-normal outline-none focus:border-emerald-500" placeholder="Add sizing, design, budget, or follow-up notes" />
                </label>
                <button onClick={() => updateConversation({ leadNote })} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Save note
                </button>

                <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                  <p className="flex items-center gap-1.5 font-semibold"><Clock3 className="h-3.5 w-3.5" /> Last activity</p>
                  <p className="mt-1">{formatDate(selectedConversation.last_message_at)}</p>
                </div>
              </div>
            ) : <p className="text-sm text-slate-500">Select a chat to manage the lead.</p>}
          </aside>
        </div>
      </section>
    </main>
  );
}
