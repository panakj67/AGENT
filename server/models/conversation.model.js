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
  { _id: false }
);

const ConversationSchema = new mongoose.Schema(
  {
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

export const Conversation = mongoose.models.Conversation || mongoose.model("Conversation", ConversationSchema);
