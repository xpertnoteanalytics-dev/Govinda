import { Request, Response, NextFunction } from "express";
import * as avatarService from "../services/avatarService";
import { createAvatarSession } from "../services/avatarProvider";
import type { AvatarPersona } from "../models/AvatarSettings";
import type { Role } from "../types/roles";

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

/**
 * POST /api/avatar/message
 *
 * Receives transcribed speech from Anam Avatar, routes it through
 * the same Gemini pipeline used by the chat UI, and returns the
 * AI reply text for Anam to speak aloud.
 *
 * Body:    { content: string }
 * Returns: { success: true, data: { reply: string, chatId: string } }
 */
export async function message(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const content: string = (req.body.content ?? "").trim();

    if (!content) {
      res.status(400).json({
        success: false,
        error: { message: "content is required" },
      });
      return;
    }

    const result = await avatarService.processAvatarMessage(
      req.tenantId!,
      req.user!.id,
      req.user!.role as Role,
      content
    );

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}