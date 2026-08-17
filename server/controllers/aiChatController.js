import AIChatSession from "../models/AIChatSession.js";

const MAX_STORED_MESSAGES = 80;
const MAX_RETURNED_MESSAGES = 20;

const safeString = (value, maxLength = 6000) =>
  String(value || "").trim().slice(0, maxLength);

const getGuestId = (req) => safeString(req.headers["x-ai-session-id"] || req.body?.guestId || req.query?.guestId, 160);

const getOwnerQuery = (req) => {
  if (req.user?._id) return { user: req.user._id };
  const guestId = getGuestId(req);
  return guestId ? { guestId } : null;
};

const getOrCreateSession = async ({ sessionId, userId, guestId }) => {
  const existing = await AIChatSession.findOne({ sessionId });
  if (existing) {
    if (userId && !existing.user) existing.user = userId;
    if (guestId && !existing.guestId) existing.guestId = guestId;
    return existing;
  }

  return AIChatSession.create({
    sessionId,
    user: userId || null,
    guestId: guestId || "",
  });
};

export const saveChatTurn = async (req, res) => {
  try {
    const body = req.body || {};
    const sessionId = safeString(body.sessionId, 160);
    const userMessage = safeString(body.userMessage);
    const assistantMessage = safeString(body.assistantMessage);
    const guestId = getGuestId(req);

    if (!sessionId || !userMessage || !assistantMessage) {
      return res.status(400).json({
        message: "sessionId, userMessage, and assistantMessage are required",
      });
    }

    if (!req.user?._id && !guestId) {
      return res.status(400).json({ message: "A user token or guest id is required" });
    }

    const session = await getOrCreateSession({
      sessionId,
      userId: req.user?._id,
      guestId,
    });

    session.messages.push(
      { role: "user", content: userMessage },
      { role: "assistant", content: assistantMessage }
    );
    session.messages = session.messages.slice(-MAX_STORED_MESSAGES);
    session.lastMessageAt = new Date();

    if (!session.title || session.title === "Shopping chat") {
      session.title = userMessage.slice(0, 80) || "Shopping chat";
    }

    await session.save();

    return res.status(201).json({
      success: true,
      data: {
        sessionId: session.sessionId,
        messageCount: session.messages.length,
      },
    });
  } catch (error) {
    console.error("saveChatTurn error:", error);
    return res.status(500).json({ message: "Failed to save AI chat" });
  }
};

export const getChatHistory = async (req, res) => {
  try {
    const sessionId = safeString(req.params.sessionId, 160);
    const ownerQuery = getOwnerQuery(req);

    if (!sessionId || !ownerQuery) {
      return res.status(400).json({ message: "sessionId and user/guest identity are required" });
    }

    const session = await AIChatSession.findOne({ sessionId, ...ownerQuery }).lean();
    if (!session) {
      return res.status(200).json({ success: true, data: { messages: [] } });
    }

    return res.status(200).json({
      success: true,
      data: {
        sessionId: session.sessionId,
        title: session.title,
        messages: (session.messages || []).slice(-MAX_RETURNED_MESSAGES).map((message) => ({
          role: message.role,
          content: message.content,
          createdAt: message.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error("getChatHistory error:", error);
    return res.status(500).json({ message: "Failed to load AI chat history" });
  }
};

export const clearChatHistory = async (req, res) => {
  try {
    const sessionId = safeString(req.params.sessionId, 160);
    const ownerQuery = getOwnerQuery(req);

    if (!sessionId || !ownerQuery) {
      return res.status(400).json({ message: "sessionId and user/guest identity are required" });
    }

    await AIChatSession.deleteOne({ sessionId, ...ownerQuery });
    return res.status(200).json({ success: true, data: { sessionId } });
  } catch (error) {
    console.error("clearChatHistory error:", error);
    return res.status(500).json({ message: "Failed to clear AI chat history" });
  }
};
