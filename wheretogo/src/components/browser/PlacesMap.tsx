"use client";

import { AdvancedMarker, APIProvider, Map, Pin, useMap } from "@vis.gl/react-google-maps";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Bounds } from "@/lib/filters";
import type { Entry } from "@/lib/types";

const BROWSER_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? "";
// Advanced markers need a map id; DEMO_MAP_ID works for development.
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";

type LatLng = { lat: number; lng: number };

type Props = {
  entries: Entry[];
  allEntries: Entry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onBoundsChange: (bounds: Bounds) => void;
  /** When this changes (and autoFit is on), the map zooms to the visible places. */
  fitKey: string;
  autoFit: boolean;
  origin: LatLng | null;
  pickingOrigin: boolean;
  onPickOrigin: (origin: LatLng) => void;
};

export function PlacesMap(props: Props) {
  if (!BROWSER_KEY) {
    return (
      <div className="grid h-full place-items-center bg-surface-2 p-6 text-center text-sm text-muted">
        <p>
          Map hidden: set <code>NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY</code> to show places on a map.
        </p>
      </div>
    );
  }
  return (
    <APIProvider apiKey={BROWSER_KEY}>
      <MapInner {...props} />
    </APIProvider>
  );
}

function boundsOf(points: LatLng[]): google.maps.LatLngBoundsLiteral | null {
  if (!points.length) return null;
  let north = -90,
    south = 90,
    east = -180,
    west = 180;
  for (const p of points) {
    north = Math.max(north, p.lat);
    south = Math.min(south, p.lat);
    east = Math.max(east, p.lng);
    west = Math.min(west, p.lng);
  }
  return { north, south, east, west };
}

function located(entries: Entry[]) {
  return entries.filter((e) => e.place.lat != null && e.place.lng != null);
}

function MapInner({
  entries,
  allEntries,
  selectedId,
  onSelect,
  onBoundsChange,
  fitKey,
  autoFit,
  origin,
  pickingOrigin,
  onPickOrigin,
}: Props) {
  const markers = useMemo(() => located(entries), [entries]);
  // Initial camera covers everything in the list.
  const [initialBounds] = useState(() =>
    boundsOf(located(allEntries).map((e) => ({ lat: e.place.lat!, lng: e.place.lng! }))),
  );

  return (
    <Map
      className="h-full w-full"
      mapId={MAP_ID}
      defaultBounds={initialBounds ? { ...initialBounds, padding: 40 } : undefined}
      defaultCenter={initialBounds ? undefined : { lat: 40.73, lng: -73.99 }}
      defaultZoom={initialBounds ? undefined : 11}
      gestureHandling="greedy"
      clickableIcons={false}
      disableDefaultUI
      zoomControl
      colorScheme="FOLLOW_SYSTEM"
      draggableCursor={pickingOrigin ? "crosshair" : undefined}
      onBoundsChanged={(e) => onBoundsChange(e.detail.bounds)}
      onClick={(e) => {
        if (pickingOrigin && e.detail.latLng) onPickOrigin(e.detail.latLng);
      }}
    >
      <FitOnChange entries={markers} fitKey={fitKey} enabled={autoFit} />
      <PanToSelected entries={markers} selectedId={selectedId} />
      {markers.map((e) => {
        const selected = e.place.id === selectedId;
        return (
          <AdvancedMarker
            key={e.place.id}
            position={{ lat: e.place.lat!, lng: e.place.lng! }}
            title={e.place.name}
            zIndex={selected ? 1000 : undefined}
            onClick={() => onSelect(e.place.id)}
          >
            <Pin
              background={selected ? "#0f6e63" : e.rating && e.rating >= 4 ? "#e29b17" : "#d9534f"}
              borderColor="#ffffff"
              glyphColor="#ffffff"
              scale={selected ? 1.25 : 0.85}
            />
          </AdvancedMarker>
        );
      })}
      {origin ? (
        <AdvancedMarker position={origin} title="Travel times from here" zIndex={2000}>
          <div className="size-4 rounded-full border-2 border-white bg-blue-600 shadow" />
        </AdvancedMarker>
      ) : null}
    </Map>
  );
}

function FitOnChange({ entries, fitKey, enabled }: { entries: Entry[]; fitKey: string; enabled: boolean }) {
  const map = useMap();
  const first = useRef(true);
  const latest = useRef(entries);
  useEffect(() => {
    latest.current = entries;
  });
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!map || !enabled) return;
    const b = boundsOf(latest.current.map((e) => ({ lat: e.place.lat!, lng: e.place.lng! })));
    if (b) map.fitBounds(b, 40);
  }, [map, fitKey, enabled]);
  return null;
}

function PanToSelected({ entries, selectedId }: { entries: Entry[]; selectedId: string | null }) {
  const map = useMap();
  const latest = useRef(entries);
  useEffect(() => {
    latest.current = entries;
  });
  useEffect(() => {
    if (!map || !selectedId) return;
    const e = latest.current.find((x) => x.place.id === selectedId);
    if (!e) return;
    const pos = { lat: e.place.lat!, lng: e.place.lng! };
    if (!map.getBounds()?.contains(pos)) map.panTo(pos);
  }, [map, selectedId]);
  return null;
}
