// src/app/(dashboard)/dashboard/appointments/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchAppointments, type Appointment } from "@/lib/appointments";
import NewAppointmentModal from "@/components/appointments/NewAppointmentModal";

const ACCENT_COLORS = [
  { bg: "bg-blue-500/20", border: "border-blue-500/40", text: "text-blue-300", dot: "bg-blue-400" },
  { bg: "bg-emerald-500/20", border: "border-emerald-500/40", text: "text-emerald-300", dot: "bg-emerald-400" },
  { bg: "bg-violet-500/20", border: "border-violet-500/40", text: "text-violet-300", dot: "bg-violet-400" },
  { bg: "bg-orange-500/20", border: "border-orange-500/40", text: "text-orange-300", dot: "bg-orange-400" },
  { bg: "bg-pink-500/20", border: "border-pink-500/40", text: "text-pink-300", dot: "bg-pink-400" },
];

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8 AM to 8 PM

function getWeekDays(baseDate: Date): Date[] {
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() - ((baseDate.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function parseAppointmentHour(time: string): number | null {
  if (!time) return null;
  const match = time.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!match) return null;
  let hour = parseInt(match[1]);
  const meridiem = match[3]?.toLowerCase();
  if (meridiem === "pm" && hour !== 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  return hour;
}

function normalizeDate(dateStr: string): string {
  if (!dateStr) return "";
  // Handle dd/mm/yyyy or yyyy-mm-dd
  if (dateStr.includes("/")) {
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }
  }
  if (dateStr.toLowerCase() === "today") return formatDate(new Date());
  if (dateStr.toLowerCase() === "tomorrow") {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    return formatDate(t);
  }
  return dateStr;
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAppointments();
      setAppointments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const weekDays = getWeekDays(currentWeek);
  const today = formatDate(new Date());

  function prevWeek() {
    const d = new Date(currentWeek);
    d.setDate(d.getDate() - 7);
    setCurrentWeek(d);
  }

  function nextWeek() {
    const d = new Date(currentWeek);
    d.setDate(d.getDate() + 7);
    setCurrentWeek(d);
  }

  function goToday() {
    setCurrentWeek(new Date());
  }

  function getAppointmentsForSlot(date: Date, hour: number): Appointment[] {
    const dateStr = formatDate(date);
    return appointments.filter((a) => {
      const normalized = normalizeDate(a.appointmentDate);
      const apptHour = parseAppointmentHour(a.appointmentTime);
      return normalized === dateStr && apptHour === hour;
    });
  }

  function getAppointmentsForDay(date: Date): Appointment[] {
    const dateStr = formatDate(date);
    return appointments.filter((a) => normalizeDate(a.appointmentDate) === dateStr);
  }

  const monthYear = weekDays[0].toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="p-4 sm:p-6 space-y-4 min-h-screen">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="ops-page-title flex items-center gap-2">
            <svg className="w-5 h-5 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth="1.5"/>
              <line x1="16" y1="2" x2="16" y2="6" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="8" y1="2" x2="8" y2="6" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="3" y1="10" x2="21" y2="10" strokeWidth="1.5"/>
            </svg>
            Appointments
          </h1>
          <p className="ops-page-subtitle">{monthYear}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Week navigation */}
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
            <button onClick={prevWeek} className="ops-icon-btn rounded-lg p-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={goToday}
              className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white transition-colors"
            >
              Today
            </button>
            <button onClick={nextWeek} className="ops-icon-btn rounded-lg p-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <button
            onClick={() => { setSelectedDate(today); setShowModal(true); }}
            className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Appointment
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "This Week", value: appointments.filter(a => weekDays.some(d => normalizeDate(a.appointmentDate) === formatDate(d))).length },
          { label: "Total", value: appointments.length },
          { label: "Today", value: appointments.filter(a => normalizeDate(a.appointmentDate) === today).length },
        ].map((stat) => (
          <div key={stat.label} className="ops-section py-3 px-4">
            <p className="text-xs text-slate-400 mb-1">{stat.label}</p>
            <p className="text-2xl font-semibold text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Calendar */}
      {loading ? (
        <div className="ops-section flex items-center gap-3 text-slate-400">
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading appointments...</span>
        </div>
      ) : error ? (
        <div className="ops-section text-red-400 text-sm">{error}</div>
      ) : (
        <div className="ops-section p-0 overflow-hidden">
          {/* Day headers */}
          <div className="grid border-b border-white/10" style={{ gridTemplateColumns: "64px repeat(7, 1fr)" }}>
            <div className="p-3 border-r border-white/10" />
            {weekDays.map((day) => {
              const isToday = formatDate(day) === today;
              const dayAppts = getAppointmentsForDay(day);
              return (
                <div
                  key={day.toISOString()}
                  className={`p-3 text-center border-r border-white/10 last:border-r-0 cursor-pointer hover:bg-white/5 transition-colors ${isToday ? "bg-brand-500/10" : ""}`}
                  onClick={() => { setSelectedDate(formatDate(day)); setShowModal(true); }}
                >
                  <p className="text-xs text-slate-400 uppercase tracking-wide">
                    {day.toLocaleDateString("en-IN", { weekday: "short" })}
                  </p>
                  <p className={`text-lg font-semibold mt-0.5 ${isToday ? "text-brand-400" : "text-white"}`}>
                    {day.getDate()}
                  </p>
                  {dayAppts.length > 0 && (
                    <div className="flex justify-center gap-0.5 mt-1">
                      {dayAppts.slice(0, 3).map((_, i) => (
                        <div key={i} className={`w-1.5 h-1.5 rounded-full ${ACCENT_COLORS[i % ACCENT_COLORS.length].dot}`} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Time slots */}
          <div className="overflow-y-auto max-h-[520px]">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="grid border-b border-white/5 last:border-b-0 hover:bg-white/[0.02] transition-colors"
                style={{ gridTemplateColumns: "64px repeat(7, 1fr)", minHeight: "72px" }}
              >
                {/* Time label */}
                <div className="p-2 border-r border-white/10 flex items-start justify-end pr-3 pt-2.5">
                  <span className="text-xs text-slate-500 font-medium">
                    {hour === 12 ? "12 PM" : hour < 12 ? `${hour} AM` : `${hour - 12} PM`}
                  </span>
                </div>

                {/* Day cells */}
                {weekDays.map((day) => {
                  const slotAppts = getAppointmentsForSlot(day, hour);
                  const isToday = formatDate(day) === today;
                  return (
                    <div
                      key={day.toISOString()}
                      className={`p-1 border-r border-white/5 last:border-r-0 cursor-pointer group ${isToday ? "bg-brand-500/5" : ""}`}
                      onClick={() => { setSelectedDate(formatDate(day)); setShowModal(true); }}
                    >
                      {slotAppts.map((appt, i) => {
                        const color = ACCENT_COLORS[i % ACCENT_COLORS.length];
                        return (
                          <div
                            key={appt._id ?? i}
                            className={`rounded-lg border px-2 py-1.5 mb-1 ${color.bg} ${color.border}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <p className={`text-xs font-medium truncate ${color.text}`}>
                              {appt.patientName}
                            </p>
                            <p className="text-xs text-slate-400 truncate">{appt.service}</p>
                            {appt.appointmentTime && (
                              <p className="text-xs text-slate-500">{appt.appointmentTime}</p>
                            )}
                          </div>
                        );
                      })}
                      {/* Empty slot hover indicator */}
                      <div className="hidden group-hover:flex items-center justify-center h-8 rounded-lg border border-dashed border-white/10">
                        <svg className="w-3 h-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unscheduled appointments */}
      {!loading && !error && appointments.filter(a => !parseAppointmentHour(a.appointmentTime) && !weekDays.some(d => normalizeDate(a.appointmentDate) === formatDate(d))).length > 0 && (
        <div className="ops-section space-y-3">
          <h3 className="text-sm font-medium text-slate-300">All Appointments</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {appointments.map((appt, i) => {
              const color = ACCENT_COLORS[i % ACCENT_COLORS.length];
              return (
                <div key={appt._id ?? i} className={`rounded-xl border px-3 py-2.5 ${color.bg} ${color.border}`}>
                  <p className={`text-sm font-medium ${color.text}`}>{appt.patientName}</p>
                  <p className="text-xs text-slate-400">{appt.service}</p>
                  <p className="text-xs text-slate-500 mt-1">{appt.appointmentDate} {appt.appointmentTime}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <NewAppointmentModal
          defaultDate={selectedDate}
          onClose={() => setShowModal(false)}
          onCreated={load}
        />
      )}
    </div>
  );
}