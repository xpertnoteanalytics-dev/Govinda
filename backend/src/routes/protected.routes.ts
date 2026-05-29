import { Router } from "express";
import { body } from "express-validator";
import { authenticate } from "../middleware/auth";
import { enforceTenantScope } from "../middleware/tenant";
import { requireMinRole } from "../middleware/role";
import { validate } from "../middleware/validate";
import { ROLES } from "../types/roles";
import * as dashboardController from "../controllers/dashboardController";
import * as profileController from "../controllers/profileController";
import aiRoutes from "./ai.routes";
import placesRoutes from "./places.routes";
import callsRoutes from "./calls.routes";
import emailsRoutes from "./emails.routes";
import whatsappRoutes from "./whatsapp.routes";
import avatarRoutes from "./avatar.routes";
import voiceRoutes from "./voice.routes";
import operationsRoutes from "./operations.routes";
import { rateLimit } from "../middleware/rateLimit";
import { env } from "../config/env";

const router = Router();

router.use(
  authenticate,
  enforceTenantScope,
  rateLimit({
    windowMs: env.rateLimit.windowMs,
    max: env.rateLimit.max,
    keyPrefix: "api",
  })
);

router.get("/dashboard", (_req, res) => {
  res.json({
    success: true,
    data: {
      message: "Dashboard data placeholder",
      tenantId: _req.tenantId,
    },
  });
});

router.use("/ai", aiRoutes);
router.use("/places", placesRoutes);
router.use("/calls", callsRoutes);
router.use("/emails", emailsRoutes);
router.use("/whatsapp", whatsappRoutes);
router.use("/avatar", avatarRoutes);
router.use("/voice", voiceRoutes);
router.use("/operations", operationsRoutes);

router.get("/analytics", dashboardController.analytics);

router.get("/profile", profileController.getProfile);

router.patch(
  "/profile",
  validate([
    body("firstName")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("First name cannot be empty"),
    body("lastName")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Last name cannot be empty"),
  ]),
  profileController.updateProfile
);

router.get(
  "/admin",
  requireMinRole(ROLES.TENANT_ADMIN),
  (req, res) => {
    res.json({
      success: true,
      data: {
        message: "Tenant admin area",
        role: req.user?.role,
      },
    });
  }
);

export default router;
