"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function NewListButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setPending(true);
    const { data, error } = await createClient()
      .from("lists")
      .insert({ name: name.trim(), kind: "custom" })
      .select("id")
      .single();
    setPending(false);
    if (error) return setError(error.message);
    router.push(`/lists/${data.id}`);
  }

  if (!open) {
    return (
      <button className="btn" onClick={() => setOpen(true)}>
        New list
      </button>
    );
  }
  return (
    <form onSubmit={create} className="flex items-center gap-2">
      <input
        autoFocus
        className="input w-48"
        placeholder="e.g. Tokyo trip"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={120}
      />
      <button className="btn btn-primary" disabled={pending || !name.trim()}>
        Create
      </button>
      <button type="button" className="btn" onClick={() => setOpen(false)}>
        Cancel
      </button>
      {error ? <span className="text-sm text-danger">{error}</span> : null}
    </form>
  );
}
