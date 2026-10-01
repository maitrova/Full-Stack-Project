import mongoose from "mongoose";

const LEAD_STATUSES = new Set(["new", "contacted", "qualified", "converted", "closed"]);
const CONVERSATION_STATUSES = new Set(["open", "handoff", "closed"]);

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
            { $project: { sender: 1, content: 1, message_type: 1, created_at: 1 } },
          ],
          as: "last_message",
        },
      },
      { $set: { last_message: { $arrayElemAt: ["$last_message", 0] } } },
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
          created_at: 1,
          updated_at: 1,
          last_message_at: 1,
          last_message: 1,
        },
      },
    ]).toArray();

    res.json({ conversations: serialize(rows) });
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

    const messages = await database.collection("messages")
      .find({ conversation_id: conversationId })
      .sort({ created_at: 1 })
      .limit(1000)
      .toArray();

    res.json({ conversation: serialize(conversation), messages: serialize(messages) });
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

  const { leadStatus, conversationStatus, leadNote } = req.body || {};
  if (leadStatus !== undefined && !LEAD_STATUSES.has(leadStatus)) {
    return res.status(400).json({ message: "Invalid lead status" });
  }
  if (conversationStatus !== undefined && !CONVERSATION_STATUSES.has(conversationStatus)) {
    return res.status(400).json({ message: "Invalid conversation status" });
  }
  if (leadNote !== undefined && typeof leadNote !== "string") {
    return res.status(400).json({ message: "Lead note must be text" });
  }

  try {
    const now = new Date();
    const set = { updated_at: now };
    if (leadStatus !== undefined) {
      set.lead_status = leadStatus;
      set.lead_updated_at = now;
    }
    if (conversationStatus !== undefined) set.status = conversationStatus;
    if (leadNote !== undefined) set.lead_note = leadNote.trim().slice(0, 2000);

    const database = mongoose.connection.db;
    const result = await database.collection("conversations").findOneAndUpdate(
      { _id: conversationId, channel: "whatsapp" },
      { $set: set },
      { returnDocument: "after" }
    );
    const conversation = result?.value || result;
    if (!conversation) return res.status(404).json({ message: "WhatsApp chat not found" });

    if (conversationStatus === "open") {
      await database.collection("conversations").updateOne(
        { _id: conversationId },
        { $unset: { "conversation_state.handoff_requested": "" } }
      );
      await database.collection("whatsapp_handoff_alerts").updateMany(
        { conversation_id: conversationId, status: { $in: ["open", "assigned"] } },
        { $set: { status: "resumed", resolved_at: now, updated_at: now } }
      );
    }

    const refreshed = await database.collection("conversations").findOne({ _id: conversationId });
    res.json({ conversation: serialize(refreshed) });
  } catch (error) {
    console.error("Update WhatsApp chat failed:", error.message);
    res.status(500).json({ message: "Could not update this WhatsApp chat" });
  }
};
