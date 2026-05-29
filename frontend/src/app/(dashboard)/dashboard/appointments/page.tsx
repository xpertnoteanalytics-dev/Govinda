"use client";

import { useEffect, useState } from "react";

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/proxy/v1/appointments")
      .then((res) => {
        if (!res.ok) throw new Error(`Error ${res.status}`);
        return res.json();
      })
      .then((data) => setAppointments(data.data || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const accentColors = [
    "#378ADD", "#1D9E75", "#7F77DD", "#D85A30", "#D4537E",
  ];

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span>Loading appointments...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 text-sm">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="5" width="16" height="16" rx="2"/><line x1="16" y1="3" x2="16" y2="7"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="4" y1="11" x2="20" y2="11"/><line x1="8" y1="15" x2="8" y2="15"/><line x1="12" y1="15" x2="12" y2="15"/>
          </svg>
          Appointments
        </h1>
        <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full border">
          {appointments.length} total
        </span>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total", value: appointments.length },
          { label: "Via email", value: appointments.filter((a) => a.source === "email").length },
          { label: "Upcoming", value: appointments.filter((a) => a.appointmentDate).length },
        ].map((stat) => (
          <div key={stat.label} className="bg-muted/50 rounded-lg p-4 border border-border/50">
            <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
            <p className="text-2xl font-medium">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Cards */}
      {appointments.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          No appointments found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {appointments.map((appt, index) => (
            <div
              key={index}
              className="relative bg-white dark:bg-zinc-900 rounded-xl border border-border/60 p-4 overflow-hidden"
            >
              {/* Left colour accent */}
              <div
                className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
                style={{ backgroundColor: accentColors[index % accentColors.length] }}
              />

              <div className="pl-3 space-y-2">
                <div>
                  <p className="font-medium text-[15px]">
                    {appt.patientName || "—"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {appt.service || "Service not specified"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {appt.appointmentDate ? (
                    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                      📅 {appt.appointmentDate}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                      No date
                    </span>
                  )}

                  {appt.appointmentTime ? (
                    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                      🕐 {appt.appointmentTime}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                      No time
                    </span>
                  )}

                  {appt.source && (
                    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-violet-50 text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                      ✉ {appt.source}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}