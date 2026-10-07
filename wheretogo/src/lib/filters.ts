// Filtering and sorting for the place browser. Filter state lives in the URL
// (so a filtered view can be shared as a link) and is applied client-side.

import { isOpenAt } from "@/lib/hours";
import type { Entry, TravelMode } from "@/lib/types";

export type Bounds = { north: number; south: number; east: number; west: number };

export type SortKey = "name" | "google_rating" | "rating" | "price" | "travel" | "added";

export type Filters = {
  q: string;
  country: string | null;
  city: string | null;
  neighborhoods: string[];
  cuisines: string[];
  minGoogleRating: number | null;
  minRating: number | null;
  maxPrice: number | null;
  openNow: boolean;
  /** Only show places inside the map viewport. */
  inView: boolean;
  bounds: Bounds | null;
  /** Where travel times are measured from, and how you're getting there. */
  origin: { lat: number; lng: number } | null;
  mode: TravelMode;
  /** Max travel time in minutes (applies once travel times are computed). */
  maxMinutes: number | null;
  sort: SortKey;
  desc: boolean;
};

export const DEFAULT_FILTERS: Filters = {
  q: "",
  country: null,
  city: null,
  neighborhoods: [],
  cuisines: [],
  minGoogleRating: null,
  minRating: null,
  maxPrice: null,
  openNow: false,
  inView: false,
  bounds: null,
  origin: null,
  mode: "WALK",
  maxMinutes: null,
  sort: "name",
  desc: false,
};

export function filtersFromSearchParams(params: URLSearchParams): Filters {
  const list = (key: string) => params.get(key)?.split("|").filter(Boolean) ?? [];
  const number = (key: string) => {
    const v = params.get(key);
    const n = v == null || v === "" ? NaN : Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const bounds = params.get("bounds")?.split(",").map(Number);
  const sort = params.get("sort") as SortKey | null;
  const from = params.get("from")?.split(",").map(Number);
  const mode = params.get("mode") as TravelMode | null;
  return {
    q: params.get("q") ?? "",
    country: params.get("country"),
    city: params.get("city"),
    neighborhoods: list("hood"),
    cuisines: list("cuisine"),
    minGoogleRating: number("grating"),
    minRating: number("rating"),
    maxPrice: number("price"),
    openNow: params.get("open") === "1",
    inView: params.get("inview") === "1",
    bounds:
      bounds?.length === 4 && bounds.every(Number.isFinite)
        ? { north: bounds[0], east: bounds[1], south: bounds[2], west: bounds[3] }
        : null,
    origin:
      from?.length === 2 && from.every(Number.isFinite) ? { lat: from[0], lng: from[1] } : null,
    mode: mode && TRAVEL_MODES.includes(mode) ? mode : "WALK",
    maxMinutes: number("mins"),
    sort: sort && SORT_KEYS.includes(sort) ? sort : "name",
    desc: params.get("desc") === "1",
  };
}

const SORT_KEYS: SortKey[] = ["name", "google_rating", "rating", "price", "travel", "added"];
export const TRAVEL_MODES: TravelMode[] = ["WALK", "DRIVE", "TRANSIT", "BICYCLE"];

export function filtersToSearchParams(f: Filters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.country) p.set("country", f.country);
  if (f.city) p.set("city", f.city);
  if (f.neighborhoods.length) p.set("hood", f.neighborhoods.join("|"));
  if (f.cuisines.length) p.set("cuisine", f.cuisines.join("|"));
  if (f.minGoogleRating != null) p.set("grating", String(f.minGoogleRating));
  if (f.minRating != null) p.set("rating", String(f.minRating));
  if (f.maxPrice != null) p.set("price", String(f.maxPrice));
  if (f.openNow) p.set("open", "1");
  if (f.inView) p.set("inview", "1");
  if (f.inView && f.bounds) {
    const b = f.bounds;
    p.set("bounds", [b.north, b.east, b.south, b.west].map((n) => n.toFixed(5)).join(","));
  }
  if (f.origin) {
    p.set("from", `${f.origin.lat.toFixed(5)},${f.origin.lng.toFixed(5)}`);
    if (f.mode !== "WALK") p.set("mode", f.mode);
  }
  if (f.maxMinutes != null) p.set("mins", String(f.maxMinutes));
  if (f.sort !== "name") p.set("sort", f.sort);
  if (f.desc) p.set("desc", "1");
  return p;
}

export type FilterContext = {
  now?: Date;
  /** Travel time in seconds by place id, when computed. */
  travelSeconds?: Record<string, number | null>;
  /** Places whose travel time is still being fetched; kept visible meanwhile. */
  travelPending?: Set<string>;
};

/** Filters that narrow by area only — used to build the neighborhood/cuisine facets. */
function matchesArea(e: Entry, f: Filters): boolean {
  if (f.country && e.place.country !== f.country) return false;
  if (f.city && e.place.city !== f.city) return false;
  return true;
}

export function applyFilters(entries: Entry[], f: Filters, ctx: FilterContext = {}): Entry[] {
  const q = f.q.trim().toLowerCase();
  const now = ctx.now ?? new Date();
  const result = entries.filter((e) => {
    const p = e.place;
    if (!matchesArea(e, f)) return false;
    if (f.neighborhoods.length && !f.neighborhoods.includes(p.neighborhood ?? "")) return false;
    if (f.cuisines.length && !f.cuisines.includes(p.cuisine ?? p.category ?? "")) return false;
    if (f.minGoogleRating != null && (p.google_rating ?? 0) < f.minGoogleRating) return false;
    if (f.minRating != null && (e.rating ?? 0) < f.minRating) return false;
    if (f.maxPrice != null && p.price_level != null && p.price_level > f.maxPrice) return false;
    if (f.openNow && isOpenAt(p.opening_hours, p.utc_offset_minutes, now) !== true) return false;
    if (f.inView && f.bounds && !inBounds(p.lat, p.lng, f.bounds)) return false;
    if (f.maxMinutes != null && ctx.travelSeconds && !ctx.travelPending?.has(p.id)) {
      const s = ctx.travelSeconds[p.id];
      if (s == null || s > f.maxMinutes * 60) return false;
    }
    if (q) {
      const haystack = [
        p.name,
        p.address,
        p.category,
        p.cuisine,
        p.neighborhood,
        p.city,
        e.notes,
        e.list_note,
        e.review_text,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
  return sortEntries(result, f, ctx);
}

export function sortEntries(entries: Entry[], f: Filters, ctx: FilterContext = {}): Entry[] {
  const value = (e: Entry): number | string | null => {
    switch (f.sort) {
      case "google_rating":
        return e.place.google_rating;
      case "rating":
        return e.rating;
      case "price":
        return e.place.price_level;
      case "travel":
        return ctx.travelSeconds?.[e.place.id] ?? null;
      case "added":
        return e.added_at ?? e.reviewed_at;
      default:
        return e.place.name.toLowerCase();
    }
  };
  // Ratings and dates read best high-to-low by default; the rest low-to-high.
  const naturalDesc = f.sort === "google_rating" || f.sort === "rating" || f.sort === "added";
  const dir = naturalDesc !== f.desc ? -1 : 1;
  return [...entries].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    // Missing values always sink to the bottom.
    if (va == null && vb == null) return a.place.name.localeCompare(b.place.name);
    if (va == null) return 1;
    if (vb == null) return -1;
    if (va < vb) return -dir;
    if (va > vb) return dir;
    return a.place.name.localeCompare(b.place.name);
  });
}

export function inBounds(lat: number | null, lng: number | null, b: Bounds): boolean {
  if (lat == null || lng == null) return false;
  if (lat > b.north || lat < b.south) return false;
  // Viewports can cross the antimeridian.
  return b.west <= b.east ? lng >= b.west && lng <= b.east : lng >= b.west || lng <= b.east;
}

export type Facet = { value: string; count: number };

export type Facets = {
  countries: Facet[];
  cities: Facet[];
  neighborhoods: Facet[];
  cuisines: Facet[];
};

/** Counts for the area and cuisine pickers, narrowed by the current country/city. */
export function buildFacets(entries: Entry[], f: Filters): Facets {
  const count = (values: (string | null)[]) => {
    const m = new Map<string, number>();
    for (const v of values) if (v) m.set(v, (m.get(v) ?? 0) + 1);
    return [...m.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  };
  const inCountry = f.country ? entries.filter((e) => e.place.country === f.country) : entries;
  const inArea = entries.filter((e) => matchesArea(e, f));
  return {
    countries: count(entries.map((e) => e.place.country)),
    cities: count(inCountry.map((e) => e.place.city)),
    neighborhoods: count(inArea.map((e) => e.place.neighborhood)),
    cuisines: count(inArea.map((e) => e.place.cuisine ?? e.place.category)),
  };
}
