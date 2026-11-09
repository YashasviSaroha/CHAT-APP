import cloudinary from "../lib/cloudinary.js";
import { sendError } from "../lib/httpError.js";
import { deviceLabel, isAdminEmail, normalizeUsername, publicUser, usernameError } from "../lib/policy.js";
import { generateToken } from "../lib/utils.js";
import User from "../models/user.js";
import bcrypt from "bcryptjs";
import { createSession } from "../services/sessions.js";

async function issueLogin(user, req) {
  const { token, jti } = generateToken(user._id);
  await createSession(user._id, jti, deviceLabel(req.headers["user-agent"]));
  return { token, userData: publicUser(user), isAdmin: isAdminEmail(user.email) };
}

export const signup = async (req, res) => {
  const { fullName, email, password, bio, username } = req.body;
  try {
    if (!fullName || !email || !password || !bio) {
      return res.json({ success: false, message: "Missing Details" });
    }
    const existing = await User.findOne({ email });
    if (existing) return res.json({ success: false, message: "Account Already Exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const payload = { fullName, email, password: hashedPassword, bio };
    if (username) {
      const nameError = usernameError(username);
      if (nameError) return res.json({ success: false, message: nameError });
      payload.username = normalizeUsername(username);
    }
    const newUser = await User.create(payload);
    const session = await issueLogin(newUser, req);
    res.json({ success: true, ...session, message: "Account created Successfully" });
  } catch (error) {
    if (error?.code === 11000) return res.json({ success: false, message: "That username is already taken." });
    console.error(error.message);
    res.json({ success: false, message: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const userData = await User.findOne({ email });
    if (!userData) return res.json({ success: false, message: "Invalid Credentials" });
    const isPasswordCorrect = await bcrypt.compare(password, userData.password);
    if (!isPasswordCorrect) return res.json({ success: false, message: "Invalid Credentials" });
    const session = await issueLogin(userData, req);
    res.json({ success: true, ...session, message: "Account login Successfully" });
  } catch (error) {
    console.error(error.message);
    res.json({ success: false, message: error.message });
  }
};

export const checkAuth = (req, res) => {
  res.json({ success: true, user: publicUser(req.user), isAdmin: isAdminEmail(req.user.email) });
};

export const updateProfile = async (req, res) => {
  try {
    const { profilePic, bio, fullName, username, discoverable } = req.body;
    const userId = req.user._id;
    const update = {};
    if (typeof fullName === "string" && fullName.trim()) update.fullName = fullName.trim();
    if (typeof bio === "string") update.bio = bio;
    if (typeof discoverable === "boolean") update.discoverable = discoverable;
    if (username) {
      const nameError = usernameError(username);
      if (nameError) return res.json({ success: false, message: nameError });
      update.username = normalizeUsername(username);
    }
    if (profilePic) {
      if (typeof profilePic !== "string" || !profilePic.startsWith("data:image/")) {
        return res.json({ success: false, message: "Upload a PNG or JPG image." });
      }
      const upload = await cloudinary.uploader.upload(profilePic);
      update.profilePic = upload.secure_url;
    }
    const updatedUser = await User.findByIdAndUpdate(userId, update, { new: true }).select("-password");
    res.json({ success: true, user: publicUser(updatedUser) });
  } catch (error) {
    if (error?.code === 11000) return res.json({ success: false, message: "That username is already taken." });
    console.error(error.message);
    res.json({ success: false, message: error.message });
  }
};

export const setNotifications = async (req, res) => {
  try {
    const current = req.user.notifications || {};
    const notifications = {
      sound: typeof req.body.sound === "boolean" ? req.body.sound : current.sound !== false,
      desktop: typeof req.body.desktop === "boolean" ? req.body.desktop : Boolean(current.desktop),
      mentions: typeof req.body.mentions === "boolean" ? req.body.mentions : current.mentions !== false,
    };
    const user = await User.findByIdAndUpdate(req.user._id, { notifications }, { new: true }).select("-password");
    res.json({ success: true, user: publicUser(user) });
  } catch (error) {
    sendError(res, error);
  }
};

export const lookupUsername = async (req, res) => {
  try {
    const username = normalizeUsername(req.params.username);
    const nameError = usernameError(username);
    if (nameError) return res.json({ success: true, user: null });
    const user = await User.findOne({ username, discoverable: { $ne: false }, _id: { $ne: req.user._id } })
      .select("_id fullName username profilePic bio");
    res.json({ success: true, user: user || null });
  } catch (error) {
    sendError(res, error);
  }
};

export const blockUser = async (req, res) => {
  try {
    if (String(req.params.id) === String(req.user._id)) {
      return res.json({ success: false, message: "You cannot block yourself." });
    }
    const target = await User.findById(req.params.id).select("_id");
    if (!target) return res.status(404).json({ success: false, message: "User not found" });
    await User.findByIdAndUpdate(req.user._id, { $addToSet: { blockedUsers: target._id } });
    res.json({ success: true, message: "User blocked" });
  } catch (error) {
    sendError(res, error);
  }
};

export const unblockUser = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { $pull: { blockedUsers: req.params.id } });
    res.json({ success: true, message: "User unblocked" });
  } catch (error) {
    sendError(res, error);
  }
};
