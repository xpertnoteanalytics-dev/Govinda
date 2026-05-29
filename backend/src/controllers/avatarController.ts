import { Request, Response, NextFunction } from "express";
import * as avatarService from "../services/avatarService";
import { createAvatarSession } from "../services/avatarProvider";
import type { AvatarPersona } from "../models/AvatarSettings";

export async function personas(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    res.json({ success: true, data: { personas: avatarService.listAvatarPersonas() } });
  } catch (err) {
    next(err);
  }
}

export async function getSettings(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const settings = await avatarService.getAvatarSettings(
      req.tenantId!,
      req.user!.id
    );
    res.json({ success: true, data: { settings } });
  } catch (err) {
    next(err);
  }
}

export async function updateSettings(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const settings = await avatarService.updateAvatarSettings(
      req.tenantId!,
      req.user!.id,
      { persona: req.body.persona as AvatarPersona | undefined }
    );
    res.json({ success: true, data: { settings } });
  } catch (err) {
    next(err);
  }
}

export async function session(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const settings = await avatarService.getAvatarSettings(
      req.tenantId!,
      req.user!.id
    );
    const session = await createAvatarSession(settings.persona);
    res.json({
      success: true,
      data: {
        ...session,
        persona: settings.persona,
        avatar: settings.meta,
      },
    });
  } catch (err) {
    next(err);
  }
}

export const streamingToken = session;
