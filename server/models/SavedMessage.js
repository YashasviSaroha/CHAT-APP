import mongoose from "mongoose";

const savedMessageSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    messageId: { type: String, required: true },
    conversationKey: { type: String, default: "" },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    senderName: { type: String, default: "" },
    text: { type: String, default: "" },
    image: { type: String, default: "" },
    audio: { type: String, default: "" },
    transcript: { type: String, default: "" },
    messageType: { type: String, default: "text" },
    originalCreatedAt: { type: Date },
  },
  { timestamps: true }
);

savedMessageSchema.index({ userId: 1, messageId: 1 }, { unique: true });

const SavedMessage = mongoose.model("SavedMessage", savedMessageSchema);

export default SavedMessage;
