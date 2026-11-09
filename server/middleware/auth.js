import jwt from "jsonwebtoken";
import User from "../models/user.js";
import { assertSessionActive, touchSession } from "../services/sessions.js";

export const protectRoute = async (req, res, next) => {
  try {
    const token = req.headers.token;
    if (!token) return res.status(401).json({ success: false, message: "Token must be provided" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const active = await assertSessionActive(decoded.jti);
    if (!active) return res.status(401).json({ success: false, message: "This session has ended. Log in again." });

    const user = await User.findById(decoded.userId).select("-password");
    if (!user) return res.status(401).json({ success: false, message: "User not Found" });

    req.user = user;
    req.sessionKey = decoded.jti || "";
    await touchSession(decoded.jti);
    next();
  } catch (error) {
    console.error(error.message);
    res.status(401).json({ success: false, message: "Session expired. Log in again." });
  }
};
