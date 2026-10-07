"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Popover } from "@/components/Popover";
import { createClient } from "@/lib/supabase/client";
import type { List } from "@/lib/types";

export function ListMenu({ list }: { list: List }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function rename() {
    const name = prompt("Rename list", list.name)?.trim();
    if (!name || name === list.name) return;
    const { error } = await createClient().from("lists").update({ name }).eq("id", list.id);
    if (error) return setError(error.message);
    router.refresh();
  }

  async function remove() {
    const reimport = list.source_key ? " Re-importing from Google will bring it back." : "";
    if (!confirm(`Delete “${list.name}”? Your ratings and notes on its places are kept.${reimport}`)) return;
    const { error } = await createClient().from("lists").delete().eq("id", list.id);
    if (error) return setError(error.message);
    router.push("/lists");
    router.refresh();
  }

  return (
    <Popover label="⋯" className="btn" align="right">
      <button className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-2" onClick={rename}>
        Rename
      </button>
      <button className="w-full rounded-md px-2 py-1.5 text-left text-sm text-danger hover:bg-surface-2" onClick={remove}>
        Delete list
      </button>
      {error ? <p className="px-2 text-xs text-danger">{error}</p> : null}
    </Popover>
  );
}
