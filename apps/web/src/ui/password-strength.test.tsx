import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";

import { PasswordStrength } from "./password-strength.tsx";
import { scorePassword } from "./password-score.ts";
import { statusKindOf } from "./pill.tsx";
import { statusOf } from "@headroom/view-model/labels";
import { connection } from "@headroom/view-model/test-fixtures";
import { zhStatus } from "../lib/zh.ts";

const noop = (): void => undefined;

describe("the strength meter", () => {
  test("keeps its English words when no copy is given, as the sign-in pages use it", () => {
    const html = renderToString(
      <PasswordStrength label="Password" name="p" minimum={12} value="abc" onChange={noop} />,
    );
    expect(html).toContain("Password strength");
    expect(html).toContain("Too Short");
    expect(html).toContain("At least 12 characters");
    expect(html).toContain("Strength: Too Short. 1 of 3 checks passed.");
  });
  test("shows injected words while the score keeps its English label as the key", () => {
    expect(scorePassword("abc", 12).label).toBe("Too Short");
    const html = renderToString(
      <PasswordStrength
        label="新密码"
        name="p"
        minimum={12}
        value="abc"
        onChange={noop}
        copy={{
          meter: "密码强度",
          word: (label) => (label === "Too Short" ? "太短" : label),
          rule: (id, minimum) => (id === "length" ? `至少 ${minimum} 个字符` : id),
        }}
      />,
    );
    expect(html).toContain("密码强度");
    expect(html).toContain("太短");
    expect(html).toContain("至少 12 个字符");
    // The element that marks a too-short password is still keyed on the English label.
    expect(html).toContain('data-short="true"');
  });
});

describe("the status words", () => {
  test("statusOf still gives the English word the pill kind is keyed on", () => {
    const paused = statusOf(connection("claude", { state: "paused" }));
    expect(paused.word).toBe("Paused");
    expect(statusKindOf(paused.word)).toBe("paused");
    expect(zhStatus(paused.word)).toBe("已暂停");
    expect(zhStatus(statusOf(connection("claude", { stale: true })).word)).toBe("数据过期");
  });
});
