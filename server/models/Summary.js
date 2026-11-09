import mongoose from "mongoose";

const summarySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    conversationRef: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation" },
    text: { type: String, required: true },
    kind: { type: String, default: "summary" },
  },
  { timestamps: true }
);

const Summary = mongoose.model("Summary", summarySchema);

export default Summary;
