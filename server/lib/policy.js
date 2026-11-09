import crypto from "crypto";

export const RETENTION_HOURS = [12, 24, 168];
export const DEFAULT_RETENTION_HOURS = 24;
export const QR_TTL_MS = 10 * 60 * 1000;

export function editWindowMs() {
  return Number(process.env.MESSAGE_EDIT_WINDOW_MS || 15 * 60 * 1000);
}

export function deleteWindowMs() {
  return Number(process.env.DELETE_EVERYONE_WINDOW_MS || 60 * 60 * 1000);
}

export function conversationKey(id1, id2) {
  return [String(id1), String(id2)].sort().join("_");
}

export function retentionHours(value) {
  const hours = Number(value);
  return RETENTION_HOURS.includes(hours) ? hours : DEFAULT_RETENTION_HOURS;
}

export function expiresAtFrom(createdAt, hours) {
  return new Date(new Date(createdAt).getTime() + retentionHours(hours) * 60 * 60 * 1000);
}

export function withinWindow(createdAt, windowMs, now = Date.now()) {
  return now - new Date(createdAt).getTime() <= windowMs;
}

export function usernameError(username) {
  const value = String(username || "").trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(value)) {
    return "Username must be 3-20 characters: letters, numbers, or underscore.";
  }
  return "";
}

export function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

export function mentionHandles(text) {
  return [...String(text || "").matchAll(/(^|\s)@([a-z0-9_]{3,20})/gi)].map((match) => match[2].toLowerCase());
}

export function isBlocked(leftBlocked, rightBlocked, leftId, rightId) {
  const has = (list, id) => (list || []).some((item) => String(item) === String(id));
  return has(leftBlocked, rightId) || has(rightBlocked, leftId);
}

export function publicUser(user) {
  if (!user) return null;
  const raw = typeof user.toObject === "function" ? user.toObject() : { ...user };
  delete raw.password;
  delete raw.__v;
  return raw;
}

export function publicProfile(user) {
  if (!user) return null;
  return {
    _id: user._id,
    fullName: user.fullName,
    username: user.username || "",
    profilePic: user.profilePic || "",
    bio: user.bio || "",
  };
}

export function qrState(row, now = new Date()) {
  if (!row) return "missing";
  if (row.revoked_at) return "revoked";
  if (row.redeemed_at) return "used";
  if (new Date(row.expires_at).getTime() <= new Date(now).getTime()) return "expired";
  return "active";
}

export function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

export function deviceLabel(userAgent) {
  const text = String(userAgent || "Unknown device");
  if (/mobile/i.test(text)) return "Mobile browser";
  if (/tablet/i.test(text)) return "Tablet browser";
  return "Desktop browser";
}

export function replyPreviewFrom(message) {
  if (!message) return "";
  if (message.text) return String(message.text).slice(0, 140);
  if (message.audio) return "Voice message";
  if (message.image) return "Photo";
  return "Message";
}

export function adminEmails() {
  return String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email) {
  return adminEmails().includes(String(email || "").toLowerCase());
}
