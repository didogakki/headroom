import { describe, expect, test } from "bun:test";

import { kindSwitches, type AccountEvent } from "@headroom/core/contracts";
import { connection, credit, metric, percent } from "@headroom/view-model/test-fixtures";
import { deriveNotifications, type NotificationSettings } from "@headroom/view-model/notifications";

import { defaultSettings } from "./settings-store.ts";
import { zhNotification } from "./zh-notifications.ts";

const hour = 3_600_000;
const day = 24 * hour;
const now = new Date(2025, 10, 3, 11, 0).getTime();

const settings: NotificationSettings = {
  ...defaultSettings,
  notifications: { ...defaultSettings.notifications, kinds: kindSwitches(true) },
};

const event = (id: string, at: number, metricKey: string | null, detail: AccountEvent["detail"]) =>
  ({ id, connectionId: "x", occurredAt: at, metricKey, detail }) satisfies AccountEvent;

/** The original English event next to what the bell shows: nothing of the event may change. */
function shown(connections: Parameters<typeof deriveNotifications>[0], over = settings) {
  const events = deriveNotifications(connections, over, now);
  const before = JSON.stringify(events);
  const words = events.map((item) => ({ item, zh: zhNotification(item) }));
  // Translating reads the event; it never writes to it.
  expect(JSON.stringify(events)).toBe(before);
  return words;
}

describe("limit notices", () => {
  const claude = connection("claude", {
    id: "claude-1",
    metrics: [
      percent("seven_day", 95, { resetsAt: now + 2 * day }),
      percent("five_hour", 75, { scope: "window:18000s", resetsAt: now + 2 * hour }),
    ],
  });

  test("Almost Out and Running Low are rebuilt, with the reset time and the share the owner reads", () => {
    const found = shown([claude]);
    const out = found.find((entry) => entry.item.kind === "almost_out");
    const low = found.find((entry) => entry.item.kind === "running_low");
    expect(out?.item.title).toBe("Claude Is Almost Out of Its Weekly Limit");
    expect(out?.zh).toEqual({
      title: "Claude 每周额度即将耗尽",
      message: "已用 95%。2天后重置。",
    });
    expect(low?.zh).toEqual({
      title: "Claude 会话额度余量偏低",
      message: "已用 75%。2小时后重置。",
    });
  });

  test("the Left view and the Exact time style are kept", () => {
    const found = shown([claude], {
      ...settings,
      limitsView: "left",
      timeStyle: "exact",
      clock: "12h",
    });
    const out = found.find((entry) => entry.item.kind === "almost_out");
    expect(out?.zh.message).toMatch(
      /^剩余 5%。(\d{1,2}月\d{1,2}日 周. )?(上午|下午)\d{1,2}:\d{2}重置。$/,
    );
  });

  test("a notice's id, kind, tone and figures do not depend on the words", () => {
    const [first] = shown([claude]);
    expect(first?.item.id.startsWith("claude-1:almost_out:seven_day:")).toBe(true);
    expect(first?.item.kind).toBe("almost_out");
    expect(first?.item.figures.percentUsed).toBe(95);
  });
});

describe("pace", () => {
  test("a running-low notice keeps the pace sentence", () => {
    const paced = connection("claude", {
      id: "claude-2",
      observedAt: now - 10 * 60_000,
      metrics: [percent("seven_day", 80, { resetsAt: now + 4 * day })],
      pace: [
        {
          metricKey: "seven_day",
          from: now - 70 * 60_000,
          to: now - 10 * 60_000,
          ratePerHour: 0.3,
        },
      ],
    });
    const low = shown([paced]).find((entry) => entry.item.kind === "running_low");
    expect(low?.item.message).toContain("At this rate it runs out in about");
    expect(low?.zh.message).toMatch(
      /^已用 80%。4天后重置。按当前速度，约.+后用完，比重置提前\d+天。$/,
    );
  });
});

describe("balances, spend and expiry", () => {
  test("Claude credits that ran out", () => {
    const empty = connection("claude", {
      id: "claude-3",
      metrics: [
        metric("prepaid.balance", {
          kind: "credits",
          unit: "USD",
          scope: "account",
          valueNum: 0,
          valueText: "0",
        }),
        metric("extra_usage.used", {
          kind: "spend",
          unit: "USD",
          scope: "month",
          valueNum: 4,
          valueText: "4",
        }),
      ],
    });
    const found = shown([empty]).find((entry) => entry.item.kind === "balance_low");
    expect(found?.zh).toEqual({
      title: "Claude 使用积分已用完",
      message: "在补充积分之前，额外用量已没有可花费的积分。",
    });
  });

  test("a banked reset that expires", () => {
    const banked = connection("codex", {
      id: "codex-1",
      metrics: [],
      resetCredits: [
        credit("a", { expiresAt: now + 2 * day }),
        credit("b", { expiresAt: now + 30 * day }),
      ],
    });
    const found = shown([banked]).find((entry) => entry.item.kind === "reset_expiring");
    expect(found?.zh.title).toBe("Codex 有重置将在2天后到期");
    expect(found?.zh.message).toMatch(/^2 个已存完整重置中有 1 个将于\d{1,2}月\d{1,2}日到期。$/);
  });

  test("spend near the provider's cap", () => {
    const cursor = connection("cursor", {
      id: "cursor-1",
      metrics: [
        metric("on_demand.used", {
          kind: "spend",
          unit: "USD",
          scope: "billing_cycle",
          valueNum: 90,
          valueText: "90",
        }),
        metric("on_demand.limit", {
          kind: "spend",
          unit: "USD",
          scope: "billing_cycle",
          valueNum: 100,
          valueText: "100",
        }),
      ],
    });
    const found = shown([cursor]).find((entry) => entry.item.kind === "spend_near_cap");
    expect(found?.zh).toEqual({
      title: "Cursor 按需支出已接近上限",
      message: "已支出 $90.00，上限 $100.00。",
    });
  });
});

describe("events and sign-in", () => {
  const detected = connection("codex", {
    id: "codex-9",
    metrics: [
      percent("rate_limit.primary_window", 23, {
        scope: "window:604800s",
        resetsAt: now + 3 * day,
      }),
    ],
    events: [
      event("e", now - hour, "rate_limit.primary_window", {
        kind: "early_reset",
        previousPercent: 63.6,
        percent: 1,
        expectedResetAt: now + day,
        bankedUsed: true,
      }),
      event("t", now - 3 * hour, "credits.balance", {
        kind: "top_up_detected",
        unit: "codex_credits",
        previous: 1,
        current: 2,
        added: 1,
        topUpId: null,
      }),
      event("a", now - 2 * hour, "rate_limit.primary_window", {
        kind: "auto_reset",
        actionId: "act",
        state: "failed",
        creditId: "c",
        percent: 96,
        resetsAt: now,
      }),
    ],
  });

  test("an early reset, a top-up and an auto-reset are translated with their figures", () => {
    const found = shown([detected]);
    const byKind = (kind: string) => found.find((entry) => entry.item.kind === kind);
    expect(byKind("early_reset")?.zh).toEqual({
      title: "Codex 每周额度提前重置",
      message: "用量从 64% 降到 1%，在计划重置时间之前已重置。已存重置在 Headroom 之外被使用。",
    });
    expect(byKind("top_up_detected")?.zh).toEqual({
      title: "Codex 检测到充值",
      message: "已增加 1 积分，当前余额 2 积分。",
    });
    expect(byKind("auto_reset")?.zh.title).toBe("Codex 自动重置失败");
    expect(byKind("auto_reset")?.zh.message).toContain("已用到 96%");
  });

  test("a disconnected account and a failing refresh", () => {
    const gone = connection("claude", {
      id: "gone",
      state: "reconnect_required",
      reconnectReason: "token_rejected",
    });
    const flaky = connection("cursor", {
      id: "flaky",
      latestRun: {
        startedAt: 5_000,
        finishedAt: 5_100,
        outcome: "provider_unavailable",
        error: "x",
        failureStreak: 3,
      },
    });
    const found = shown([gone, flaky]);
    expect(found.find((entry) => entry.item.kind === "disconnected")?.zh).toEqual({
      title: "Claude 已断开连接",
      message: "此账户的登录已过期。请重新连接以继续跟踪。",
    });
    expect(found.find((entry) => entry.item.kind === "refresh_failed")?.zh).toEqual({
      title: "Cursor 刷新失败",
      message: "Headroom 无法刷新此账户，几分钟后会再次尝试。",
    });
  });
});

describe("anything not recognised is shown as it was", () => {
  test("an unknown title or message, and a kind with another kind's words", () => {
    const base = deriveNotifications(
      [
        connection("claude", {
          id: "c",
          metrics: [percent("seven_day", 95, { resetsAt: now + day })],
        }),
      ],
      settings,
      now,
    )[0];
    if (base === undefined) throw new Error("expected a notice");
    const odd = { ...base, title: "Something New Happened", message: "A brand new sentence." };
    expect(zhNotification(odd)).toEqual({ title: odd.title, message: odd.message });
    const crossed = { ...base, kind: "refresh_failed" as const };
    expect(zhNotification(crossed)).toEqual({ title: base.title, message: base.message });
  });

  test("a provider or model name with regular-expression characters is kept and never breaks a match", () => {
    const base = deriveNotifications(
      [
        connection("claude", {
          id: "c",
          metrics: [percent("limits.Fable (x)+", 95, { resetsAt: now + day })],
        }),
      ],
      settings,
      now,
    )[0];
    if (base === undefined) throw new Error("expected a notice");
    const translated = zhNotification(base);
    expect(translated.title).toContain("Fable (x)+");
  });
});
