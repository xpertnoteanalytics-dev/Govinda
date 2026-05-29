import { SearchHistory } from "../models";
import { AppError } from "../utils/AppError";
import { resolveObjectIdString } from "../utils/resolveId";
import { env } from "../config/env";
import type {
  PlaceCategory,
  PlaceResult,
  PlaceSearchQuery,
  PlaceSearchResponse,
} from "../types/places";
import { ALL_PLACE_CATEGORIES } from "../types/places";

const PLACES_BASE = "https://maps.googleapis.com/maps/api/place";
const GEOCODE_BASE = "https://maps.googleapis.com/maps/api/geocode/json";

interface CategoryConfig {
  type?: string;
  keyword?: string;
}

const CATEGORY_CONFIG: Record<PlaceCategory, CategoryConfig> = {
  pharmacy: { type: "pharmacy" },
  hospital: { type: "hospital" },
  ngo: { keyword: "NGO nonprofit health" },
  polyclinic: { keyword: "polyclinic medical clinic", type: "doctor" },
};

function getApiKey(): string {
  if (!env.googleMaps.apiKey) {
    throw new AppError(
      503,
      "Maps service is not configured. Set GOOGLE_MAPS_API_KEY.",
      "MAPS_NOT_CONFIGURED"
    );
  }
  return env.googleMaps.apiKey;
}

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildMapsUrl(placeId: string): string {
  return `https://www.google.com/maps/place/?q=place_id:${placeId}`;
}

function buildDirectionsUrl(lat: number, lng: number, placeId: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination_place_id=${placeId}&destination=${lat},${lng}`;
}

interface GoogleNearbyResult {
  place_id: string;
  name: string;
  vicinity?: string;
  formatted_address?: string;
  geometry: { location: { lat: number; lng: number } };
  rating?: number;
  user_ratings_total?: number;
  opening_hours?: { open_now?: boolean };
  business_status?: string;
}

interface GoogleNearbyResponse {
  status: string;
  results?: GoogleNearbyResult[];
  error_message?: string;
  next_page_token?: string;
}

interface GoogleGeocodeResponse {
  status: string;
  results?: Array<{
    formatted_address: string;
    geometry: { location: { lat: number; lng: number } };
  }>;
  error_message?: string;
}

interface GoogleDetailsResponse {
  status: string;
  result?: {
    formatted_phone_number?: string;
    international_phone_number?: string;
    website?: string;
    url?: string;
    opening_hours?: {
      open_now?: boolean;
      weekday_text?: string[];
    };
    rating?: number;
    user_ratings_total?: number;
  };
  error_message?: string;
}

async function googleFetch<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = (await res.json()) as T;
  return data;
}

export async function geocodeCity(city: string): Promise<{
  lat: number;
  lng: number;
  label: string;
}> {
  const key = getApiKey();
  const params = new URLSearchParams({
    address: city,
    key,
  });

  const data = await googleFetch<GoogleGeocodeResponse>(
    `${GEOCODE_BASE}?${params.toString()}`
  );

  if (data.status !== "OK" || !data.results?.[0]) {
    throw new AppError(
      400,
      data.error_message ?? `Could not find location: ${city}`,
      "GEOCODE_FAILED"
    );
  }

  const result = data.results[0];
  return {
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    label: result.formatted_address,
  };
}

async function nearbySearch(
  lat: number,
  lng: number,
  radius: number,
  category: PlaceCategory
): Promise<GoogleNearbyResult[]> {
  const key = getApiKey();
  const config = CATEGORY_CONFIG[category];

  const params = new URLSearchParams({
    location: `${lat},${lng}`,
    radius: String(Math.min(radius, 50000)),
    key,
  });

  if (config.type) params.set("type", config.type);
  if (config.keyword) params.set("keyword", config.keyword);

  const data = await googleFetch<GoogleNearbyResponse>(
    `${PLACES_BASE}/nearbysearch/json?${params.toString()}`
  );

  if (data.status === "ZERO_RESULTS") {
    return [];
  }

  if (data.status !== "OK") {
    throw new AppError(
      502,
      data.error_message ?? `Places API error: ${data.status}`,
      "PLACES_API_ERROR"
    );
  }

  let results = data.results ?? [];
  let nextPageToken = data.next_page_token;

  // Google returns up to 3 pages (60 results); pagetoken requires a short delay
  while (nextPageToken && results.length < 60) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const pageParams = new URLSearchParams({ pagetoken: nextPageToken, key });
    const pageData = await googleFetch<GoogleNearbyResponse>(
      `${PLACES_BASE}/nearbysearch/json?${pageParams.toString()}`
    );
    if (pageData.status !== "OK") break;
    results = [...results, ...(pageData.results ?? [])];
    nextPageToken = pageData.next_page_token;
  }

  return results;
}

async function fetchPlaceDetails(placeId: string): Promise<{
  phone?: string;
  website?: string;
  email?: string;
  isOpen?: boolean;
  openStatusText?: string;
  rating?: number;
  userRatingsTotal?: number;
}> {
  const key = getApiKey();

  const params = new URLSearchParams({
    place_id: placeId,
    fields:
      "formatted_phone_number,international_phone_number,website,opening_hours,rating,user_ratings_total,url",
    key,
  });

  const data = await googleFetch<GoogleDetailsResponse>(
    `${PLACES_BASE}/details/json?${params.toString()}`
  );

  if (data.status !== "OK" || !data.result) {
    return {};
  }

  const r = data.result;
  const isOpen = r.opening_hours?.open_now;

  let email: string | undefined;

  if (r.website) {
    try {
      const html = await fetch(r.website).then((res) => res.text());

      const match = html.match(
        /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
      );

      if (match) {
        email = match[0];
      }
    } catch (err) {
      console.log("Email extraction failed");
    }
  }

  return {
    phone: r.formatted_phone_number ?? r.international_phone_number,
    website: r.website,
    email,
    isOpen,
    openStatusText:
      isOpen === true
        ? "Open now"
        : isOpen === false
          ? "Closed now"
          : undefined,
    rating: r.rating,
    userRatingsTotal: r.user_ratings_total,
  };
}

function mapNearbyToPlace(
  item: GoogleNearbyResult,
  originLat: number,
  originLng: number,
  category: PlaceCategory
): PlaceResult {
  const lat = item.geometry.location.lat;
  const lng = item.geometry.location.lng;
  const isOpen = item.opening_hours?.open_now;

  return {
    placeId: item.place_id,
    name: item.name,
    address: item.vicinity ?? item.formatted_address ?? "",
    lat,
    lng,
    rating: item.rating,
    userRatingsTotal: item.user_ratings_total,
    isOpen,
    openStatusText:
      isOpen === true
        ? "Open now"
        : isOpen === false
          ? "Closed now"
          : item.business_status === "OPERATIONAL"
            ? "Hours unavailable"
            : undefined,
    category,
    distanceMeters: Math.round(haversineMeters(originLat, originLng, lat, lng)),
    mapsUrl: buildMapsUrl(item.place_id),
    directionsUrl: buildDirectionsUrl(lat, lng, item.place_id),
  };
}

export async function searchPlaces(
  query: PlaceSearchQuery
): Promise<PlaceSearchResponse> {
  if (!ALL_PLACE_CATEGORIES.includes(query.category)) {
    throw new AppError(400, "Invalid category", "INVALID_CATEGORY");
  }

  const radius = Math.max(500, Math.min(query.radius, 50000));

  let lat = query.lat;
  let lng = query.lng;
  let label = query.locationLabel ?? "Current location";

  if (query.city?.trim()) {
    const geocoded = await geocodeCity(query.city.trim());
    lat = geocoded.lat;
    lng = geocoded.lng;
    label = geocoded.label;
  }

  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    throw new AppError(400, "Location coordinates are required", "LOCATION_REQUIRED");
  }

  const nearby = await nearbySearch(lat, lng, radius, query.category);

  let results = nearby
    .map((item) => mapNearbyToPlace(item, lat, lng, query.category))
    .filter((p) => (p.distanceMeters ?? 0) <= radius)
    .sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0))
    .slice(0, 40);

  // Enrich top results with phone/website (limit API calls)
  const enrichLimit = Math.min(results.length, 10);
  const enriched = await Promise.all(
  results.slice(0, enrichLimit).map(async (place) => {
    const details = await fetchPlaceDetails(place.placeId);

    return {
      ...place,
      phone: details.phone ?? place.phone,
      website: details.website ?? place.website,
      email: details.email,
      isOpen: details.isOpen ?? place.isOpen,
      openStatusText:
        details.openStatusText ?? place.openStatusText,
      rating: details.rating ?? place.rating,
      userRatingsTotal:
        details.userRatingsTotal ?? place.userRatingsTotal,
    };
  })
);

  results = [...enriched, ...results.slice(enrichLimit)];

  return {
    results,
    location: { lat, lng, label },
    radius,
    category: query.category,
    resultCount: results.length,
  };
}

export async function getPlaceDetails(
  placeId: string,
  category: PlaceCategory = "pharmacy"
): Promise<PlaceResult> {
  const key = getApiKey();
  const params = new URLSearchParams({
    place_id: placeId,
    fields:
      "place_id,name,formatted_address,geometry,rating,user_ratings_total,opening_hours,formatted_phone_number,international_phone_number,website,url",
    key,
  });

  const data = await googleFetch<{
    status: string;
    result?: GoogleNearbyResult & {
      formatted_address?: string;
      formatted_phone_number?: string;
      international_phone_number?: string;
      website?: string;
      url?: string;
    };
    error_message?: string;
  }>(`${PLACES_BASE}/details/json?${params.toString()}`);

  if (data.status !== "OK" || !data.result) {
    throw new AppError(404, "Place not found", "PLACE_NOT_FOUND");
  }

  const r = data.result;
  const lat = r.geometry.location.lat;
  const lng = r.geometry.location.lng;
  const isOpen = r.opening_hours?.open_now;

  return {
    placeId: r.place_id,
    name: r.name,
    address: r.formatted_address ?? r.vicinity ?? "",
    lat,
    lng,
    rating: r.rating,
    userRatingsTotal: r.user_ratings_total,
    isOpen,
    openStatusText:
      isOpen === true ? "Open now" : isOpen === false ? "Closed now" : undefined,
    phone: r.formatted_phone_number ?? r.international_phone_number,
    website: r.website,
    category,
    mapsUrl: r.url ?? buildMapsUrl(r.place_id),
    directionsUrl: buildDirectionsUrl(lat, lng, r.place_id),
  };
}

export async function recordSearchHistory(
  tenantId: string,
  userId: string,
  query: PlaceSearchQuery,
  response: PlaceSearchResponse
): Promise<void> {
  await SearchHistory.create({
    tenantId: resolveObjectIdString(tenantId, "tenantId"),
    userId: resolveObjectIdString(userId, "userId"),
    category: query.category,
    city: query.city,
    locationLabel: response.location.label,
    lat: response.location.lat,
    lng: response.location.lng,
    radius: response.radius,
    resultCount: response.resultCount,
    topResultName: response.results[0]?.name,
  });
}

export function serializeSearchHistory(entry: {
  _id: { toString(): string };
  category: PlaceCategory;
  city?: string;
  locationLabel: string;
  lat: number;
  lng: number;
  radius: number;
  resultCount: number;
  topResultName?: string;
  createdAt: Date;
}) {
  return {
    id: entry._id.toString(),
    category: entry.category,
    city: entry.city,
    locationLabel: entry.locationLabel,
    lat: entry.lat,
    lng: entry.lng,
    radius: entry.radius,
    resultCount: entry.resultCount,
    topResultName: entry.topResultName,
    createdAt: entry.createdAt.toISOString(),
  };
}

export async function listSearchHistory(tenantId: string, userId: string) {
  const entries = await SearchHistory.find({
    tenantId: resolveObjectIdString(tenantId, "tenantId"),
    userId: resolveObjectIdString(userId, "userId"),
  })
    .sort({ createdAt: -1 })
    .limit(25);

  return entries.map(serializeSearchHistory);
}

export async function deleteSearchHistory(
  historyId: string,
  tenantId: string,
  userId: string
): Promise<void> {
  const result = await SearchHistory.deleteOne({
    _id: resolveObjectIdString(historyId, "historyId"),
    tenantId: resolveObjectIdString(tenantId, "tenantId"),
    userId: resolveObjectIdString(userId, "userId"),
  });

  if (result.deletedCount === 0) {
    throw new AppError(404, "Search history not found", "HISTORY_NOT_FOUND");
  }
}

export async function getSearchAnalytics(tenantId: string, userId: string) {
  const tenantOid = resolveObjectIdString(tenantId, "tenantId");
  const userOid = resolveObjectIdString(userId, "userId");

  const [totalSearches, byCategory, recent] = await Promise.all([
    SearchHistory.countDocuments({ tenantId: tenantOid, userId: userOid }),
    SearchHistory.aggregate([
      { $match: { tenantId: tenantOid, userId: userOid } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]),
    SearchHistory.find({ tenantId: tenantOid, userId: userOid })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("category locationLabel resultCount createdAt"),
  ]);

  return {
    totalSearches,
    byCategory: byCategory.map((c) => ({
      category: c._id as PlaceCategory,
      count: c.count as number,
    })),
    recent: recent.map((r) => ({
      category: r.category,
      locationLabel: r.locationLabel,
      resultCount: r.resultCount,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
