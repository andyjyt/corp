import { z } from "zod";
import { jsonError, parseBody } from "@/lib/api";
import { googleKey, travelTimes } from "@/lib/google/api";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

const bodySchema = z.object({
  origin: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }),
  mode: z.enum(["WALK", "DRIVE", "BICYCLE", "TRANSIT"]),
  placeIds: z.array(z.string().uuid()).min(1).max(300),
});

/**
 * Travel time from a point to places in our catalog. Open to share-link
 * viewers too; destinations are limited to catalog places so the endpoint
 * can't be used as a general routing proxy. Set API quotas in Google Cloud.
 */
export async function POST(request: Request) {
  if (!googleKey()) return jsonError("Travel times need GOOGLE_MAPS_API_KEY", 501);
  const body = await parseBody(request, bodySchema);
  if ("response" in body) return body.response;
  const { origin, mode, placeIds } = body.data;

  const supabase = await createClient();
  const { data: places, error } = await supabase
    .from("places")
    .select("id, lat, lng")
    .in("id", placeIds)
    .not("lat", "is", null)
    .not("lng", "is", null);
  if (error) return jsonError(error.message, 500);

  const located = places as { id: string; lat: number; lng: number }[];
  const durations = located.length ? await travelTimes(origin, located, mode) : [];
  const seconds: Record<string, number | null> = {};
  for (const id of placeIds) seconds[id] = null;
  located.forEach((p, i) => (seconds[p.id] = durations[i]));
  return Response.json({ seconds });
}
