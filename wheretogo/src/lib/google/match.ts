// Picks which Places API search result corresponds to an imported record.
// Takeout CSVs only carry a name and a CID, so the CID match is what makes
// resolution reliable; coordinates + name similarity is the fallback.

import { cidFromMapsUri, type GooglePlace } from "@/lib/google/derive";

export type MatchConfidence = "exact" | "nearby" | "name";

export type MatchInput = { name: string; cid?: string; lat?: number; lng?: number };

export function pickCandidate(
  record: MatchInput,
  candidates: GooglePlace[],
): { place: GooglePlace; confidence: MatchConfidence } | null {
  if (record.cid) {
    const exact = candidates.find((c) => cidFromMapsUri(c.googleMapsUri) === record.cid);
    if (exact) return { place: exact, confidence: "exact" };
  }

  if (record.lat != null && record.lng != null) {
    let best: { place: GooglePlace; distance: number } | null = null;
    for (const c of candidates) {
      if (!c.location) continue;
      const distance = distanceMeters(record.lat, record.lng, c.location.latitude, c.location.longitude);
      const similar = nameSimilarity(record.name, c.displayName?.text ?? "") >= 0.5;
      if (distance <= 250 && similar && (!best || distance < best.distance)) {
        best = { place: c, distance };
      }
    }
    if (best) return { place: best.place, confidence: "nearby" };
    return null;
  }

  // Without a CID match or a location, only accept a near-identical name
  // when the record had no CID to check against.
  if (!record.cid) {
    const named = candidates.find((c) => nameSimilarity(record.name, c.displayName?.text ?? "") >= 0.9);
    if (named) return { place: named, confidence: "name" };
  }
  return null;
}

export function normalizeName(name: string): string[] {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter((t) => t && t !== "the");
}

/** Token overlap relative to the shorter name: 1 when one name contains the other. */
export function nameSimilarity(a: string, b: string): number {
  const ta = new Set(normalizeName(a));
  const tb = new Set(normalizeName(b));
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / Math.min(ta.size, tb.size);
}

export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
