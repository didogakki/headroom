import type { OverviewConnection } from "../../api.ts";
import type { EarlyReset } from "@headroom/view-model/early-resets";
import { providerName } from "@headroom/view-model/labels";
import { resetVerb } from "../../lib/reset-caption.tsx";
import type { Clock } from "@headroom/view-model/time";
import { displayMeter, toneOf, type LimitsView } from "@headroom/view-model/tone";
import { zhAccountName, zhAgo, zhCountdown, zhExactFull, zhLabel, zhShort } from "../../lib/zh.ts";
import type { PopoverContent } from "../../ui/hover-popover.tsx";
import { timelineKinds, type Bank, type EarlyMark, type Lane } from "./lanes.ts";

/** The popover wording for every bar and tick of the Timeline. Pure, so the words can be tested. */

export interface TipContext {
  readonly now: number;
  readonly clock: Clock;
  readonly view: LimitsView;
  readonly low: number;
}

export type Role = "prev" | "cur" | "next";

export function windowTipId(lane: Lane, role: Role): string {
  return `${lane.id}:${role}`;
}

export function bankTipId(lane: Lane, bank: Bank): string {
  return `${lane.id}:bank:${bank.index}`;
}

export function earlyTipId(lane: Lane, mark: EarlyMark): string {
  return `${lane.id}:early:${mark.index}`;
}

/** "已用 91%" or "剩余 36%"; "未报告" when the provider gave no figure. */
export function usedText(used: number | null, context: TipContext): string {
  if (used === null) return "未报告";
  const shown = displayMeter(used, context.view, context.low, 0);
  return `${context.view === "left" ? "剩余" : "已用"} ${shown.value ?? 0}%`;
}

/** "Claude · Personal", with the account's default name in Chinese. */
export function laneName(connection: OverviewConnection): string {
  return `${providerName(connection.provider)} · ${zhAccountName(connection)}`;
}

/** The account's identity when another account of its provider has the same name, else null. */
export function sharedIdentity(
  connection: OverviewConnection,
  shared: ReadonlySet<string>,
): string | null {
  return shared.has(connection.id) ? connection.identity : null;
}

export function kindLabel(kind: Lane["kind"]): string {
  return timelineKinds.find((entry) => entry.value === kind)?.label ?? kind;
}

const staleLines = (lane: Lane, context: TipContext): { text: string }[] => {
  const observed = lane.connection.snapshot?.observedAt;
  return lane.inactive && observed !== undefined
    ? [{ text: `数据来自${zhAgo(observed, context.now)}` }]
    : [];
};

/** What each bar says. The earlier window is worked out from the window length, and the popover says so. */
export function windowTip(lane: Lane, role: Role, context: TipContext): PopoverContent {
  const { now, clock } = context;
  const title = `${laneName(lane.connection)} · ${kindLabel(lane.kind)}`;
  const stale = staleLines(lane, context);
  if (role === "prev") {
    const start = lane.start - lane.lengthMs;
    return {
      title,
      when: `较早的窗口 · 结束于${zhExactFull(lane.start, now, clock)}`,
      lines: [{ text: `开启于${zhExactFull(start, now, clock)}` }, { text: "根据窗口长度推算" }],
    };
  }
  if (role === "next") {
    const idleNext = lane.kind === "session";
    return {
      title,
      when: idleNext
        ? "下一个窗口 · 下次使用时开始"
        : `下一个窗口 · 开启于${zhExactFull(lane.end, now, clock)}`,
      lines: [
        ...(idleNext ? [] : [{ text: `${zhExactFull(lane.end + lane.lengthMs, now, clock)}重置` }]),
        { text: "当前窗口重置时开启" },
      ],
    };
  }
  if (lane.phase === "idle") {
    return {
      title,
      when: "未开始",
      lines: [{ text: "下次使用时开启" }, ...stale],
    };
  }
  const meters = lane.meters.map((meter) => ({
    text: `${usedText(meter.used, context)} · ${zhShort(meter.short)}`,
    tone: meter.used === null ? null : toneOf(meter.used, context.low),
  }));
  if (lane.phase === "ended") {
    return {
      title,
      when: `结束于${zhExactFull(lane.end, now, clock)}`,
      lines: [
        ...meters,
        { text: `开启于${zhExactFull(lane.start, now, clock)}` },
        { text: "最后一次读数，来自窗口结束之前" },
        ...stale,
      ],
    };
  }
  const passed = Math.round(
    Math.min(1, Math.max(0, (now - lane.start) / (lane.end - lane.start))) * 100,
  );
  const verb = resetVerb(lane.drawn.resetWords);
  return {
    title,
    when: `${zhCountdown(lane.end, now)}后${verb} · ${zhExactFull(lane.end, now, clock)}`,
    lines: [
      ...meters,
      { text: `开启于${zhExactFull(lane.start, now, clock)}` },
      { text: `窗口时间已过 ${passed}%` },
      ...stale,
    ],
  };
}

function bankTip(lane: Lane, bank: Bank, context: TipContext): PopoverContent {
  return {
    title: `${laneName(lane.connection)} · ${zhLabel(bank.label)}到期`,
    when: `${zhCountdown(bank.at, context.now)}后到期 · ${zhExactFull(bank.at, context.now, context.clock)}`,
    lines: [{ text: `已存 ${bank.count} 个中的第 ${bank.index + 1} 个` }],
  };
}

/** The figures of an early reset in the owner's used or left view: "已用 41% → 1% · 提前2天5小时". */
function earlyLine(reset: EarlyReset, view: LimitsView): string {
  const shown = (used: number): string =>
    `${Math.round(view === "left" ? Math.max(0, 100 - used) : used)}%`;
  return `${view === "left" ? "剩余" : "已用"} ${shown(reset.from)} → ${shown(reset.to)} · 提前${zhCountdown(reset.expectedAt, reset.at)}`;
}

function earlyTip(lane: Lane, mark: EarlyMark, context: TipContext): PopoverContent {
  const { reset } = mark;
  return {
    title: `${laneName(lane.connection)} · ${reset.bankedUsed ? "已存重置已使用" : "提前重置"}`,
    when: `${zhShort(mark.short)} · ${zhExactFull(reset.at, context.now, context.clock)}`,
    lines: [{ text: earlyLine(reset, context.view) }],
  };
}

/** The popover as one sentence, for a button's accessible name. */
export function tipLabel(tip: PopoverContent): string {
  return [tip.title, tip.when, ...tip.lines.map((line) => line.text)]
    .filter((part): part is string => part !== undefined)
    .join("。");
}

/** Every popover of a set of lanes, by id. */
export function laneTips(lanes: readonly Lane[], context: TipContext): Map<string, PopoverContent> {
  const tips = new Map<string, PopoverContent>();
  for (const lane of lanes) {
    const roles: Role[] = lane.phase === "current" ? ["prev", "cur", "next"] : ["cur"];
    for (const role of roles) tips.set(windowTipId(lane, role), windowTip(lane, role, context));
    for (const bank of lane.banks) tips.set(bankTipId(lane, bank), bankTip(lane, bank, context));
    for (const mark of lane.early) tips.set(earlyTipId(lane, mark), earlyTip(lane, mark, context));
  }
  return tips;
}
