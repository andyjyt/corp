import { z } from "zod";
import { jsonError, parseBody, requireUser } from "@/lib/api";
import { googleKey } from "@/lib/google/api";
import { placeFromGoogleId } from "@/lib/places-service";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  listId: z.string().uuid(),
  googlePlaceId: z.string().min(1).max(300),
  sessionToken: z.string().max(100).optional(),
  note: z.string().max(5000).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  reviewText: z.string().max(10000).optional(),
  notes: z.string().max(10000).optional(),
});

/** Adds a place picked from search to one of your lists, optionally with your rating and notes. */
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;
  if (!googleKey()) return jsonError("Adding places needs GOOGLE_MAPS_API_KEY", 501);

  const body = await parseBody(request, bodySchema);
  if ("response" in body) return body.response;
  const { listId, googlePlaceId, sessionToken, note, rating, reviewText, notes } = body.data;

  // RLS makes this return nothing unless the list is yours.
  const { data: list } = await supabase.from("lists").select("id").eq("id", listId).maybeSingle();
  if (!list) return jsonError("List not found", 404);

  const placeId = await placeFromGoogleId(createAdminClient(), googlePlaceId, sessionToken);

  const { error } = await supabase
    .from("list_items")
    .upsert({ list_id: listId, place_id: placeId, note: note ?? null }, { onConflict: "list_id,place_id" });
  if (error) return jsonError(error.message, 500);

  if (rating || reviewText || notes) {
    const { error: upError } = await supabase.from("user_places").upsert(
      {
        user_id: user.id,
        place_id: placeId,
        ...(rating ? { rating, reviewed_at: new Date().toISOString() } : {}),
        ...(reviewText ? { review_text: reviewText } : {}),
        ...(notes ? { notes } : {}),
      },
      { onConflict: "user_id,place_id" },
    );
    if (upError) return jsonError(upError.message, 500);
  }

  return Response.json({ placeId });
}
