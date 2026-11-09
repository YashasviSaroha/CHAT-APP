import express from "express";
import { protectRoute } from "../middleware/auth.js";
import { endSession, sessions } from "../controllers/featureControllers.js";

const sessionRouter = express.Router();

sessionRouter.get("/", protectRoute, sessions);
sessionRouter.post("/:id/revoke", protectRoute, endSession);

export default sessionRouter;
