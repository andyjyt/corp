"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { applyFilters, type Filters } from "@/lib/filters";
import { distanceMeters } from "@/lib/google/match";
import type { Entry } from "@/lib/types";

// Only the nearest places (as the crow flies) get travel times: bounds cost,
// and anything further is very unlikely to be "within X minutes".
const MAX_PLACES = 300;

export type TravelState = {
  /** Seconds by place id for the current origin + mode; undefined when no origin is set or it failed. */
  seconds: Record<string, number | null> | undefined;
  /** Places among the nearest that are still being fetched. */
  pending: Set<string>;
  loading: boolean;
  error: string | null;
};

/**
 * Fetches travel times from the filter's origin to the places that match the
 * other filters, nearest first, and only for places not already computed.
 */
export function useTravelTimes(entries: Entry[], filters: Filters): TravelState {
  const { origin, mode } = filters;
  const key = origin ? `${origin.lat},${origin.lng},${mode}` : null;
  const [cache, setCache] = useState<{ key: string | null; seconds: Record<string, number | null> }>({
    key: null,
    seconds: {},
  });
  const [error, setError] = useState<{ key: string; message: string } | null>(null);
  const inflight = useRef(new Set<string>());

  const known = useMemo(() => (cache.key === key ? cache.seconds : {}), [cache, key]);

  const missing = useMemo(() => {
    if (!origin) return [];
    const candidates = applyFilters(entries, { ...filters, maxMinutes: null, inView: false, sort: "name" });
    return candidates
      .filter((e) => e.place.lat != null && e.place.lng != null)
      .map((e) => ({ id: e.place.id, d: distanceMeters(origin.lat, origin.lng, e.place.lat!, e.place.lng!) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, MAX_PLACES)
      .map((x) => x.id)
      .filter((id) => !(id in known));
  }, [entries, filters, origin, known]);

  const failed = error != null && error.key === key;

  useEffect(() => {
    if (!key || !origin || failed) return;
    const ids = missing.filter((id) => !inflight.current.has(`${key}:${id}`));
    if (!ids.length) return;
    ids.forEach((id) => inflight.current.add(`${key}:${id}`));

    fetch("/api/travel-times", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin, mode, placeIds: ids }),
    })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
        setCache((prev) => ({
          key,
          seconds: { ...(prev.key === key ? prev.seconds : {}), ...body.seconds },
        }));
      })
      .catch((err: Error) => setError({ key, message: err.message }))
      .finally(() => ids.forEach((id) => inflight.current.delete(`${key}:${id}`)));
  }, [key, origin, mode, missing, failed]);

  const pending = useMemo(() => new Set(failed ? [] : missing), [missing, failed]);
  return {
    seconds: key && !failed ? known : undefined,
    pending,
    loading: pending.size > 0,
    error: failed ? error.message : null,
  };
}
