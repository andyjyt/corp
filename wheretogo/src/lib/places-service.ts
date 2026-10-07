import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPlaceDetails, GoogleApiError, googleKey, searchText } from "@/lib/google/api";
import { toPlaceRecord, type PlaceRecord } from "@/lib/google/derive";
import { pickCandidate } from "@/lib/google/match";
import type { ImportRecord } from "@/lib/takeout/parse";

export type ResolveStatus =
  | "exact" // matched by Google's place id (CID)
  | "nearby" // matched by location + similar name
  | "name" // matched by name only
  | "cached" // already in our catalog
  | "unresolved" // looked up, no confident match — saved with what we know
  | "unenriched"; // no Google API key — saved with what we know

const FRESH_MS = 30 * 24 * 60 * 60 * 1000;

/** Finds or creates the catalog place for an imported record. Uses the admin client. */
export async function resolveRecord(
  admin: SupabaseClient,
  record: ImportRecord,
): Promise<{ placeId: string; status: ResolveStatus }> {
  if (record.cid) {
    const { data } = await admin
      .from("places")
      .select("id, enriched_at")
      .eq("cid", record.cid)
      .maybeSingle();
    if (data && (data.enriched_at || !googleKey())) return { placeId: data.id, status: "cached" };
  }

  // Nothing to search for when Google exported only an id.
  if (googleKey() && !record.nameUnknown) {
    const query =
      record.address && record.address !== record.name ? `${record.name}, ${record.address}` : record.name;
    try {
      const candidates = await searchText({ query, lat: record.lat, lng: record.lng });
      const match = pickCandidate(record, candidates);
      if (match) {
        const placeId = await savePlace(admin, toPlaceRecord(match.place), record.cid);
        return { placeId, status: match.confidence };
      }
    } catch (err) {
      // Bad key, quota, outage: keep the record anyway. A re-import retries
      // the lookup because the saved row has no enriched_at.
      if (!(err instanceof GoogleApiError)) throw err;
      console.error("places lookup failed", err.message);
    }
  }

  const placeId = await saveBarePlace(admin, record);
  return { placeId, status: googleKey() ? "unresolved" : "unenriched" };
}

/** Finds or fetches a place by Google place id (from search / autocomplete). */
export async function placeFromGoogleId(
  admin: SupabaseClient,
  googlePlaceId: string,
  sessionToken?: string,
): Promise<string> {
  const { data } = await admin
    .from("places")
    .select("id, enriched_at")
    .eq("google_place_id", googlePlaceId)
    .maybeSingle();
  if (data?.enriched_at && Date.now() - new Date(data.enriched_at).getTime() < FRESH_MS) {
    return data.id;
  }
  const details = await getPlaceDetails(googlePlaceId, sessionToken);
  return savePlace(admin, toPlaceRecord(details));
}

/**
 * Upserts a Google-sourced place. Prefers an existing row with the same
 * Google id, then one with the same CID (e.g. a previously unresolved import).
 */
async function savePlace(admin: SupabaseClient, rec: PlaceRecord, knownCid?: string): Promise<string> {
  const cid = rec.cid ?? knownCid ?? null;
  const row = { ...rec, cid };

  for (let attempt = 0; attempt < 3; attempt++) {
    const existing = await findExisting(admin, rec.google_place_id, cid);
    if (existing) {
      const { error } = await admin.from("places").update(row).eq("id", existing);
      if (!error) return existing;
      if (error.code !== "23505") throw error;
      // The CID belongs to a different row; keep that row's claim on it.
      const { error: retry } = await admin.from("places").update({ ...row, cid: undefined }).eq("id", existing);
      if (retry) throw retry;
      return existing;
    }
    const { data, error } = await admin.from("places").insert(row).select("id").single();
    if (!error) return data.id;
    // Another request inserted it concurrently; loop to update that row.
    if (error.code !== "23505") throw error;
  }
  throw new Error(`Couldn't save place ${rec.name}`);
}

async function findExisting(
  admin: SupabaseClient,
  googlePlaceId: string | null,
  cid: string | null,
): Promise<string | null> {
  if (googlePlaceId) {
    const { data } = await admin.from("places").select("id").eq("google_place_id", googlePlaceId).maybeSingle();
    if (data) return data.id;
  }
  if (cid) {
    const { data } = await admin.from("places").select("id").eq("cid", cid).maybeSingle();
    if (data) return data.id;
  }
  return null;
}

/** Saves an import record we couldn't match, so it still shows up (and can be fixed later). */
async function saveBarePlace(admin: SupabaseClient, record: ImportRecord): Promise<string> {
  const row = {
    name: record.name,
    address: record.address ?? null,
    lat: record.lat ?? null,
    lng: record.lng ?? null,
    cid: record.cid ?? null,
  };
  if (row.cid) {
    const { data, error } = await admin
      .from("places")
      .upsert(row, { onConflict: "cid", ignoreDuplicates: true })
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (data) return data.id;
    const { data: existing, error: lookupError } = await admin
      .from("places")
      .select("id")
      .eq("cid", row.cid)
      .single();
    if (lookupError) throw lookupError;
    return existing.id;
  }
  const { data, error } = await admin.from("places").insert(row).select("id").single();
  if (error) throw error;
  return data.id;
}

/** Runs `fn` over `items` with at most `limit` in flight. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
