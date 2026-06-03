// src/routes/calls.routes.ts
import { Router } from "express";
import { body } from "express-validator";
import { validate } from "../middleware/validate";
import * as callsController from "../controllers/callsController";

const router = Router();

router.get("/", callsController.list);
router.get("/analytics", callsController.analytics);
router.post(
  "/script",
  validate([
    body("placeName").trim().notEmpty(),
    body("category").trim().notEmpty(),
    body("purpose").optional().isString().trim(),
    body("scriptType")
      .optional()
      .isIn([
        "pharmacy_inquiry",
        "appointment_scheduling",
        "healthcare_coordination",
      ]),
  ]),
  callsController.generateScript
);
router.post(
  "/initiate",
  validate([
    body("placeName").trim().notEmpty(),
    body("phoneNumber").trim().notEmpty(),
    body("placeId").optional().isString(),
    body("category").optional().isString(),
    body("script").optional().isString(),
    body("scriptType")
      .optional()
      .isIn([
        "pharmacy_inquiry",
        "appointment_scheduling",
        "healthcare_coordination",
      ]),
  ]),
  callsController.initiate
);

export default router;