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

    if (env.nodeEnv === "production") {
      setInterval(() => {
        fetch(`http://localhost:${env.port}/api/health`)
          .catch(() => undefined);
      }, 10 * 60 * 1000);
    }
  });

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

    // FIX 1: Log the OpenAI API key status at connection time so you can
    // immediately see in logs whether the key is present or empty.
    console.log(
      "[ws] OpenAI key present:",
      env.openai.apiKey ? `yes (len=${env.openai.apiKey.length})` : "NO — KEY IS EMPTY"
    );

    // Bridge is created without a script initially; script is injected
    // once the start event reveals the callSid and we fetch from DB.
    // FIX 2: Pass a script setter so the bridge can receive the script
    // after the DB lookup completes, instead of reading a dead ws property.
    let scriptResolver: ((script: string) => void) | null = null;
    const scriptPromise = new Promise<string | undefined>((resolve) => {
      // Resolve after 3 seconds even if no script found, so the bridge
      // doesn't wait forever before greeting the caller.
      const timeout = setTimeout(() => resolve(undefined), 3000);
      scriptResolver = (script: string) => {
        clearTimeout(timeout);
        resolve(script);
      };
    });

    const bridge = createRealtimeBridge(ws, scriptPromise);

    ws.on("message", async (message: RawData) => {
      const raw = message.toString();

      // FIX 3: Parse the start event to get callSid and fetch script,
      // then resolve the promise so the bridge gets the script in time.
      try {
        const parsed = JSON.parse(raw) as {
          event?: string;
          start?: { callSid?: string; streamSid?: string };
        };

        if (parsed.event === "start") {
          // Log the full start payload so we can see Exotel's exact schema
          console.log("[ws] start payload:", JSON.stringify(parsed.start));

          const callSid = parsed.start?.callSid ?? parsed.start?.streamSid;
          if (callSid && scriptResolver) {
            Call.findOne({ exotelCallSid: callSid })
              .select("script")
              .lean()
              .then((doc) => {
                if (doc?.script && scriptResolver) {
                  console.log("[ws] found script for callSid:", callSid);
                  scriptResolver(doc.script);
                }
              })
              .catch(() => undefined);
          }
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
