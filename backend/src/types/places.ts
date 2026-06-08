export const PLACE_CATEGORIES = {
  pharmacy: "pharmacy",
  hospital: "hospital",
  ngo: "ngo",
  polyclinic: "polyclinic",

  clinic: "clinic",
  diagnostic_center: "diagnostic_center",
  medical_lab: "medical_lab",
  blood_bank: "blood_bank",

  school: "school",
  college: "college",
  university: "university",

  community_center: "community_center",
  government_office: "government_office",
  corporate_office: "corporate_office",

} as const;

export type PlaceCategory = keyof typeof PLACE_CATEGORIES;

export const ALL_PLACE_CATEGORIES = Object.keys(
  PLACE_CATEGORIES
) as PlaceCategory[];

export interface PlaceSearchQuery {
  lat?: number;
  lng?: number;
  radius: number;
  category: PlaceCategory;
  city?: string;
  locationLabel?: string;
}

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
  email?: string;
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
