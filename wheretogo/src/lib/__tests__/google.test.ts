import { describe, expect, it } from "vitest";
import { areaFromComponents, cuisineFromTypes, toPlaceRecord, type GooglePlace } from "@/lib/google/derive";
import { nameSimilarity, pickCandidate } from "@/lib/google/match";

const lilia: GooglePlace = {
  id: "ChIJlilia",
  displayName: { text: "Lilia" },
  formattedAddress: "567 Union Ave, Brooklyn, NY 11211, USA",
  location: { latitude: 40.7177, longitude: -73.9524 },
  types: ["italian_restaurant", "restaurant", "food", "point_of_interest"],
  primaryType: "italian_restaurant",
  primaryTypeDisplayName: { text: "Italian Restaurant" },
  rating: 4.6,
  userRatingCount: 3021,
  priceLevel: "PRICE_LEVEL_EXPENSIVE",
  googleMapsUri: "https://maps.google.com/?cid=26",
  addressComponents: [
    { longText: "Williamsburg", shortText: "Williamsburg", types: ["neighborhood", "political"] },
    { longText: "Brooklyn", shortText: "Brooklyn", types: ["sublocality_level_1", "sublocality", "political"] },
    { longText: "New York", shortText: "New York", types: ["locality", "political"] },
    { longText: "New York", shortText: "NY", types: ["administrative_area_level_1", "political"] },
    { longText: "United States", shortText: "US", types: ["country", "political"] },
  ],
};

describe("derive", () => {
  it("builds a place record", () => {
    expect(toPlaceRecord(lilia)).toMatchObject({
      google_place_id: "ChIJlilia",
      cid: "26",
      name: "Lilia",
      country: "United States",
      country_code: "US",
      city: "New York",
      neighborhood: "Williamsburg",
      category: "Italian Restaurant",
      cuisine: "Italian",
      price_level: 3,
      google_rating: 4.6,
    });
  });

  it("derives cuisine, preferring the primary type and skipping formats", () => {
    expect(cuisineFromTypes(["japanese_restaurant", "ramen_restaurant"], "ramen_restaurant")).toBe("Ramen");
    expect(cuisineFromTypes(["fast_food_restaurant", "hamburger_restaurant"])).toBe("Burgers");
    expect(cuisineFromTypes(["restaurant", "bar"])).toBeNull();
    expect(cuisineFromTypes(["cafe"])).toBeNull();
  });

  it("falls back to postal_town for UK-style cities", () => {
    expect(
      areaFromComponents([
        { longText: "London", shortText: "London", types: ["postal_town"] },
        { longText: "United Kingdom", shortText: "GB", types: ["country"] },
      ]),
    ).toMatchObject({ city: "London", neighborhood: null, country_code: "GB" });
  });
});

describe("pickCandidate", () => {
  const other: GooglePlace = { ...lilia, id: "other", googleMapsUri: "https://maps.google.com/?cid=99", displayName: { text: "Lilia Cafe" } };

  it("matches on cid", () => {
    expect(pickCandidate({ name: "Lilia", cid: "26" }, [other, lilia])).toEqual({ place: lilia, confidence: "exact" });
  });

  it("refuses a cid-bearing record with no cid match and no location", () => {
    expect(pickCandidate({ name: "Lilia", cid: "404" }, [other, lilia])).toBeNull();
  });

  it("falls back to nearby + similar name", () => {
    const far: GooglePlace = { ...lilia, id: "far", location: { latitude: 41, longitude: -73 } };
    expect(pickCandidate({ name: "Lilia", lat: 40.7178, lng: -73.9525 }, [far, lilia])?.place.id).toBe("ChIJlilia");
    expect(pickCandidate({ name: "Lilia", lat: 40.7178, lng: -73.9525 }, [far])).toBeNull();
  });

  it("scores name similarity", () => {
    expect(nameSimilarity("Katz's Delicatessen", "Katz’s Delicatessen")).toBe(1);
    expect(nameSimilarity("The Smith", "Smith")).toBe(1);
    expect(nameSimilarity("Joe's Pizza", "Prince Street Pizza")).toBe(0.5);
  });
});
