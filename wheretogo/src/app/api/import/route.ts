import { z } from "zod";
import { jsonError, parseBody, requireUser } from "@/lib/api";
import { googleKey } from "@/lib/google/api";
import { mapLimit, resolveRecord, type ResolveStatus } from "@/lib/places-service";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

const recordSchema = z.object({
  name: z.string().min(1).max(300),
  nameUnknown: z.boolean().optional(),
  address: z.string().max(500).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  cid: z.string().regex(/^\d+$/).optional(),
  url: z.string().max(2000).optional(),
  note: z.string().max(5000).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  reviewText: z.string().max(10000).optional(),
  date: z.string().datetime().optional(),
});

const bodySchema = z.object({
  list: z.object({
    sourceKey: z.string().min(1).max(200),
    name: z.string().min(1).max(120),
    kind: z.enum(["reviews", "saved"]),
  }),
  records: z.array(recordSchema).max(50),
});

/**
 * Imports one batch of Takeout records into a list. The browser parses the
 * export and sends it in batches so large exports don't hit request timeouts
 * and can show progress.
 */
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  const body = await parseBody(request, bodySchema);
  if ("response" in body) return body.response;
  const { list, records } = body.data;

  // Find or create the list (as the user, so RLS applies).
  let { data: listRow } = await supabase
    .from("lists")
    .select("id")
    .eq("owner_id", user.id)
    .eq("source_key", list.sourceKey)
    .maybeSingle();
  if (!listRow) {
    const { data, error } = await supabase
      .from("lists")
      .insert({ name: list.name, kind: list.kind, source_key: list.sourceKey })
      .select("id")
      .single();
    if (error) return jsonError(error.message, 500);
    listRow = data;
  }

  const admin = createAdminClient();
  const results = await mapLimit(records, 5, async (record) => {
    try {
      return await resolveRecord(admin, record);
    } catch (err) {
      console.error("import: resolve failed", record.name, err);
      return { placeId: null, status: "failed" as const };
    }
  });

  const now = new Date().toISOString();
  const items = records
    .map((r, i) => ({ r, placeId: results[i].placeId }))
    .filter((x): x is { r: (typeof records)[number]; placeId: string } => Boolean(x.placeId));

  // Re-imports refresh Google's note but never wipe a note with nothing.
  const withNote = items.filter((x) => x.r.note);
  const withoutNote = items.filter((x) => !x.r.note);
  for (const [rows, ignoreDuplicates] of [
    [withNote, false],
    [withoutNote, true],
  ] as const) {
    if (!rows.length) continue;
    const { error } = await supabase.from("list_items").upsert(
      dedupeBy(rows, (x) => x.placeId).map(({ r, placeId }) => ({
        list_id: listRow.id,
        place_id: placeId,
        ...(r.note ? { note: r.note } : {}),
        added_at: r.date ?? now,
      })),
      { onConflict: "list_id,place_id", ignoreDuplicates },
    );
    if (error) return jsonError(error.message, 500);
  }

  if (list.kind === "reviews") {
    const reviews = dedupeBy(items, (x) => x.placeId).filter(({ r }) => r.rating || r.reviewText);
    if (reviews.length) {
      // Only the Google-sourced columns are sent, so your own notes survive re-imports.
      const { error } = await supabase.from("user_places").upsert(
        reviews.map(({ r, placeId }) => ({
          user_id: user.id,
          place_id: placeId,
          rating: r.rating ?? null,
          review_text: r.reviewText ?? null,
          reviewed_at: r.date ?? null,
        })),
        { onConflict: "user_id,place_id" },
      );
      if (error) return jsonError(error.message, 500);
    }
  }

  const counts: Partial<Record<ResolveStatus | "failed", number>> = {};
  for (const r of results) counts[r.status] = (counts[r.status] ?? 0) + 1;
  return Response.json({
    listId: listRow.id,
    counts,
    unmatched: records.filter((_, i) => results[i].status === "unresolved" || results[i].status === "failed").map((r) => r.name),
    enriched: Boolean(googleKey()),
  });
}

function dedupeBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
