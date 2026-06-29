// src/controllers/callsController.ts
import { Request, Response, NextFunction } from "express";
import * as callService from "../services/callService";
import type { CallRequest } from "../types/callRequest";

export async function list(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const calls = await callService.listCalls(req.tenantId!, req.user!.id);
    res.json({ success: true, data: { calls } });
  } catch (err) {
    next(err);
  }
}

export async function analytics(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const data = await callService.getCallAnalytics(req.tenantId!, req.user!.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function initiate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body as CallRequest;
    const call = await callService.initiateCall(body, req.tenantId!, req.user!.id);
    res.status(201).json({ success: true, data: { call } });
  } catch (err) {
    next(err);
  }
}
