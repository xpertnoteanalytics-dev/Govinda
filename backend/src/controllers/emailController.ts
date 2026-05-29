import { Request, Response, NextFunction } from "express";
import * as emailService from "../services/emailService";
import { Tenant } from "../models";

export async function list(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const emails = await emailService.listEmails(req.tenantId!, req.user!.id);
    res.json({ success: true, data: { emails } });
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
    const data = await emailService.getEmailAnalytics(req.tenantId!, req.user!.id);
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
    const draft = await emailService.generateEmailDraft({
      placeName: req.body.placeName,
      category: req.body.category,
      purpose: req.body.purpose,
      organizationName: tenant?.name,
      outreachType: req.body.outreachType,
    });
    res.json({ success: true, data: draft });
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
    const email = await emailService.sendOutreachEmail({
      tenantId: req.tenantId!,
      userId: req.user!.id,
      placeId: req.body.placeId,
      placeName: req.body.placeName,
      toEmail: req.body.toEmail,
      subject: req.body.subject,
      body: req.body.body,
      category: req.body.category,
      outreachType: req.body.outreachType,
    });
    res.status(201).json({ success: true, data: { email } });
  } catch (err) {
    next(err);
  }
}
