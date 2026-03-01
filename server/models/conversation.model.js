import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["system", "user", "assistant"],
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    _id: false,
    timestamps: true,
  }
);

const ConversationSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: "New conversation",
      trim: true,
    },
    messages: {
      type: [MessageSchema],
      default: [],
    },
  },
  { timestamps: true }
);

// Hot-path indexes for concurrent read/write traffic:
// - list by user with newest first
// - point lookups by user + conversation id
ConversationSchema.index({ userId: 1, updatedAt: -1 });
ConversationSchema.index({ userId: 1, _id: 1 });

export const Conversation = mongoose.models.Conversation || mongoose.model("Conversation", ConversationSchema);
