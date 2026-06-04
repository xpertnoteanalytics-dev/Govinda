import { Router } from "express";
import { body } from "express-validator";
import { validate } from "../middleware/validate";
import { authenticate } from "../middleware/auth";
import * as avatarController from "../controllers/avatarController";

const router = Router();

router.get("/personas", avatarController.personas);
router.get("/settings", avatarController.getSettings);
router.patch(
  "/settings",
  validate([body("persona").optional().isIn(["govinda", "durga"])]),
  avatarController.updateSettings
);
router.post("/session", avatarController.session);
router.post("/streaming-token", avatarController.session);

// Anam Avatar → Gemini pipeline
// Receives transcribed speech, returns AI reply text for Anam to speak
router.post(
  "/message",
  authenticate,
  validate([body("content").notEmpty().withMessage("content is required")]),
  avatarController.message
);

export default router;