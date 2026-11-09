import express from "express";
import { protectRoute } from "../middleware/auth.js";
import { changeMute, changeRetention, makeGroup, myConversations, readConversation } from "../controllers/featureControllers.js";

const conversationRouter = express.Router();

conversationRouter.get("/", protectRoute, myConversations);
conversationRouter.post("/group", protectRoute, makeGroup);
conversationRouter.post("/read", protectRoute, readConversation);
conversationRouter.put("/peer/:peerId/retention", protectRoute, changeRetention);
conversationRouter.put("/:id/retention", protectRoute, changeRetention);
conversationRouter.put("/:id/mute", protectRoute, changeMute);

export default conversationRouter;
