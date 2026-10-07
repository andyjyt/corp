"use client";

import { useState } from "react";
import { PlaceSearch, type PickedPlace } from "@/components/PlaceSearch";
import { StarInput } from "@/components/StarInput";

/** Search Google for a place and add it to the list with an optional rating and notes. */
export function AddPlaceButton({ listId, onAdded }: { listId: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<PickedPlace | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setPicked(null);
    setRating(null);
    setNotes("");
    setError(null);
  }

  async function add() {
    if (!picked) return;
    setPending(true);
    setError(null);
    const res = await fetch("/api/places/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listId,
        googlePlaceId: picked.placeId,
        sessionToken: picked.sessionToken,
        ...(rating ? { rating } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      }),
    });
    setPending(false);
    if (!res.ok) return setError((await res.json()).error ?? "Couldn't add the place");
    close();
    onAdded();
  }

  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>
        + Add place
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-start bg-black/30 p-4 pt-24" onClick={close}>
          <div
            className="card mx-auto w-full max-w-md p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Add a place"
          >
            <h2 className="font-semibold">Add a place</h2>
            {picked ? (
              <div className="mt-3 space-y-3 text-sm">
                <p className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
                  <span className="font-medium">{picked.name}</span>
                  <button className="text-muted hover:underline" onClick={() => setPicked(null)}>
                    Change
                  </button>
                </p>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted">My rating</span>
                  <StarInput value={rating} onChange={setRating} />
                </div>
                <textarea
                  className="input min-h-20"
                  placeholder="Notes (what to order, who it's good for…)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            ) : (
              <div className="mt-3">
                <PlaceSearch onPick={setPicked} autoFocus />
              </div>
            )}
            {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn" onClick={close}>
                Cancel
              </button>
              <button className="btn btn-primary" disabled={!picked || pending} onClick={add}>
                {pending ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
