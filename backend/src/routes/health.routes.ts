import { Router, Request, Response } from "express";
import mongoose from "mongoose";

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      service: "govinda-ai-api",
      status: "ok",
      timestamp: new Date().toISOString(),
    },
  });
});

router.get("/ready", (_req: Request, res: Response) => {
  const dbState = mongoose.connection.readyState;
  const dbReady = dbState === 1;

  res.status(dbReady ? 200 : 503).json({
    success: dbReady,
    data: {
      database: dbReady ? "connected" : "disconnected",
      uptime: process.uptime(),
    },
  });
});

export default router;
