import User from "../models/user.js";
import ConnectionRequest from "../models/ConnectionRequest.js";
import { HttpError } from "../lib/httpError.js";
import { isBlocked } from "../lib/policy.js";

export async function loadPair(userId, peerId) {
  const [user, peer] = await Promise.all([
    User.findById(userId).select("contacts blockedUsers fullName username profilePic bio"),
    User.findById(peerId).select("contacts blockedUsers fullName username profilePic bio"),
  ]);
  if (!peer) throw new HttpError("User not found", 404);
  return { user, peer };
}

export function pairIsBlocked(user, peer, userId, peerId) {
  return isBlocked(user?.blockedUsers, peer?.blockedUsers, userId, peerId);
}

export async function canMessage(userId, peerId) {
  if (String(userId) === String(peerId)) return { ok: false, message: "Choose another person." };
  const { user, peer } = await loadPair(userId, peerId);
  if (pairIsBlocked(user, peer, userId, peerId)) {
    return { ok: false, message: "Messaging is unavailable." };
  }
  const connected = (user.contacts || []).some((id) => String(id) === String(peerId))
    || (peer.contacts || []).some((id) => String(id) === String(userId));
  if (!connected) return { ok: false, message: "Connect with this person before sending a message." };
  return { ok: true, user, peer };
}

export async function relation(userId, peerId) {
  const { user, peer } = await loadPair(userId, peerId);
  const blockedByMe = (user.blockedUsers || []).some((id) => String(id) === String(peerId));
  const blocked = pairIsBlocked(user, peer, userId, peerId);
  const isContact = (user.contacts || []).some((id) => String(id) === String(peerId))
    || (peer.contacts || []).some((id) => String(id) === String(userId));
  const [outgoing, incoming] = await Promise.all([
    ConnectionRequest.findOne({ fromUser: userId, toUser: peerId, status: "pending" }).select("_id"),
    ConnectionRequest.findOne({ fromUser: peerId, toUser: userId, status: "pending" }).select("_id"),
  ]);
  return {
    isContact,
    canMessage: isContact && !blocked,
    blockedByMe,
    messagingDisabled: blocked && !blockedByMe,
    pendingOutgoing: Boolean(outgoing),
    pendingIncoming: Boolean(incoming),
    requestId: incoming?._id || null,
    profile: {
      _id: peer._id,
      fullName: peer.fullName,
      username: peer.username || "",
      profilePic: peer.profilePic || "",
      bio: peer.bio || "",
    },
  };
}

export async function connectUsers(userId, peerId) {
  await User.findByIdAndUpdate(userId, { $addToSet: { contacts: peerId } });
  await User.findByIdAndUpdate(peerId, { $addToSet: { contacts: userId } });
}

export async function assertConversationMember(conversation, userId) {
  const member = (conversation?.memberIds || []).some((id) => String(id) === String(userId));
  if (!member) throw new HttpError("You are not in this conversation.", 403);
}
