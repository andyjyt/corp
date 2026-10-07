"use client";

import { useState } from "react";
import { Popover } from "@/components/Popover";
import { formatMinutes } from "@/components/Stars";
import type { Facet, Facets, Filters } from "@/lib/filters";
import type { TravelMode } from "@/lib/types";
import type { TravelState } from "./useTravelTimes";

const MODE_LABEL: Record<TravelMode, string> = {
  WALK: "Walking",
  DRIVE: "Driving",
  TRANSIT: "Transit",
  BICYCLE: "Biking",
};

type Props = {
  filters: Filters;
  setFilters: (patch: Partial<Filters>) => void;
  resetFilters: () => void;
  facets: Facets;
  showMyRating: boolean;
  travel: TravelState;
  pickingOrigin: boolean;
  setPickingOrigin: (v: boolean) => void;
};

export function FilterBar({
  filters: f,
  setFilters,
  resetFilters,
  facets,
  showMyRating,
  travel,
  pickingOrigin,
  setPickingOrigin,
}: Props) {
  const anyActive =
    f.q ||
    f.country ||
    f.city ||
    f.neighborhoods.length ||
    f.cuisines.length ||
    f.minGoogleRating != null ||
    f.minRating != null ||
    f.maxPrice != null ||
    f.openNow ||
    f.inView ||
    f.origin;

  return (
    <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-2 px-4 pb-3">
      <input
        type="search"
        className="input h-8 w-full sm:w-56"
        placeholder="Search names, notes, cuisine…"
        value={f.q}
        onChange={(e) => setFilters({ q: e.target.value })}
      />

      {facets.countries.length > 1 ? (
        <SingleSelect
          label="Country"
          value={f.country}
          options={facets.countries}
          onChange={(country) => setFilters({ country, city: null, neighborhoods: [] })}
        />
      ) : null}
      <SingleSelect
        label="City"
        value={f.city}
        options={facets.cities}
        onChange={(city) => setFilters({ city, neighborhoods: [] })}
      />
      {facets.neighborhoods.length ? (
        <MultiSelect
          label="Neighborhood"
          values={f.neighborhoods}
          options={facets.neighborhoods}
          onChange={(neighborhoods) => setFilters({ neighborhoods })}
        />
      ) : null}
      {facets.cuisines.length ? (
        <MultiSelect
          label="Cuisine / type"
          values={f.cuisines}
          options={facets.cuisines}
          onChange={(cuisines) => setFilters({ cuisines })}
        />
      ) : null}

      <ChoiceSelect
        label="Google rating"
        value={f.minGoogleRating}
        options={[4, 4.3, 4.5, 4.7].map((v) => ({ value: v, label: `★ ${v}+` }))}
        onChange={(minGoogleRating) => setFilters({ minGoogleRating })}
      />
      {showMyRating ? (
        <ChoiceSelect
          label="My rating"
          value={f.minRating}
          options={[5, 4, 3].map((v) => ({ value: v, label: v === 5 ? "★★★★★ only" : `${"★".repeat(v)}+` }))}
          onChange={(minRating) => setFilters({ minRating })}
        />
      ) : null}
      <ChoiceSelect
        label="Price"
        value={f.maxPrice}
        options={[1, 2, 3].map((v) => ({ value: v, label: `${"$".repeat(v)} or less` }))}
        onChange={(maxPrice) => setFilters({ maxPrice })}
      />
      <button className={`chip ${f.openNow ? "chip-on" : ""}`} onClick={() => setFilters({ openNow: !f.openNow })}>
        Open now
      </button>
      <button
        className={`chip ${f.inView ? "chip-on" : ""}`}
        onClick={() => setFilters({ inView: !f.inView, bounds: null })}
        title="Only show places inside the map"
      >
        In map view
      </button>

      <TravelControl
        filters={f}
        setFilters={setFilters}
        travel={travel}
        pickingOrigin={pickingOrigin}
        setPickingOrigin={setPickingOrigin}
      />

      {anyActive ? (
        <button className="text-sm text-muted underline-offset-2 hover:text-ink hover:underline" onClick={resetFilters}>
          Clear
        </button>
      ) : null}
    </div>
  );
}

function SingleSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: Facet[];
  onChange: (v: string | null) => void;
}) {
  return (
    <Popover label={value ?? label} active={value != null}>
      <OptionList
        options={options}
        isSelected={(v) => v === value}
        onToggle={(v) => onChange(v === value ? null : v)}
        allLabel={`Any ${label.toLowerCase()}`}
        onAll={() => onChange(null)}
      />
    </Popover>
  );
}

function MultiSelect({
  label,
  values,
  options,
  onChange,
}: {
  label: string;
  values: string[];
  options: Facet[];
  onChange: (v: string[]) => void;
}) {
  const display = values.length === 0 ? label : values.length === 1 ? values[0] : `${label} (${values.length})`;
  return (
    <Popover label={display} active={values.length > 0}>
      <OptionList
        options={options}
        multi
        isSelected={(v) => values.includes(v)}
        onToggle={(v) => onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v])}
        allLabel="Clear"
        onAll={() => onChange([])}
      />
    </Popover>
  );
}

function OptionList({
  options,
  isSelected,
  onToggle,
  allLabel,
  onAll,
  multi,
}: {
  options: Facet[];
  isSelected: (v: string) => boolean;
  onToggle: (v: string) => void;
  allLabel: string;
  onAll: () => void;
  multi?: boolean;
}) {
  const [query, setQuery] = useState("");
  const shown = options.filter((o) => o.value.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="w-64">
      {options.length > 8 ? (
        <input
          className="input mb-2 h-8"
          placeholder="Filter…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      ) : null}
      <button className="w-full rounded-md px-2 py-1.5 text-left text-sm text-muted hover:bg-surface-2" onClick={onAll}>
        {allLabel}
      </button>
      <ul className="max-h-72 overflow-auto">
        {shown.map((o) => (
          <li key={o.value}>
            <button
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-2"
              onClick={() => onToggle(o.value)}
            >
              {multi ? (
                <span
                  className={`grid size-4 shrink-0 place-items-center rounded border text-[10px] ${isSelected(o.value) ? "border-accent bg-accent text-accent-ink" : "border-line"}`}
                >
                  {isSelected(o.value) ? "✓" : null}
                </span>
              ) : null}
              <span className={`flex-1 truncate ${!multi && isSelected(o.value) ? "font-semibold text-accent" : ""}`}>
                {o.value}
              </span>
              <span className="text-xs tabular-nums text-muted">{o.count}</span>
            </button>
          </li>
        ))}
        {shown.length === 0 ? <li className="px-2 py-1.5 text-sm text-muted">No matches</li> : null}
      </ul>
    </div>
  );
}

function ChoiceSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: number | null;
  options: { value: number; label: string }[];
  onChange: (v: number | null) => void;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <Popover label={current?.label ?? label} active={value != null}>
      <button className="w-full rounded-md px-2 py-1.5 text-left text-sm text-muted hover:bg-surface-2" onClick={() => onChange(null)}>
        Any
      </button>
      {options.map((o) => (
        <button
          key={o.value}
          className={`w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-2 ${o.value === value ? "font-semibold text-accent" : ""}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </Popover>
  );
}

function TravelControl({
  filters: f,
  setFilters,
  travel,
  pickingOrigin,
  setPickingOrigin,
}: {
  filters: Filters;
  setFilters: (patch: Partial<Filters>) => void;
  travel: TravelState;
  pickingOrigin: boolean;
  setPickingOrigin: (v: boolean) => void;
}) {
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  function useMyLocation() {
    if (!navigator.geolocation) return setGeoError("Your browser can't share its location.");
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setFilters({
          origin: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          maxMinutes: f.maxMinutes ?? 15,
          sort: "travel",
        });
      },
      (err) => {
        setLocating(false);
        setGeoError(err.message || "Couldn't get your location.");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  const label = f.origin
    ? `${f.maxMinutes != null ? `≤ ${formatMinutes(f.maxMinutes * 60)}` : "Any time"} · ${MODE_LABEL[f.mode].toLowerCase()}`
    : pickingOrigin
      ? "Click the map…"
      : "Travel time";

  return (
    <Popover label={label} active={Boolean(f.origin) || pickingOrigin} align="right">
      <div className="w-72 space-y-3 p-1 text-sm">
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">From</p>
          <div className="flex gap-2">
            <button className="btn flex-1" onClick={useMyLocation} disabled={locating}>
              {locating ? "Locating…" : "My location"}
            </button>
            <button className={`btn flex-1 ${pickingOrigin ? "chip-on" : ""}`} onClick={() => setPickingOrigin(!pickingOrigin)}>
              {pickingOrigin ? "Cancel" : "Pick on map"}
            </button>
          </div>
          {f.origin ? (
            <p className="mt-1.5 text-xs text-muted">
              From {f.origin.lat.toFixed(4)}, {f.origin.lng.toFixed(4)} ·{" "}
              <button className="underline" onClick={() => setFilters({ origin: null, maxMinutes: null, sort: f.sort === "travel" ? "name" : f.sort })}>
                clear
              </button>
            </p>
          ) : null}
          {geoError ? <p className="mt-1.5 text-xs text-danger">{geoError}</p> : null}
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">By</p>
          <div className="grid grid-cols-4 gap-1">
            {(Object.keys(MODE_LABEL) as TravelMode[]).map((m) => (
              <button
                key={m}
                className={`chip justify-center ${f.mode === m ? "chip-on" : ""}`}
                onClick={() => setFilters({ mode: m })}
              >
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Within</p>
          <div className="flex flex-wrap gap-1">
            {[5, 10, 15, 20, 30, 45, 60].map((m) => (
              <button
                key={m}
                className={`chip ${f.maxMinutes === m ? "chip-on" : ""}`}
                onClick={() => setFilters({ maxMinutes: m })}
              >
                {m} min
              </button>
            ))}
            <button className={`chip ${f.maxMinutes == null ? "chip-on" : ""}`} onClick={() => setFilters({ maxMinutes: null })}>
              Any
            </button>
          </div>
        </div>
        {travel.loading ? <p className="text-xs text-muted">Calculating travel times…</p> : null}
        {travel.error ? <p className="text-xs text-danger">{travel.error}</p> : null}
      </div>
    </Popover>
  );
}
