import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";

let redisReady = false;

export function redisConfigured() {
  return Boolean(process.env.REDIS_URL);
}

export async function attachSocketAdapter(io) {
  if (!redisConfigured()) return false;
  try {
    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    redisReady = true;
    console.log("Socket.IO is using Redis");
    return true;
  } catch (error) {
    console.error("Redis adapter is unavailable:", error.message);
    return false;
  }
}

export function redisIsReady() {
  return redisReady;
}
