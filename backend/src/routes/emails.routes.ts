import { Router } from "express";
import { body } from "express-validator";
import { validate } from "../middleware/validate";
import * as emailController from "../controllers/emailController";
import { OUTREACH_TYPES } from "../types/outreach";

const router = Router();

router.get("/", emailController.list);
router.get("/analytics", emailController.analytics);
router.post(
  "/draft",
  validate([
    body("placeName").trim().notEmpty(),
    body("category").trim().notEmpty(),
    body("purpose").optional().isString().trim(),
    body("outreachType").optional().isIn(OUTREACH_TYPES),
  ]),
  emailController.generateDraft
);
router.post(
  "/send",
  validate([
    body("placeName").trim().notEmpty(),
    body("toEmail").trim().isEmail(),
    body("subject").trim().notEmpty().isLength({ max: 500 }),
    body("body").trim().notEmpty().isLength({ max: 32000 }),
    body("placeId").optional().isString(),
    body("category").optional().isString(),
    body("outreachType").optional().isIn(OUTREACH_TYPES),
  ]),
  emailController.send
);

export default router;
