import cloudinary from "../lib/cloudinary.js";
import { HttpError } from "../lib/httpError.js";
import { conversationKey, deleteWindowMs, editWindowMs, expiresAtFrom, mentionHandles, replyPreviewFrom, withinWindow } from "../lib/policy.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import ReadState from "../models/ReadState.js";
import SavedMessage from "../models/SavedMessage.js";
import User from "../models/user.js";
import { assertConversationMember, canMessage } from "./access.js";
import { ensureDirect, findDirect, getConversationForUser } from "./conversations.js";
import { enqueueTranscription } from "../jobs/queue.js";
import { emitToUser, emitToUsers } from "../lib/realtime.js";

const visible = (userId) => ({
  expiresAt: { $gt: new Date() },
  deletedForEveryone: { $ne: true },
  deletedFor: { $nin: [userId] },
});

export function serializeMessage(doc) {
  const message = doc.toObject ? doc.toObject() : doc;
  return {
    messageId: message.messageId,
    conversationId: message.conversationKey,
    conversationRef: message.conversationRef ? String(message.conversationRef) : "",
    senderId: String(message.senderId),
    receiverId: message.receiverId ? String(message.receiverId) : null,
    text: message.deletedForEveryone ? null : message.text || null,
    image: message.deletedForEveryone ? null : message.image || null,
    audio: message.deletedForEveryone ? null : message.audio || null,
    messageType: message.messageType || "text",
    sequenceNumber: message.sequenceNumber,
    createdAt: message.createdAt,
    expiresAt: message.expiresAt,
    status: message.status || "sent",
    editedAt: message.editedAt || null,
    replyToMessageId: message.replyToMessageId || null,
    replyPreview: message.replyPreview || null,
    transcript: message.deletedForEveryone ? "" : message.transcript || "",
    transcriptStatus: message.transcriptStatus || "",
    transcriptSearchable: Boolean(message.transcriptSearchable),
    deletedForEveryone: Boolean(message.deletedForEveryone),
    bookmarked: false,
  };
}

async function nextSequence(conversationId) {
  const conversation = await Conversation.findOneAndUpdate(
    { _id: conversationId },
    { $inc: { nextSequence: 1 }, $set: { lastMessageAt: new Date() } },
    { new: true }
  );
  return conversation.nextSequence;
}

export async function createMessage({ senderId, receiverId, conversationId, text, image, audio, publicId, resourceType, messageId, replyToMessageId }) {
  if (!messageId) throw new HttpError("Message id is required.");
  if (!text && !image && !audio) throw new HttpError("Message must have text, an image, or a voice note.");
  if (text && text.length > 10000) throw new HttpError("Message is too long.");

  const existing = await Message.findOne({ messageId });
  if (existing) {
    const existingConversation = await Conversation.findById(existing.conversationRef);
    return { message: existing, duplicate: true, conversation: existingConversation };
  }

  let conversation;
  if (conversationId) {
    conversation = await getConversationForUser(senderId, conversationId);
    if (conversation.type === "direct") {
      const peerId = conversation.memberIds.find((id) => String(id) !== String(senderId));
      const allowed = await canMessage(senderId, peerId);
      if (!allowed.ok) throw new HttpError(allowed.message, 403);
      receiverId = peerId;
    } else {
      const sender = await User.findById(senderId).select("blockedUsers");
      const blockedMember = (conversation.memberIds || []).some((memberId) =>
        (sender?.blockedUsers || []).some((id) => String(id) === String(memberId))
      );
      if (blockedMember) throw new HttpError("Messaging is unavailable.", 403);
    }
  } else {
    if (!receiverId) throw new HttpError("Choose a recipient.");
    conversation = await ensureDirect(senderId, receiverId);
  }

  let replyPreview = "";
  if (replyToMessageId) {
    const parent = await Message.findOne({ messageId: replyToMessageId, conversationRef: conversation._id, ...visible(senderId) });
    if (!parent) throw new HttpError("The message you are replying to is no longer available.");
    replyPreview = replyPreviewFrom(parent);
  }

  const handles = mentionHandles(text);
  const mentionedUsers = handles.length
    ? await User.find({ username: { $in: handles }, _id: { $in: conversation.memberIds } }).select("_id")
    : [];

  const sequenceNumber = await nextSequence(conversation._id);
  try {
    const message = await Message.create({
      messageId,
      conversationRef: conversation._id,
      conversationKey: conversation.directKey || String(conversation._id),
      senderId,
      receiverId: receiverId || null,
      text: text || "",
      image: image || "",
      audio: audio || "",
      publicId: publicId || "",
      resourceType: resourceType || "",
      messageType: audio ? "audio" : image ? "image" : "text",
      sequenceNumber,
      expiresAt: expiresAtFrom(new Date(), conversation.retentionHours),
      status: "sent",
      replyToMessageId: replyToMessageId || "",
      replyPreview,
      transcriptStatus: audio ? "processing" : "",
      mentions: mentionedUsers.map((user) => user._id),
    });
    if (audio) await enqueueTranscription(message.messageId);
    return { message, duplicate: false, conversation };
  } catch (error) {
    if (error?.code === 11000) {
      const saved = await Message.findOne({ messageId });
      const savedConversation = saved ? await Conversation.findById(saved.conversationRef) : conversation;
      return { message: saved, duplicate: true, conversation: savedConversation };
    }
    throw error;
  }
}

export async function listHistory(userId, conversation, { cursor, limit = 40 } = {}) {
  await assertConversationMember(conversation, userId);
  const query = { conversationRef: conversation._id, ...visible(userId) };
  if (cursor) query.sequenceNumber = { $lt: Number(cursor) };
  const rows = await Message.find(query).sort({ sequenceNumber: -1 }).limit(Math.min(Number(limit) || 40, 100));
  const removals = await Message.find({
    conversationRef: conversation._id,
    deletedForEveryone: true,
    updatedAt: { $gt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
  }).select("messageId");
  const saved = await SavedMessage.find({ userId, messageId: { $in: rows.map((row) => row.messageId) } }).select("messageId");
  const savedIds = new Set(saved.map((item) => item.messageId));
  const messages = rows.reverse().map((row) => ({ ...serializeMessage(row), bookmarked: savedIds.has(row.messageId) }));
  return {
    messages,
    removals: removals.map((item) => item.messageId),
    nextCursor: rows.length ? rows[0].sequenceNumber : null,
    conversationId: conversation._id,
    retentionHours: conversation.retentionHours,
  };
}

export async function historyWithPeer(userId, peerId, options) {
  const conversation = await findDirect(userId, peerId);
  if (!conversation) return { messages: [], removals: [], nextCursor: null, retentionHours: 24 };
  return listHistory(userId, conversation, options);
}

export async function historyForConversation(userId, conversationId, options) {
  const conversation = await getConversationForUser(userId, conversationId);
  return listHistory(userId, conversation, options);
}

export async function unseenCounts(userId) {
  const conversations = await Conversation.find({ memberIds: userId }).select("_id type memberIds");
  const counts = {};
  if (!conversations.length) return counts;
  const rows = await Message.aggregate([
    {
      $match: {
        conversationRef: { $in: conversations.map((item) => item._id) },
        senderId: { $ne: userId },
        readBy: { $ne: userId },
        deletedForEveryone: { $ne: true },
        deletedFor: { $nin: [userId] },
        expiresAt: { $gt: new Date() },
      },
    },
    { $group: { _id: "$conversationRef", count: { $sum: 1 }, senderId: { $first: "$senderId" } } },
  ]);
  const byId = new Map(conversations.map((item) => [String(item._id), item]));
  for (const row of rows) {
    const conversation = byId.get(String(row._id));
    if (!conversation) continue;
    const key = conversation.type === "group"
      ? String(conversation._id)
      : String(conversation.memberIds.find((id) => String(id) !== String(userId)));
    counts[key] = row.count;
  }
  return counts;
}

export async function markMessagesRead(userId, messageIds) {
  const ids = (Array.isArray(messageIds) ? messageIds : [messageIds]).filter(Boolean);
  if (!ids.length) return [];
  const messages = await Message.find({ messageId: { $in: ids }, expiresAt: { $gt: new Date() } });
  const updated = [];
  for (const message of messages) {
    const conversation = await Conversation.findById(message.conversationRef).select("memberIds");
    if (!conversation || !(conversation.memberIds || []).some((id) => String(id) === String(userId))) continue;
    if (String(message.senderId) === String(userId)) continue;
    await Message.updateOne({ _id: message._id }, { $addToSet: { readBy: userId }, $set: { status: "read", seen: true } });
    updated.push(message);
  }
  return updated;
}

export async function markMessagesDelivered(userId, messageId) {
  const message = await Message.findOne({ messageId, expiresAt: { $gt: new Date() } });
  if (!message || String(message.senderId) === String(userId)) return null;
  const conversation = await Conversation.findById(message.conversationRef).select("memberIds");
  if (!conversation || !(conversation.memberIds || []).some((id) => String(id) === String(userId))) return null;
  if (message.status !== "read") {
    await Message.updateOne({ _id: message._id }, { $addToSet: { deliveredTo: userId }, $set: { status: "delivered" } });
  }
  return message;
}

export async function pendingForUser(userId) {
  const conversations = await Conversation.find({ memberIds: userId }).select("_id");
  const messages = await Message.find({
    conversationRef: { $in: conversations.map((item) => item._id) },
    senderId: { $ne: userId },
    readBy: { $ne: userId },
    ...visible(userId),
  }).sort({ createdAt: 1 }).limit(200);
  const removals = await Message.find({
    conversationRef: { $in: conversations.map((item) => item._id) },
    deletedForEveryone: true,
    updatedAt: { $gt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
  }).select("messageId");
  return {
    messages: messages.map(serializeMessage),
    removals: removals.map((item) => item.messageId),
  };
}

async function ownedMessage(userId, messageId) {
  const message = await Message.findOne({ messageId, expiresAt: { $gt: new Date() }, deletedForEveryone: { $ne: true } });
  if (!message) throw new HttpError("That message is no longer available.", 404);
  const conversation = await Conversation.findById(message.conversationRef);
  await assertConversationMember(conversation, userId);
  return { message, conversation };
}

export async function bookmarkMessage(userId, messageId) {
  const { message } = await ownedMessage(userId, messageId);
  const sender = await User.findById(message.senderId).select("fullName");
  await Message.updateOne({ _id: message._id }, { $addToSet: { bookmarkedBy: userId } });
  await SavedMessage.findOneAndUpdate(
    { userId, messageId },
    {
      $set: {
        conversationKey: message.conversationKey,
        senderId: message.senderId,
        senderName: sender?.fullName || "Someone",
        text: message.text || "",
        image: message.image || "",
        audio: message.audio || "",
        transcript: message.transcript || "",
        messageType: message.messageType,
        originalCreatedAt: message.createdAt,
      },
    },
    { upsert: true, new: true }
  );
  return true;
}

export async function unbookmarkMessage(userId, messageId) {
  await SavedMessage.deleteOne({ userId, messageId });
  await Message.updateOne({ messageId }, { $pull: { bookmarkedBy: userId } });
  return true;
}

export async function listSaved(userId) {
  return SavedMessage.find({ userId }).sort({ createdAt: -1 }).limit(200);
}

export async function editMessage(userId, messageId, text) {
  const nextText = String(text || "").trim();
  if (!nextText) throw new HttpError("Edited text cannot be empty.");
  if (nextText.length > 10000) throw new HttpError("Message is too long.");
  const { message } = await ownedMessage(userId, messageId);
  if (String(message.senderId) !== String(userId)) throw new HttpError("You can only edit your own messages.", 403);
  if (!withinWindow(message.createdAt, editWindowMs())) throw new HttpError("The edit window for this message has closed.", 403);
  message.text = nextText;
  message.editedAt = new Date();
  const handles = mentionHandles(nextText);
  const conversation = await Conversation.findById(message.conversationRef).select("memberIds");
  const mentioned = handles.length
    ? await User.find({ username: { $in: handles }, _id: { $in: conversation.memberIds } }).select("_id")
    : [];
  message.mentions = mentioned.map((user) => user._id);
  await message.save();
  await SavedMessage.updateMany({ messageId }, { $set: { text: nextText } });
  emitToUsers((conversation.memberIds || []).map(String), "message_edited", serializeMessage(message));
  return message;
}

export async function deleteMessage(userId, messageId, scope) {
  const message = await Message.findOne({ messageId });
  if (!message) throw new HttpError("That message is no longer available.", 404);
  const conversation = await Conversation.findById(message.conversationRef);
  await assertConversationMember(conversation, userId);
  if (scope === "everyone") {
    if (String(message.senderId) !== String(userId)) throw new HttpError("You can only delete your own messages for everyone.", 403);
    if (!withinWindow(message.createdAt, deleteWindowMs())) throw new HttpError("The window for deleting this message for everyone has closed.", 403);
    await SavedMessage.deleteMany({ messageId });
    if (message.publicId) {
      try {
        await cloudinary.uploader.destroy(message.publicId, { resource_type: message.resourceType || "image" });
      } catch (error) {
        console.error("Stored file cleanup failed");
      }
    }
    message.deletedForEveryone = true;
    message.text = "";
    message.image = "";
    message.audio = "";
    message.transcript = "";
    message.bookmarkedBy = [];
    await message.save();
    emitToUsers((conversation.memberIds || []).map(String), "message_deleted", {
      messageId,
      scope: "everyone",
      conversationId: message.conversationKey,
    });
    return { message, scope };
  }
  await Message.updateOne({ _id: message._id }, { $addToSet: { deletedFor: userId } });
  emitToUser(String(userId), "message_deleted", { messageId, scope: "me", conversationId: message.conversationKey });
  return { message, scope: "me" };
}

export async function searchMessages(userId, { q, conversationId, peerId, senderId, from, to, type }) {
  let conversationIds = [];
  if (conversationId) {
    const conversation = await getConversationForUser(userId, conversationId);
    conversationIds = [conversation._id];
  } else if (peerId) {
    const conversation = await findDirect(userId, peerId);
    if (!conversation) return [];
    conversationIds = [conversation._id];
  } else {
    const conversations = await Conversation.find({ memberIds: userId }).select("_id");
    conversationIds = conversations.map((item) => item._id);
  }
  const query = { conversationRef: { $in: conversationIds }, ...visible(userId) };
  if (senderId) query.senderId = senderId;
  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from);
    if (to) query.createdAt.$lte = new Date(to);
  }
  if (type === "image" || type === "audio") query.messageType = type;
  if (type === "link") query.text = /https?:\/\/\S+/i;
  if (q) {
    const escaped = String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!escaped) return [];
    const regex = new RegExp(escaped, "i");
    query.$or = [{ text: regex }, { transcript: regex, transcriptSearchable: true }];
  }
  const rows = await Message.find(query).sort({ createdAt: -1 }).limit(50);
  return rows.map(serializeMessage);
}

export async function messagesForSummary(userId, { conversation, range, messageIds, from, to }) {
  const query = { conversationRef: conversation._id, ...visible(userId) };
  const now = Date.now();
  if (range === "hour") query.createdAt = { $gte: new Date(now - 60 * 60 * 1000) };
  if (range === "day") query.createdAt = { $gte: new Date(now - 24 * 60 * 60 * 1000) };
  if (range === "custom") {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from);
    if (to) query.createdAt.$lte = new Date(to);
  }
  if (range === "selected") query.messageId = { $in: messageIds || [] };
  const rows = await Message.find(query).sort({ sequenceNumber: 1 }).limit(200);
  const users = await User.find({ _id: { $in: [...new Set(rows.map((row) => String(row.senderId)))] } }).select("fullName");
  const names = new Map(users.map((user) => [String(user._id), user.fullName]));
  return rows.map((row) => {
    const body = row.text || row.transcript || (row.image ? "[photo]" : row.audio ? "[voice message]" : "");
    return `${names.get(String(row.senderId)) || "Someone"} (${new Date(row.createdAt).toISOString()}): ${body}`;
  });
}

export async function catchUpLines(userId, conversation) {
  const state = await ReadState.findOne({ userId, conversationRef: conversation._id });
  const since = state?.lastReadAt || new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await Message.find({
    conversationRef: conversation._id,
    senderId: { $ne: userId },
    createdAt: { $gt: since },
    ...visible(userId),
  }).sort({ sequenceNumber: 1 }).limit(200);
  return messagesForSummary(userId, { conversation, range: "selected", messageIds: rows.map((row) => row.messageId) });
}

export async function setTranscriptSearchable(userId, messageId, enabled) {
  const { message } = await ownedMessage(userId, messageId);
  if (String(message.senderId) !== String(userId)) throw new HttpError("Only the sender can change transcript search.", 403);
  message.transcriptSearchable = Boolean(enabled);
  await message.save();
  return message;
}

export async function markConversationRead(userId, conversationId) {
  await ReadState.findOneAndUpdate(
    { userId, conversationRef: conversationId },
    { $set: { lastReadAt: new Date() } },
    { upsert: true }
  );
}

export async function cleanupExpiredMessages() {
  const expired = await Message.find({ expiresAt: { $lte: new Date() } }).limit(200);
  let removed = 0;
  for (const message of expired) {
    if (message.bookmarkedBy?.length && !message.deletedForEveryone) {
      for (const userId of message.bookmarkedBy) {
        const sender = await User.findById(message.senderId).select("fullName");
        await SavedMessage.updateOne(
          { userId, messageId: message.messageId },
          {
            $setOnInsert: {
              conversationKey: message.conversationKey,
              senderId: message.senderId,
              senderName: sender?.fullName || "Someone",
              text: message.text || "",
              image: message.image || "",
              audio: message.audio || "",
              transcript: message.transcript || "",
              messageType: message.messageType,
              originalCreatedAt: message.createdAt,
            },
          },
          { upsert: true }
        );
      }
    }
    const savedCount = await SavedMessage.countDocuments({ messageId: message.messageId });
    if (message.publicId && savedCount === 0) {
      try {
        await cloudinary.uploader.destroy(message.publicId, { resource_type: message.resourceType || "image" });
      } catch {
        console.error("Stored file cleanup failed");
      }
    }
    await Message.deleteOne({ _id: message._id });
    removed += 1;
  }
  return removed;
}

export function directKeyFor(userId, peerId) {
  return conversationKey(userId, peerId);
}
