// src/index.ts
import { createApp } from "./app";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { env } from "./config/env";
import { WebSocketServer } from "ws";
import type { RawData } from "ws";
import type { IncomingMessage } from "http";
import type { Socket } from "net";
import { createRealtimeBridge } from "./services/realtimeBridge";
import { Call } from "./models";

async function bootstrap() {
  await connectDatabase();

  const app = createApp();

  const server = app.listen(env.port, () => {
    console.log(`[api] Govinda AI API running on port ${env.port}`);

    // Keep-alive for Render free tier
    if (env.nodeEnv === "production") {
      setInterval(() => {
        fetch(`http://localhost:${env.port}/api/health`)
          .catch(() => undefined);
      }, 10 * 60 * 1000);
    }
  });

  // ===== DEBUG ADDED =====
  console.log("[ws] OpenAI key present:", env.openai.apiKey ? `yes (len=${env.openai.apiKey.length})` : "NO — KEY IS EMPTY");
  // ===== DEBUG ADDED =====

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req: IncomingMessage, socket: Socket, head: Buffer) => {
    const pathname = req.url ?? "";
    console.log("[ws] upgrade request for:", pathname);

    if (pathname === "/ws") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", (ws, req) => {
    console.log("[ws] Exotel voicebot connected from", req.socket.remoteAddress);

    const bridge = createRealtimeBridge(ws);

    ws.on("message", async (message: RawData) => {
      const raw = message.toString();

      try {
        const parsed = JSON.parse(raw) as {
          event?: string;
          start?: { callSid?: string };
        };

        // ===== DEBUG ADDED =====
        if (parsed.event && parsed.event !== "media") {
          console.log("[ws] non-media event received:", raw.slice(0, 500));
        }
        // ===== DEBUG ADDED =====

        if (parsed.event === "start" && parsed.start?.callSid) {
          const callSid = parsed.start.callSid;
          Call.findOne({ exotelCallSid: callSid })
            .select("script")
            .lean()
            .then((doc) => {
              if (doc?.script) {
                (ws as typeof ws & { _callScript?: string })._callScript =
                  doc.script;
              }
            })
            .catch(() => undefined);
        }
      } catch {
        // not JSON — ignore
      }

      bridge.handleExotelMessage(raw);
    });

    ws.on("close", (code, reason) => {
      console.log("[ws] Exotel disconnected", code, reason.toString());
      bridge.destroy();
    });

    ws.on("error", (err) => {
      console.error("[ws] error", err.message);
      bridge.destroy();
    });
  });

  const shutdown = async (signal: string) => {
    console.log(`[api] ${signal} received, shutting down...`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

bootstrap().catch((err) => {
  console.error("[api] failed to start:", err);
  process.exit(1);
});
