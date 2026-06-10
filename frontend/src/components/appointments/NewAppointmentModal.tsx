// src/components/appointments/NewAppointmentModal.tsx
"use client";

import { useState } from "react";
import { createAppointment, type CreateAppointmentInput } from "@/lib/appointments";

interface Props {
  onClose: () => void;
  onCreated: () => void;
  defaultDate?: string;
}

export default function NewAppointmentModal({ onClose, onCreated, defaultDate }: Props) {
  const [form, setForm] = useState<CreateAppointmentInput>({
    patientName: "",
    phone: "",
    service: "",
    appointmentDate: defaultDate ?? "",
    appointmentTime: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!form.patientName || !form.service || !form.appointmentDate || !form.appointmentTime) {
      setError("Please fill all required fields.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await createAppointment(form);
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create appointment");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl ops-modal p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">New Appointment</h2>
          <button onClick={onClose} className="ops-icon-btn">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="ops-label">Patient Name *</label>
            <input
              className="ops-input"
              placeholder="Full name"
              value={form.patientName}
              onChange={(e) => setForm({ ...form, patientName: e.target.value })}
            />
          </div>
          <div>
            <label className="ops-label">Phone</label>
            <input
              className="ops-input"
              placeholder="+91 XXXXX XXXXX"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="ops-label">Service *</label>
            <input
              className="ops-input"
              placeholder="e.g. Blood Test, Consultation"
              value={form.service}
              onChange={(e) => setForm({ ...form, service: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="ops-label">Date *</label>
              <input
                type="date"
                className="ops-input"
                value={form.appointmentDate}
                onChange={(e) => setForm({ ...form, appointmentDate: e.target.value })}
              />
            </div>
            <div>
              <label className="ops-label">Time *</label>
              <input
                type="time"
                className="ops-input"
                value={form.appointmentTime}
                onChange={(e) => setForm({ ...form, appointmentTime: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="ops-label">Notes</label>
            <textarea
              className="ops-textarea"
              rows={2}
              placeholder="Additional notes..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm text-slate-300 hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 rounded-xl bg-brand-500 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
          >
            {loading ? "Saving..." : "Book Appointment"}
          </button>
        </div>
      </div>
    </div>
  );
}