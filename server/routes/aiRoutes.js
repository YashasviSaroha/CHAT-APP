import express from "express";
import { protectRoute } from "../middleware/auth.js";
import { rateLimit } from "../lib/rateLimit.js";
import { catchUp, saveSummary, summarize } from "../controllers/featureControllers.js";

const aiRouter = express.Router();
const aiLimit = rateLimit({ windowMs: 60_000, max: 10, keyFn: (req) => `${req.user?._id || req.ip}:ai` });

aiRouter.post("/summarize", protectRoute, aiLimit, summarize);
aiRouter.post("/catch-up", protectRoute, aiLimit, catchUp);
aiRouter.post("/summaries", protectRoute, saveSummary);

export default aiRouter;
