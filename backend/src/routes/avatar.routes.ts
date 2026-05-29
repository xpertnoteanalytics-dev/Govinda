import { Router } from "express";
import { body } from "express-validator";
import { validate } from "../middleware/validate";
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

export default router;
