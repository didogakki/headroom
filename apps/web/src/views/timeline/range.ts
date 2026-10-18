import type { Clock } from "@headroom/view-model/time";
import type { TimelineKind } from "./lanes.ts";

/**
 * The time axis of the Timeline grid: which instants it covers, where its columns fall, and where a span lands
 * on it. Everything is in milliseconds and the browser's local time zone, and pure so it can be tested.
 */

const hour = 3_600_000;
const day = 24 * hour;

const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"] as const;

export interface Axis {
  readonly kind: TimelineKind;
  readonly base: number;
  readonly end: number;
  /** The start of every column, in order. The columns are equal width. */
  readonly columns: readonly number[];
  /** "14天", for the range label. */
  readonly size: string;
  /** What one step moves by, for the stepper's accessible names. */
  readonly stepWord: string;
}

/** Local midnight at the start of the day that holds `t`, moved by `days` calendar days and set to `hours`. */
function localDay(t: number, days: number, hours = 0): number {
  const at = new Date(t);
  return new Date(at.getFullYear(), at.getMonth(), at.getDate() + days, hours).getTime();
}

function daily(first: number, count: number, every: number): number[] {
  return Array.from({ length: count }, (_, index) => localDay(first, index * every));
}

/**
 * The axis for a window kind. `step` counts whole steps away from now: a week for Weekly, a day for 5-Hour,
 * four weeks for Cycle. Weekly shows the last week and the next; 5-Hour shows 24 hours that start six hours
 * before now, on a two-hour mark; Cycle shows ten weeks, starting four weeks back.
 */
export function axisFor(kind: TimelineKind, now: number, step: number): Axis {
  if (kind === "weekly") {
    const base = localDay(now, -7 + step * 7);
    return {
      kind,
      base,
      end: localDay(base, 14),
      columns: daily(base, 14, 1),
      size: "14天",
      stepWord: "一周",
    };
  }
  if (kind === "session") {
    // Two-hour marks on the local clock, six hours before the mark that holds now.
    const midnight = localDay(now, 0);
    const mark = midnight + Math.floor((now - midnight) / (2 * hour)) * 2 * hour;
    const base = mark - 6 * hour + step * day;
    return {
      kind,
      base,
      end: base + day,
      columns: Array.from({ length: 12 }, (_, index) => base + index * 2 * hour),
      size: "24小时",
      stepWord: "一天",
    };
  }
  const base = localDay(now, -28 + step * 28);
  return {
    kind,
    base,
    end: localDay(base, 70),
    columns: daily(base, 10, 7),
    size: "10周",
    stepWord: "4周",
  };
}

/** "10月". */
export function shortMonth(t: number): string {
  return `${new Date(t).getMonth() + 1}月`;
}

/** "10月5日". */
export function shortDay(t: number): string {
  const at = new Date(t);
  return `${at.getMonth() + 1}月${at.getDate()}日`;
}

export function weekday(t: number): string {
  return weekdays[new Date(t).getDay()] ?? "";
}

/** "19:00" or "下午7:00", from the owner's clock setting. */
export function clockText(t: number, clock: Clock): string {
  const at = new Date(t);
  const minutes = String(at.getMinutes()).padStart(2, "0");
  const hours = at.getHours();
  if (clock === "24h") return `${String(hours).padStart(2, "0")}:${minutes}`;
  return `${hours < 12 ? "上午" : "下午"}${hours % 12 || 12}:${minutes}`;
}

/** "周一 19:00". */
export function dayClock(t: number, clock: Clock): string {
  return `${weekday(t)} ${clockText(t, clock)}`;
}

/** "9月26日 – 10月9日 · 14天". One date when the range sits inside a single day. */
export function rangeLabel(axis: Axis): string {
  const first = shortDay(axis.base);
  const last = shortDay(axis.end - 1);
  return `${first === last ? first : `${first} – ${last}`} · ${axis.size}`;
}

/** The short reset time written on a bar: weekday and time, time alone, or the date. */
export function resetShort(kind: TimelineKind, t: number, clock: Clock): string {
  if (kind === "weekly") return dayClock(t, clock);
  if (kind === "session") return clockText(t, clock);
  return shortDay(t);
}

/** Where `t` falls on the axis as a percent of its width, or null when it is outside. */
export function positionOf(axis: Pick<Axis, "base" | "end">, t: number): number | null {
  if (t < axis.base || t > axis.end) return null;
  return ((t - axis.base) / (axis.end - axis.base)) * 100;
}

export interface Box {
  /** Percent of the axis width. */
  readonly left: number;
  readonly width: number;
  /** The span begins before the axis does, or ends after it. */
  readonly cutStart: boolean;
  readonly cutEnd: boolean;
  /** The part of the span that is on the axis. */
  readonly from: number;
  readonly to: number;
}

/** The visible part of a span, or null when none of it is on the axis. */
export function placeSpan(
  axis: Pick<Axis, "base" | "end">,
  start: number,
  end: number,
): Box | null {
  const from = Math.max(start, axis.base);
  const to = Math.min(end, axis.end);
  if (to <= from) return null;
  const span = axis.end - axis.base;
  return {
    left: ((from - axis.base) / span) * 100,
    width: ((to - from) / span) * 100,
    cutStart: start < axis.base,
    cutEnd: end > axis.end,
    from,
    to,
  };
}

/** The column that holds `t`, or null when it is outside the axis. */
export function columnOf(axis: Axis, t: number): number | null {
  if (t < axis.base || t >= axis.end) return null;
  let found = 0;
  for (const [index, start] of axis.columns.entries()) if (start <= t) found = index;
  return found;
}

/** The share of a visible box that lies before `now`, 0 to 1. */
export function elapsedShare(box: Pick<Box, "from" | "to">, now: number): number {
  return Math.min(1, Math.max(0, (now - box.from) / (box.to - box.from)));
}
