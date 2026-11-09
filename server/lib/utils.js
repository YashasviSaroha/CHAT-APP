import crypto from "crypto";
import jwt from "jsonwebtoken";

export const generateToken = (userId) => {
  const jti = crypto.randomUUID();
  const token = jwt.sign({ userId, jti }, process.env.JWT_SECRET, { expiresIn: "30d" });
  return { token, jti };
};
