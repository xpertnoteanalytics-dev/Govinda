import { Router } from "express";
import { Feedback } from "../models/Feedback";
import { authenticate } from "../middleware/auth";

const router = Router();

router.get("/", authenticate, async (req, res) => {
  try {
    const feedback = await Feedback.find({ tenantId: req.tenantId })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, data: feedback });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { message: "Failed to fetch feedback" } });
  }
});

router.post("/", authenticate, async (req, res) => {
  try {
    const { patientName, feedback, sentiment, source } = req.body;

    if (!feedback?.trim()) {
      return res.status(400).json({
        success: false,
        error: { message: "Feedback text is required." },
      });
    }

    if (!["positive", "negative", "neutral"].includes(sentiment)) {
      return res.status(400).json({
        success: false,
        error: { message: "Sentiment must be positive, negative, or neutral." },
      });
    }

    const doc = await Feedback.create({
      tenantId:    req.tenantId,          // ✅ scoped to tenant from auth middleware
      patientName: patientName?.trim() || undefined,
      feedback:    feedback.trim(),
      sentiment,
      source:      source || undefined,
    });

    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { message: "Failed to save feedback" } });
  }
});

export default router;