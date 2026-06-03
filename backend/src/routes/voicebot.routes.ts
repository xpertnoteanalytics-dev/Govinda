// src/routes/voicebot.routes.ts
// src/routes/voicebot.routes.ts
import { Router, Request, Response } from "express";
import { env } from "../config/env";

const router = Router();

router.get("/", (req: Request, res: Response) => {
  // Use https:// not wss:// — Exotel upgrades the connection itself
  const wsUrl = env.exotel.voicebotWsUrl
    .replace("wss://", "https://")
    .replace("ws://", "http://");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}" bidirectional="true">
      <Parameter name="encoding" value="mulaw" />
      <Parameter name="sampleRate" value="8000" />
    </Stream>
  </Connect>
</Response>`;

  res.set("Content-Type", "text/xml");
  res.send(xml);
});

export default router;