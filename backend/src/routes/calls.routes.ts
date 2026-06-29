// src/routes/calls.routes.ts
import { Router } from "express";
import { body } from "express-validator";
import { validate } from "../middleware/validate";
import * as callsController from "../controllers/callsController";
import { describeToolViolations } from "../config/toolCompatibility";
import type { CallObjectiveType, CallTool } from "../types/callRequest";

const OBJECTIVE_TYPES: CallObjectiveType[] = [
  "appointment_booking",
  "feedback_collection",
  "pharmacy_inquiry",
  "doctor_verification",
  "hospital_onboarding",
  "sales_outreach",
  "insurance_verification",
  "lab_result_followup",
  "patient_reminder",
  "custom",
];

const CALL_TOOLS: CallTool[] = [
  "appointment_booking",
  "crm_update",
  "human_transfer",
  "whatsapp_followup",
  "callback_schedule",
  "post_call_extraction",
];

const router = Router();

router.get("/", callsController.list);
router.get("/analytics", callsController.analytics);

router.post(
  "/initiate",
  validate([
    body("recipientName").trim().notEmpty(),
    body("phoneNumber").trim().notEmpty(),
    body("placeId").optional().isString(),
    body("recipientCategory").optional().isString(),
    body("objectiveType").isIn(OBJECTIVE_TYPES),
    body("customObjectiveText")
      .if(body("objectiveType").equals("custom"))
      .trim()
      .notEmpty()
      .isLength({ max: 500 }),
    body("businessContext").optional().isString().isLength({ max: 500 }),
    body("notes").optional().isString().isLength({ max: 200 }),
    body("enabledTools").optional().isArray(),
    body("enabledTools.*").optional().isIn(CALL_TOOLS),

    // Tool validation is deliberately NOT keyed by objective (see
    // toolCompatibility.ts). It only rejects unknown values, duplicates,
    // or a genuinely conflicting pair — never a combination that's merely
    // unusual for the stated objective. A feedback call that ends in a
    // booked appointment is normal conversational drift, not an error.
    body("enabledTools").custom((tools: string[] | undefined) => {
      const violations = describeToolViolations(tools);
      if (violations.length > 0) {
        throw new Error(violations.join("; "));
      }
      return true;
    }),
  ]),
  callsController.initiate
);

export default router;
