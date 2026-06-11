// src/components/search/CsvImportModal.tsx
"use client";

import { useRef, useState } from "react";
import { Upload, X, CheckCircle, AlertCircle, FileText } from "lucide-react";
import { parseCsv, importCsvRecords, type CsvRecord } from "@/lib/places-api";
import { ALL_PLACE_CATEGORIES } from "@/lib/places-types";

interface Props {
  onClose: () => void;
  onImported: () => void;
}

type RowStatus = "valid" | "invalid_category" | "invalid_coords" | "missing_name";

interface PreviewRow extends CsvRecord {
  status: RowStatus;
  error?: string;
}

function validateRow(row: CsvRecord): PreviewRow {
  if (!row.name?.trim()) {
    return { ...row, status: "missing_name", error: "Name is required" };
  }
  if (!ALL_PLACE_CATEGORIES.includes(row.category as any)) {
    return { ...row, status: "invalid_category", error: `Invalid category: "${row.category}"` };
  }
  const lat = parseFloat(row.lat);
  const lng = parseFloat(row.lng);
  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { ...row, status: "invalid_coords", error: "Invalid lat/lng" };
  }
  return { ...row, status: "valid" };
}

export default function CsvImportModal({ onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; duplicates: number; errors: string[] } | null>(null);

  function handleFile(file: File) {
    setParseError("");
    setPreview([]);
    setResult(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const rows = parseCsv(text);
        setPreview(rows.map(validateRow));
      } catch (err) {
        setParseError(err instanceof Error ? err.message : "Failed to parse CSV");
      }
    };
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  async function handleImport() {
    const valid = preview.filter((r) => r.status === "valid");
    if (!valid.length) return;
    setImporting(true);
    try {
      const res = await importCsvRecords(valid);
      setResult(res);
      onImported();
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  const validCount = preview.filter((r) => r.status === "valid").length;
  const invalidCount = preview.filter((r) => r.status !== "valid").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl ops-modal p-6 space-y-4 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Import CSV</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Bulk import healthcare providers
            </p>
          </div>
          <button onClick={onClose} className="ops-icon-btn">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* CSV Format hint */}
        <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 space-y-1">
          <p className="text-xs font-medium text-slate-300">Required CSV columns:</p>
          <p className="text-xs text-slate-500 font-mono">
            Name, Category, Phone, Address, Latitude, Longitude
          </p>
          <p className="text-xs text-slate-500">
            Valid categories: pharmacy, hospital, clinic, blood_bank, school, college, ngo...
          </p>
        </div>

        {/* Drop zone */}
        {!preview.length && !result && (
          <div
            className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center cursor-pointer hover:border-brand-400/50 hover:bg-brand-500/5 transition-colors"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="w-8 h-8 text-slate-500 mx-auto mb-3" />
            <p className="text-sm text-slate-300 font-medium">
              Drop CSV file here or click to browse
            </p>
            <p className="text-xs text-slate-500 mt-1">Supports .csv files</p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>
        )}

        {parseError && (
          <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2.5 text-xs text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {parseError}
          </div>
        )}

        {/* Preview */}
        {preview.length > 0 && !result && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400" />
                <span className="text-xs text-slate-300 font-medium">{fileName}</span>
              </div>
              <div className="flex gap-3 text-xs">
                <span className="text-emerald-400">{validCount} valid</span>
                {invalidCount > 0 && (
                  <span className="text-red-400">{invalidCount} errors</span>
                )}
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto rounded-xl border border-white/10">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-900">
                  <tr className="border-b border-white/10">
                    <th className="px-3 py-2 text-left text-slate-400 font-medium">Name</th>
                    <th className="px-3 py-2 text-left text-slate-400 font-medium">Category</th>
                    <th className="px-3 py-2 text-left text-slate-400 font-medium">Lat</th>
                    <th className="px-3 py-2 text-left text-slate-400 font-medium">Lng</th>
                    <th className="px-3 py-2 text-left text-slate-400 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr
                      key={i}
                      className={`border-b border-white/5 ${row.status !== "valid" ? "bg-red-500/5" : ""}`}
                    >
                      <td className="px-3 py-2 text-white truncate max-w-[120px]">{row.name || "—"}</td>
                      <td className="px-3 py-2 text-slate-300">{row.category || "—"}</td>
                      <td className="px-3 py-2 text-slate-400">{row.lat}</td>
                      <td className="px-3 py-2 text-slate-400">{row.lng}</td>
                      <td className="px-3 py-2">
                        {row.status === "valid" ? (
                          <span className="text-emerald-400">✓ Valid</span>
                        ) : (
                          <span className="text-red-400" title={row.error}>✗ {row.error}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setPreview([]); setFileName(""); }}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm text-slate-300 hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={importing || validCount === 0}
                className="flex-1 rounded-xl bg-brand-500 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
              >
                {importing ? "Importing..." : `Import ${validCount} Records`}
              </button>
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3">
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-300">Import Complete</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {result.imported} imported · {result.duplicates} duplicates skipped
                  {result.errors.length > 0 && ` · ${result.errors.length} errors`}
                </p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-400">Errors:</p>
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-400">• {e}</p>
                ))}
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full rounded-xl bg-brand-500 py-2.5 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}