import { getPool, mysqlRequired } from "../lib/mysql.js";
import { sha256 } from "../lib/policy.js";

const touched = new Map();

export async function createSession(userId, jti, label) {
  const pool = await getPool();
  if (!pool) return { configured: false };
  await pool.execute(
    "INSERT INTO device_sessions (session_key, user_id, token_hash, device_label, last_active_at) VALUES (?, ?, ?, ?, ?)",
    [jti, String(userId), sha256(jti), String(label || "Browser").slice(0, 255), new Date()]
  );
  return { configured: true };
}

export async function assertSessionActive(jti) {
  if (!jti) return true;
  const pool = await getPool();
  if (!pool) return true;
  const [rows] = await pool.execute("SELECT revoked_at FROM device_sessions WHERE session_key = ? LIMIT 1", [jti]);
  if (!rows.length) return true;
  return !rows[0].revoked_at;
}

export async function touchSession(jti) {
  if (!jti) return;
  const now = Date.now();
  if (now - (touched.get(jti) || 0) < 60_000) return;
  touched.set(jti, now);
  const pool = await getPool();
  if (!pool) return;
  await pool.execute("UPDATE device_sessions SET last_active_at = ? WHERE session_key = ? AND revoked_at IS NULL", [new Date(), jti]);
}

export async function listSessions(userId, currentJti) {
  const pool = await getPool();
  if (!pool) throw mysqlRequired();
  const [rows] = await pool.execute(
    "SELECT id, device_label, last_active_at, created_at, revoked_at, session_key FROM device_sessions WHERE user_id = ? ORDER BY last_active_at DESC",
    [String(userId)]
  );
  return rows.map((row) => ({
    id: row.id,
    device: row.device_label,
    lastActiveAt: row.last_active_at,
    createdAt: row.created_at,
    revoked: Boolean(row.revoked_at),
    current: row.session_key === currentJti,
  }));
}

export async function revokeSession(userId, sessionId) {
  const pool = await getPool();
  if (!pool) throw mysqlRequired();
  const [result] = await pool.execute(
    "UPDATE device_sessions SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL",
    [new Date(), sessionId, String(userId)]
  );
  return result.affectedRows === 1;
}
