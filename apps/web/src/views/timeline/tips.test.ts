import { describe, expect, test } from "bun:test";

import { connection, percent } from "@headroom/view-model/test-fixtures";
import { laneOf } from "./lanes.ts";
import { laneTips, tipLabel, usedText, windowTip, type TipContext } from "./tips.ts";

const hour = 3_600_000;
const now = new Date(2025, 9, 3, 11, 0).getTime();
const context: TipContext = { now, clock: "24h", view: "used", low: 30 };

const account = connection("claude", {
  name: "Work",
  metrics: [
    percent("seven_day", 91, { resetsAt: new Date(2025, 9, 5, 19, 0).getTime() }),
    percent("five_hour", 20, { scope: "window:18000s", resetsAt: now + hour }),
  ],
});

describe("popover wording", () => {
  const lane = laneOf(account, "weekly", now);
  if (lane === null) throw new Error("expected a weekly lane");
  test("the current window says when it resets, in our wording", () => {
    const tip = windowTip(lane, "cur", context);
    expect(tip.title).toBe("Claude · Work · 每周");
    expect(tip.when).toBe("2天8小时后重置 · 10月5日 周日 19:00");
    expect(tip.lines[0]).toEqual({ text: "已用 91% · 每周", tone: "bad" });
    expect(tip.lines.map((line) => line.text)).toContain("开启于9月28日 周日 19:00");
  });
  test("Left flips the figure", () => {
    expect(usedText(91, { ...context, view: "left" })).toBe("剩余 9%");
    expect(usedText(null, context)).toBe("未报告");
  });
  test("the earlier window says it is worked out from the length", () => {
    const tip = windowTip(lane, "prev", context);
    expect(tip.when).toBe("较早的窗口 · 结束于9月28日 周日 19:00");
    expect(tip.lines.map((line) => line.text)).toContain("根据窗口长度推算");
  });
  test("the next window opens when this one resets", () => {
    const tip = windowTip(lane, "next", context);
    expect(tip.when).toBe("下一个窗口 · 开启于10月5日 周日 19:00");
    expect(tip.lines[0]?.text).toBe("10月12日 周日 19:00重置");
  });
  test("a session's next window starts on next use", () => {
    const session = laneOf(account, "session", now);
    if (session === null) throw new Error("expected a session lane");
    expect(windowTip(session, "next", context).when).toBe("下一个窗口 · 下次使用时开始");
  });
  test("every bar of a current lane has a popover, and a label is one sentence", () => {
    const tips = laneTips([lane], context);
    expect([...tips.keys()]).toEqual([`${lane.id}:prev`, `${lane.id}:cur`, `${lane.id}:next`]);
    expect(tipLabel(windowTip(lane, "cur", context))).toContain("2天8小时后重置");
  });
});
