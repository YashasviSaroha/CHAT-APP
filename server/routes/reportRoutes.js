import express from "express";
import { protectRoute } from "../middleware/auth.js";
import { rateLimit } from "../lib/rateLimit.js";
import { adminReports, reportUser, reviewReport } from "../controllers/featureControllers.js";

const reportRouter = express.Router();
const reportLimit = rateLimit({ windowMs: 60_000, max: 10, keyFn: (req) => `${req.user?._id || req.ip}:report` });

reportRouter.post("/", protectRoute, reportLimit, reportUser);
reportRouter.get("/", protectRoute, adminReports);
reportRouter.patch("/:id", protectRoute, reviewReport);

export default reportRouter;
