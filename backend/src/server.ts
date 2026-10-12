import http from "node:http";
import { WebSocketServer } from "ws";
import app from "./app";
import { env } from "./config/env";

const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws, req) => {
  console.log(`[WS] Client connected from ${req.socket.remoteAddress}`);

  ws.on("message", (data) => {
    console.log(`[WS] Received: ${data}`);
  });

  ws.on("close", () => {
    console.log("[WS] Client disconnected");
  });

  ws.on("error", (err) => {
    console.error("[WS] Error:", err);
  });
});

server.listen(env.PORT, "0.0.0.0", () => {
  console.log(`Proctora Backend running on port ${env.PORT}`);
  console.log(`Environment: ${env.NODE_ENV}`);
  console.log(`API: http://0.0.0.0:${env.PORT}/api`);
  console.log(`WebSocket: ws://0.0.0.0:${env.PORT}/ws`);
});
