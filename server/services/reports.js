import { getPool, mysqlRequired } from "../lib/mysql.js";
import { HttpError } from "../lib/httpError.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import { assertConversationMember } from "./access.js";

const REASONS = new Set(["spam", "harassment", "inappropriate", "scam", "other"]);

export async function createReport(reporterId, { reportedUserId, messageId, reason, description, includeEvidence }) {
  const pool = await getPool();
  if (!pool) throw mysqlRequired();
  if (!REASONS.has(reason)) throw new HttpError("Choose a report reason.");
  if (!reportedUserId) throw new HttpError("Choose who to report.");
  let evidence = null;
  const messageKey = messageId ? String(messageId).slice(0, 80) : "user";
  if (includeEvidence && messageId) {
    const message = await Message.findOne({ messageId, expiresAt: { $gt: new Date() }, deletedForEveryone: { $ne: true } });
    if (!message) throw new HttpError("That message is no longer available to attach.", 404);
    const conversation = await Conversation.findById(message.conversationRef);
    await assertConversationMember(conversation, reporterId);
    evidence = [message.text, message.transcript].filter(Boolean).join("\n").slice(0, 4000);
    if (!evidence) throw new HttpError("That message has no text to attach.");
  }
  try {
    await pool.execute(
      "INSERT INTO abuse_reports (reporter_user_id, reported_user_id, message_key, reason, description, evidence_text, status) VALUES (?, ?, ?, ?, ?, ?, 'open')",
      [String(reporterId), String(reportedUserId), messageKey, reason, String(description || "").slice(0, 2000), evidence]
    );
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") throw new HttpError("You already reported this.", 409);
    throw error;
  }
  return true;
}

export async function listReports() {
  const pool = await getPool();
  if (!pool) throw mysqlRequired();
  const [rows] = await pool.execute("SELECT id, reporter_user_id, reported_user_id, message_key, reason, description, status, created_at FROM abuse_reports ORDER BY created_at DESC LIMIT 200");
  return rows.map((row) => ({
    id: row.id,
    reporterId: row.reporter_user_id,
    reportedUserId: row.reported_user_id,
    messageKey: row.message_key,
    reason: row.reason,
    description: row.description || "",
    status: row.status,
    createdAt: row.created_at,
  }));
}

export async function updateReportStatus(reportId, status) {
  if (!["open", "reviewing", "resolved", "dismissed"].includes(status)) throw new HttpError("Unknown report status.");
  const pool = await getPool();
  if (!pool) throw mysqlRequired();
  const [result] = await pool.execute("UPDATE abuse_reports SET status = ? WHERE id = ?", [status, reportId]);
  if (!result.affectedRows) throw new HttpError("Report not found", 404);
  return true;
}
