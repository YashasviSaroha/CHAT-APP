import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  fullName: { type: String, required: true },
  password: { type: String, required: true, minLength: 6 },
  profilePic: { type: String, default: "" },
  bio: { type: String },
  username: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  discoverable: { type: Boolean, default: true },
  contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  notifications: {
    sound: { type: Boolean, default: true },
    desktop: { type: Boolean, default: false },
    mentions: { type: Boolean, default: true },
  },
}, { timestamps: true });

const User = mongoose.model("User", userSchema);

export default User;
