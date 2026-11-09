import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import { geminiConfigured, transcribeAudio } from "./gemini.js";

let emitUpdate = () => {};

export function onMessageUpdate(fn) {
  emitUpdate = fn;
}

export async function transcribeMessage(messageId) {
  const message = await Message.findOne({ messageId });
  if (!message?.audio || message.transcriptStatus === "completed") return;
  if (!geminiConfigured()) {
    message.transcriptStatus = "unavailable";
    await message.save();
    emitUpdate("message_updated", await audience(message), serializeUpdate(message));
    return;
  }
  try {
    const response = await fetch(message.audio);
    if (!response.ok) throw new Error("Audio could not be read");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 8 * 1024 * 1024) throw new Error("Audio file is too large");
    const mimeType = response.headers.get("content-type") || "audio/webm";
    message.transcript = await transcribeAudio(bytes.toString("base64"), mimeType.split(";")[0]);
    message.transcriptStatus = "completed";
    await message.save();
  } catch (error) {
    message.transcriptStatus = "failed";
    await message.save();
    console.error("Transcription failed:", error.message);
  }
  emitUpdate("message_updated", await audience(message), serializeUpdate(message));
}

async function audience(message) {
  if (message.conversationRef) {
    const conversation = await Conversation.findById(message.conversationRef).select("memberIds");
    if (conversation?.memberIds?.length) return conversation.memberIds.map(String);
  }
  return [message.senderId, message.receiverId].filter(Boolean).map(String);
}

function serializeUpdate(message) {
  return {
    messageId: message.messageId,
    transcript: message.transcript || "",
    transcriptStatus: message.transcriptStatus || "",
    conversationId: message.conversationKey,
  };
}
