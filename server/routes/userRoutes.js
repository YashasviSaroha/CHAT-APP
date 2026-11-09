import express from "express";
import { blockUser, checkAuth, login, lookupUsername, setNotifications, signup, unblockUser, updateProfile } from "../controllers/userController.js";
import { peerRelation } from "../controllers/messageController.js";
import { protectRoute } from "../middleware/auth.js";
import { rateLimit } from "../lib/rateLimit.js";

const userRouter = express.Router();
const authLimit = rateLimit({ windowMs: 60_000, max: 20 });

userRouter.post("/signup", authLimit, signup);
userRouter.post("/login", authLimit, login);
userRouter.put("/update-profile", protectRoute, updateProfile);
userRouter.put("/notifications", protectRoute, setNotifications);
userRouter.get("/check", protectRoute, checkAuth);
userRouter.get("/lookup/:username", protectRoute, lookupUsername);
userRouter.get("/relation/:id", protectRoute, peerRelation);
userRouter.post("/block/:id", protectRoute, blockUser);
userRouter.post("/unblock/:id", protectRoute, unblockUser);

export default userRouter;
