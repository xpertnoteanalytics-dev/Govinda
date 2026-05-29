import { Router } from "express";
import { Feedback } from "../models/Feedback";
import { authenticate } from "../middleware/auth";  // ✅ add this

const router = Router();

router.get("/", authenticate, async (req, res) => {  // ✅ add authenticate
  try {
    const feedback = await Feedback.find({ tenantId: req.tenantId })  // ✅ filter by tenant
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      data: feedback,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: { message: "Failed to fetch feedback" },
    });
  }
});

export default router;