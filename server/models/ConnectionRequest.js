import mongoose from "mongoose";

const connectionRequestSchema = new mongoose.Schema(
  {
    fromUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    toUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" },
  },
  { timestamps: true }
);

connectionRequestSchema.index({ fromUser: 1, toUser: 1, status: 1 });

const ConnectionRequest = mongoose.model("ConnectionRequest", connectionRequestSchema);

export default ConnectionRequest;
