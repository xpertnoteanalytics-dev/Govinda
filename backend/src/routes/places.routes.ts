import { Router } from "express";
import { body } from "express-validator";
import { validate } from "../middleware/validate";
import * as placesController from "../controllers/placesController";
import { ALL_PLACE_CATEGORIES } from "../types/places";

const router = Router();

router.post(
  "/search",
  validate([
    body("category")
      .isIn(ALL_PLACE_CATEGORIES)
      .withMessage("Invalid place category"),
    body("radius")
      .optional()
      .isInt({ min: 500, max: 50000 })
      .withMessage("Radius must be between 500m and 50km"),
    body("lat")
      .optional()
      .isFloat({ min: -90, max: 90 })
      .withMessage("Invalid latitude"),
    body("lng")
      .optional()
      .isFloat({ min: -180, max: 180 })
      .withMessage("Invalid longitude"),
    body("city").optional().isString().trim().isLength({ max: 120 }),
    body("locationLabel").optional().isString().trim().isLength({ max: 200 }),
    body("lat").custom((_value, { req }) => {
      const b = req.body as { city?: string; lat?: number; lng?: number };
      if (b.city?.trim()) return true;
      if (b.lat != null && b.lng != null) return true;
      throw new Error("Provide a city name or use current location");
    }),
  ]),
  placesController.search
);

router.get("/history", placesController.history);
router.get("/analytics", placesController.analytics);
router.delete("/history/:historyId", placesController.removeHistory);

router.get("/details/:placeId", placesController.getDetails);

export default router;
