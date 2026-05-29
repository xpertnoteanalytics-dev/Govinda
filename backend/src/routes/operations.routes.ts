import { Router } from "express";
import * as operationsController from "../controllers/operationsController";

const router = Router();

router.get("/overview", operationsController.overview);
router.get("/outreach-config", operationsController.outreachConfig);

export default router;
