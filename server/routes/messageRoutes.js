import express from "express";
import { protectRoute } from "../middleware/auth.js";
import { rateLimit } from "../lib/rateLimit.js";
import {
  acceptRequest,
  addContact,
  editOwnMessage,
  findMessages,
  getConversationHistory,
  getPeerHistory,
  getUsersForSidebar,
  listRequests,
  rejectRequest,
  removeBookmark,
  removeMessage,
  requestContact,
  saveBookmark,
  savedMessages,
  searchUsers,
  transcriptPrivacy,
  uploadFile,
} from "../controllers/messageController.js";

const messageRouter = express.Router();
const searchLimit = rateLimit({ windowMs: 60_000, max: 30, keyFn: (req) => `${req.headers.token || req.ip}:search` });

messageRouter.get("/users", protectRoute, getUsersForSidebar);
messageRouter.get("/search", protectRoute, searchLimit, searchUsers);
messageRouter.get("/find", protectRoute, findMessages);
messageRouter.get("/saved", protectRoute, savedMessages);
messageRouter.get("/requests", protectRoute, listRequests);
messageRouter.get("/history/:peerId", protectRoute, getPeerHistory);
messageRouter.get("/conversation/:conversationId", protectRoute, getConversationHistory);
messageRouter.post("/add-contact/:id", protectRoute, addContact);
messageRouter.post("/request/:id", protectRoute, requestContact);
messageRouter.post("/requests/:id/accept", protectRoute, acceptRequest);
messageRouter.post("/requests/:id/reject", protectRoute, rejectRequest);
messageRouter.post("/upload", protectRoute, uploadFile);
messageRouter.post("/:messageId/bookmark", protectRoute, saveBookmark);
messageRouter.delete("/:messageId/bookmark", protectRoute, removeBookmark);
messageRouter.patch("/:messageId", protectRoute, editOwnMessage);
messageRouter.post("/:messageId/delete", protectRoute, removeMessage);
messageRouter.put("/:messageId/transcript", protectRoute, transcriptPrivacy);

export default messageRouter;
