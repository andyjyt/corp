export type ListKind = "reviews" | "saved" | "custom";
export type Visibility = "private" | "unlisted" | "public";

export type OpeningPoint = { day: number; hour: number; minute: number };
export type OpeningHours = {
  periods?: { open: OpeningPoint; close?: OpeningPoint }[];
  weekdayDescriptions?: string[];
};

/** A place in the shared catalog (one row per real-world place). */
export type Place = {
  id: string;
  google_place_id: string | null;
  cid: string | null;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  country: string | null;
  country_code: string | null;
  region: string | null;
  city: string | null;
  neighborhood: string | null;
  primary_type: string | null;
  category: string | null;
  cuisine: string | null;
  types: string[];
  google_rating: number | null;
  google_rating_count: number | null;
  price_level: number | null;
  website: string | null;
  phone: string | null;
  maps_url: string | null;
  opening_hours: OpeningHours | null;
  utc_offset_minutes: number | null;
  enriched_at: string | null;
};

export type List = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  kind: ListKind;
  visibility: Visibility;
  share_slug: string;
  source_key: string | null;
  created_at: string;
  updated_at: string;
};

export type ListSummary = List & { item_count: number };

/** A place as it appears in one of a person's lists, with their own take on it. */
export type Entry = {
  place: Place;
  /** Note attached to the place within this list (e.g. imported from Google). */
  list_note: string | null;
  added_at: string | null;
  /** The list owner's own rating (1–5) and review. */
  rating: number | null;
  review_text: string | null;
  reviewed_at: string | null;
  /** The owner's extra notes about the place, shared with anyone who can see the list. */
  notes: string | null;
  /** Lists the place belongs to (only populated in the "All places" view). */
  lists?: { id: string; name: string }[];
};

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

export type TravelMode = "WALK" | "DRIVE" | "BICYCLE" | "TRANSIT";
