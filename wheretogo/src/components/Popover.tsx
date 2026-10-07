"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** A <details>-based dropdown that closes on outside click and Escape. */
export function Popover({
  label,
  active,
  children,
  align = "left",
  className = "chip",
}: {
  label: ReactNode;
  active?: boolean;
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: Event) => {
      const el = ref.current;
      if (!el?.open) return;
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !el.contains(e.target as Node)) el.open = false;
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);
  return (
    <details ref={ref} className="relative">
      <summary className={`${className} cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden ${active ? "chip-on" : ""}`}>
        {label}
        <span aria-hidden className="text-[10px] opacity-60">▾</span>
      </summary>
      <div
        className={`absolute top-full z-40 mt-1 min-w-56 rounded-xl border border-line bg-surface p-2 shadow-lg ${align === "right" ? "right-0" : "left-0"}`}
      >
        {children}
      </div>
    </details>
  );
}
