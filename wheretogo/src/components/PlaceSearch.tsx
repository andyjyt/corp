"use client";

import { useEffect, useState } from "react";

export type PickedPlace = { placeId: string; name: string; sessionToken: string };
type Suggestion = { placeId: string; main: string; secondary: string };

/** Google place autocomplete (proxied through our API so the key stays on the server). */
export function PlaceSearch({
  onPick,
  initialQuery = "",
  near,
  disabled,
  autoFocus,
}: {
  onPick: (place: PickedPlace) => void;
  initialQuery?: string;
  near?: { lat: number; lng: number };
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<{ query: string; suggestions: Suggestion[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // One session token per search → pick, which Google bills as a single session.
  const [sessionToken, setSessionToken] = useState(() => crypto.randomUUID());

  const q = query.trim();
  useEffect(() => {
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const params = new URLSearchParams({ q, session: sessionToken });
      if (near) {
        params.set("lat", String(near.lat));
        params.set("lng", String(near.lng));
      }
      try {
        const res = await fetch(`/api/places/search?${params}`, { signal: controller.signal });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Search failed");
        setError(null);
        setResults({ query: q, suggestions: body.suggestions });
      } catch (err) {
        if (!controller.signal.aborted) setError((err as Error).message);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, sessionToken, near]);

  const suggestions = q.length >= 2 && results ? results.suggestions : [];

  return (
    <div className="relative">
      <input
        className="input"
        placeholder="Search Google Maps for a place…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={disabled}
        autoFocus={autoFocus}
      />
      {suggestions.length ? (
        <ul className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-line bg-surface p-1 shadow-lg">
          {suggestions.map((s) => (
            <li key={s.placeId}>
              <button
                type="button"
                className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-2"
                onClick={() => {
                  onPick({ placeId: s.placeId, name: s.main, sessionToken });
                  setSessionToken(crypto.randomUUID());
                  setQuery("");
                }}
              >
                <span className="font-medium">{s.main}</span>
                <span className="block truncate text-xs text-muted">{s.secondary}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
