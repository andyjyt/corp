// Helpers for the Google Maps URLs found in Takeout exports and Places API
// responses. Google identifies a place in a URL by its "CID" (customer id),
// either as `?cid=<decimal>` or as the second half of a `0x…:0x…` feature id.

export type MapsUrlInfo = {
  cid?: string;
  lat?: number;
  lng?: number;
  /** Place name embedded in /maps/place/<name>/ URLs. */
  name?: string;
  /** Free-text `?q=` search, usually an address (e.g. starred places with no name). */
  query?: string;
};

export function parseMapsUrl(raw: string | null | undefined): MapsUrlInfo {
  if (!raw) return {};
  const info: MapsUrlInfo = {};
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return info;
  }

  const cidParam = url.searchParams.get("cid");
  if (cidParam && /^\d+$/.test(cidParam)) info.cid = cidParam;

  if (!info.cid) {
    // e.g. /data=!4m2!3m1!1s0x89c25984d0b4a4a5:0x6f4c2a3a7b8c9d0e
    const feature = decodeURIComponent(url.pathname + url.search).match(
      /0x[0-9a-f]+:(0x[0-9a-f]+)/i,
    );
    if (feature) info.cid = BigInt(feature[1]).toString();
  }

  const path = decodeURIComponent(url.pathname);
  const q = url.searchParams.get("q")?.trim();
  const qCoords = q?.match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
  if (q && !qCoords) info.query = q;
  // !3d<lat>!4d<lng> appears in many place URLs.
  const dataCoords = path.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  // /maps/search/<lat>,<lng> or /maps/place/<lat>,<lng> for dropped pins.
  const pathCoords = path.match(
    /\/maps\/(?:search|place)\/(-?\d+(?:\.\d+)?),\s*\+?(-?\d+(?:\.\d+)?)/,
  );
  // @<lat>,<lng>,<zoom>z is the viewport centre — only a fallback.
  const viewport = path.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  const coords = dataCoords ?? pathCoords ?? qCoords ?? viewport;
  if (coords) {
    const lat = Number(coords[1]);
    const lng = Number(coords[2]);
    if (isValidCoordinate(lat, lng)) {
      info.lat = lat;
      info.lng = lng;
    }
  }

  const named = path.match(/\/maps\/place\/([^/]+)/);
  if (named && !pathCoords) {
    info.name = named[1].replace(/\+/g, " ").trim() || undefined;
  }

  return info;
}

/** True for links that point at a place on Google Maps (not web pages or other Google saves). */
export function isMapsUrl(raw: string | null | undefined): boolean {
  if (!raw) return false;
  try {
    const url = new URL(raw.trim());
    const host = url.hostname.replace(/^www\./, "");
    if (host === "maps.google.com" || host === "maps.app.goo.gl") return true;
    if (host === "goo.gl") return url.pathname.startsWith("/maps");
    return /^google\.[a-z.]+$/.test(host) && url.pathname.startsWith("/maps");
  } catch {
    return false;
  }
}

export function isValidCoordinate(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    // Takeout uses 0,0 for "no location".
    !(lat === 0 && lng === 0)
  );
}

export function mapsUrlForPlace(place: {
  google_place_id?: string | null;
  cid?: string | null;
  name: string;
  lat?: number | null;
  lng?: number | null;
}): string {
  if (place.google_place_id) {
    const q = encodeURIComponent(place.name);
    return `https://www.google.com/maps/search/?api=1&query=${q}&query_place_id=${place.google_place_id}`;
  }
  if (place.cid) return `https://maps.google.com/?cid=${place.cid}`;
  if (place.lat != null && place.lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}`;
}
