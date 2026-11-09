import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { redisConfigured } from "../lib/redis.js";

let transcribeQueue = null;
let started = false;

export async function startQueues() {
  if (started || !redisConfigured()) return false;
  started = true;
  try {
    const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
    transcribeQueue = new Queue("transcription", { connection });
    const cleanupQueue = new Queue("cleanup", { connection: connection.duplicate() });
    new Worker("transcription", async (job) => {
      const { transcribeMessage } = await import("../services/transcription.js");
      await transcribeMessage(job.data.messageId);
    }, { connection: connection.duplicate(), concurrency: 2 });
    new Worker("cleanup", async () => {
      const { cleanupExpiredMessages } = await import("../services/messages.js");
      await cleanupExpiredMessages();
    }, { connection: connection.duplicate() });
    await cleanupQueue.add("sweep", {}, {
      repeat: { every: 60_000 },
      jobId: "expired-message-sweep",
    });
    console.log("Background jobs are using Redis");
    return true;
  } catch (error) {
    transcribeQueue = null;
    console.error("Background jobs stayed in-process:", error.message);
    return false;
  }
}

export async function enqueueTranscription(messageId) {
  if (transcribeQueue) {
    await transcribeQueue.add("transcribe", { messageId }, {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 100,
      jobId: `transcript-${messageId}`,
    });
    return;
  }
  setTimeout(async () => {
    const { transcribeMessage } = await import("../services/transcription.js");
    await transcribeMessage(messageId);
  }, 0);
}
