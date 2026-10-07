"use client";

import { useState } from "react";
import { PlaceSearch, type PickedPlace } from "@/components/PlaceSearch";
import { StarInput } from "@/components/StarInput";
import { GoogleRating, Price, Stars } from "@/components/Stars";
import { mapsUrlForPlace } from "@/lib/google/maps-url";
import { isOpenAt } from "@/lib/hours";
import type { Entry } from "@/lib/types";
import type { EntryEdit } from "./PlaceBrowser";

type Props = {
  entry: Entry;
  editable: boolean;
  inList: boolean;
  onEdit: (edit: EntryEdit) => void;
  onRemove: () => void;
  onResolved: () => void;
};

export function PlaceDetails({ entry: e, editable, inList, onEdit, onRemove, onResolved }: Props) {
  const p = e.place;
  const open = isOpenAt(p.opening_hours, p.utc_offset_minutes);
  const today = new Date().getDay(); // weekdayDescriptions start on Monday
  const hours = p.opening_hours?.weekdayDescriptions;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-2 text-sm">
        {!p.google_place_id && editable ? <FixMatch entry={e} onResolved={onResolved} /> : null}
        <p className="text-muted">
          {[p.category, p.cuisine && p.category && !p.category.startsWith(p.cuisine) ? p.cuisine : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {p.address ? <p>{p.address}</p> : null}
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <GoogleRating rating={p.google_rating} count={p.google_rating_count} />
          <Price level={p.price_level} />
          {open != null ? (
            <span className={open ? "text-emerald-600 dark:text-emerald-400" : "text-muted"}>{open ? "Open now" : "Closed now"}</span>
          ) : null}
        </p>
        {hours?.length ? (
          <details className="text-muted">
            <summary className="cursor-pointer">Hours</summary>
            <ul className="mt-1 space-y-0.5">
              {hours.map((h, i) => (
                <li key={h} className={(i + 1) % 7 === today ? "font-medium text-ink" : ""}>
                  {h}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        <p className="flex flex-wrap gap-2 pt-1">
          <a className="btn" href={p.maps_url ?? mapsUrlForPlace(p)} target="_blank" rel="noreferrer">
            Open in Google Maps ↗
          </a>
          {p.website ? (
            <a className="btn" href={p.website} target="_blank" rel="noreferrer">
              Website ↗
            </a>
          ) : null}
          {p.phone ? (
            <a className="btn" href={`tel:${p.phone}`}>
              {p.phone}
            </a>
          ) : null}
        </p>
      </div>

      <div className="space-y-3 text-sm">
        {editable ? (
          <EditablePanel entry={e} inList={inList} onEdit={onEdit} onRemove={onRemove} />
        ) : (
          <ReadOnlyPanel entry={e} />
        )}
      </div>
    </div>
  );
}

function ReadOnlyPanel({ entry: e }: { entry: Entry }) {
  if (!e.rating && !e.review_text && !e.notes && !e.list_note) {
    return <p className="text-muted">No notes on this one.</p>;
  }
  return (
    <>
      {e.rating ? (
        <p>
          <Stars value={e.rating} size="md" />
        </p>
      ) : null}
      {e.review_text ? <p className="whitespace-pre-line">{e.review_text}</p> : null}
      {e.list_note ? <p className="whitespace-pre-line text-muted">{e.list_note}</p> : null}
      {e.notes ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Notes</p>
          <p className="whitespace-pre-line">{e.notes}</p>
        </div>
      ) : null}
    </>
  );
}

function EditablePanel({
  entry: e,
  inList,
  onEdit,
  onRemove,
}: {
  entry: Entry;
  inList: boolean;
  onEdit: (edit: EntryEdit) => void;
  onRemove: () => void;
}) {
  return (
    <>
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">My rating</span>
        <StarInput value={e.rating} onChange={(rating) => onEdit({ rating })} />
      </div>
      {e.review_text ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">My Google review</p>
          <p className="whitespace-pre-line">{e.review_text}</p>
        </div>
      ) : null}
      <NoteField
        label="My notes"
        hint="Shown wherever this place appears in your shared lists"
        value={e.notes}
        onSave={(notes) => onEdit({ notes })}
      />
      {inList ? (
        <NoteField label="Note in this list" value={e.list_note} onSave={(list_note) => onEdit({ list_note })} />
      ) : null}
      {e.lists?.length ? <p className="text-muted">In: {e.lists.map((l) => l.name).join(", ")}</p> : null}
      {inList ? (
        <button
          className="text-sm text-danger hover:underline"
          onClick={() => {
            if (confirm(`Remove ${e.place.name} from this list?`)) onRemove();
          }}
        >
          Remove from list
        </button>
      ) : null}
    </>
  );
}

function NoteField({
  label,
  hint,
  value,
  onSave,
}: {
  label: string;
  hint?: string;
  value: string | null;
  onSave: (v: string | null) => void;
}) {
  const [draft, setDraft] = useState(value ?? "");
  const dirty = draft !== (value ?? "");
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      <textarea
        className="input mt-1 min-h-20 resize-y"
        value={draft}
        placeholder={hint ?? "Add a note…"}
        onChange={(ev) => setDraft(ev.target.value)}
        onBlur={() => dirty && onSave(draft.trim() || null)}
        maxLength={10000}
      />
      {dirty ? <span className="text-xs text-muted">Saves when you click away</span> : null}
    </label>
  );
}

function FixMatch({ entry, onResolved }: { entry: Entry; onResolved: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function resolve(picked: PickedPlace) {
    setPending(true);
    setError(null);
    const res = await fetch("/api/places/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromPlaceId: entry.place.id,
        googlePlaceId: picked.placeId,
        sessionToken: picked.sessionToken,
      }),
    });
    setPending(false);
    if (!res.ok) return setError((await res.json()).error ?? "Couldn't update");
    onResolved();
  }

  return (
    <div className="rounded-lg border border-line bg-surface-2 p-3">
      <p className="font-medium">We couldn&apos;t match this to a Google place.</p>
      <p className="mt-0.5 text-muted">Search for it to pull in its details. Your rating and notes carry over.</p>
      <div className="mt-2">
        <PlaceSearch
          initialQuery={entry.place.name === "Unknown place" ? "" : entry.place.name}
          near={entry.place.lat != null && entry.place.lng != null ? { lat: entry.place.lat, lng: entry.place.lng } : undefined}
          onPick={resolve}
          disabled={pending}
        />
      </div>
      {error ? <p className="mt-1 text-danger">{error}</p> : null}
    </div>
  );
}
