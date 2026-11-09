import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["direct", "group"], required: true },
    directKey: { type: String, unique: true, sparse: true },
    name: { type: String, default: "" },
    memberIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", index: true }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    retentionHours: { type: Number, default: 24 },
    mutedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    nextSequence: { type: Number, default: 0 },
    lastMessageAt: { type: Date },
  },
  { timestamps: true }
);

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
