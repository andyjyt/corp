// Sample data for the /dev/preview page (development only). Ratings and
// details are illustrative, not live Google data.
import type { Entry, OpeningHours, Place } from "@/lib/types";

const dinner: OpeningHours = {
  periods: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    open: { day, hour: 17, minute: 0 },
    close: { day, hour: 23, minute: 0 },
  })),
  weekdayDescriptions: [
    "Monday: 5:00 – 11:00 PM",
    "Tuesday: 5:00 – 11:00 PM",
    "Wednesday: 5:00 – 11:00 PM",
    "Thursday: 5:00 – 11:00 PM",
    "Friday: 5:00 – 11:00 PM",
    "Saturday: 5:00 – 11:00 PM",
    "Sunday: 5:00 – 11:00 PM",
  ],
};
const allDay: OpeningHours = { periods: [{ open: { day: 0, hour: 0, minute: 0 } }], weekdayDescriptions: ["Open 24 hours"] };

let n = 0;
function place(p: Partial<Place> & Pick<Place, "name">): Place {
  n++;
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    google_place_id: `sample-${n}`,
    cid: null,
    address: null,
    lat: null,
    lng: null,
    country: "United States",
    country_code: "US",
    region: "New York",
    city: "New York",
    neighborhood: null,
    primary_type: "restaurant",
    category: "Restaurant",
    cuisine: null,
    types: [],
    google_rating: null,
    google_rating_count: null,
    price_level: null,
    website: null,
    phone: null,
    maps_url: null,
    opening_hours: null,
    utc_offset_minutes: -240,
    enriched_at: null,
    ...p,
  };
}

function entry(p: Place, e: Partial<Entry> = {}): Entry {
  return { place: p, list_note: null, added_at: null, rating: null, review_text: null, reviewed_at: null, notes: null, ...e };
}

export const SAMPLE_ENTRIES: Entry[] = [
  entry(
    place({ name: "Lilia", neighborhood: "Williamsburg", category: "Italian Restaurant", cuisine: "Italian", google_rating: 4.6, google_rating_count: 3021, price_level: 3, lat: 40.7177, lng: -73.9524, address: "567 Union Ave, Brooklyn, NY 11211", opening_hours: dinner }),
    { rating: 5, review_text: "Mafaldini with pink peppercorns. Book exactly 30 days out.", notes: "Sit at the bar if you can't get a table." },
  ),
  entry(
    place({ name: "Katz's Delicatessen", neighborhood: "Lower East Side", category: "Deli", cuisine: "Deli", google_rating: 4.5, google_rating_count: 41000, price_level: 2, lat: 40.7223, lng: -73.9874, opening_hours: allDay }),
    { rating: 4, notes: "Pastrami on rye, tip the cutter." },
  ),
  entry(
    place({ name: "Russ & Daughters Cafe", neighborhood: "Lower East Side", category: "Jewish Restaurant", cuisine: "Jewish", google_rating: 4.6, google_rating_count: 2400, price_level: 2, lat: 40.7191, lng: -73.9897 }),
    { rating: 5 },
  ),
  entry(
    place({ name: "Via Carota", neighborhood: "West Village", category: "Italian Restaurant", cuisine: "Italian", google_rating: 4.5, google_rating_count: 2100, price_level: 3, lat: 40.7331, lng: -74.0035, opening_hours: dinner }),
    { list_note: "Walk-in only — go at 5pm" },
  ),
  entry(
    place({ name: "Veselka", neighborhood: "East Village", category: "Ukrainian Restaurant", cuisine: "Ukrainian", google_rating: 4.4, google_rating_count: 7600, price_level: 2, lat: 40.7290, lng: -73.9871, opening_hours: allDay }),
  ),
  entry(
    place({ name: "Superiority Burger", neighborhood: "East Village", category: "Vegetarian Restaurant", cuisine: "Vegetarian", google_rating: 4.4, google_rating_count: 900, price_level: 2, lat: 40.7266, lng: -73.9857 }),
  ),
  entry(
    place({ name: "Di Fara Pizza", neighborhood: "Midwood", category: "Pizza Restaurant", cuisine: "Pizza", google_rating: 4.3, google_rating_count: 5200, price_level: 1, lat: 40.6250, lng: -73.9615 }),
  ),
  entry(
    place({ name: "Ichiran Shibuya", country: "Japan", country_code: "JP", region: "Tokyo", city: "Shibuya", neighborhood: "Jinnan", category: "Ramen Restaurant", cuisine: "Ramen", google_rating: 4.4, google_rating_count: 21000, price_level: 1, lat: 35.6614, lng: 139.7006, utc_offset_minutes: 540, opening_hours: allDay }),
    { rating: 4, review_text: "Solo booths are a vibe." },
  ),
  entry(
    place({ name: "Fuunji", country: "Japan", country_code: "JP", region: "Tokyo", city: "Shibuya", neighborhood: "Yoyogi", category: "Ramen Restaurant", cuisine: "Ramen", google_rating: 4.5, google_rating_count: 5000, price_level: 1, lat: 35.6866, lng: 139.6985, utc_offset_minutes: 540 }),
    { notes: "Tsukemen. Line moves fast." },
  ),
  entry(
    place({ name: "Unknown place", google_place_id: null, country: null, country_code: null, region: null, city: null, category: null, utc_offset_minutes: null }),
    { rating: 3, review_text: "Imported without a location — fix me." },
  ),
];
