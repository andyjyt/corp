export function Stars({ value, size = "sm" }: { value: number | null; size?: "sm" | "md" }) {
  if (value == null) return <span className="text-muted">—</span>;
  const full = Math.round(value);
  return (
    <span
      className={`whitespace-nowrap tracking-tight text-star ${size === "md" ? "text-base" : "text-xs"}`}
      aria-label={`${value} out of 5`}
    >
      {"★".repeat(full)}
      <span className="text-line">{"★".repeat(5 - full)}</span>
    </span>
  );
}

export function GoogleRating({ rating, count }: { rating: number | null; count: number | null }) {
  if (rating == null) return <span className="text-muted">—</span>;
  return (
    <span className="whitespace-nowrap tabular-nums">
      <span className="text-star">★</span> {Number(rating).toFixed(1)}
      {count != null ? <span className="text-muted"> ({formatCount(count)})</span> : null}
    </span>
  );
}

export function Price({ level }: { level: number | null }) {
  if (level == null) return <span className="text-muted">—</span>;
  if (level === 0) return <span>Free</span>;
  return (
    <span className="tabular-nums" aria-label={`Price level ${level} of 4`}>
      {"$".repeat(level)}
      <span className="text-line">{"$".repeat(4 - level)}</span>
    </span>
  );
}

export function formatCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);
}

export function formatMinutes(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const m = Math.round(seconds / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}
