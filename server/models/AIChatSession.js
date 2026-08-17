import mongoose from "mongoose";

const aiChatMessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 6000,
    },
  },
  { timestamps: true }
);

const aiChatSessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    guestId: {
      type: String,
      default: "",
      index: true,
    },
    title: {
      type: String,
      default: "Shopping chat",
      trim: true,
      maxlength: 120,
    },
    messages: {
      type: [aiChatMessageSchema],
      default: [],
    },
    lastMessageAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

aiChatSessionSchema.index({ user: 1, lastMessageAt: -1 });
aiChatSessionSchema.index({ guestId: 1, lastMessageAt: -1 });

export default mongoose.model("AIChatSession", aiChatSessionSchema);
