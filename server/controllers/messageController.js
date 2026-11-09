import cloudinary from "../lib/cloudinary.js";
import { HttpError, sendError } from "../lib/httpError.js";
import User from "../models/user.js";
import ConnectionRequest from "../models/ConnectionRequest.js";
import { connectUsers, relation } from "../services/access.js";
import { findDirect } from "../services/conversations.js";
import {
  bookmarkMessage,
  deleteMessage,
  editMessage,
  historyForConversation,
  historyWithPeer,
  listSaved,
  markConversationRead,
  searchMessages,
  serializeMessage,
  setTranscriptSearchable,
  unbookmarkMessage,
  unseenCounts,
} from "../services/messages.js";

const ALLOWED_FILES = new Set([
  "image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif",
  "audio/webm", "audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav",
]);

export const getUsersForSidebar = async (req, res) => {
  try {
    const userId = req.user._id;
    const currentUser = await User.findById(userId).populate("contacts", "fullName username profilePic bio email");
    const contacts = currentUser?.contacts || [];
    const unseenMessages = await unseenCounts(userId);
    res.json({ success: true, users: contacts, unseenMessages });
  } catch (error) {
    console.error(error.message);
    res.json({ success: false, message: error.message });
  }
};

export const searchUsers = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query || typeof query !== "string" || query.trim().length < 2) {
      return res.json({ success: true, users: [] });
    }
    const cleanQuery = query.trim();
    const escaped = cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");
    const matchedUsers = await User.find({
      _id: { $ne: req.user._id },
      discoverable: { $ne: false },
      $or: [{ email: regex }, { fullName: regex }, { username: regex }],
    }).select("_id fullName username profilePic bio").limit(10);
    res.json({ success: true, users: matchedUsers });
  } catch (error) {
    console.error(error.message);
    res.json({ success: false, message: error.message });
  }
};

export const addContact = async (req, res) => {
  try {
    const contactId = req.params.id;
    const userId = req.user._id;
    if (contactId === userId.toString()) return res.json({ success: false, message: "Cannot add yourself as contact" });
    const targetUser = await User.findById(contactId).select("_id fullName username profilePic bio blockedUsers");
    if (!targetUser) return res.json({ success: false, message: "User not found" });
    if ((targetUser.blockedUsers || []).some((id) => String(id) === String(userId)) || (req.user.blockedUsers || []).some((id) => String(id) === String(contactId))) {
      return res.json({ success: false, message: "Messaging is unavailable." });
    }
    await connectUsers(userId, contactId);
    res.json({
      success: true,
      user: { _id: targetUser._id, fullName: targetUser.fullName, username: targetUser.username, profilePic: targetUser.profilePic, bio: targetUser.bio },
      message: "Contact added successfully",
    });
  } catch (error) {
    console.error(error.message);
    res.json({ success: false, message: error.message });
  }
};

export const requestContact = async (req, res) => {
  try {
    const contactId = req.params.id;
    if (contactId === String(req.user._id)) return res.json({ success: false, message: "You cannot connect with yourself." });
    const target = await User.findById(contactId).select("_id fullName username profilePic bio blockedUsers contacts");
    if (!target) return res.status(404).json({ success: false, message: "User not found" });
    const info = await relation(req.user._id, contactId);
    if (info.blockedByMe || info.messagingDisabled) return res.json({ success: false, message: "Messaging is unavailable." });
    if (info.isContact) return res.json({ success: true, alreadyConnected: true, user: target, message: "You are already connected." });
    const existing = await ConnectionRequest.findOne({ fromUser: req.user._id, toUser: contactId, status: "pending" });
    if (existing) return res.json({ success: true, request: existing, message: "Request already sent." });
    const request = await ConnectionRequest.create({ fromUser: req.user._id, toUser: contactId, status: "pending" });
    res.json({ success: true, request, user: target, message: "Request sent." });
  } catch (error) {
    sendError(res, error);
  }
};

export const listRequests = async (req, res) => {
  try {
    const requests = await ConnectionRequest.find({ toUser: req.user._id, status: "pending" })
      .populate("fromUser", "fullName username profilePic bio")
      .sort({ createdAt: -1 });
    res.json({
      success: true,
      requests: requests.map((item) => ({ _id: item._id, from: item.fromUser, createdAt: item.createdAt })),
    });
  } catch (error) {
    sendError(res, error);
  }
};

export const acceptRequest = async (req, res) => {
  try {
    const request = await ConnectionRequest.findOne({ _id: req.params.id, toUser: req.user._id, status: "pending" });
    if (!request) return res.status(404).json({ success: false, message: "Request not found" });
    await connectUsers(request.fromUser, request.toUser);
    request.status = "accepted";
    await request.save();
    const user = await User.findById(request.fromUser).select("fullName username profilePic bio");
    res.json({ success: true, user, message: "Request accepted" });
  } catch (error) {
    sendError(res, error);
  }
};

export const rejectRequest = async (req, res) => {
  try {
    const request = await ConnectionRequest.findOne({ _id: req.params.id, toUser: req.user._id, status: "pending" });
    if (!request) return res.status(404).json({ success: false, message: "Request not found" });
    request.status = "rejected";
    await request.save();
    res.json({ success: true, message: "Request declined" });
  } catch (error) {
    sendError(res, error);
  }
};

export const uploadFile = async (req, res) => {
  try {
    const file = req.body.audio || req.body.image;
    if (!file || typeof file !== "string" || !file.startsWith("data:")) {
      return res.json({ success: false, message: "No file provided" });
    }
    const mime = file.slice(5, file.indexOf(";"));
    if (!ALLOWED_FILES.has(mime)) return res.json({ success: false, message: "Unsupported file type" });
    if (Math.ceil((file.length * 3) / 4) > 8 * 1024 * 1024) {
      return res.json({ success: false, message: "File is too large" });
    }
    const upload = await cloudinary.uploader.upload(file, { resource_type: "auto" });
    res.json({
      success: true,
      imageUrl: upload.secure_url,
      url: upload.secure_url,
      publicId: upload.public_id,
      resourceType: upload.resource_type,
    });
  } catch (error) {
    console.error(error.message);
    res.json({ success: false, message: error.message });
  }
};

export const getPeerHistory = async (req, res) => {
  try {
    const history = await historyWithPeer(req.user._id, req.params.peerId, req.query);
    await markIfPresent(req.user._id, req.params.peerId);
    res.json({ success: true, ...history });
  } catch (error) {
    sendError(res, error);
  }
};

export const getConversationHistory = async (req, res) => {
  try {
    const history = await historyForConversation(req.user._id, req.params.conversationId, req.query);
    await markConversationRead(req.user._id, req.params.conversationId);
    res.json({ success: true, ...history });
  } catch (error) {
    sendError(res, error);
  }
};

async function markIfPresent(userId, peerId) {
  const conversation = await findDirect(userId, peerId);
  if (conversation) await markConversationRead(userId, conversation._id);
}

export const saveBookmark = async (req, res) => {
  try {
    await bookmarkMessage(req.user._id, req.params.messageId);
    res.json({ success: true });
  } catch (error) {
    sendError(res, error);
  }
};

export const removeBookmark = async (req, res) => {
  try {
    await unbookmarkMessage(req.user._id, req.params.messageId);
    res.json({ success: true });
  } catch (error) {
    sendError(res, error);
  }
};

export const savedMessages = async (req, res) => {
  try {
    const messages = await listSaved(req.user._id);
    res.json({ success: true, messages });
  } catch (error) {
    sendError(res, error);
  }
};

export const editOwnMessage = async (req, res) => {
  try {
    const message = await editMessage(req.user._id, req.params.messageId, req.body.text);
    res.json({ success: true, message: serializeMessage(message) });
  } catch (error) {
    sendError(res, error);
  }
};

export const removeMessage = async (req, res) => {
  try {
    const scope = req.body.scope === "everyone" ? "everyone" : "me";
    const result = await deleteMessage(req.user._id, req.params.messageId, scope);
    res.json({ success: true, messageId: result.message.messageId, scope: result.scope, conversationId: result.message.conversationKey });
  } catch (error) {
    sendError(res, error);
  }
};

export const findMessages = async (req, res) => {
  try {
    const messages = await searchMessages(req.user._id, req.query);
    res.json({ success: true, messages });
  } catch (error) {
    sendError(res, error);
  }
};

export const transcriptPrivacy = async (req, res) => {
  try {
    const message = await setTranscriptSearchable(req.user._id, req.params.messageId, req.body.enabled);
    res.json({ success: true, message: serializeMessage(message) });
  } catch (error) {
    sendError(res, error);
  }
};

export const peerRelation = async (req, res) => {
  try {
    const info = await relation(req.user._id, req.params.id);
    res.json({ success: true, ...info });
  } catch (error) {
    if (error instanceof HttpError && error.statusCode === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    sendError(res, error);
  }
};
