import "server-only";
import { createClient, getUser } from "@/lib/supabase/server";
import type { Entry, List, Profile } from "@/lib/types";

export type ListView = {
  list: List | null;
  owner: Profile | null;
  isOwner: boolean;
  entries: Entry[];
  /** Signed-in user id when they own what's shown (needed for edits). */
  viewerId: string | null;
};

/** A list the signed-in user can see, or "all" for every place across their lists. */
export async function loadList(id: string): Promise<ListView | null | "signin"> {
  const { supabase, user } = await getUser();
  if (id === "all") {
    if (!user) return "signin";
    const { data, error } = await supabase.rpc("my_places");
    if (error) throw error;
    return { list: null, owner: null, isOwner: true, entries: data as Entry[], viewerId: user.id };
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await supabase.rpc("get_list", { p_list_id: id });
  if (error) throw error;
  if (!data) return user ? null : "signin";
  return toView(data, user?.id ?? null);
}

export async function loadSharedList(slug: string): Promise<ListView | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_list", { p_slug: slug });
  if (error) throw error;
  return data ? toView(data, null) : null;
}

function toView(
  data: { list: List; owner: Profile; is_owner: boolean; entries: Entry[] },
  userId: string | null,
): ListView {
  return {
    list: data.list,
    owner: data.owner,
    isOwner: data.is_owner,
    entries: data.entries,
    viewerId: data.is_owner ? userId : null,
  };
}
