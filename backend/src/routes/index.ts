import { Router } from "express";
import authRoutes from "./auth.routes";
import healthRoutes from "./health.routes";
import protectedRoutes from "./protected.routes";
import webhooksRoutes from "./webhooks.routes";

const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/webhooks", webhooksRoutes);
router.use("/v1", protectedRoutes);

export default router;
