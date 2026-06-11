// src/lib/places-api.ts
import { apiFetch } from "./api";
import type {
  PlaceCategory,
  PlaceResult,
  PlaceSearchResponse,
  SearchHistoryEntry,
} from "./places-types";

export interface SearchPlacesInput {
  category: PlaceCategory;
  radius: number;
  lat?: number;
  lng?: number;
  city?: string;
  locationLabel?: string;
}

export interface CsvRecord {
  name: string;
  category: string;
  phone?: string;
  address?: string;
  lat: string;
  lng: string;
}

export interface ImportResult {
  imported: number;
  duplicates: number;
  errors: string[];
}

export interface ImportedPlace {
  _id: string;
  name: string;
  category: PlaceCategory;
  phone?: string;
  address?: string;
  lat: number;
  lng: number;
  createdAt: string;
}

export async function searchPlaces(input: SearchPlacesInput): Promise<PlaceSearchResponse> {
  return apiFetch<PlaceSearchResponse>("/v1/places/search", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getPlaceDetails(placeId: string, category?: PlaceCategory): Promise<PlaceResult> {
  const qs = category ? `?category=${category}` : "";
  const data = await apiFetch<{ place: PlaceResult }>(`/v1/places/details/${placeId}${qs}`);
  return data.place;
}

export async function listSearchHistory(): Promise<SearchHistoryEntry[]> {
  const data = await apiFetch<{ searches: SearchHistoryEntry[] }>("/v1/places/history");
  return data.searches;
}

export async function deleteSearchHistory(historyId: string): Promise<void> {
  await apiFetch(`/v1/places/history/${historyId}`, { method: "DELETE" });
}

export async function importCsvRecords(records: CsvRecord[]): Promise<ImportResult> {
  return apiFetch<ImportResult>("/v1/places/import", {
    method: "POST",
    body: JSON.stringify({ records }),
  });
}

export async function listImportedPlaces(): Promise<ImportedPlace[]> {
  const data = await apiFetch<{ places: ImportedPlace[] }>("/v1/places/imported");
  return data.places;
}

export function formatDistance(meters?: number): string {
  if (meters == null) return "";
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function parseCsv(text: string): CsvRecord[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const nameIdx = headers.indexOf("name");
  const catIdx = headers.indexOf("category");
  const phoneIdx = headers.indexOf("phone");
  const addrIdx = headers.indexOf("address");
  const latIdx = headers.indexOf("latitude");
  const lngIdx = headers.indexOf("longitude");

  if (nameIdx === -1 || catIdx === -1 || latIdx === -1 || lngIdx === -1) {
    throw new Error("CSV must have columns: Name, Category, Latitude, Longitude");
  }

  return lines.slice(1)
    .filter((l) => l.trim())
    .map((line) => {
      const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      return {
        name: cols[nameIdx] ?? "",
        category: cols[catIdx]?.toLowerCase() ?? "",
        phone: phoneIdx !== -1 ? cols[phoneIdx] : undefined,
        address: addrIdx !== -1 ? cols[addrIdx] : undefined,
        lat: cols[latIdx] ?? "",
        lng: cols[lngIdx] ?? "",
      };
    });
}