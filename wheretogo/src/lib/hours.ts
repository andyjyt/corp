import type { OpeningHours } from "@/lib/types";

const WEEK = 7 * 24 * 60;

/**
 * Whether a place is open at `now`, from its regular weekly hours and UTC
 * offset. Returns null when hours are unknown. Doesn't know about holidays.
 */
export function isOpenAt(
  hours: OpeningHours | null | undefined,
  utcOffsetMinutes: number | null | undefined,
  now: Date = new Date(),
): boolean | null {
  const periods = hours?.periods;
  if (!periods?.length || utcOffsetMinutes == null) return null;

  const local = new Date(now.getTime() + utcOffsetMinutes * 60_000);
  const t = local.getUTCDay() * 1440 + local.getUTCHours() * 60 + local.getUTCMinutes();

  for (const { open, close } of periods) {
    const start = open.day * 1440 + open.hour * 60 + open.minute;
    // No close time means open 24 hours a day.
    if (!close) return true;
    let end = close.day * 1440 + close.hour * 60 + close.minute;
    if (end <= start) end += WEEK;
    if ((t >= start && t < end) || (t + WEEK >= start && t + WEEK < end)) return true;
  }
  return false;
}
