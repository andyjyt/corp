// Turns a Places API (New) place into the columns we store and filter on:
// area (country / city / neighborhood), category, cuisine and price.

import type { OpeningHours, Place } from "@/lib/types";

export type GooglePlace = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  types?: string[];
  primaryType?: string;
  primaryTypeDisplayName?: { text: string };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  googleMapsUri?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  addressComponents?: { longText: string; shortText: string; types: string[] }[];
  regularOpeningHours?: OpeningHours;
  utcOffsetMinutes?: number;
};

export type PlaceRecord = Omit<Place, "id">;

const PRICE_LEVELS: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

// Restaurant types that describe a format rather than a cuisine.
const NOT_A_CUISINE = new Set([
  "restaurant",
  "fine_dining_restaurant",
  "buffet_restaurant",
  "family_restaurant",
  "fast_food_restaurant",
]);

const CUISINE_ALIASES: Record<string, string> = {
  steak_house: "Steakhouse",
  sandwich_shop: "Sandwiches",
  hamburger_restaurant: "Burgers",
  bagel_shop: "Bagels",
  donut_shop: "Donuts",
  dim_sum_restaurant: "Dim sum",
  korean_barbecue_restaurant: "Korean BBQ",
  barbecue_restaurant: "BBQ",
};

export function cuisineFromTypes(types: string[] = [], primaryType?: string): string | null {
  const ordered = primaryType ? [primaryType, ...types.filter((t) => t !== primaryType)] : types;
  for (const t of ordered) {
    if (CUISINE_ALIASES[t]) return CUISINE_ALIASES[t];
    if (t.endsWith("_restaurant") && !NOT_A_CUISINE.has(t)) {
      return humanize(t.replace(/_restaurant$/, ""));
    }
  }
  return null;
}

export function areaFromComponents(components: GooglePlace["addressComponents"] = []) {
  const find = (...types: string[]) => {
    for (const type of types) {
      const c = components.find((c) => c.types.includes(type));
      if (c) return c;
    }
    return undefined;
  };
  const country = find("country");
  const city = find(
    "locality",
    "postal_town",
    "administrative_area_level_3",
    "administrative_area_level_2",
  );
  const neighborhood = find("neighborhood", "sublocality_level_1", "sublocality");
  return {
    country: country?.longText ?? null,
    country_code: country?.shortText ?? null,
    region: find("administrative_area_level_1")?.longText ?? null,
    city: city?.longText ?? null,
    neighborhood:
      neighborhood && neighborhood.longText !== city?.longText ? neighborhood.longText : null,
  };
}

export function priceLevelToNumber(level?: string): number | null {
  return level && level in PRICE_LEVELS ? PRICE_LEVELS[level] : null;
}

export function cidFromMapsUri(uri?: string): string | null {
  if (!uri) return null;
  const m = uri.match(/[?&]cid=(\d+)/);
  return m ? m[1] : null;
}

export function toPlaceRecord(g: GooglePlace): PlaceRecord {
  const types = g.types ?? [];
  return {
    google_place_id: g.id,
    cid: cidFromMapsUri(g.googleMapsUri),
    name: g.displayName?.text ?? "Unnamed place",
    address: g.formattedAddress ?? null,
    lat: g.location?.latitude ?? null,
    lng: g.location?.longitude ?? null,
    ...areaFromComponents(g.addressComponents),
    primary_type: g.primaryType ?? null,
    category: g.primaryTypeDisplayName?.text ?? (g.primaryType ? humanize(g.primaryType) : null),
    cuisine: cuisineFromTypes(types, g.primaryType),
    types,
    google_rating: g.rating ?? null,
    google_rating_count: g.userRatingCount ?? null,
    price_level: priceLevelToNumber(g.priceLevel),
    website: g.websiteUri ?? null,
    phone: g.nationalPhoneNumber ?? null,
    maps_url: g.googleMapsUri ?? null,
    opening_hours: g.regularOpeningHours
      ? {
          periods: g.regularOpeningHours.periods,
          weekdayDescriptions: g.regularOpeningHours.weekdayDescriptions,
        }
      : null,
    utc_offset_minutes: g.utcOffsetMinutes ?? null,
    enriched_at: new Date().toISOString(),
  };
}

export function humanize(type: string): string {
  const s = type.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
