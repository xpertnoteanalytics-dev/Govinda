export type PlaceCategory =
  | "pharmacy"
  | "hospital"
  | "ngo"
  | "polyclinic"
  | "clinic"
  | "diagnostic_center"
  | "medical_lab"
  | "blood_bank"
  | "school"
  | "college"
  | "university"
  | "community_center"
  | "government_office"
  | "corporate_office";

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

  clinic: {
    label: "Clinic",
    plural: "Clinics",
    color: "bg-cyan-50 text-cyan-800 ring-cyan-200",
  },

  diagnostic_center: {
    label: "Diagnostic Center",
    plural: "Diagnostic Centers",
    color: "bg-blue-50 text-blue-800 ring-blue-200",
  },

  medical_lab: {
    label: "Medical Lab",
    plural: "Medical Labs",
    color: "bg-sky-50 text-sky-800 ring-sky-200",
  },

  blood_bank: {
    label: "Blood Bank",
    plural: "Blood Banks",
    color: "bg-rose-50 text-rose-800 ring-rose-200",
  },

  school: {
    label: "School",
    plural: "Schools",
    color: "bg-yellow-50 text-yellow-800 ring-yellow-200",
  },

  college: {
    label: "College",
    plural: "Colleges",
    color: "bg-amber-50 text-amber-800 ring-amber-200",
  },

  university: {
    label: "University",
    plural: "Universities",
    color: "bg-orange-50 text-orange-800 ring-orange-200",
  },

  community_center: {
    label: "Community Center",
    plural: "Community Centers",
    color: "bg-indigo-50 text-indigo-800 ring-indigo-200",
  },

  government_office: {
    label: "Government Office",
    plural: "Government Offices",
    color: "bg-slate-50 text-slate-800 ring-slate-200",
  },

  corporate_office: {
    label: "Corporate Office",
    plural: "Corporate Offices",
    color: "bg-zinc-50 text-zinc-800 ring-zinc-200",
  },
};
// src/lib/places-types.ts — add at the bottom after CATEGORY_META
export const ALL_PLACE_CATEGORIES: PlaceCategory[] = [
  "pharmacy",
  "hospital",
  "ngo",
  "polyclinic",
  "clinic",
  "diagnostic_center",
  "medical_lab",
  "blood_bank",
  "school",
  "college",
  "university",
  "community_center",
  "government_office",
  "corporate_office",
];