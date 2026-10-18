import { describe, expect, test } from "bun:test";

import { ApiError, demoRefusal } from "../../api.ts";
import { zhMessage } from "../../lib/zh.ts";

import {
  chatTypeWord,
  failureText,
  botCheckProblem,
  changeProblem,
  codeOf,
  botNameOf,
  destinationName,
  destinationState,
  rotationProblem,
  saveProblem,
  statusLine,
  testProblem,
} from "./status.ts";

const now = 1_000_000_000_000;
const minute = 60_000;

describe("failureText", () => {
  test("differs by channel where the cause differs", () => {
    expect(failureText("telegram", "unauthorized")).toBe("Telegram 不接受这个机器人令牌。");
    expect(failureText("webhook", "unauthorized")).toBe(
      "你的接收端拒绝了此请求。请确认它使用的是这个密钥。",
    );
    expect(failureText("webhook", "not_found")).toBe("此路径没有响应。");
    expect(failureText("webhook", "rejected")).toBe("你的接收端未接受此请求。");
    expect(failureText("webhook", "server_error")).toBe("你的接收端出现错误。");
    expect(failureText("webhook", "timeout")).toBe("Headroom 无法连接到此 URL。");
  });
  test("is shared where the cause is the same", () => {
    expect(failureText("telegram", "rate_limited")).toBe(failureText("webhook", "rate_limited"));
  });
});

describe("statusLine", () => {
  test("nothing sent", () => {
    expect(statusLine({ type: "webhook", lastDelivery: null }, now).text).toBe("尚未发送");
  });
  test("delivered", () => {
    const line = statusLine(
      {
        type: "webhook",
        lastDelivery: { status: "delivered", at: now - 3 * minute, failure: null },
      },
      now,
    );
    expect(line).toEqual({ text: "上次发送：3分钟前", tone: "good" });
  });
  test("retrying", () => {
    const line = statusLine(
      { type: "telegram", lastDelivery: { status: "retrying", at: now, failure: "rate_limited" } },
      now,
    );
    expect(line.text).toBe("正在重试。消息过多，Headroom 会稍后重试。");
    expect(line.tone).toBe("warn");
  });
  test("failed", () => {
    const line = statusLine(
      {
        type: "webhook",
        lastDelivery: { status: "failed", at: now - 5 * minute, failure: "network" },
      },
      now,
    );
    expect(line.text).toBe("上次失败：5分钟前。Headroom 无法连接到此 URL。");
    expect(line.tone).toBe("bad");
  });
  test("a send just now reads 刚刚", () => {
    const line = statusLine(
      { type: "webhook", lastDelivery: { status: "delivered", at: now, failure: null } },
      now,
    );
    expect(line.text).toBe("上次发送：刚刚");
  });
});

test("chat type words", () => {
  expect(chatTypeWord("private")).toBe("私聊");
  expect(chatTypeWord("supergroup")).toBe("群组");
  expect(chatTypeWord("channel")).toBe("频道");
  expect(chatTypeWord("other")).toBe("聊天");
});

test("destination state", () => {
  expect(destinationState(null)).toEqual({ mark: "none", label: "未设置" });
  expect(destinationState({ enabled: false, lastDelivery: null }).mark).toBe("off");
  expect(destinationState({ enabled: true, lastDelivery: null })).toEqual({
    mark: "on",
    label: "已设置",
  });
  const sent = { status: "delivered", at: now - 2 * minute, failure: null } as const;
  expect(destinationState({ enabled: true, lastDelivery: sent }).mark).toBe("on");
  const failed = { status: "failed", at: now - minute, failure: "timeout" } as const;
  expect(destinationState({ enabled: true, lastDelivery: failed }).mark).toBe("failing");
  const retrying = { status: "retrying", at: now - minute, failure: "network" } as const;
  expect(destinationState({ enabled: true, lastDelivery: retrying }).mark).toBe("failing");
});

test("names", () => {
  expect(destinationName("telegram")).toBe("Telegram");
  expect(botNameOf("@family_bot · Family")).toBe("@family_bot");
  expect(botNameOf("@family_bot")).toBe("@family_bot");
});

test("bot check problem", () => {
  expect(botCheckProblem("telegram_token_rejected")).toBe(
    "Telegram 不接受这个令牌。请从 BotFather 重新复制。",
  );
  expect(botCheckProblem("timeout")).toBe("Headroom 无法连接到 Telegram，请重试。");
  expect(botCheckProblem(null)).toBe("Headroom 无法连接到 Telegram，请重试。");
});

test("test problem", () => {
  expect(testProblem("webhook", "not_found")).toBe("此路径没有响应。");
  expect(testProblem("webhook", "nonsense")).toBe("Headroom 无法发送。");
  expect(testProblem("telegram", null)).toBe("Headroom 无法发送。");
});

describe("a demo refusal", () => {
  const shown = zhMessage(demoRefusal);
  test("is worded in Chinese, and reads the same on every delivery surface", () => {
    expect(shown).not.toBe(demoRefusal);
    expect(botCheckProblem("demo_mode")).toBe(shown);
    expect(testProblem("webhook", "demo_mode")).toBe(shown);
    expect(testProblem("telegram", "demo_mode")).toBe(shown);
    expect(saveProblem("demo_mode")).toBe(shown);
    expect(changeProblem("demo_mode")).toBe(shown);
    expect(rotationProblem("demo_mode")).toBe(shown);
  });
  test("leaves the other failures as they were", () => {
    expect(saveProblem(null)).toBe("Headroom 无法保存。请检查填写的内容，然后重试。");
    expect(changeProblem("x")).toBe("Headroom 无法保存这项更改，请重试。");
    expect(rotationProblem(null)).toBe("Headroom 无法生成新密钥，请重试。");
  });
  test("reaches the mapping as the error word of an ApiError", () => {
    expect(codeOf(new ApiError(409, "Request failed (409)", "demo_mode"))).toBe("demo_mode");
    expect(codeOf(new Error("x"))).toBeNull();
    expect(botCheckProblem(codeOf(new ApiError(409, "m", "demo_mode")))).toBe(shown);
  });
});
