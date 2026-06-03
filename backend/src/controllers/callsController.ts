// src/controllers/callsController.ts
import { Request, Response, NextFunction } from "express";
import * as callService from "../services/callService";
import { Tenant } from "../models";

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

export async function generateScript(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenant = await Tenant.findById(req.tenantId!).select("name");
    const script = await callService.generateCallingScript({
      placeName: req.body.placeName,
      category: req.body.category,
      purpose: req.body.purpose,
      organizationName: tenant?.name,
      scriptType: req.body.scriptType,
    });
    res.json({ success: true, data: { script } });
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
    const call = await callService.initiateCall({
      tenantId: req.tenantId!,
      userId: req.user!.id,
      placeId: req.body.placeId,
      placeName: req.body.placeName,
      phoneNumber: req.body.phoneNumber,
      category: req.body.category,
      script: req.body.script,
      scriptType: req.body.scriptType,
    });
    res.status(201).json({ success: true, data: { call } });
  } catch (err) {
    next(err);
  }
}