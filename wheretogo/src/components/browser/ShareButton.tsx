"use client";

import { useState } from "react";
import { Popover } from "@/components/Popover";
import { createClient } from "@/lib/supabase/client";
import type { List, Visibility } from "@/lib/types";

const OPTIONS: { value: Visibility; label: string; hint: string }[] = [
  { value: "private", label: "Private", hint: "Only you" },
  { value: "unlisted", label: "Anyone with the link", hint: "Not listed anywhere" },
  { value: "public", label: "Public", hint: "Anyone, and may be shown on your profile later" },
];

export function ShareButton({ list }: { list: List }) {
  const [visibility, setVisibility] = useState(list.visibility);
  const [withFilters, setWithFilters] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function changeVisibility(v: Visibility) {
    const previous = visibility;
    setVisibility(v);
    const { error } = await createClient().from("lists").update({ visibility: v }).eq("id", list.id);
    if (error) {
      setVisibility(previous);
      setError(error.message);
    }
  }

  function link() {
    const search = withFilters ? window.location.search : "";
    return `${window.location.origin}/s/${list.share_slug}${search}`;
  }

  async function copy() {
    await navigator.clipboard.writeText(link());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Popover label="Share" className="btn" active={visibility !== "private"} align="right">
      <div className="w-80 space-y-3 p-1 text-sm">
        <div className="space-y-1">
          {OPTIONS.map((o) => (
            <label key={o.value} className="flex cursor-pointer items-start gap-2 rounded-md p-1.5 hover:bg-surface-2">
              <input
                type="radio"
                name="visibility"
                className="mt-1 accent-[var(--accent)]"
                checked={visibility === o.value}
                onChange={() => changeVisibility(o.value)}
              />
              <span>
                <span className="font-medium">{o.label}</span>
                <span className="block text-xs text-muted">{o.hint}</span>
              </span>
            </label>
          ))}
        </div>
        {visibility !== "private" ? (
          <>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="accent-[var(--accent)]"
                checked={withFilters}
                onChange={(e) => setWithFilters(e.target.checked)}
              />
              Include current filters (area, cuisine, travel time…)
            </label>
            <button className="btn btn-primary w-full" onClick={copy}>
              {copied ? "Copied!" : "Copy link"}
            </button>
            <p className="text-xs text-muted">
              People with the link see your ratings, reviews and notes for places in this list.
            </p>
          </>
        ) : null}
        {error ? <p className="text-xs text-danger">{error}</p> : null}
      </div>
    </Popover>
  );
}
