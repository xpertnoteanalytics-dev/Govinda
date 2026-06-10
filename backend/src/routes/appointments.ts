// src/routes/appointments.ts
import { Router } from "express";
import { Appointment } from "../models/Appointment";
import { authenticate } from "../middleware/auth";

const router = Router();

// GET — fetch all appointments for tenant
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
      error: { message: "Failed to fetch appointments" },
    });
  }
});

// POST — create appointment manually (from calendar modal)
router.post("/", authenticate, async (req, res) => {
  try {
    const { patientName, phone, service, appointmentDate, appointmentTime, notes } = req.body;

    if (!patientName || !service || !appointmentDate || !appointmentTime) {
      res.status(400).json({
        success: false,
        error: { message: "Missing required fields: patientName, service, appointmentDate, appointmentTime" },
      });
      return;
    }

    const appointment = await Appointment.create({
      tenantId: req.tenantId,
      patientName,
      phone,
      service,
      appointmentDate,
      appointmentTime,
      notes,
      source: "manual",
    });

    res.status(201).json({ success: true, data: appointment });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: { message: "Failed to create appointment" },
    });
  }
});

export default router;