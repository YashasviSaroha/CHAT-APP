import Conversation from "../models/Conversation.js";
import ReadState from "../models/ReadState.js";
import User from "../models/user.js";
import { HttpError } from "../lib/httpError.js";
import { conversationKey, retentionHours } from "../lib/policy.js";
import { assertConversationMember, canMessage } from "./access.js";

export async function findDirect(userId, peerId) {
  return Conversation.findOne({ directKey: conversationKey(userId, peerId) });
}

export async function ensureDirect(userId, peerId) {
  const existing = await findDirect(userId, peerId);
  if (existing) {
    const allowed = await canMessage(userId, peerId);
    if (!allowed.ok) throw new HttpError(allowed.message, 403);
    return existing;
  }
  const allowed = await canMessage(userId, peerId);
  if (!allowed.ok) throw new HttpError(allowed.message, 403);
  return Conversation.create({
    type: "direct",
    directKey: conversationKey(userId, peerId),
    memberIds: [userId, peerId],
    createdBy: userId,
    retentionHours: 24,
    nextSequence: 0,
  });
}

export async function listForUser(userId) {
  const conversations = await Conversation.find({ memberIds: userId }).sort({ lastMessageAt: -1, updatedAt: -1 }).limit(100);
  const peerIds = conversations
    .filter((item) => item.type === "direct")
    .map((item) => item.memberIds.find((id) => String(id) !== String(userId)))
    .filter(Boolean);
  const peers = await User.find({ _id: { $in: peerIds } }).select("fullName username profilePic bio");
  const peerMap = new Map(peers.map((peer) => [String(peer._id), peer]));
  return conversations.map((conversation) => {
    const peerId = conversation.memberIds.find((id) => String(id) !== String(userId));
    const peer = peerMap.get(String(peerId));
    return {
      _id: conversation._id,
      type: conversation.type,
      name: conversation.type === "group" ? conversation.name : peer?.fullName || "Conversation",
      username: peer?.username || "",
      profilePic: peer?.profilePic || "",
      bio: peer?.bio || "",
      peerId: conversation.type === "direct" ? peerId : null,
      memberIds: conversation.memberIds,
      retentionHours: conversation.retentionHours,
      muted: (conversation.mutedBy || []).some((id) => String(id) === String(userId)),
      lastMessageAt: conversation.lastMessageAt,
    };
  });
}

export async function createGroup(userId, name, memberIds) {
  const cleanName = String(name || "").trim();
  if (cleanName.length < 2 || cleanName.length > 60) throw new HttpError("Give the group a name between 2 and 60 characters.");
  const uniqueMembers = [...new Set((memberIds || []).map(String))].filter((id) => id !== String(userId));
  if (uniqueMembers.length < 2) throw new HttpError("Choose at least two contacts for a group.");
  if (uniqueMembers.length > 50) throw new HttpError("A group can have at most 50 other people.");
  for (const memberId of uniqueMembers) {
    const allowed = await canMessage(userId, memberId);
    if (!allowed.ok) throw new HttpError("Every group member must already be a contact you can message.");
  }
  return Conversation.create({
    type: "group",
    name: cleanName,
    memberIds: [userId, ...uniqueMembers],
    createdBy: userId,
    retentionHours: 24,
    nextSequence: 0,
  });
}

export async function setRetention(userId, conversationId, hours) {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw new HttpError("Conversation not found", 404);
  await assertConversationMember(conversation, userId);
  conversation.retentionHours = retentionHours(hours);
  await conversation.save();
  return conversation;
}

export async function setRetentionForPeer(userId, peerId, hours) {
  const conversation = await ensureDirect(userId, peerId);
  conversation.retentionHours = retentionHours(hours);
  await conversation.save();
  return conversation;
}

export async function setMute(userId, conversationId, muted) {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw new HttpError("Conversation not found", 404);
  await assertConversationMember(conversation, userId);
  if (muted) {
    await Conversation.updateOne({ _id: conversationId }, { $addToSet: { mutedBy: userId } });
  } else {
    await Conversation.updateOne({ _id: conversationId }, { $pull: { mutedBy: userId } });
  }
  return true;
}

export async function markRead(userId, conversationId) {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw new HttpError("Conversation not found", 404);
  await assertConversationMember(conversation, userId);
  await ReadState.findOneAndUpdate(
    { userId, conversationRef: conversationId },
    { $set: { lastReadAt: new Date() } },
    { upsert: true, new: true }
  );
  return conversation;
}

export async function getConversationForUser(userId, conversationId) {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw new HttpError("Conversation not found", 404);
  await assertConversationMember(conversation, userId);
  return conversation;
}
