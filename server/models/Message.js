import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    messageId: { type: String, unique: true, sparse: true },
    conversationRef: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", index: true },
    conversationKey: { type: String, index: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    text: { type: String, default: "" },
    image: { type: String, default: "" },
    audio: { type: String, default: "" },
    publicId: { type: String, default: "" },
    resourceType: { type: String, default: "" },
    messageType: { type: String, enum: ["text", "image", "audio"], default: "text" },
    sequenceNumber: { type: Number, default: 0 },
    expiresAt: { type: Date, index: true },
    status: { type: String, default: "sent" },
    seen: { type: Boolean, default: false },
    editedAt: { type: Date },
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    deletedForEveryone: { type: Boolean, default: false },
    bookmarkedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    deliveredTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    replyToMessageId: { type: String, default: "" },
    replyPreview: { type: String, default: "" },
    transcript: { type: String, default: "" },
    transcriptStatus: { type: String, default: "" },
    transcriptSearchable: { type: Boolean, default: false },
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

messageSchema.index({ conversationRef: 1, sequenceNumber: -1 });
messageSchema.index({ receiverId: 1, expiresAt: 1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;
