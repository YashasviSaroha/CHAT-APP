import { redisConfigured } from "../lib/redis.js";
import { startQueues } from "./queue.js";

let timer = null;

export async function startScheduler() {
  const queued = await startQueues();
  if (queued && redisConfigured()) return;
  if (timer) return;
  const run = async () => {
    const { cleanupExpiredMessages } = await import("../services/messages.js");
    try {
      await cleanupExpiredMessages();
    } catch (error) {
      console.error("Cleanup failed:", error.message);
    }
  };
  timer = setInterval(run, 60_000);
  setTimeout(run, 5_000);
}
