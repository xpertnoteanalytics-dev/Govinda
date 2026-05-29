import { Request, Response, NextFunction } from "express";
import * as whatsappService from "../services/whatsappService";
import { Tenant } from "../models";

export async function list(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const messages = await whatsappService.listWhatsAppMessages(
      req.tenantId!,
      req.user!.id
    );
    res.json({ success: true, data: { messages } });
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
    const data = await whatsappService.getWhatsAppAnalytics(
      req.tenantId!,
      req.user!.id
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function generateDraft(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenant = await Tenant.findById(req.tenantId!).select("name");
    const message = await whatsappService.generateWhatsAppDraft({
      placeName: req.body.placeName,
      category: req.body.category,
      purpose: req.body.purpose,
      organizationName: tenant?.name,
      outreachType: req.body.outreachType,
    });
    res.json({ success: true, data: { message } });
  } catch (err) {
    next(err);
  }
}

export async function send(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await whatsappService.sendOutreachWhatsApp({
      tenantId: req.tenantId!,
      userId: req.user!.id,
      placeId: req.body.placeId,
      placeName: req.body.placeName,
      phoneNumber: req.body.phoneNumber,
      message: req.body.message,
      category: req.body.category,
      outreachType: req.body.outreachType,
      openChatOnly: req.body.openChatOnly === true,
    });
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
