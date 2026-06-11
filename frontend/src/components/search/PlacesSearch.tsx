// src/components/search/PlacesSearch.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  MapPin,
  Loader2,
  Cross,
  Building2,
  HeartHandshake,
  Stethoscope,
  LocateFixed,
  Menu,
  X,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlaceCategory, PlaceResult, SearchHistoryEntry } from "@/lib/places-types";
import { CATEGORY_META } from "@/lib/places-types";
import { searchPlaces, listSearchHistory, listImportedPlaces, type ImportedPlace } from "@/lib/places-api";
import { HEALTHCARE_WORKFLOW_STEPS } from "@/lib/workflow-steps";
import { WorkflowRibbon } from "@/components/ui/WorkflowRibbon";
import { PlaceCard } from "./PlaceCard";
import { SearchHistorySidebar } from "./SearchHistorySidebar";
import CsvImportModal from "./CsvImportModal";

const CATEGORIES: {
  id: PlaceCategory;
  icon: typeof Cross;
}[] = [
  { id: "pharmacy", icon: Cross },
  { id: "hospital", icon: Building2 },
  { id: "polyclinic", icon: Stethoscope },
  { id: "clinic", icon: Stethoscope },
  { id: "diagnostic_center", icon: Building2 },
  { id: "medical_lab", icon: Building2 },
  { id: "blood_bank", icon: HeartHandshake },
  { id: "school", icon: Building2 },
  { id: "college", icon: Building2 },
  { id: "university", icon: Building2 },
  { id: "ngo", icon: HeartHandshake },
  { id: "community_center", icon: Building2 },
  { id: "government_office", icon: Building2 },
  { id: "corporate_office", icon: Building2 },
];

const RADIUS_MIN = 500;
const RADIUS_MAX = 50000;
const RADIUS_DEFAULT = 5000;

export function PlacesSearch() {
  const [category, setCategory] = useState<PlaceCategory>("pharmacy");
  const [radius, setRadius] = useState(RADIUS_DEFAULT);
  const [city, setCity] = useState("");
  const [location, setLocation] = useState<{
    lat: number;
    lng: number;
    label: string;
  } | null>(null);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [locationLabel, setLocationLabel] = useState("");
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importedPlaces, setImportedPlaces] = useState<ImportedPlace[]>([]);

  const loadHistory = useCallback(async () => {
    try {
      const data = await listSearchHistory();
      setHistory(data);
    } catch {
      setHistory([]);
    }
  }, []);

  const loadImported = useCallback(async () => {
    try {
      const data = await listImportedPlaces();
      setImportedPlaces(data);
    } catch {
      setImportedPlaces([]);
    }
  }, []);

  useEffect(() => {
    loadHistory();
    loadImported();
  }, [loadHistory, loadImported]);

  async function useCurrentLocation() {
    setError("");
    setIsLocating(true);
    if (!navigator.geolocation) {
      setError("Geolocation is not supported in this browser");
      setIsLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: "Current location",
        });
        setCity("");
        setIsLocating(false);
      },
      () => {
        setError("Unable to access your location. Enter a city instead.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function runSearch(overrides?: {
    category?: PlaceCategory;
    radius?: number;
    lat?: number;
    lng?: number;
    city?: string;
    locationLabel?: string;
  }) {
    setError("");
    setIsSearching(true);
    setHasSearched(true);

    const searchCategory = overrides?.category ?? category;
    const searchRadius = overrides?.radius ?? radius;

    try {
      const lat = overrides?.lat ?? location?.lat;
      const lng = overrides?.lng ?? location?.lng;
      const searchCity = overrides?.city ?? (city.trim() || undefined);
      const label =
        overrides?.locationLabel ??
        location?.label ??
        (searchCity ? searchCity : "Current location");

      if (!searchCity && (lat == null || lng == null)) {
        setError("Enter a city or use current location");
        setIsSearching(false);
        return;
      }

      const data = await searchPlaces({
        category: searchCategory,
        radius: searchRadius,
        lat,
        lng,
        city: searchCity,
        locationLabel: label,
      });

      setResults(data.results);
      setLocationLabel(data.location.label);
      setLocation({
        lat: data.location.lat,
        lng: data.location.lng,
        label: data.location.label,
      });
      await loadHistory();
    } catch (err) {
      setResults([]);
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setIsSearching(false);
    }
  }

  function handleReplay(entry: SearchHistoryEntry) {
    setCategory(entry.category);
    setRadius(entry.radius);
    setCity(entry.city ?? "");
    setLocation({
      lat: entry.lat,
      lng: entry.lng,
      label: entry.locationLabel,
    });
    setSidebarOpen(false);
    runSearch({
      category: entry.category,
      radius: entry.radius,
      lat: entry.lat,
      lng: entry.lng,
      city: entry.city,
      locationLabel: entry.locationLabel,
    });
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-0 flex-1 overflow-hidden lg:h-full">
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        className="absolute left-4 top-20 z-20 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium shadow-sm dark:border-white/10 dark:bg-slate-800/90 dark:text-white lg:hidden"
      >
        <Menu className="h-4 w-4" />
        History
      </button>

      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-72 pt-16 transition-transform duration-300 lg:static lg:z-0 lg:pt-0 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="relative h-full lg:h-[calc(100vh-4rem)]">
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="absolute right-2 top-2 z-10 rounded-lg p-1.5 hover:bg-slate-100 lg:hidden"
            aria-label="Close history"
          >
            <X className="h-4 w-4" />
          </button>
          <SearchHistorySidebar
            history={history}
            onRefresh={loadHistory}
            onReplay={handleReplay}
            className="h-full w-72"
          />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="border-b border-slate-200/80 bg-white/80 px-4 py-4 backdrop-blur-md dark:border-white/10 dark:bg-slate-900/80 sm:px-6">
          <div className="mx-auto max-w-4xl space-y-4">
            <WorkflowRibbon steps={HEALTHCARE_WORKFLOW_STEPS} activeIndex={0} />

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      runSearch();
                    }
                  }}
                  placeholder="Search by city (e.g. Mumbai, Delhi)"
                  className="h-11 w-full rounded-xl border border-slate-200/80 bg-slate-50/80 pl-10 pr-4 text-sm text-ink outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-white/10 dark:bg-slate-950/50 dark:text-white"
                />
              </div>
              <button
                type="button"
                onClick={useCurrentLocation}
                disabled={isLocating}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-ink hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
              >
                {isLocating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LocateFixed className="h-4 w-4" />
                )}
                Current location
              </button>
              <button
                type="button"
                onClick={() => runSearch()}
                disabled={isSearching}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Search
              </button>

              {/* ✅ Import CSV Button */}
              <button
                type="button"
                onClick={() => setShowImport(true)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-ink hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
              >
                <Upload className="h-4 w-4" />
                Import CSV
              </button>
            </div>

            {location && (
              <p className="flex items-center gap-1.5 text-xs text-ink-muted">
                <MapPin className="h-3.5 w-3.5 text-brand-600" />
                {location.label}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(({ id, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setCategory(id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ring-1 ring-inset",
                    category === id
                      ? CATEGORY_META[id].color
                      : "bg-white text-ink-muted ring-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:ring-white/10 dark:hover:bg-slate-700"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {CATEGORY_META[id].plural}
                </button>
              ))}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-ink dark:text-white">Search radius</span>
                <span className="text-ink-muted">{(radius / 1000).toFixed(1)} km</span>
              </div>
              <input
                type="range"
                min={RADIUS_MIN}
                max={RADIUS_MAX}
                step={500}
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-600"
              />
              <div className="mt-1 flex justify-between text-xs text-ink-subtle">
                <span>0.5 km</span>
                <span>50 km</span>
              </div>
            </div>

            {/* ✅ Imported places count badge */}
            {importedPlaces.length > 0 && (
              <p className="flex items-center gap-1.5 text-xs text-ink-muted">
                <Upload className="h-3.5 w-3.5 text-brand-600" />
                {importedPlaces.length} imported places in your database
              </p>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-4xl">
            {error && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-clinical-danger">
                {error}
              </div>
            )}

            {isSearching && (
              <div className="space-y-4 py-4">
                <p className="text-sm text-ink-muted">
                  Finding nearby {CATEGORY_META[category].plural.toLowerCase()}...
                </p>
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div key={`skeleton-${idx}`} className="glass-panel space-y-3 p-5">
                    <div className="ops-skeleton h-4 w-24" />
                    <div className="ops-skeleton h-6 w-2/3" />
                    <div className="ops-skeleton h-4 w-full" />
                    <div className="flex gap-2 pt-1">
                      <div className="ops-skeleton h-9 w-20" />
                      <div className="ops-skeleton h-9 w-20" />
                      <div className="ops-skeleton h-9 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isSearching && hasSearched && results.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center py-20 text-center"
              >
                <MapPin className="h-12 w-12 text-ink-subtle" />
                <h3 className="mt-4 text-lg font-semibold text-ink">No places found</h3>
                <p className="mt-2 max-w-sm text-sm text-ink-muted">
                  Try increasing the radius, switching category, or searching a different city.
                </p>
              </motion.div>
            )}

            {!isSearching && !hasSearched && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center py-16 text-center"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-elevated">
                  <MapPin className="h-8 w-8" />
                </div>
                <h3 className="mt-6 text-xl font-bold text-ink">
                  Find healthcare services nearby
                </h3>
                <p className="mt-2 max-w-md text-sm text-ink-muted">
                  Search hospitals, pharmacies, clinics, diagnostic centers, medical labs,
                  blood banks, schools, colleges, universities, NGOs, government offices,
                  community centers, and other nearby services using your city or current
                  location. Results include ratings, contact information, hours, and directions.
                </p>
                {importedPlaces.length > 0 && (
                  <p className="mt-3 text-xs text-brand-600 dark:text-brand-400">
                    {importedPlaces.length} places already imported in your database
                  </p>
                )}
              </motion.div>
            )}

            {!isSearching && results.length > 0 && (
              <div className="space-y-4">
                <p className="text-sm text-ink-muted">
                  {results.length} {CATEGORY_META[category].plural.toLowerCase()} near{" "}
                  <span className="font-medium text-ink">{locationLabel}</span>
                </p>
                {results.map((place, index) => (
                  <PlaceCard key={place.placeId} place={place} index={index} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ✅ CSV Import Modal */}
      {showImport && (
        <CsvImportModal
          onClose={() => setShowImport(false)}
          onImported={async () => {
            await loadImported();
          }}
        />
      )}
    </div>
  );
}