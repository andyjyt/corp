import { jsonError, requireUser } from "@/lib/api";
import { autocomplete, googleKey } from "@/lib/google/api";

export async function GET(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  if (!googleKey()) return jsonError("Place search needs GOOGLE_MAPS_API_KEY", 501);

  const url = new URL(request.url);
  const input = url.searchParams.get("q")?.trim() ?? "";
  if (input.length < 2) return Response.json({ suggestions: [] });
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const suggestions = await autocomplete({
    input: input.slice(0, 200),
    sessionToken: url.searchParams.get("session") ?? undefined,
    ...(Number.isFinite(lat) && Number.isFinite(lng) && url.searchParams.has("lat") ? { lat, lng } : {}),
  });
  return Response.json({ suggestions });
}
