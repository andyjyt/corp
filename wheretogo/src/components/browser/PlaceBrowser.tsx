"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  applyFilters,
  buildFacets,
  DEFAULT_FILTERS,
  filtersFromSearchParams,
  filtersToSearchParams,
  type Bounds,
  type Filters,
} from "@/lib/filters";
import { createClient } from "@/lib/supabase/client";
import type { Entry, List } from "@/lib/types";
import { AddPlaceButton } from "./AddPlaceButton";
import { FilterBar } from "./FilterBar";
import { ListMenu } from "./ListMenu";
import { PlacesMap } from "./PlacesMap";
import { PlaceTable } from "./PlaceTable";
import { ShareButton } from "./ShareButton";
import { useTravelTimes } from "./useTravelTimes";

export type EntryEdit = {
  rating?: number | null;
  notes?: string | null;
  list_note?: string | null;
};

type Props = {
  title: string;
  list: List | null;
  entries: Entry[];
  ownerName: string | null;
  /** Set when the signed-in user owns what's shown; enables editing. */
  viewerId: string | null;
  shared?: boolean;
};

export function PlaceBrowser({ title, list, entries: initialEntries, ownerName, viewerId, shared }: Props) {
  const router = useRouter();
  const editable = viewerId != null;

  // Entries are edited optimistically; a server refresh replaces them.
  const [entries, setEntries] = useState(initialEntries);
  const [prevInitial, setPrevInitial] = useState(initialEntries);
  if (initialEntries !== prevInitial) {
    setPrevInitial(initialEntries);
    setEntries(initialEntries);
  }

  const latestBounds = useRef<Bounds | null>(null);

  // Filters live in the URL so any filtered view can be shared as a link.
  // replaceState updates useSearchParams without a server round trip.
  const searchParams = useSearchParams();
  const filters = useMemo(
    () => filtersFromSearchParams(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );
  const setFilters = useCallback(
    (patch: Partial<Filters>) => {
      const next = { ...filters, ...patch };
      if (patch.inView && !next.bounds) next.bounds = latestBounds.current;
      const qs = filtersToSearchParams(next).toString();
      window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
    },
    [filters],
  );
  const resetFilters = useCallback(() => setFilters({ ...DEFAULT_FILTERS, sort: filters.sort, desc: filters.desc }), [
    filters.sort,
    filters.desc,
    setFilters,
  ]);

  const onBoundsChange = useCallback(
    (bounds: Bounds) => {
      latestBounds.current = bounds;
      if (filters.inView) setFilters({ bounds });
    },
    [filters.inView, setFilters],
  );

  const [onlyUnmatched, setOnlyUnmatched] = useState(false);
  const unmatchedCount = useMemo(() => entries.filter((e) => !e.place.google_place_id).length, [entries]);

  const travel = useTravelTimes(entries, filters);

  const filtered = useMemo(() => {
    const result = applyFilters(entries, filters, { travelSeconds: travel.seconds, travelPending: travel.pending });
    return onlyUnmatched ? result.filter((e) => !e.place.google_place_id) : result;
  }, [entries, filters, travel.seconds, travel.pending, onlyUnmatched]);
  const facets = useMemo(() => buildFacets(entries, filters), [entries, filters]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickingOrigin, setPickingOrigin] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "map">("list");

  const selectFromMap = useCallback((id: string) => {
    setSelectedId(id);
    setMobileView("list");
    requestAnimationFrame(() =>
      document.getElementById(`row-${id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
    );
  }, []);

  const [saveError, setSaveError] = useState<string | null>(null);
  const editEntry = useCallback(
    async (placeId: string, edit: EntryEdit) => {
      if (!viewerId) return;
      setEntries((prev) => prev.map((e) => (e.place.id === placeId ? { ...e, ...edit } : e)));
      const supabase = createClient();
      setSaveError(null);
      const { list_note, ...mine } = edit;
      if (Object.keys(mine).length) {
        const { error } = await supabase
          .from("user_places")
          .upsert({ user_id: viewerId, place_id: placeId, ...mine }, { onConflict: "user_id,place_id" });
        if (error) setSaveError(error.message);
      }
      if (list_note !== undefined && list) {
        const { error } = await supabase
          .from("list_items")
          .update({ note: list_note })
          .eq("list_id", list.id)
          .eq("place_id", placeId);
        if (error) setSaveError(error.message);
      }
    },
    [viewerId, list],
  );

  const removeEntry = useCallback(
    async (placeId: string) => {
      if (!list) return;
      setEntries((prev) => prev.filter((e) => e.place.id !== placeId));
      const { error } = await createClient()
        .from("list_items")
        .delete()
        .eq("list_id", list.id)
        .eq("place_id", placeId);
      if (error) setSaveError(error.message);
    },
    [list],
  );

  const hasMyRatings = useMemo(() => entries.some((e) => e.rating != null), [entries]);

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <div className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-4 pb-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted">
              {filtered.length === entries.length
                ? `${entries.length} place${entries.length === 1 ? "" : "s"}`
                : `${filtered.length} of ${entries.length} places`}
              {shared && ownerName ? ` · shared by ${ownerName}` : null}
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {editable && unmatchedCount > 0 ? (
              <button
                className={`chip ${onlyUnmatched ? "chip-on" : ""}`}
                onClick={() => setOnlyUnmatched((v) => !v)}
                title="Places we couldn't match to Google — open one to fix it"
              >
                ⚠ {unmatchedCount} unmatched
              </button>
            ) : null}
            {editable && list ? <AddPlaceButton listId={list.id} onAdded={() => router.refresh()} /> : null}
            {editable && list ? <ShareButton list={list} /> : null}
            {editable && list ? <ListMenu list={list} /> : null}
          </div>
        </div>
        <FilterBar
          filters={filters}
          setFilters={setFilters}
          resetFilters={resetFilters}
          facets={facets}
          showMyRating={hasMyRatings}
          travel={travel}
          pickingOrigin={pickingOrigin}
          setPickingOrigin={setPickingOrigin}
        />
        {saveError ? <p className="px-4 pb-2 text-sm text-danger">Couldn&apos;t save: {saveError}</p> : null}
      </div>

      <div className="flex border-b border-line bg-surface lg:hidden">
        {(["list", "map"] as const).map((v) => (
          <button
            key={v}
            className={`flex-1 py-2 text-sm font-medium capitalize ${mobileView === v ? "border-b-2 border-accent text-accent" : "text-muted"}`}
            onClick={() => setMobileView(v)}
          >
            {v}
          </button>
        ))}
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1">
        <div className={`min-w-0 flex-1 overflow-auto lg:block ${mobileView === "list" ? "block" : "hidden"}`}>
          <PlaceTable
            entries={filtered}
            filters={filters}
            setFilters={setFilters}
            selectedId={selectedId}
            onSelect={setSelectedId}
            travelSeconds={travel.seconds}
            showMyRating={hasMyRatings}
            showLists={!list}
            editable={editable}
            inList={Boolean(list)}
            onEdit={editEntry}
            onRemove={removeEntry}
            onResolved={() => router.refresh()}
            emptyAction={
              entries.length > 0 ? (
                <button className="btn mt-3" onClick={resetFilters}>
                  Clear filters
                </button>
              ) : null
            }
          />
        </div>
        <div
          className={`relative border-l border-line lg:block lg:w-[42%] lg:shrink-0 ${mobileView === "map" ? "block flex-1" : "hidden"}`}
        >
          <PlacesMap
            entries={filtered}
            allEntries={entries}
            selectedId={selectedId}
            onSelect={selectFromMap}
            onBoundsChange={onBoundsChange}
            fitKey={[filters.country, filters.city, filters.neighborhoods.join(), filters.cuisines.join()].join("|")}
            autoFit={!filters.inView}
            origin={filters.origin}
            pickingOrigin={pickingOrigin}
            onPickOrigin={(origin) => {
              setPickingOrigin(false);
              setFilters({ origin, maxMinutes: filters.maxMinutes ?? 15 });
            }}
          />
        </div>
      </div>
    </div>
  );
}
