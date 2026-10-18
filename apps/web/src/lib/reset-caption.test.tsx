import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";

import { ResetCaption, resetVerb } from "./reset-caption.tsx";

const soon = Date.now() + 3 * 86_400_000 + 3_600_000;

describe("ResetCaption", () => {
  test("a rolling window resets, a cycle ends", () => {
    expect(renderToString(<ResetCaption resetWords="resets" resetsAt={soon} />)).toContain(
      "</time>重置",
    );
    expect(renderToString(<ResetCaption resetWords="cycle_end" resetsAt={soon} />)).toContain(
      "</time>周期结束",
    );
  });
  test("a pool that follows the cycle shows no time", () => {
    expect(renderToString(<ResetCaption resetWords="with_cycle" resetsAt={null} />)).toBe(
      "随周期重置",
    );
    expect(renderToString(<ResetCaption resetWords="with_cycle" resetsAt={soon} />)).toBe(
      "随周期重置",
    );
  });
  test("a session that has not started, and a missing time", () => {
    expect(renderToString(<ResetCaption resetWords="not_started" resetsAt={null} />)).toBe(
      "未开始",
    );
    expect(renderToString(<ResetCaption resetWords="resets" resetsAt={null} />)).toBe("无重置时间");
  });
  test("verb", () => {
    expect(resetVerb("resets")).toBe("重置");
    expect(resetVerb("with_cycle")).toBe("周期结束");
  });
});
