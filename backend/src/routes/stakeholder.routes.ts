// src/routes/stakeholder.routes.ts
import { Router } from "express";
import { body } from "express-validator";
import { validate } from "../middleware/validate";
import * as ctrl from "../controllers/stakeholderController";

const router = Router();

router.get("/", ctrl.list);
router.get("/analytics", ctrl.analytics);
router.get("/imports", ctrl.importHistory);
router.get("/:id", ctrl.getOne);

router.post(
  "/",
  validate([
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("mobile").trim().notEmpty().withMessage("Mobile is required"),
    body("stakeholderType").optional().isIn([
      "patient", "partner", "employee", "sponsor",
      "vendor", "donor", "government", "other",
    ]),
  ]),
  ctrl.create
);

router.patch("/:id", ctrl.update);
router.delete("/:id", ctrl.remove);

router.post(
  "/import/bulk",
  validate([
    body("records").isArray({ min: 1 }).withMessage("Records required"),
    body("fileName").optional().isString(),
  ]),
  ctrl.bulkImport
);

router.post("/:id/interactions", ctrl.addInteraction);

export default router;