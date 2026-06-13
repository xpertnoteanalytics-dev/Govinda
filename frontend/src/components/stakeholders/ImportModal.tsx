// src/components/stakeholders/ImportModal.tsx
"use client";

import { useRef, useState } from "react";
import { Upload, X, CheckCircle, AlertCircle, FileText } from "lucide-react";
import {
  parseStakeholderCsv,
  bulkImportStakeholders,
  type ImportRecord,
  type ImportResult,
} from "@/lib/stakeholder-api";

interface Props {
  onClose: () => void;
  onImported: () => void;
}

const VALID_TYPES = ["patient", "partner", "employee", "sponsor", "vendor", "donor", "government", "other"];

interface PreviewRow extends ImportRecord {
  status: "valid" | "error";
  error?: string;
}

function validateRow(row: ImportRecord): PreviewRow {
  if (!row.name?.trim()) return { ...row, status: "error", error: "Name required" };
  if (!row.mobile?.trim()) return { ...row, status: "error", error: "Mobile required" };
  if (row.stakeholderType && !VALID_TYPES.includes(row.stakeholderType.toLowerCase())) {
    return { ...row, status: "error", error: `Invalid type: ${row.stakeholderType}` };
  }
  return { ...row, status: "valid" };
}

export default function ImportModal({ onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  function handleFile(file: File) {
    setParseError("");
    setPreview([]);
    setResult(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const rows = parseStakeholderCsv(text);
        setPreview(rows.map(validateRow));
      } catch (err) {
        setParseError(err instanceof Error ? err.message : "Failed to parse file");
      }
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    const valid = preview.filter((r) => r.status === "valid");
    if (!valid.length) return;
    setImporting(true);
    try {
      const res = await bulkImportStakeholders(valid, fileName);
      setResult(res);
      onImported();
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  const validCount = preview.filter((r) => r.status === "valid").length;
  const errorCount = preview.filter((r) => r.status === "error").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl ops-modal p-6 space-y-4 max-h-[90vh] overflow-y-auto">

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Import Stakeholders</h2>
            <p className="text-xs text-slate-400 mt-0.5">Upload CSV or Excel exported as CSV</p>
          </div>
          <button onClick={onClose} className="ops-icon-btn"><X className="w-4 h-4" /></button>
        </div>

        <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 space-y-1">
          <p className="text-xs font-medium text-slate-300">Required CSV columns:</p>
          <p className="text-xs text-slate-500 font-mono">Name, Mobile, Email, Organization Name, Organization Address, Stakeholder Type</p>
          <p className="text-xs text-slate-500">Types: patient, partner, employee, sponsor, vendor, donor, government, other</p>
        </div>

        {!preview.length && !result && (
          <div
            className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center cursor-pointer hover:border-brand-400/50 hover:bg-brand-500/5 transition-colors"
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="w-8 h-8 text-slate-500 mx-auto mb-3" />
            <p className="text-sm text-slate-300 font-medium">Drop CSV file or click to browse</p>
            <p className="text-xs text-slate-500 mt-1">.csv files only</p>
            <input ref={fileRef} type="file" accept=".csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>
        )}

        {parseError && (
          <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2.5 text-xs text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" />{parseError}
          </div>
        )}

        {preview.length > 0 && !result && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400" />
                <span className="text-xs text-slate-300 font-medium">{fileName}</span>
              </div>
              <div className="flex gap-3 text-xs">
                <span className="text-emerald-400">{validCount} valid</span>
                {errorCount > 0 && <span className="text-red-400">{errorCount} errors</span>}
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto rounded-xl border border-white/10">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-900">
                  <tr className="border-b border-white/10">
                    <th className="px-3 py-2 text-left text-slate-400">Name</th>
                    <th className="px-3 py-2 text-left text-slate-400">Mobile</th>
                    <th className="px-3 py-2 text-left text-slate-400">Type</th>
                    <th className="px-3 py-2 text-left text-slate-400">Organization</th>
                    <th className="px-3 py-2 text-left text-slate-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className={`border-b border-white/5 ${row.status === "error" ? "bg-red-500/5" : ""}`}>
                      <td className="px-3 py-2 text-white truncate max-w-[100px]">{row.name || "—"}</td>
                      <td className="px-3 py-2 text-slate-300">{row.mobile || "—"}</td>
                      <td className="px-3 py-2 text-slate-400">{row.stakeholderType || "other"}</td>
                      <td className="px-3 py-2 text-slate-400 truncate max-w-[100px]">{row.organizationName || "—"}</td>
                      <td className="px-3 py-2">
                        {row.status === "valid"
                          ? <span className="text-emerald-400">✓ Valid</span>
                          : <span className="text-red-400" title={row.error}>✗ {row.error}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2">
              <button onClick={() => { setPreview([]); setFileName(""); }}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm text-slate-300 hover:bg-white/10 transition-colors">
                Cancel
              </button>
              <button onClick={handleImport} disabled={importing || validCount === 0}
                className="flex-1 rounded-xl bg-brand-500 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50 transition-colors">
                {importing ? "Importing..." : `Import ${validCount} Records`}
              </button>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3">
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-300">Import Complete</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {result.imported} imported · {result.duplicates} duplicates skipped · {result.errors} errors
                </p>
              </div>
            </div>
            {result.errorDetails?.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-400">Errors:</p>
                {result.errorDetails.map((e, i) => (
                  <p key={i} className="text-xs text-red-400">• {e}</p>
                ))}
              </div>
            )}
            <button onClick={onClose}
              className="w-full rounded-xl bg-brand-500 py-2.5 text-sm font-medium text-white hover:bg-brand-600 transition-colors">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}