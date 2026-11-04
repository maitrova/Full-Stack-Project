import mongoose from "mongoose";
import { callWhatsAppService } from "../services/whatsappOrderService.js";

const LEAD_STATUSES = new Set(["new", "contacted", "qualified", "converted", "closed"]);
const CONVERSATION_STATUSES = new Set(["open", "handoff", "closed"]);
const HANDOFF_STATUSES = new Set(["open", "assigned", "resolved", "resumed"]);

const requireAdmin = (req, res) => {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ message: "Admin access required" });
    return false;
  }
  return true;
};

const parseConversationId = (value) => {
  if (!mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
};

const serialize = (value) => JSON.parse(JSON.stringify(value));

const NOTE_MAX_LENGTH = 2000;
const HISTORY_LIMIT = 200;
// Alerts the team created itself; every other alert came from the customer's chat.
const TEAM_ALERT_REASONS = new Set(["team_paused_ai", "team_started"]);

const displayName = (user) => user?.name || user?.email || "Admin";

const isOwned = (conversation) => conversation?.status === "handoff"
  && conversation?.handoff_status === "assigned"
  && Boolean(conversation?.handoff_assigned_to);

let historyIndexes = null;
const ensureHistoryIndexes = (database) => {
  if (!historyIndexes) {
    historyIndexes = Promise.all(["whatsapp_chat_activity", "whatsapp_chat_notes"].map((name) => (
      database.collection(name).createIndex({ conversation_id: 1, created_at: -1 })
    ))).catch((error) => {
      historyIndexes = null;
      console.error("WhatsApp chat history indexes failed:", error.message);
    });
  }
  return historyIndexes;
};

// The change has already happened by now, so a logging failure must not report it as failed.
const logActivity = async (database, conversationId, user, type, details = {}, createdAt = new Date()) => {
  try {
    await ensureHistoryIndexes(database);
    await database.collection("whatsapp_chat_activity").insertOne({
      conversation_id: conversationId,
      type,
      actor_id: user._id,
      actor_name: displayName(user),
      ...details,
      created_at: createdAt,
    });
  } catch (error) {
    console.error("WhatsApp chat activity log failed:", error.message);
  }
};

// Things the AI service did on its own are recorded on the handoff alerts.
const alertEvents = (alerts) => alerts.flatMap((alert) => {
  const events = [];
  if (!TEAM_ALERT_REASONS.has(alert.reason) && alert.created_at) {
    events.push({
      _id: `${alert._id}-requested`,
      type: alert.lead_type === "customization" ? "customization_lead" : "team_requested",
      created_at: alert.created_at,
    });
  }
  if (alert.auto_resumed && alert.resolved_at) {
    events.push({ _id: `${alert._id}-resumed`, type: "ai_auto_resumed", created_at: alert.resolved_at });
  }
  return events;
});

// Statuses can arrive in any order, so the furthest step reached wins.
const deliveryState = (row) => {
  if (!row) return null;
  let status = "sent";
  if (row.read_at) status = "read";
  else if (row.delivered_at) status = "delivered";
  else if (row.failed_at) status = "failed";
  return {
    status,
    sent_at: row.sent_at,
    delivered_at: row.delivered_at,
    read_at: row.read_at,
    failed_at: row.failed_at,
    error_code: row.error_code,
    error_title: row.error_title,
  };
};

const outboundId = (message) => (
  message.sender !== "customer" ? message.metadata?.whatsapp_message_id : null
);

const withDelivery = async (database, messages) => {
  const ids = messages.map(outboundId).filter(Boolean).map(String);
  if (!ids.length) return messages;
  const rows = await database.collection("whatsapp_message_status").find({ _id: { $in: ids } }).toArray();
  const byId = new Map(rows.map((row) => [String(row._id), row]));
  return messages.map((message) => {
    const id = outboundId(message);
    if (!id) return message;
    // WhatsApp accepted it, so it counts as sent until the first status arrives.
    return { ...message, delivery: deliveryState(byId.get(String(id))) || { status: "sent" } };
  });
};

const ownershipEvent = (before, owner, actor) => {
  const previousOwner = isOwned(before) ? before.handoff_assigned_to : null;
  if (previousOwner && String(previousOwner) === String(owner._id)) return null;
  const toSelf = String(owner._id) === String(actor._id);
  if (!previousOwner) {
    return toSelf ? { type: "claimed" } : { type: "assigned", to_name: displayName(owner) };
  }
  const fromName = before.handoff_assigned_name || "Team";
  return toSelf
    ? { type: "taken_over", from_name: fromName }
    : { type: "reassigned", from_name: fromName, to_name: displayName(owner) };
};

export const getWhatsAppOverview = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const database = mongoose.connection.db;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [metricRows, openChats, handoffs, deliveryErrors, oldestHandoff, metaFailures, updatesNotSent, latencyRows] = await Promise.all([
      database.collection("ai_agent_metrics").aggregate([
        { $match: { created_at: { $gte: since } } },
        { $group: {
          _id: null,
          requests: { $sum: 1 },
          average_latency_ms: { $avg: "$latency_ms" },
          max_latency_ms: { $max: "$latency_ms" },
          timed_out: { $sum: { $cond: ["$timed_out", 1, 0] } },
          // Timing breakdown; rows written before it existed are skipped by $avg.
          average_model_ms: { $avg: "$model_ms" },
          average_tool_ms: { $avg: "$tool_ms" },
          average_model_calls: { $avg: "$model_calls" },
          empty_results: { $sum: { $cond: ["$empty_result", 1, 0] } },
          image_failures: { $sum: { $cond: ["$image_analysis_failed", 1, 0] } },
          checkout_failures: { $sum: { $cond: ["$checkout_failure", 1, 0] } },
          handoffs: { $sum: { $cond: ["$handoff_requested", 1, 0] } },
          total_tokens: { $sum: { $ifNull: ["$total_tokens", 0] } },
          estimated_cost_usd: { $sum: { $ifNull: ["$estimated_cost_usd", 0] } },
        } },
      ]).toArray(),
      database.collection("conversations").countDocuments({ channel: "whatsapp", status: { $ne: "closed" } }),
      database.collection("whatsapp_handoff_alerts").countDocuments({ status: { $in: ["open", "assigned"] } }),
      database.collection("whatsapp_deliveries").countDocuments({
        created_at: { $gte: since },
        $or: [{ processing_error: { $exists: true } }, { rate_limited: true }],
      }),
      database.collection("whatsapp_handoff_alerts").findOne(
        { status: { $in: ["open", "assigned"] } },
        { sort: { created_at: 1 }, projection: { created_at: 1 } }
      ),
      // Messages Meta reported as undelivered (template rejections, closed 24-hour windows, blocked numbers).
      database.collection("whatsapp_delivery_failures").countDocuments({ created_at: { $gte: since } }),
      // Order updates that were skipped (no template outside 24 hours) or failed.
      database.collection("whatsapp_notification_log").countDocuments({
        created_at: { $gte: since },
        status: { $in: ["failed", "skipped"] },
      }),
      // Answered replies only, for the slowest-10% figure ($percentile needs MongoDB 7).
      database.collection("ai_agent_metrics").find(
        { created_at: { $gte: since }, latency_ms: { $type: "number" }, timed_out: { $ne: true }, rate_limited: { $ne: true } },
        { projection: { _id: 0, latency_ms: 1 }, limit: 20000 }
      ).toArray(),
    ]);
    const metrics = metricRows[0] || {};
    const latencies = latencyRows.map((row) => row.latency_ms).sort((a, b) => a - b);
    const p90LatencyMs = latencies.length
      ? latencies[Math.min(latencies.length - 1, Math.round(0.9 * (latencies.length - 1)))]
      : 0;
    const roundOrNull = (value) => (value == null ? null : Math.round(Number(value)));
    const errorCount = Number(metrics.image_failures || 0) + Number(metrics.checkout_failures || 0) + deliveryErrors + metaFailures;
    res.json({
      window_hours: 24,
      generated_at: new Date(),
      status: errorCount > 10 ? "degraded" : "healthy",
      open_chats: openChats,
      active_handoffs: handoffs,
      oldest_handoff_at: oldestHandoff?.created_at || null,
      delivery_errors: deliveryErrors,
      meta_delivery_failures: metaFailures,
      order_updates_not_sent: updatesNotSent,
      requests: Number(metrics.requests || 0),
      average_latency_ms: Math.round(Number(metrics.average_latency_ms || 0)),
      max_latency_ms: Math.round(Number(metrics.max_latency_ms || 0)),
      p90_latency_ms: Math.round(p90LatencyMs),
      timed_out: Number(metrics.timed_out || 0),
      average_model_ms: roundOrNull(metrics.average_model_ms),
      average_tool_ms: roundOrNull(metrics.average_tool_ms),
      average_model_calls: metrics.average_model_calls == null ? null : Number(Number(metrics.average_model_calls).toFixed(1)),
      empty_results: Number(metrics.empty_results || 0),
      image_failures: Number(metrics.image_failures || 0),
      checkout_failures: Number(metrics.checkout_failures || 0),
      handoffs: Number(metrics.handoffs || 0),
      total_tokens: Number(metrics.total_tokens || 0),
      estimated_cost_usd: Number(Number(metrics.estimated_cost_usd || 0).toFixed(6)),
    });
  } catch (error) {
    console.error("WhatsApp overview failed:", error.message);
    res.status(500).json({ message: "Could not load AI production monitoring" });
  }
};

export const listWhatsAppAdmins = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const rows = await mongoose.connection.db.collection("users")
      .find({ role: "admin" }, { projection: { name: 1, email: 1 } })
      .sort({ name: 1 })
      .limit(200)
      .toArray();
    res.json({ admins: rows.map((row) => ({ _id: String(row._id), name: displayName(row) })) });
  } catch (error) {
    console.error("List WhatsApp admins failed:", error.message);
    res.status(500).json({ message: "Could not load the team list" });
  }
};

export const listWhatsAppChats = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 500);
    const conversations = mongoose.connection.db.collection("conversations");
    const rows = await conversations.aggregate([
      { $match: { channel: "whatsapp" } },
      { $sort: { last_message_at: -1, created_at: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "messages",
          let: { conversationId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$conversation_id", "$$conversationId"] } } },
            { $sort: { created_at: -1 } },
            { $limit: 1 },
            { $project: { sender: 1, content: 1, message_type: 1, created_at: 1, "metadata.whatsapp_message_id": 1 } },
          ],
          as: "last_message",
        },
      },
      { $set: { last_message: { $arrayElemAt: ["$last_message", 0] } } },
      {
        $lookup: {
          from: "whatsapp_message_status",
          localField: "last_message.metadata.whatsapp_message_id",
          foreignField: "_id",
          as: "last_delivery",
        },
      },
      {
        $project: {
          business_id: 1,
          external_customer_ref: 1,
          customer_name: 1,
          status: 1,
          current_intent: 1,
          conversation_state: 1,
          lead_type: {
            $ifNull: [
              "$lead_type",
              {
                $cond: [
                  {
                    $or: [
                      { $eq: ["$conversation_state.customization_interest", true] },
                      { $eq: ["$conversation_state.attributes.catalog_type", "customization"] },
                    ],
                  },
                  "customization",
                  null,
                ],
              },
            ],
          },
          lead_status: 1,
          lead_note: 1,
          lead_updated_at: 1,
          handoff_reason: 1,
          handoff_summary: 1,
          handoff_urgency: 1,
          handoff_requested_at: 1,
          handoff_status: 1,
          handoff_assigned_to: 1,
          handoff_assigned_name: 1,
          closed_at: 1,
          created_at: 1,
          updated_at: 1,
          last_message_at: 1,
          last_message: 1,
          last_delivery: 1,
        },
      },
    ]).toArray();

    const chats = rows.map(({ last_delivery: lastDelivery, ...row }) => ({
      ...row,
      last_message_failed: Boolean(row.last_message)
        && row.last_message.sender !== "customer"
        && deliveryState(lastDelivery?.[0])?.status === "failed",
    }));
    res.json({ conversations: serialize(chats) });
  } catch (error) {
    console.error("List WhatsApp chats failed:", error.message);
    res.status(500).json({ message: "Could not load WhatsApp chats" });
  }
};

export const getWhatsAppChat = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const conversationId = parseConversationId(req.params.id);
  if (!conversationId) return res.status(400).json({ message: "Invalid conversation id" });

  try {
    const database = mongoose.connection.db;
    const conversation = await database.collection("conversations").findOne({
      _id: conversationId,
      channel: "whatsapp",
    });
    if (!conversation) return res.status(404).json({ message: "WhatsApp chat not found" });

    // Keep the newest messages when a chat is over the limit, shown oldest first.
    const newestFirst = { created_at: -1, _id: -1 };
    const byConversation = { conversation_id: conversationId };
    const [messages, notes, activity, alerts] = await Promise.all([
      database.collection("messages").find(byConversation).sort(newestFirst).limit(1000).toArray(),
      database.collection("whatsapp_chat_notes").find(byConversation).sort(newestFirst).limit(HISTORY_LIMIT).toArray(),
      database.collection("whatsapp_chat_activity").find(byConversation).sort(newestFirst).limit(HISTORY_LIMIT).toArray(),
      database.collection("whatsapp_handoff_alerts").find(byConversation).sort(newestFirst).limit(HISTORY_LIMIT).toArray(),
    ]);

    res.json({
      conversation: serialize(conversation),
      messages: serialize(await withDelivery(database, messages.reverse())),
      notes: serialize(notes),
      activity: serialize([...activity, ...alertEvents(alerts)]
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))),
    });
  } catch (error) {
    console.error("Get WhatsApp chat failed:", error.message);
    res.status(500).json({ message: "Could not load this WhatsApp chat" });
  }
};

export const getWhatsAppChatMedia = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const conversationId = parseConversationId(req.params.id);
  if (!conversationId) return res.status(400).json({ message: "Invalid conversation id" });

  try {
    const database = mongoose.connection.db;
    const message = await database.collection("messages").findOne({
      _id: parseConversationId(req.params.messageId),
      conversation_id: conversationId,
      message_type: "image",
    });
    if (!message) return res.status(404).json({ message: "Image message not found" });

    const mediaId = message.metadata?.admin_media_id;
    if (!mediaId) return res.status(404).json({ message: "Image preview is unavailable" });
    const media = await database.collection("whatsapp_admin_media").findOne({ _id: String(mediaId) });
    if (!media?.data) return res.status(404).json({ message: "Image preview has expired" });

    res.setHeader("Content-Type", media.content_type || "image/jpeg");
    res.setHeader("Cache-Control", "private, max-age=300");
    res.send(Buffer.from(media.data.buffer || media.data));
  } catch (error) {
    console.error("Get WhatsApp chat media failed:", error.message);
    res.status(500).json({ message: "Could not load image preview" });
  }
};

export const updateWhatsAppChat = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const conversationId = parseConversationId(req.params.id);
  if (!conversationId) return res.status(400).json({ message: "Invalid conversation id" });

  const { leadStatus, conversationStatus, assignTo, assignToMe, handoffStatus, confirmTakeover } = req.body || {};
  if (leadStatus !== undefined && !LEAD_STATUSES.has(leadStatus)) {
    return res.status(400).json({ message: "Invalid lead status" });
  }
  if (conversationStatus !== undefined && !CONVERSATION_STATUSES.has(conversationStatus)) {
    return res.status(400).json({ message: "Invalid conversation status" });
  }
  const assigneeId = assignTo === undefined ? null : parseConversationId(assignTo);
  if (assignTo !== undefined && !assigneeId) {
    return res.status(400).json({ message: "Invalid team member" });
  }
  if (handoffStatus !== undefined && !HANDOFF_STATUSES.has(handoffStatus)) {
    return res.status(400).json({ message: "Invalid handoff status" });
  }
  if (assignToMe !== undefined && typeof assignToMe !== "boolean") {
    return res.status(400).json({ message: "assignToMe must be true or false" });
  }
  if (confirmTakeover !== undefined && typeof confirmTakeover !== "boolean") {
    return res.status(400).json({ message: "confirmTakeover must be true or false" });
  }

  try {
    const database = mongoose.connection.db;
    let owner = req.user;
    if (assigneeId) {
      owner = await database.collection("users").findOne(
        { _id: assigneeId, role: "admin" },
        { projection: { name: 1, email: 1 } }
      );
      if (!owner) return res.status(400).json({ message: "That team member isn't an admin." });
    }
    const ownerName = displayName(owner);

    const now = new Date();
    const set = { updated_at: now };
    if (leadStatus !== undefined) {
      set.lead_status = leadStatus;
      set.lead_updated_at = now;
    }
    if (conversationStatus !== undefined) set.status = conversationStatus;
    if (conversationStatus === "closed") {
      set.closed_at = now;
      set.handoff_status = "resolved";
      set.handoff_resolved_at = now;
    }
    if (handoffStatus !== undefined) set.handoff_status = handoffStatus;
    const takeOver = assignToMe || conversationStatus === "handoff" || Boolean(assigneeId);
    if (takeOver) {
      set.handoff_status = "assigned";
      set.handoff_assigned_to = owner._id;
      set.handoff_assigned_name = ownerName;
      set.handoff_assigned_at = now;
      set.status = "handoff";
    }

    const filter = { _id: conversationId, channel: "whatsapp" };
    // Checked in the update itself, so two admins claiming at once can't both win.
    if (takeOver && !confirmTakeover) {
      filter.$nor = [{
        status: "handoff",
        handoff_status: "assigned",
        handoff_assigned_to: { $nin: [req.user._id, String(req.user._id), owner._id, String(owner._id), null] },
      }];
    }
    const result = await database.collection("conversations").findOneAndUpdate(
      filter,
      { $set: set },
      { returnDocument: "before" }
    );
    // Older MongoDB drivers wrap the document as { value }.
    const before = result && "value" in result ? result.value : result;
    if (!before) {
      const existing = await database.collection("conversations").findOne(
        { _id: conversationId, channel: "whatsapp" },
        { projection: { handoff_assigned_name: 1 } }
      );
      if (!existing) return res.status(404).json({ message: "WhatsApp chat not found" });
      const currentOwner = existing.handoff_assigned_name || "Another team member";
      return res.status(409).json({
        code: "owned_by_other",
        owner_name: currentOwner,
        message: `${currentOwner} already owns this chat.`,
      });
    }

    if (takeOver || handoffStatus !== undefined) {
      const alertUpdate = await database.collection("whatsapp_handoff_alerts").updateMany(
        { conversation_id: conversationId, status: { $in: ["open", "assigned"] } },
        { $set: {
          status: takeOver ? "assigned" : handoffStatus,
          ...(takeOver ? {
            assigned_to: owner._id,
            assigned_name: ownerName,
            assigned_at: now,
          } : {}),
          updated_at: now,
          ...(["resolved", "resumed"].includes(handoffStatus) ? { resolved_at: now } : {}),
        } }
      );
      if (takeOver && !alertUpdate.matchedCount) {
        await database.collection("whatsapp_handoff_alerts").insertOne({
          business_id: before.business_id,
          conversation_id: conversationId,
          channel: "whatsapp",
          customer_name: before.customer_name,
          external_customer_ref: before.external_customer_ref,
          status: "assigned",
          reason: "team_paused_ai",
          summary: "The team paused the AI from the dashboard.",
          urgency: "normal",
          assigned_to: owner._id,
          assigned_name: ownerName,
          assigned_at: now,
          created_at: now,
          updated_at: now,
        });
      }
    }

    if (conversationStatus === "open") {
      await database.collection("conversations").updateOne(
        { _id: conversationId },
        {
          $unset: {
            "conversation_state.handoff_requested": "",
            "conversation_state.handoff_context": "",
          },
          $set: { handoff_status: "resumed", handoff_resolved_at: now },
        }
      );
      await database.collection("whatsapp_handoff_alerts").updateMany(
        { conversation_id: conversationId, status: { $in: ["open", "assigned"] } },
        { $set: { status: "resumed", resolved_at: now, updated_at: now } }
      );
    }

    if (conversationStatus === "closed") {
      await database.collection("whatsapp_handoff_alerts").updateMany(
        { conversation_id: conversationId, status: { $in: ["open", "assigned"] } },
        { $set: { status: "resolved", resolved_at: now, updated_at: now } }
      );
    }

    const log = (type, details) => logActivity(database, conversationId, req.user, type, details, now);
    if (leadStatus !== undefined && leadStatus !== (before.lead_status || "new")) {
      await log("lead_status", { to_status: leadStatus });
    }
    if (takeOver) {
      const event = ownershipEvent(before, owner, req.user);
      if (event) await log(event.type, event);
    }
    if (conversationStatus === "closed") await log("closed");
    if (conversationStatus === "open" && before.status === "closed") await log("reopened");
    if (conversationStatus === "open" && before.status === "handoff") await log("ai_resumed");

    const refreshed = await database.collection("conversations").findOne({ _id: conversationId });
    res.json({ conversation: serialize(refreshed) });
  } catch (error) {
    console.error("Update WhatsApp chat failed:", error.message);
    res.status(500).json({ message: "Could not update this WhatsApp chat" });
  }
};

export const addWhatsAppChatNote = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const conversationId = parseConversationId(req.params.id);
  if (!conversationId) return res.status(400).json({ message: "Invalid conversation id" });
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!text || text.length > NOTE_MAX_LENGTH) {
    return res.status(400).json({ message: `Write a note of up to ${NOTE_MAX_LENGTH} characters.` });
  }

  try {
    const database = mongoose.connection.db;
    const conversation = await database.collection("conversations").findOne(
      { _id: conversationId, channel: "whatsapp" },
      { projection: { _id: 1 } }
    );
    if (!conversation) return res.status(404).json({ message: "WhatsApp chat not found" });

    await ensureHistoryIndexes(database);
    const now = new Date();
    const note = {
      conversation_id: conversationId,
      text,
      author_id: req.user._id,
      author_name: displayName(req.user),
      created_at: now,
    };
    await database.collection("whatsapp_chat_notes").insertOne(note);
    await logActivity(database, conversationId, req.user, "note_added", {}, now);
    res.status(201).json({ note: serialize(note) });
  } catch (error) {
    console.error("Add WhatsApp chat note failed:", error.message);
    res.status(500).json({ message: "Could not save this note" });
  }
};

const sendTeamReply = async (req, conversationId, text) => {
  const database = mongoose.connection.db;
  const before = await database.collection("conversations").findOne(
    { _id: conversationId, channel: "whatsapp" },
    { projection: { handoff_status: 1 } }
  );
  const result = await callWhatsAppService("team-reply", {
    conversation_id: String(conversationId),
    text,
    admin_id: String(req.user._id),
    admin_name: req.user.name || req.user.email || "Store team",
  });
  // The AI service makes the first person to reply the owner of an unowned chat.
  if (result.status < 300 && before && before.handoff_status !== "assigned") {
    await logActivity(database, conversationId, req.user, "claimed", { via: "reply" });
  }
  return result;
};

export const sendWhatsAppReply = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const conversationId = parseConversationId(req.params.id);
  if (!conversationId) return res.status(400).json({ message: "Invalid conversation id" });
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!text || text.length > 4096) return res.status(400).json({ message: "Write a reply of up to 4096 characters." });

  try {
    const { status, data } = await sendTeamReply(req, conversationId, text);
    return res.status(status).json(data);
  } catch (error) {
    console.error("Send WhatsApp reply failed:", error.message);
    return res.status(502).json({ message: "Could not reach the WhatsApp service. Please try again." });
  }
};

export const retryWhatsAppReply = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const conversationId = parseConversationId(req.params.id);
  const messageId = parseConversationId(req.params.messageId);
  if (!conversationId || !messageId) return res.status(400).json({ message: "Invalid message id" });

  const database = mongoose.connection.db;
  const messages = database.collection("messages");
  const release = () => messages.updateOne(
    { _id: messageId },
    { $unset: { "metadata.retried_at": "", "metadata.retried_by": "" } }
  );
  let claimed = false;

  try {
    const message = await messages.findOne({ _id: messageId, conversation_id: conversationId, sender: "human" });
    if (!message) return res.status(404).json({ message: "Team reply not found" });

    const statusRow = message.metadata?.whatsapp_message_id
      ? await database.collection("whatsapp_message_status").findOne({ _id: String(message.metadata.whatsapp_message_id) })
      : null;
    if (deliveryState(statusRow)?.status !== "failed") {
      return res.status(409).json({ message: "Only replies that failed to deliver can be retried." });
    }

    // Claimed in the update itself, so a double click can't send the reply twice.
    const result = await messages.findOneAndUpdate(
      { _id: messageId, "metadata.retried_at": { $exists: false } },
      { $set: { "metadata.retried_at": new Date(), "metadata.retried_by": displayName(req.user) } }
    );
    const unclaimed = result && "value" in result ? !result.value : !result;
    if (unclaimed) return res.status(409).json({ message: "This reply has already been retried." });
    claimed = true;

    const { status, data } = await sendTeamReply(req, conversationId, message.content);
    if (status >= 300) {
      await release();
      return res.status(status).json(data);
    }
    await logActivity(database, conversationId, req.user, "reply_retried");
    return res.status(status).json(data);
  } catch (error) {
    console.error("Retry WhatsApp reply failed:", error.message);
    if (claimed) await release().catch(() => {});
    return res.status(502).json({ message: "Could not reach the WhatsApp service. Please try again." });
  }
};
