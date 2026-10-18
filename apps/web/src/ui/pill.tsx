import type { ReactNode } from "react";

import { AlertIcon, ClockIcon, PartialIcon, PauseIcon, RetryIcon } from "../icons.tsx";
import type { StatusView } from "@headroom/view-model/labels";
import { cx } from "./cx.ts";
import { Fade } from "./fade.tsx";

export type PillTone = "default" | "neutral" | "warn" | "bad" | "quiet" | "good";

/** A small toned label. Put an icon before the words; the icon takes the tone colour. */
export function Pill(props: {
  readonly tone?: PillTone;
  readonly icon?: ReactNode;
  readonly children: ReactNode;
}) {
  const tone = props.tone ?? "default";
  return (
    <span className={cx("pill", tone !== "default" && tone)}>
      {props.icon}
      {props.children}
    </span>
  );
}

export type StatusKind =
  | "active"
  | "paused"
  | "disconnected"
  | "refresh_failed"
  | "out_of_date"
  | "partial"
  | "waiting";

const statusLook: Record<StatusKind, { tone: PillTone; icon: ReactNode; words: string }> = {
  active: { tone: "good", icon: <span className="dot" aria-hidden="true" />, words: "正常" },
  paused: { tone: "quiet", icon: <PauseIcon />, words: "已暂停" },
  disconnected: { tone: "bad", icon: <AlertIcon />, words: "已断开" },
  refresh_failed: { tone: "neutral", icon: <RetryIcon />, words: "刷新失败" },
  out_of_date: { tone: "warn", icon: <ClockIcon />, words: "数据过期" },
  partial: { tone: "warn", icon: <PartialIcon />, words: "部分" },
  waiting: { tone: "quiet", icon: <ClockIcon />, words: "等待首次刷新" },
};

/** The status of an account as a pill: icon and words, never colour alone. `label` overrides the words. */
export function StatusPill(props: { readonly kind: StatusKind; readonly label?: string }) {
  const look = statusLook[props.kind];
  return (
    <Pill tone={look.tone} icon={look.icon}>
      {props.label ?? look.words}
    </Pill>
  );
}

const kindOfWord: Record<StatusView["word"], StatusKind> = {
  Active: "active",
  Paused: "paused",
  Disconnected: "disconnected",
  "Refresh Failed": "refresh_failed",
  "Out of Date": "out_of_date",
};

/** The pill kind for the word `statusOf` gives an account. */
export function statusKindOf(word: StatusView["word"]): StatusKind {
  return kindOfWord[word];
}

/** The healthy panel status: a dot and how long ago the account refreshed. */
export function HealthyStatus(props: { readonly age: ReactNode }) {
  return (
    <span className="status">
      <span className="dot" aria-hidden="true" />
      <span className="age">{props.age}</span>
    </span>
  );
}

/**
 * The fixed-size box in a panel header. Status changes fade through it, so the header never shifts.
 * `statusKey` names the current status; change it when the content changes.
 */
export function StatusSlot(props: { readonly statusKey: string; readonly children: ReactNode }) {
  return (
    <Fade swapKey={props.statusKey} className="status-slot" delay={140}>
      {props.children}
    </Fade>
  );
}
