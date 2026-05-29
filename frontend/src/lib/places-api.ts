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

export async function searchPlaces(
  input: SearchPlacesInput
): Promise<PlaceSearchResponse> {
  return apiFetch<PlaceSearchResponse>("/v1/places/search", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getPlaceDetails(
  placeId: string,
  category?: PlaceCategory
): Promise<PlaceResult> {
  const qs = category ? `?category=${category}` : "";
  const data = await apiFetch<{ place: PlaceResult }>(
    `/v1/places/details/${placeId}${qs}`
  );
  return data.place;
}

export async function listSearchHistory(): Promise<SearchHistoryEntry[]> {
  const data = await apiFetch<{ searches: SearchHistoryEntry[] }>(
    "/v1/places/history"
  );
  return data.searches;
}

export async function deleteSearchHistory(historyId: string): Promise<void> {
  await apiFetch(`/v1/places/history/${historyId}`, { method: "DELETE" });
}

export function formatDistance(meters?: number): string {
  if (meters == null) return "";
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}
