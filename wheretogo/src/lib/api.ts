import "server-only";
import type { z } from "zod";
import { getUser } from "@/lib/supabase/server";

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

/** Parses a JSON body against a schema, returning either the data or an error response. */
export async function parseBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<{ data: z.infer<T> } | { response: Response }> {
  const json = await request.json().catch(() => undefined);
  const result = schema.safeParse(json);
  if (!result.success) {
    return { response: jsonError(result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")) };
  }
  return { data: result.data };
}

export async function requireUser() {
  const { supabase, user } = await getUser();
  if (!user) return { response: jsonError("Sign in first", 401) } as const;
  return { supabase, user } as const;
}
