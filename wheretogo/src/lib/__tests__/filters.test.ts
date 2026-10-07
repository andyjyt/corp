import { describe, expect, it } from "vitest";
import {
  applyFilters,
  buildFacets,
  DEFAULT_FILTERS,
  filtersFromSearchParams,
  filtersToSearchParams,
  inBounds,
  type Filters,
} from "@/lib/filters";
import { isOpenAt } from "@/lib/hours";
import type { Entry, Place } from "@/lib/types";

function entry(id: string, place: Partial<Place>, extra: Partial<Entry> = {}): Entry {
  return {
    place: {
      id, google_place_id: null, cid: null, name: id, address: null, lat: null, lng: null,
      country: "United States", country_code: "US", region: null, city: "New York", neighborhood: null,
      primary_type: null, category: null, cuisine: null, types: [], google_rating: null,
      google_rating_count: null, price_level: null, website: null, phone: null, maps_url: null,
      opening_hours: null, utc_offset_minutes: null, enriched_at: null, ...place,
    },
    list_note: null, added_at: null, rating: null, review_text: null, reviewed_at: null, notes: null,
    ...extra,
  };
}

const entries = [
  entry("Lilia", { neighborhood: "Williamsburg", cuisine: "Italian", google_rating: 4.6, price_level: 3, lat: 40.71, lng: -73.95 }, { rating: 5 }),
  entry("Katz", { neighborhood: "Lower East Side", cuisine: "Deli", google_rating: 4.5, price_level: 2, lat: 40.72, lng: -73.98 }, { notes: "pastrami" }),
  entry("Ichiran", { country: "Japan", city: "Tokyo", cuisine: "Ramen", google_rating: 4.2 }),
];

const f = (over: Partial<Filters>): Filters => ({ ...DEFAULT_FILTERS, ...over });

describe("applyFilters", () => {
  it("filters by area and cuisine", () => {
    expect(applyFilters(entries, f({ city: "New York" })).map((e) => e.place.id)).toEqual(["Katz", "Lilia"]);
    expect(applyFilters(entries, f({ neighborhoods: ["Williamsburg"] })).map((e) => e.place.id)).toEqual(["Lilia"]);
    expect(applyFilters(entries, f({ cuisines: ["Ramen"] })).map((e) => e.place.id)).toEqual(["Ichiran"]);
  });

  it("searches notes", () => {
    expect(applyFilters(entries, f({ q: "PASTRAMI" })).map((e) => e.place.id)).toEqual(["Katz"]);
  });

  it("sorts by google rating high to low, flipping with desc", () => {
    expect(applyFilters(entries, f({ sort: "google_rating" })).map((e) => e.place.id)).toEqual(["Lilia", "Katz", "Ichiran"]);
    expect(applyFilters(entries, f({ sort: "google_rating", desc: true })).map((e) => e.place.id)).toEqual(["Ichiran", "Katz", "Lilia"]);
  });

  it("filters by travel time once computed", () => {
    const travelSeconds = { Lilia: 600, Katz: 1500 };
    expect(applyFilters(entries, f({ maxMinutes: 15 }), { travelSeconds }).map((e) => e.place.id)).toEqual(["Lilia"]);
    // Still-loading places stay visible.
    const travelPending = new Set(["Ichiran"]);
    expect(applyFilters(entries, f({ maxMinutes: 15 }), { travelSeconds, travelPending }).map((e) => e.place.id)).toEqual(["Ichiran", "Lilia"]);
  });

  it("filters by viewport", () => {
    const bounds = { north: 40.715, south: 40.7, east: -73.9, west: -74 };
    expect(applyFilters(entries, f({ inView: true, bounds })).map((e) => e.place.id)).toEqual(["Lilia"]);
  });
});

describe("facets", () => {
  it("narrows neighborhoods to the chosen city", () => {
    const facets = buildFacets(entries, f({ city: "Tokyo" }));
    expect(facets.countries).toHaveLength(2);
    expect(facets.neighborhoods).toEqual([]);
    expect(facets.cuisines).toEqual([{ value: "Ramen", count: 1 }]);
  });
});

describe("url round-trip", () => {
  it("serializes and parses filters", () => {
    const original = f({ city: "New York", neighborhoods: ["Williamsburg", "SoHo"], minGoogleRating: 4.5, openNow: true, sort: "travel", maxMinutes: 20, origin: { lat: 40.7, lng: -73.99 }, mode: "TRANSIT" });
    expect(filtersFromSearchParams(filtersToSearchParams(original))).toEqual(original);
  });
});

describe("inBounds", () => {
  it("handles viewports crossing the antimeridian", () => {
    expect(inBounds(0, 179, { north: 1, south: -1, east: -179, west: 178 })).toBe(true);
    expect(inBounds(0, 0, { north: 1, south: -1, east: -179, west: 178 })).toBe(false);
  });
});

describe("isOpenAt", () => {
  // Open Tue–Sat 17:00–01:00 (closes after midnight), New York in winter (UTC-5).
  const hours = {
    periods: [2, 3, 4, 5, 6].map((day) => ({
      open: { day, hour: 17, minute: 0 },
      close: { day: (day + 1) % 7, hour: 1, minute: 0 },
    })),
  };
  it("handles overnight and week-wrapping periods", () => {
    // Tue 2026-01-06 18:00 local = 23:00 UTC
    expect(isOpenAt(hours, -300, new Date("2026-01-06T23:00:00Z"))).toBe(true);
    // Sun 2026-01-11 00:30 local (Saturday's shift) = 05:30 UTC
    expect(isOpenAt(hours, -300, new Date("2026-01-11T05:30:00Z"))).toBe(true);
    // Mon 2026-01-05 18:00 local = 23:00 UTC
    expect(isOpenAt(hours, -300, new Date("2026-01-05T23:00:00Z"))).toBe(false);
  });
  it("treats a period without close as 24/7 and missing data as unknown", () => {
    expect(isOpenAt({ periods: [{ open: { day: 0, hour: 0, minute: 0 } }] }, 0)).toBe(true);
    expect(isOpenAt(null, 0)).toBeNull();
  });
});
