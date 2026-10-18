import {
  notificationDeliveryFailureSchema,
  type NotificationChannelType,
  type NotificationDeliveryFailure,
} from "@headroom/core/contracts";
import { age } from "@headroom/view-model/time";

import { ApiError, demoRefusal, type ChannelView } from "../../api.ts";
import { zhAge, zhMessage } from "../../lib/zh.ts";

const texts: Record<NotificationChannelType, Record<NotificationDeliveryFailure, string>> = {
  telegram: {
    timeout: "响应超时。",
    network: "Headroom 无法连接到它。",
    unauthorized: "Telegram 不接受这个机器人令牌。",
    not_found: "未找到该聊天。请先给你的机器人发一条消息。",
    rate_limited: "消息过多，Headroom 会稍后重试。",
    rejected: "消息被拒绝。",
    server_error: "对方出现错误。",
  },
  webhook: {
    timeout: "Headroom 无法连接到此 URL。",
    network: "Headroom 无法连接到此 URL。",
    unauthorized: "你的接收端拒绝了此请求。请确认它使用的是这个密钥。",
    not_found: "此路径没有响应。",
    rate_limited: "消息过多，Headroom 会稍后重试。",
    rejected: "你的接收端未接受此请求。",
    server_error: "你的接收端出现错误。",
  },
};

/** Why a send failed, in plain words. */
export function failureText(
  type: NotificationChannelType,
  failure: NotificationDeliveryFailure,
): string {
  return texts[type][failure];
}

/** The status line under a channel. `tone` colours it. */
export function statusLine(
  channel: Pick<ChannelView, "type" | "lastDelivery">,
  now: number,
): { readonly text: string; readonly tone: "good" | "warn" | "bad" | "quiet" } {
  const last = channel.lastDelivery;
  const ago = (at: number): string => zhAge(age(at, now));
  if (last === null) return { text: "尚未发送", tone: "quiet" };
  const reason = last.failure === null ? "" : failureText(channel.type, last.failure);
  const join = (lead: string): string => (reason === "" ? lead : `${lead}${reason}`);
  if (last.status === "delivered") return { text: `上次发送：${ago(last.at)}`, tone: "good" };
  if (last.status === "retrying") return { text: join("正在重试。"), tone: "warn" };
  return { text: join(`上次失败：${ago(last.at)}。`), tone: "bad" };
}

/** The word for a Telegram chat type. */
export function chatTypeWord(type: string): string {
  if (type === "private") return "私聊";
  if (type === "group" || type === "supergroup") return "群组";
  if (type === "channel") return "频道";
  return "聊天";
}

/** The error word an API call failed with, when it sent one. */
export function codeOf(cause: unknown): string | null {
  return cause instanceof ApiError ? cause.code : null;
}

/** The demo site refuses every change with this word; the owner sees why instead of a failure. */
const isDemoCode = (code: string | null): boolean => code === "demo_mode";

/** Why a first save failed. */
export function saveProblem(code: string | null): string {
  return isDemoCode(code)
    ? zhMessage(demoRefusal)
    : "Headroom 无法保存。请检查填写的内容，然后重试。";
}

/** Why a change to a saved channel failed. */
export function changeProblem(code: string | null): string {
  return isDemoCode(code) ? zhMessage(demoRefusal) : "Headroom 无法保存这项更改，请重试。";
}

/** Why making a new webhook secret failed. */
export function rotationProblem(code: string | null): string {
  return isDemoCode(code) ? zhMessage(demoRefusal) : "Headroom 无法生成新密钥，请重试。";
}

/** Why a test send failed, from the error word the server sent. */
export function testProblem(type: NotificationChannelType, code: string | null): string {
  if (isDemoCode(code)) return zhMessage(demoRefusal);
  const failure = notificationDeliveryFailureSchema.safeParse(code);
  return failure.success ? failureText(type, failure.data) : "Headroom 无法发送。";
}

/** The name of a destination. */
export function destinationName(type: NotificationChannelType): string {
  return type === "telegram" ? "Telegram" : "Webhook";
}

/**
 * The mark at the right of a destination card: a seal when it is set up (outlined when switched off), an alert when
 * its last send failed, nothing when it is not set up. `label` names the mark for assistive tech and on hover.
 */
export function destinationState(channel: Pick<ChannelView, "enabled" | "lastDelivery"> | null): {
  readonly mark: "none" | "on" | "off" | "failing";
  readonly label: string;
} {
  if (channel === null) return { mark: "none", label: "未设置" };
  if (!channel.enabled) return { mark: "off", label: "已设置，已关闭" };
  const last = channel.lastDelivery;
  if (last !== null && last.status !== "delivered") return { mark: "failing", label: "未能发送" };
  return { mark: "on", label: "已设置" };
}

/** The bot name in a Telegram channel label such as "@bot · Family". */
export function botNameOf(label: string): string {
  return label.split(" · ")[0] ?? label;
}

/** Why a bot token check failed, from the error word the server sent. */
export function botCheckProblem(code: string | null): string {
  if (isDemoCode(code)) return zhMessage(demoRefusal);
  return code === "telegram_token_rejected" || code === "unauthorized"
    ? "Telegram 不接受这个令牌。请从 BotFather 重新复制。"
    : "Headroom 无法连接到 Telegram，请重试。";
}
