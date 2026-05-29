export type PlaceCategory = "pharmacy" | "hospital" | "ngo" | "polyclinic";

export interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating?: number;
  userRatingsTotal?: number;
  isOpen?: boolean;
  openStatusText?: string;
  phone?: string;
  email? : string
  website?: string;
  distanceMeters?: number;
  category: PlaceCategory;
  mapsUrl: string;
  directionsUrl: string;
}

export interface PlaceSearchResponse {
  results: PlaceResult[];
  location: {
    lat: number;
    lng: number;
    label: string;
  };
  radius: number;
  category: PlaceCategory;
  resultCount: number;
}

export interface SearchHistoryEntry {
  id: string;
  category: PlaceCategory;
  city?: string;
  locationLabel: string;
  lat: number;
  lng: number;
  radius: number;
  resultCount: number;
  topResultName?: string;
  createdAt: string;
}

export const CATEGORY_META: Record<
  PlaceCategory,
  { label: string; plural: string; color: string }
> = {
  pharmacy: {
    label: "Pharmacy",
    plural: "Pharmacies",
    color: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  },
  hospital: {
    label: "Hospital",
    plural: "Hospitals",
    color: "bg-red-50 text-red-800 ring-red-200",
  },
  ngo: {
    label: "NGO",
    plural: "NGOs",
    color: "bg-purple-50 text-purple-800 ring-purple-200",
  },
  polyclinic: {
    label: "Polyclinic",
    plural: "Polyclinics",
    color: "bg-brand-50 text-brand-800 ring-brand-200",
  },
};
