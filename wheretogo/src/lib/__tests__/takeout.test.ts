import { describe, expect, it } from "vitest";
import { parseTakeoutFiles } from "@/lib/takeout/parse";

const reviewsNew = JSON.stringify({
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [-73.9874, 40.7223] },
      properties: {
        date: "2023-05-14T18:20:11Z",
        five_star_rating_published: 5,
        google_maps_url: "http://maps.google.com/?cid=111",
        location: { address: "205 E Houston St, New York, NY", country_code: "US", name: "Katz's Delicatessen" },
        review_text_published: "Pastrami on rye. Get the pickles.",
      },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [0, 0] },
      properties: {
        five_star_rating_published: 3,
        google_maps_url: "http://maps.google.com/?cid=222",
        location: { name: "No coords cafe" },
      },
    },
  ],
});

const reviewsOld = JSON.stringify({
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [139.7, 35.66] },
      properties: {
        "Google Maps URL": "http://maps.google.com/?cid=333",
        Location: {
          Address: "Shibuya, Tokyo",
          "Business Name": "Ichiran",
          "Geo Coordinates": { Latitude: "35.66", Longitude: "139.7" },
        },
        Published: "2019-03-01T10:00:00Z",
        "Review Comment": "Solo booths!",
        "Star Rating": 4,
      },
    },
  ],
});

const wantToGo = `﻿Title,Note,URL,Tags,Comment
,,,,
"Lilia","Pasta, book 30 days out",https://www.google.com/maps/place/Lilia/data=!4m2!3m1!1s0x89c2:0x1a,,
Dropped pin,,"https://www.google.com/maps/search/40.71,-74.0",,
"Lilia","dup",https://www.google.com/maps/place/Lilia/data=!4m2!3m1!1s0x89c2:0x1a,,
`;

describe("parseTakeoutFiles", () => {
  const { lists, warnings } = parseTakeoutFiles([
    { path: "Takeout/Maps (your places)/Reviews.json", text: reviewsNew },
    { path: "Takeout/Saved/Want to go.csv", text: wantToGo },
    { path: "Takeout/Saved/Broken.csv", text: "" },
    { path: "Takeout/Maps (your places)/Saved Places.json", text: "{not json" },
  ]);

  it("puts reviews first and reports unreadable files", () => {
    expect(lists.map((l) => l.name)).toEqual(["My reviews", "Want to go"]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/Saved Places\.json/);
  });

  it("parses the current review format", () => {
    const [katz, noCoords] = lists[0].records;
    expect(katz).toMatchObject({
      name: "Katz's Delicatessen",
      cid: "111",
      lat: 40.7223,
      lng: -73.9874,
      rating: 5,
      reviewText: "Pastrami on rye. Get the pickles.",
      date: "2023-05-14T18:20:11.000Z",
    });
    expect(noCoords.lat).toBeUndefined();
    expect(noCoords.rating).toBe(3);
  });

  it("parses saved-list CSVs, skipping blanks and duplicates", () => {
    const list = lists.find((l) => l.name === "Want to go")!;
    expect(list.sourceKey).toBe("takeout:list:want to go");
    expect(list.records).toHaveLength(2);
    expect(list.records[0]).toMatchObject({ name: "Lilia", cid: "26", note: "Pasta, book 30 days out" });
    expect(list.records[1]).toMatchObject({ name: "Dropped pin", lat: 40.71, lng: -74 });
  });

  it("parses the legacy review format", () => {
    const [ichiran] = parseTakeoutFiles([{ path: "Reviews.json", text: reviewsOld }]).lists[0].records;
    expect(ichiran).toMatchObject({
      name: "Ichiran",
      address: "Shibuya, Tokyo",
      cid: "333",
      rating: 4,
      reviewText: "Solo booths!",
      lat: 35.66,
      lng: 139.7,
    });
  });
});

describe("non-place saves", () => {
  it("skips web links and search saves, and drops lists left empty", () => {
    const csv = `Title,Note,URL,Tags,Comment
,,,,
Car Rentals,,https://www.delta.com/us/en/car-rentals,,
Nimona,,https://www.google.com,,
`;
    expect(parseTakeoutFiles([{ path: "Saved for later.csv", text: csv }]).lists).toEqual([]);
  });
});

describe("entries Google exports without a location", () => {
  const starred = JSON.stringify({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [0, 0] },
        properties: {
          google_maps_url: "http://maps.google.com/?q=293+N+7th+St,+Brooklyn,+NY+11211&ftid=0x89c2:0x10",
          Comment: "No location information is available for this saved place",
        },
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [0, 0] },
        properties: {
          google_maps_url: "http://maps.google.com/?q=47.60299,-122.30497",
          Comment: "No location information is available for this saved place",
        },
      },
    ],
  });
  const reviews = JSON.stringify({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [0, 0] },
        properties: {
          five_star_rating_published: 4,
          google_maps_url: "https://www.google.com/maps/place//data=!4m2!3m1!1s0x0:0x9d331897295d9b2",
          review_text_published: "Great",
          Comment: "No location information is available for this review",
        },
      },
    ],
  });

  it("uses the ?q= address or coordinates", () => {
    const [address, pin] = parseTakeoutFiles([{ path: "Saved Places.json", text: starred }]).lists[0].records;
    expect(address).toMatchObject({ name: "293 N 7th St, Brooklyn, NY 11211", address: "293 N 7th St, Brooklyn, NY 11211", cid: "16" });
    expect(address.note).toBeUndefined();
    expect(pin).toMatchObject({ name: "Dropped pin", lat: 47.60299, lng: -122.30497 });
  });

  it("keeps id-only reviews so the rating isn't lost", () => {
    const [review] = parseTakeoutFiles([{ path: "Reviews.json", text: reviews }]).lists[0].records;
    expect(review).toMatchObject({
      name: "Unknown place",
      nameUnknown: true,
      cid: BigInt("0x9d331897295d9b2").toString(),
      rating: 4,
      reviewText: "Great",
    });
  });
});
