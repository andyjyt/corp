import { z } from "zod";
import { jsonError, parseBody, requireUser } from "@/lib/api";
import { googleKey } from "@/lib/google/api";
import { placeFromGoogleId } from "@/lib/places-service";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  fromPlaceId: z.string().uuid(),
  googlePlaceId: z.string().min(1).max(300),
  sessionToken: z.string().max(100).optional(),
});

/**
 * Fixes an import that matched the wrong place (or none): points your list
 * items and notes at the place you picked. Only your own rows change; the
 * catalog entry other people may reference is left alone.
 */
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;
  if (!googleKey()) return jsonError("Fixing places needs GOOGLE_MAPS_API_KEY", 501);

  const body = await parseBody(request, bodySchema);
  if ("response" in body) return body.response;
  const { fromPlaceId, googlePlaceId, sessionToken } = body.data;

  const toPlaceId = await placeFromGoogleId(createAdminClient(), googlePlaceId, sessionToken);
  if (toPlaceId === fromPlaceId) return Response.json({ placeId: toPlaceId });

  // List items: move each one, unless the list already has the target place.
  const { data: items, error } = await supabase
    .from("list_items")
    .select("list_id, note, added_at, lists!inner(owner_id)")
    .eq("place_id", fromPlaceId)
    .eq("lists.owner_id", user.id);
  if (error) return jsonError(error.message, 500);
  if (items.length) {
    const { error: insertError } = await supabase.from("list_items").upsert(
      items.map((i) => ({ list_id: i.list_id, place_id: toPlaceId, note: i.note, added_at: i.added_at })),
      { onConflict: "list_id,place_id", ignoreDuplicates: true },
    );
    if (insertError) return jsonError(insertError.message, 500);
    const { error: deleteError } = await supabase
      .from("list_items")
      .delete()
      .eq("place_id", fromPlaceId)
      .in("list_id", items.map((i) => i.list_id));
    if (deleteError) return jsonError(deleteError.message, 500);
  }

  // Your rating/notes move too, unless you already have some on the target.
  const { data: mine } = await supabase
    .from("user_places")
    .select("rating, review_text, reviewed_at, notes")
    .eq("user_id", user.id)
    .eq("place_id", fromPlaceId)
    .maybeSingle();
  if (mine) {
    await supabase
      .from("user_places")
      .upsert({ user_id: user.id, place_id: toPlaceId, ...mine }, { onConflict: "user_id,place_id", ignoreDuplicates: true });
    await supabase.from("user_places").delete().eq("user_id", user.id).eq("place_id", fromPlaceId);
  }

  return Response.json({ placeId: toPlaceId });
}
