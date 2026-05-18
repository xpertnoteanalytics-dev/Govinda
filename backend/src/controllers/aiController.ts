import { Request, Response, NextFunction } from "express";
import * as aiService from "../services/aiService";

export async function listChats(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const chats = await aiService.listChats(req.tenantId!, req.user!.id);
    res.json({ success: true, data: { chats } });
  } catch (err) {
    next(err);
  }
}

export async function createChat(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const chat = await aiService.createChat(
      req.tenantId!,
      req.user!.id,
      req.body.title
    );
    res.status(201).json({ success: true, data: { chat } });
  } catch (err) {
    next(err);
  }
}

export async function getChat(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const chat = await aiService.getChat(
      req.params.chatId as string,
      req.tenantId!,
      req.user!.id
    );
    res.json({ success: true, data: { chat } });
  } catch (err) {
    next(err);
  }
}

export async function deleteChat(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await aiService.deleteChat(
      req.params.chatId as string,
      req.tenantId!,
      req.user!.id
    );
    res.json({ success: true, data: { message: "Conversation deleted" } });
  } catch (err) {
    next(err);
  }
}

export async function sendMessage(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await aiService.sendMessage(
      req.params.chatId as string,
      req.tenantId!,
      req.user!.id,
      req.user!.role,
      req.body.content
    );
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
