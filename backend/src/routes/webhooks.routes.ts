// src/routes/webhooks.routes.ts
import { Router, Request, Response } from "express";
import multer from "multer";
import { env } from "../config/env";
import * as callService from "../services/callService";

const router = Router();
const upload = multer();

function verifyWebhookToken(req: Request): boolean {
  const secret = env.exotel.webhookSecret;
  if (!secret) return true;
  const token = req.query.token as string | undefined;
  return token === secret;
}

router.post(
  "/exotel/call-status",
  upload.none(),
  async (req: Request, res: Response) => {
    if (!verifyWebhookToken(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      const payload = req.body as Record<string, unknown>;
      console.log("[webhook] parsed payload:", JSON.stringify(payload, null, 2));

      if (!payload || typeof payload !== "object") {
        res.status(400).json({ error: "Invalid body" });
        return;
      }

      const result = await callService.applyExotelStatusCallback(payload);
      res.status(200).json({ success: result.ok, ...result });
    } catch (e) {
      console.error("[webhook] exotel call-status error", e);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

export default router;