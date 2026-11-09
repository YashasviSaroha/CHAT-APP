import { sendError } from "../lib/httpError.js";
import { isAdminEmail } from "../lib/policy.js";
import Summary from "../models/Summary.js";
import { summarizeTranscript } from "../services/gemini.js";
import { catchUpLines, messagesForSummary } from "../services/messages.js";
import { findDirect, getConversationForUser, setMute, setRetention, setRetentionForPeer, createGroup, listForUser, markRead } from "../services/conversations.js";
import { issueQr, redeemQr, revokeQr } from "../services/qr.js";
import { listSessions, revokeSession } from "../services/sessions.js";
import { createReport, listReports, updateReportStatus } from "../services/reports.js";

async function conversationFromBody(user, body) {
  if (body.conversationId) return getConversationForUser(user._id, body.conversationId);
  if (body.peerId) {
    const existing = await findDirect(user._id, body.peerId);
    if (!existing) return null;
    return existing;
  }
  return null;
}

export const summarize = async (req, res) => {
  try {
    const conversation = await conversationFromBody(req.user, req.body);
    if (!conversation) return res.json({ success: true, empty: true, text: "There are no messages in that range." });
    const lines = await messagesForSummary(req.user._id, {
      conversation,
      range: req.body.range || "day",
      messageIds: req.body.messageIds || [],
      from: req.body.from,
      to: req.body.to,
    });
    const summary = await summarizeTranscript(lines, "summary");
    res.json({ success: true, ...summary, disclosure: "The selected messages were sent to Google Gemini." });
  } catch (error) {
    sendError(res, error);
  }
};

export const catchUp = async (req, res) => {
  try {
    const conversation = await conversationFromBody(req.user, req.body);
    if (!conversation) return res.json({ success: true, empty: true, text: "There are no missed messages." });
    const lines = await catchUpLines(req.user._id, conversation);
    const summary = await summarizeTranscript(lines, "catchup");
    res.json({ success: true, ...summary, count: lines.length, disclosure: "The missed messages were sent to Google Gemini." });
  } catch (error) {
    sendError(res, error);
  }
};

export const saveSummary = async (req, res) => {
  try {
    const text = String(req.body.text || "").trim();
    if (!text) return res.status(400).json({ success: false, message: "Nothing to save." });
    const summary = await Summary.create({
      userId: req.user._id,
      conversationRef: req.body.conversationId || undefined,
      text: text.slice(0, 8000),
      kind: req.body.kind || "summary",
    });
    res.json({ success: true, id: summary._id });
  } catch (error) {
    sendError(res, error);
  }
};

export const myConversations = async (req, res) => {
  try {
    const conversations = await listForUser(req.user._id);
    res.json({ success: true, conversations });
  } catch (error) {
    sendError(res, error);
  }
};

export const makeGroup = async (req, res) => {
  try {
    const group = await createGroup(req.user._id, req.body.name, req.body.memberIds);
    res.json({ success: true, conversation: group });
  } catch (error) {
    sendError(res, error);
  }
};

export const changeRetention = async (req, res) => {
  try {
    const conversation = req.params.peerId
      ? await setRetentionForPeer(req.user._id, req.params.peerId, req.body.hours)
      : await setRetention(req.user._id, req.params.id, req.body.hours);
    res.json({ success: true, retentionHours: conversation.retentionHours, conversationId: conversation._id });
  } catch (error) {
    sendError(res, error);
  }
};

export const changeMute = async (req, res) => {
  try {
    await setMute(req.user._id, req.params.id, Boolean(req.body.muted));
    res.json({ success: true });
  } catch (error) {
    sendError(res, error);
  }
};

export const readConversation = async (req, res) => {
  try {
    const conversation = req.body.conversationId
      ? await getConversationForUser(req.user._id, req.body.conversationId)
      : await findDirect(req.user._id, req.body.peerId);
    if (conversation) await markRead(req.user._id, conversation._id);
    res.json({ success: true });
  } catch (error) {
    sendError(res, error);
  }
};

export const createQr = async (req, res) => {
  try {
    const qr = await issueQr(req.user._id);
    res.json({ success: true, ...qr });
  } catch (error) {
    sendError(res, error);
  }
};

export const cancelQr = async (req, res) => {
  try {
    await revokeQr(req.user._id, req.params.id);
    res.json({ success: true });
  } catch (error) {
    sendError(res, error);
  }
};

export const useQr = async (req, res) => {
  try {
    const user = await redeemQr(req.user._id, req.body.token);
    res.json({ success: true, user });
  } catch (error) {
    sendError(res, error);
  }
};

export const sessions = async (req, res) => {
  try {
    const items = await listSessions(req.user._id, req.sessionKey);
    res.json({ success: true, sessions: items });
  } catch (error) {
    sendError(res, error);
  }
};

export const endSession = async (req, res) => {
  try {
    const ended = await revokeSession(req.user._id, req.params.id);
    if (!ended) return res.status(404).json({ success: false, message: "Session not found" });
    res.json({ success: true });
  } catch (error) {
    sendError(res, error);
  }
};

export const reportUser = async (req, res) => {
  try {
    await createReport(req.user._id, req.body);
    res.json({ success: true, message: "Report submitted. Attached text is kept only because you chose to include it." });
  } catch (error) {
    sendError(res, error);
  }
};

export const adminReports = async (req, res) => {
  try {
    if (!isAdminEmail(req.user.email)) return res.status(403).json({ success: false, message: "Reports are limited to administrators." });
    const reports = await listReports();
    res.json({ success: true, reports });
  } catch (error) {
    sendError(res, error);
  }
};

export const reviewReport = async (req, res) => {
  try {
    if (!isAdminEmail(req.user.email)) return res.status(403).json({ success: false, message: "Reports are limited to administrators." });
    await updateReportStatus(req.params.id, req.body.status);
    res.json({ success: true });
  } catch (error) {
    sendError(res, error);
  }
};
