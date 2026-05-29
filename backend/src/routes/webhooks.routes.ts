import { Router, Request, Response } from "express";
import { env } from "../config/env";
import * as callService from "../services/callService";

const router = Router();

function verifyWebhookToken(req: Request): boolean {
  const secret = env.exotel.webhookSecret;
  if (!secret) return true;
  const token = req.query.token as string | undefined;
  return token === secret;
}

/**
 * Exotel StatusCallback (terminal) — JSON or form-encoded body.
 */
router.post("/exotel/call-status", async (req: Request, res: Response) => {
  if (!verifyWebhookToken(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const payload = req.body as Record<string, unknown>;
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
});

export default router;
