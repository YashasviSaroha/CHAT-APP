import express from "express";
import "dotenv/config";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { connectDB } from "./lib/db.js";
import { initMysql } from "./lib/mysql.js";
import { attachSocketAdapter } from "./lib/redis.js";
import userRouter from "./routes/userRoutes.js";
import messageRouter from "./routes/messageRoutes.js";
import conversationRouter from "./routes/conversationRoutes.js";
import aiRouter from "./routes/aiRoutes.js";
import qrRouter from "./routes/qrRoutes.js";
import sessionRouter from "./routes/sessionRoutes.js";
import reportRouter from "./routes/reportRoutes.js";
import { registerSocket } from "./socket/register.js";
import { startScheduler } from "./jobs/scheduler.js";
import { onMessageUpdate } from "./services/transcription.js";
import { bindIo } from "./lib/realtime.js";

const app = express();
const server = http.createServer(app);
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map((item) => item.trim()).filter(Boolean)
  : true;

export const io = new Server(server, {
  cors: { origin: allowedOrigins },
});

bindIo(io);

app.use(express.json({ limit: "12mb" }));
app.use(cors({ origin: allowedOrigins }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

app.get("/api/status", (req, res) => res.send("Server is live"));
app.use("/api/auth", userRouter);
app.use("/api/messages", messageRouter);
app.use("/api/conversations", conversationRouter);
app.use("/api/ai", aiRouter);
app.use("/api/qr", qrRouter);
app.use("/api/sessions", sessionRouter);
app.use("/api/reports", reportRouter);

onMessageUpdate((event, userIds, payload) => {
  for (const userId of userIds) io.to(`user:${userId}`).emit(event, payload);
});

await connectDB();
await initMysql();
await attachSocketAdapter(io);
registerSocket(io);
await startScheduler();

if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => console.log("Server is running on PORT:" + PORT));
}

export default server;
