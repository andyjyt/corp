"use client";

import { Fragment, type ReactNode } from "react";
import { formatMinutes, GoogleRating, Price, Stars } from "@/components/Stars";
import type { Filters, SortKey } from "@/lib/filters";
import { isOpenAt } from "@/lib/hours";
import type { Entry } from "@/lib/types";
import type { EntryEdit } from "./PlaceBrowser";
import { PlaceDetails } from "./PlaceDetails";

type Props = {
  entries: Entry[];
  filters: Filters;
  setFilters: (patch: Partial<Filters>) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  travelSeconds: Record<string, number | null> | undefined;
  showMyRating: boolean;
  showLists: boolean;
  editable: boolean;
  inList: boolean;
  onEdit: (placeId: string, edit: EntryEdit) => void;
  onRemove: (placeId: string) => void;
  onResolved: () => void;
  emptyAction: ReactNode;
};

export function PlaceTable(props: Props) {
  const { entries, filters, setFilters, selectedId, onSelect, travelSeconds, showMyRating, showLists } = props;
  const now = new Date();

  const sortBy = (key: SortKey) =>
    setFilters(filters.sort === key ? { desc: !filters.desc } : { sort: key, desc: false });

  const columns = 6 + (showMyRating ? 1 : 0) + (travelSeconds ? 1 : 0);

  if (!entries.length) {
    return (
      <div className="p-10 text-center text-sm text-muted">
        <p>No places match.</p>
        {props.emptyAction}
      </div>
    );
  }

  return (
    <table className="w-full border-separate border-spacing-0 text-sm">
      <thead className="sticky top-0 z-10 bg-surface-2 text-left text-xs font-medium text-muted">
        <tr>
          <Th label="Place" sortKey="name" filters={filters} onSort={sortBy} className="pl-4" />
          <th className="hidden border-b border-line px-2 py-2 font-medium sm:table-cell">Cuisine / type</th>
          <th className="hidden border-b border-line px-2 py-2 font-medium md:table-cell">Area</th>
          <Th label="Google" sortKey="google_rating" filters={filters} onSort={sortBy} />
          {showMyRating ? <Th label="Mine" sortKey="rating" filters={filters} onSort={sortBy} /> : null}
          <Th label="Price" sortKey="price" filters={filters} onSort={sortBy} className="hidden sm:table-cell" />
          {travelSeconds ? <Th label="Travel" sortKey="travel" filters={filters} onSort={sortBy} /> : null}
          <th className="hidden border-b border-line px-2 py-2 pr-4 font-medium xl:table-cell">Notes</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => {
          const p = e.place;
          const selected = selectedId === p.id;
          const open = isOpenAt(p.opening_hours, p.utc_offset_minutes, now);
          const note = e.notes || e.list_note || e.review_text;
          return (
            <Fragment key={p.id}>
              <tr
                id={`row-${p.id}`}
                className={`cursor-pointer ${selected ? "bg-accent-soft" : "hover:bg-surface-2"}`}
                onClick={() => onSelect(selected ? null : p.id)}
                aria-expanded={selected}
              >
                <td className="border-b border-line py-2 pr-2 pl-4 align-top">
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${open === true ? "bg-emerald-500" : open === false ? "bg-line" : "bg-transparent"}`}
                      title={open === true ? "Open now" : open === false ? "Closed now" : undefined}
                    />
                    <div className="min-w-0">
                      <p className="font-medium leading-snug">
                        {p.name}
                        {!p.google_place_id ? (
                          <span className="ml-1 text-xs text-danger" title="Not matched to a Google place">
                            ⚠
                          </span>
                        ) : null}
                      </p>
                      {showLists && e.lists?.length ? (
                        <p className="truncate text-xs text-muted">{e.lists.map((l) => l.name).join(" · ")}</p>
                      ) : (
                        <p className="truncate text-xs text-muted md:hidden">
                          <span className="sm:hidden">{p.cuisine ?? p.category}</span>
                          {(p.cuisine ?? p.category) && (p.neighborhood ?? p.city) ? <span className="sm:hidden"> · </span> : null}
                          {[p.neighborhood, p.city].filter(Boolean).join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="hidden border-b border-line px-2 py-2 align-top text-muted sm:table-cell">
                  {p.cuisine ?? p.category ?? "—"}
                </td>
                <td className="hidden border-b border-line px-2 py-2 align-top text-muted md:table-cell">
                  {p.neighborhood ? (
                    <>
                      <span className="text-ink">{p.neighborhood}</span>
                      {p.city ? <span>, {p.city}</span> : null}
                    </>
                  ) : (
                    (p.city ?? "—")
                  )}
                </td>
                <td className="border-b border-line px-2 py-2 align-top">
                  <GoogleRating rating={p.google_rating} count={p.google_rating_count} />
                </td>
                {showMyRating ? (
                  <td className="border-b border-line px-2 py-2 align-top">
                    <Stars value={e.rating} />
                  </td>
                ) : null}
                <td className="hidden border-b border-line px-2 py-2 align-top sm:table-cell">
                  <Price level={p.price_level} />
                </td>
                {travelSeconds ? (
                  <td className="border-b border-line px-2 py-2 align-top whitespace-nowrap tabular-nums">
                    {p.id in travelSeconds ? formatMinutes(travelSeconds[p.id]) : <span className="text-muted">…</span>}
                  </td>
                ) : null}
                <td className="hidden max-w-xs border-b border-line px-2 py-2 pr-4 align-top text-muted xl:table-cell">
                  <p className="line-clamp-2">{note ?? ""}</p>
                </td>
              </tr>
              {selected ? (
                <tr>
                  <td colSpan={columns} className="border-b border-line bg-surface px-4 py-4">
                    <PlaceDetails
                      entry={e}
                      editable={props.editable}
                      inList={props.inList}
                      onEdit={(edit) => props.onEdit(p.id, edit)}
                      onRemove={() => props.onRemove(p.id)}
                      onResolved={props.onResolved}
                    />
                  </td>
                </tr>
              ) : null}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

function Th({
  label,
  sortKey,
  filters,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: SortKey;
  filters: Filters;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = filters.sort === sortKey;
  const naturalDesc = sortKey === "google_rating" || sortKey === "rating" || sortKey === "added";
  const arrow = active ? (naturalDesc !== filters.desc ? "↓" : "↑") : "";
  return (
    <th
      className={`border-b border-line px-2 py-2 font-medium ${className}`}
      aria-sort={active ? (arrow === "↓" ? "descending" : "ascending") : undefined}
    >
      <button className={`hover:text-ink ${active ? "text-ink" : ""}`} onClick={() => onSort(sortKey)}>
        {label} {arrow}
      </button>
    </th>
  );
}
