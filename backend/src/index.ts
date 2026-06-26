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

    // The bridge no longer takes a static `script` argument. Instead it takes
    // a resolver function that it calls itself, internally, once Exotel's
    // "start" event gives it a call_sid — and it waits for that resolver to
    // settle BEFORE opening the OpenAI socket / sending session.update.
    //
    // This replaces the old (ws as any)._callScript hack: there is no more
    // race, because the script is fetched on-demand by the bridge at the
    // exact moment it's needed, not pushed in from outside on a best-effort
    // basis after construction.
    const bridge = createRealtimeBridge(ws, async (callSid: string) => {
      try {
        const doc = await Call.findOne({ exotelCallSid: callSid })
          .select("script")
          .lean();
        return doc?.script ?? undefined;
      } catch (err) {
        console.error(
          "[ws] script lookup failed for callSid:", callSid,
          "|", err instanceof Error ? err.message : err
        );
        return undefined;
      }
    });

    ws.on("message", (message: RawData) => {
      const raw = message.toString();

      // ===== DEBUG ADDED =====
      try {
        const parsed = JSON.parse(raw) as { event?: string };
        if (parsed.event && parsed.event !== "media") {
          console.log("[ws] non-media event received:", raw.slice(0, 500));
        }
      } catch {
        // not JSON — ignore
      }
      // ===== DEBUG ADDED =====

      // NOTE: the old code parsed `parsed.start?.callSid` here and did its
      // own Mongo lookup before handing off to the bridge. That's removed:
      // (a) Exotel actually sends call_sid (snake_case), not callSid, so
      //     that lookup never fired in the first place, and
      // (b) the bridge now owns the script lookup itself (via the resolver
      //     passed in above), keyed off the correctly-named field, and
      //     guarantees it resolves before session.update is sent.
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
