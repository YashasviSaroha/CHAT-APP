import mongoose from "mongoose";

const readStateSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    conversationRef: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
    lastReadAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

readStateSchema.index({ userId: 1, conversationRef: 1 }, { unique: true });

const ReadState = mongoose.model("ReadState", readStateSchema);

export default ReadState;
