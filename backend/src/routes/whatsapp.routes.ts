import { Router } from "express";
import { body } from "express-validator";
import { validate } from "../middleware/validate";
import * as whatsappController from "../controllers/whatsappController";
import { OUTREACH_TYPES } from "../types/outreach";

const router = Router();

router.get("/", whatsappController.list);
router.get("/analytics", whatsappController.analytics);
router.post(
  "/draft",
  validate([
    body("placeName").trim().notEmpty(),
    body("category").trim().notEmpty(),
    body("purpose").optional().isString().trim(),
    body("outreachType").optional().isIn(OUTREACH_TYPES),
  ]),
  whatsappController.generateDraft
);
router.post(
  "/send",
  validate([
    body("placeName").trim().notEmpty(),
    body("phoneNumber").trim().notEmpty(),
    body("message").trim().notEmpty().isLength({ max: 4096 }),
    body("placeId").optional().isString(),
    body("category").optional().isString(),
    body("outreachType").optional().isIn(OUTREACH_TYPES),
    body("openChatOnly").optional().isBoolean(),
  ]),
  whatsappController.send
);

export default router;
