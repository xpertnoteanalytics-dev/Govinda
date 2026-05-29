import { Request, Response, NextFunction } from "express";
import * as elevenLabsService from "../services/elevenLabsService";
import * as avatarService from "../services/avatarService";
import type { AvatarPersonaId } from "../types/avatars";

export async function synthesize(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const settings = await avatarService.getAvatarSettings(
      req.tenantId!,
      req.user!.id
    );
    const audio = await elevenLabsService.textToSpeech({
      text: req.body.text,
      voiceId: settings.elevenLabsVoiceId,
      persona: settings.persona as AvatarPersonaId,
    });
    res.json({ success: true, data: audio });
  } catch (err) {
    next(err);
  }
}
