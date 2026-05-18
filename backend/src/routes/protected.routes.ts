import { Router } from "express";
import { body } from "express-validator";
import { authenticate } from "../middleware/auth";
import { enforceTenantScope } from "../middleware/tenant";
import { requireMinRole } from "../middleware/role";
import { validate } from "../middleware/validate";
import { ROLES } from "../types/roles";
import * as dashboardController from "../controllers/dashboardController";
import * as profileController from "../controllers/profileController";

const router = Router();

router.use(authenticate, enforceTenantScope);

router.get("/dashboard", (_req, res) => {
  res.json({
    success: true,
    data: {
      message: "Dashboard data placeholder",
      tenantId: _req.tenantId,
    },
  });
});

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
