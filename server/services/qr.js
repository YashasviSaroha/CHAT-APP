import crypto from "crypto";
import QRCode from "qrcode";
import { getPool, mysqlRequired } from "../lib/mysql.js";
import { HttpError } from "../lib/httpError.js";
import { QR_TTL_MS, qrState, sha256 } from "../lib/policy.js";
import { connectUsers } from "./access.js";
import User from "../models/user.js";

export async function issueQr(ownerUserId) {
  const pool = await getPool();
  if (!pool) throw mysqlRequired();
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + QR_TTL_MS);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      "UPDATE qr_invite_tokens SET revoked_at = ? WHERE owner_user_id = ? AND redeemed_at IS NULL AND revoked_at IS NULL",
      [new Date(), String(ownerUserId)]
    );
    const [result] = await connection.execute(
      "INSERT INTO qr_invite_tokens (token_hash, owner_user_id, expires_at) VALUES (?, ?, ?)",
      [sha256(token), String(ownerUserId), expiresAt]
    );
    await connection.commit();
    const image = await QRCode.toDataURL(token, { margin: 1, width: 280 });
    return { id: result.insertId, token, expiresAt: expiresAt.toISOString(), image };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function revokeQr(ownerUserId, qrId) {
  const pool = await getPool();
  if (!pool) throw mysqlRequired();
  const [result] = await pool.execute(
    "UPDATE qr_invite_tokens SET revoked_at = ? WHERE id = ? AND owner_user_id = ? AND redeemed_at IS NULL AND revoked_at IS NULL",
    [new Date(), qrId, String(ownerUserId)]
  );
  if (!result.affectedRows) throw new HttpError("That QR code is already expired or used.", 409);
  return true;
}

export async function redeemQr(userId, token) {
  const pool = await getPool();
  if (!pool) throw mysqlRequired();
  if (!token || typeof token !== "string" || token.length < 20) throw new HttpError("Enter a valid QR code.");
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute("SELECT * FROM qr_invite_tokens WHERE token_hash = ? FOR UPDATE", [sha256(token.trim())]);
    const row = rows[0];
    const state = qrState(row);
    if (state !== "active") {
      await connection.rollback();
      const messages = { missing: "This QR code is not valid.", revoked: "This QR code was revoked.", used: "This QR code was already used.", expired: "This QR code has expired." };
      throw new HttpError(messages[state] || "This QR code is not valid.", 409);
    }
    if (String(row.owner_user_id) === String(userId)) {
      await connection.rollback();
      throw new HttpError("You cannot redeem your own QR code.");
    }
    const owner = await User.findById(row.owner_user_id).select("fullName username profilePic bio blockedUsers");
    if (!owner) {
      await connection.rollback();
      throw new HttpError("That profile is no longer available.", 404);
    }
    if ((owner.blockedUsers || []).some((id) => String(id) === String(userId))) {
      await connection.rollback();
      throw new HttpError("This connection is unavailable.", 403);
    }
    await connectUsers(userId, owner._id);
    const [updated] = await connection.execute(
      "UPDATE qr_invite_tokens SET redeemed_by = ?, redeemed_at = ? WHERE id = ? AND redeemed_at IS NULL AND revoked_at IS NULL AND expires_at > ?",
      [String(userId), new Date(), row.id, new Date()]
    );
    if (!updated.affectedRows) {
      await connection.rollback();
      throw new HttpError("This QR code is no longer valid.", 409);
    }
    await connection.commit();
    return {
      _id: owner._id,
      fullName: owner.fullName,
      username: owner.username || "",
      profilePic: owner.profilePic || "",
      bio: owner.bio || "",
    };
  } catch (error) {
    try { await connection.rollback(); } catch { /* already closed */ }
    throw error;
  } finally {
    connection.release();
  }
}
