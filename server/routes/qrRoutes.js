import express from "express";
import { protectRoute } from "../middleware/auth.js";
import { rateLimit } from "../lib/rateLimit.js";
import { cancelQr, createQr, useQr } from "../controllers/featureControllers.js";

const qrRouter = express.Router();
const qrLimit = rateLimit({ windowMs: 60_000, max: 20, keyFn: (req) => `${req.user?._id || req.ip}:qr` });

qrRouter.post("/", protectRoute, qrLimit, createQr);
qrRouter.post("/redeem", protectRoute, qrLimit, useQr);
qrRouter.post("/:id/revoke", protectRoute, cancelQr);

export default qrRouter;
