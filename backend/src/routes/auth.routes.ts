import { Router } from "express";
import { body } from "express-validator";
import * as authController from "../controllers/authController";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

router.post(
  "/signup",
  validate([
    body("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters"),
    body("firstName").trim().notEmpty().withMessage("First name is required"),
    body("lastName").trim().notEmpty().withMessage("Last name is required"),
    body("organizationName")
      .trim()
      .notEmpty()
      .withMessage("Organization name is required"),
  ]),
  authController.signup
);

router.post(
  "/login",
  validate([
    body("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ]),
  authController.login
);

router.post(
  "/refresh",
  validate([body("refreshToken").notEmpty().withMessage("Refresh token is required")]),
  authController.refresh
);

router.post("/logout", authenticate, authController.logout);
router.get("/me", authenticate, authController.me);

export default router;
