import { Router } from "express";
import { body } from "express-validator";
import { validate } from "../middleware/validate";
import * as aiController from "../controllers/aiController";

const router = Router();

router.get("/chats", aiController.listChats);
router.post(
  "/chats",
  validate([
    body("title")
      .optional({ values: "null" })
      .isString()
      .trim()
      .isLength({ max: 200 })
      .withMessage("Title too long"),
  ]),
  aiController.createChat
);
router.get("/chats/:chatId", aiController.getChat);
router.delete("/chats/:chatId", aiController.deleteChat);
router.post(
  "/chats/:chatId/messages",
  validate([
    body("content").trim().notEmpty().withMessage("Message content is required"),
  ]),
  aiController.sendMessage
);

export default router;
