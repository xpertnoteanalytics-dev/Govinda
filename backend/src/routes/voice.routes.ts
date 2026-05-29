import { Router } from "express";
import { body } from "express-validator";
import { validate } from "../middleware/validate";
import * as voiceController from "../controllers/voiceController";

const router = Router();

router.post(
  "/synthesize",
  validate([body("text").trim().notEmpty().isLength({ max: 5000 })]),
  voiceController.synthesize
);

export default router;
