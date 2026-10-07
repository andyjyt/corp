import "server-only";
import type { GooglePlace } from "./derive";
import type { TravelMode } from "@/lib/types";

// Everything we store about a place. Rating, price and hours put requests in
// the Places "Enterprise" SKU; see README for costs.
const PLACE_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "types",
  "primaryType",
  "primaryTypeDisplayName",
  "rating",
  "userRatingCount",
  "priceLevel",
  "googleMapsUri",
  "websiteUri",
  "nationalPhoneNumber",
  "addressComponents",
  "regularOpeningHours",
  "utcOffsetMinutes",
];

export function googleKey(): string | null {
  return process.env.GOOGLE_MAPS_API_KEY || null;
}

export class GoogleApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function call<T>(url: string, init: RequestInit & { fieldMask: string }): Promise<T> {
  const key = googleKey();
  if (!key) throw new GoogleApiError("GOOGLE_MAPS_API_KEY is not set", 500);
  const { fieldMask, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": fieldMask,
      ...rest.headers,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new GoogleApiError(`Google API ${res.status}: ${body.slice(0, 300)}`, res.status);
  }
  return res.json() as Promise<T>;
}

export async function searchText(params: {
  query: string;
  lat?: number;
  lng?: number;
  radiusMeters?: number;
  pageSize?: number;
}): Promise<GooglePlace[]> {
  const body: Record<string, unknown> = {
    textQuery: params.query,
    pageSize: params.pageSize ?? 10,
  };
  if (params.lat != null && params.lng != null) {
    body.locationBias = {
      circle: {
        center: { latitude: params.lat, longitude: params.lng },
        radius: params.radiusMeters ?? 500,
      },
    };
  }
  const data = await call<{ places?: GooglePlace[] }>(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      body: JSON.stringify(body),
      fieldMask: PLACE_FIELDS.map((f) => `places.${f}`).join(","),
    },
  );
  return data.places ?? [];
}

export async function getPlaceDetails(placeId: string, sessionToken?: string): Promise<GooglePlace> {
  const qs = sessionToken ? `?sessionToken=${encodeURIComponent(sessionToken)}` : "";
  return call<GooglePlace>(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}${qs}`, {
    method: "GET",
    fieldMask: PLACE_FIELDS.join(","),
  });
}

export type Suggestion = { placeId: string; main: string; secondary: string };

export async function autocomplete(params: {
  input: string;
  sessionToken?: string;
  lat?: number;
  lng?: number;
}): Promise<Suggestion[]> {
  const body: Record<string, unknown> = { input: params.input };
  if (params.sessionToken) body.sessionToken = params.sessionToken;
  if (params.lat != null && params.lng != null) {
    body.locationBias = {
      circle: { center: { latitude: params.lat, longitude: params.lng }, radius: 20000 },
    };
  }
  type Res = {
    suggestions?: {
      placePrediction?: {
        placeId: string;
        structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } };
        text?: { text: string };
      };
    }[];
  };
  const data = await call<Res>("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    body: JSON.stringify(body),
    fieldMask:
      "suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.text",
  });
  return (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => ({
      placeId: p.placeId,
      main: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
      secondary: p.structuredFormat?.secondaryText?.text ?? "",
    }));
}

/**
 * Travel time in seconds from one origin to each destination (null when
 * there's no route). Batches requests to stay under the matrix size limits.
 */
export async function travelTimes(
  origin: { lat: number; lng: number },
  destinations: { lat: number; lng: number }[],
  mode: TravelMode,
): Promise<(number | null)[]> {
  const batchSize = mode === "TRANSIT" ? 100 : 500;
  const out: (number | null)[] = new Array(destinations.length).fill(null);
  const waypoint = (p: { lat: number; lng: number }) => ({
    waypoint: { location: { latLng: { latitude: p.lat, longitude: p.lng } } },
  });

  for (let start = 0; start < destinations.length; start += batchSize) {
    const batch = destinations.slice(start, start + batchSize);
    const body: Record<string, unknown> = {
      origins: [waypoint(origin)],
      destinations: batch.map(waypoint),
      travelMode: mode,
    };
    if (mode === "DRIVE") body.routingPreference = "TRAFFIC_AWARE";
    type Element = { destinationIndex?: number; duration?: string; condition?: string };
    const rows = await call<Element[]>(
      "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
      {
        method: "POST",
        body: JSON.stringify(body),
        fieldMask: "destinationIndex,duration,condition",
      },
    );
    for (const row of rows) {
      if (row.destinationIndex == null || row.condition !== "ROUTE_EXISTS" || !row.duration) continue;
      out[start + row.destinationIndex] = Number.parseInt(row.duration, 10);
    }
  }
  return out;
}
