import { GoogleGenerativeAI } from "@google/generative-ai";
import { HttpError } from "../lib/httpError.js";

export function geminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

function model() {
  if (!geminiConfigured()) {
    throw new HttpError("Gemini is not configured. Add GEMINI_API_KEY on the server.", 503);
  }
  const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return client.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-2.0-flash" });
}

function friendlyGeminiError(error) {
  const text = String(error?.message || "");
  if (/429|quota|rate/i.test(text)) {
    throw new HttpError("Gemini is busy right now. Try again in a minute.", 429);
  }
  throw new HttpError("Gemini could not complete that request.", 502);
}

export async function summarizeTranscript(lines, kind) {
  if (!lines.length) {
    return { empty: true, text: "There are no messages in that range." };
  }
  const clipped = lines.join("\n").slice(0, 12000);
  const instruction = kind === "catchup"
    ? "Summarize what this person missed. Use five short sections: Main points, Decisions, Pending questions, Action items, Important information. Mention that this is only the messages they have not read."
    : "Summarize this conversation. Use five short sections: Main points, Decisions, Pending questions, Action items, Important information.";
  try {
    const result = await model().generateContent(`${instruction}\n\nThe user chose to send only these messages to Gemini:\n${clipped}`);
    return { empty: false, text: result.response.text().trim() };
  } catch (error) {
    if (error.statusCode) throw error;
    friendlyGeminiError(error);
  }
}

export async function transcribeAudio(base64, mimeType) {
  try {
    const result = await model().generateContent([
      { text: "Transcribe this voice message. Return only the spoken words." },
      { inlineData: { mimeType: mimeType || "audio/webm", data: base64 } },
    ]);
    return result.response.text().trim();
  } catch (error) {
    if (error.statusCode) throw error;
    friendlyGeminiError(error);
  }
}
