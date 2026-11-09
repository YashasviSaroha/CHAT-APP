import jwt from "jsonwebtoken";
import User from "../models/user.js";
import Conversation from "../models/Conversation.js";
import { allowSocketSend } from "../lib/rateLimit.js";
import { addSocket, onlineUserIds, removeSocket, socketIdsFor } from "../lib/presence.js";
import { assertSessionActive } from "../services/sessions.js";
import {
  createMessage,
  markMessagesDelivered,
  markMessagesRead,
  pendingForUser,
  serializeMessage,
} from "../services/messages.js";

function joinOnlineSockets(io, userId, room) {
  for (const socketId of socketIdsFor(userId)) {
    io.sockets.sockets.get(socketId)?.join(room);
  }
}

export function registerSocket(io) {
  io.on("connection", async (socket) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      socket.disconnect();
      return;
    }

    let userId;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.userId;
      const active = await assertSessionActive(decoded.jti);
      const user = await User.findById(userId).select("_id notifications");
      if (!user || !active) {
        socket.disconnect();
        return;
      }
      socket.userId = String(userId);
      socket.notifications = user.notifications || {};
    } catch {
      socket.disconnect();
      return;
    }

    addSocket(socket.userId, socket.id);
    socket.join(`user:${socket.userId}`);
    const conversations = await Conversation.find({ memberIds: socket.userId }).select("_id");
    for (const conversation of conversations) {
      socket.join(`conversation:${conversation._id}`);
    }
    io.emit("getOnlineUsers", onlineUserIds());

    socket.on("join_conversation", async ({ conversationId }) => {
      try {
        const conversation = await Conversation.findById(conversationId).select("memberIds");
        const member = (conversation?.memberIds || []).some((id) => String(id) === socket.userId);
        if (!member) return socket.emit("message_error", { error: "You cannot join that conversation." });
        socket.join(`conversation:${conversation._id}`);
      } catch {
        socket.emit("message_error", { error: "Could not join the conversation." });
      }
    });

    socket.on("send_message", async (data) => {
      try {
        if (!allowSocketSend(socket.userId)) {
          return socket.emit("message_error", { error: "You are sending messages too quickly." });
        }
        const result = await createMessage({
          senderId: socket.userId,
          receiverId: data?.receiverId,
          conversationId: data?.conversationId,
          text: data?.text || "",
          image: data?.image || "",
          audio: data?.audio || "",
          publicId: data?.publicId || "",
          resourceType: data?.resourceType || "",
          messageId: data?.messageId,
          replyToMessageId: data?.replyToMessageId || "",
        });
        const payload = serializeMessage(result.message);
        socket.emit("message_sent", payload);
        socket.to(`user:${socket.userId}`).emit("message_sent", payload);
        const members = result.conversation?.memberIds || [];
        for (const memberId of members) {
          joinOnlineSockets(io, memberId, `conversation:${result.conversation._id}`);
          if (String(memberId) === socket.userId) continue;
          io.to(`user:${memberId}`).emit("newMessage", payload);
          const muted = (result.conversation.mutedBy || []).some((id) => String(id) === String(memberId));
          if (!muted) {
            const mentioned = (result.message.mentions || []).some((id) => String(id) === String(memberId));
            io.to(`user:${memberId}`).emit("notification", {
              conversationId: payload.conversationId,
              conversationRef: payload.conversationRef,
              messageId: payload.messageId,
              senderId: payload.senderId,
              mention: mentioned,
              preview: mentioned ? String(result.message.text || "Voice message").slice(0, 80) : "New message",
            });
          }
        }
      } catch (error) {
        socket.emit("message_error", { error: error.message || "Failed to send message" });
      }
    });

    socket.on("message_delivered", async ({ messageId }) => {
      const message = await markMessagesDelivered(socket.userId, messageId);
      if (!message) return;
      io.to(`user:${message.senderId}`).emit("message_delivered", { messageId });
    });

    socket.on("message_read", async ({ messageId, messageIds }) => {
      const ids = messageIds || (messageId ? [messageId] : []);
      const messages = await markMessagesRead(socket.userId, ids);
      const bySender = new Map();
      for (const message of messages) {
        const key = String(message.senderId);
        if (!bySender.has(key)) bySender.set(key, []);
        bySender.get(key).push(message.messageId);
      }
      for (const [senderId, readIds] of bySender) {
        io.to(`user:${senderId}`).emit("message_read", { messageIds: readIds });
      }
    });

    socket.on("get_pending_messages", async () => {
      const pending = await pendingForUser(socket.userId);
      socket.emit("pending_messages", pending.messages);
      if (pending.removals.length) socket.emit("messages_removed", { messageIds: pending.removals });
    });

    socket.on("disconnect", () => {
      removeSocket(socket.userId, socket.id);
      io.emit("getOnlineUsers", onlineUserIds());
    });
  });
}
