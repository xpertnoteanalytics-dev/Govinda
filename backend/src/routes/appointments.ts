import { Router } from "express";
import { Appointment } from "../models/Appointment";
import { authenticate } from "../middleware/auth";

const router = Router();

router.get("/", authenticate, async (req, res) => {
  try {
    const appointments = await Appointment.find({
      tenantId: req.tenantId,
    })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      data: appointments,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      error: {
        message: "Failed to fetch appointments",
      },
    });
  }
});

export default router;