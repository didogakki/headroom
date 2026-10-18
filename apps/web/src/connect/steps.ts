import type { AttemptState, AuthMethod, MethodAvailability } from "@headroom/core/contracts";

import type { Attempt } from "../api.ts";

/** Attempt states after which nothing more can happen. */
export function isTerminal(state: AttemptState): boolean {
  return (
    state === "succeeded" || state === "failed" || state === "expired" || state === "cancelled"
  );
}

/** The page asks the server again after `pollAfterMs`, or while the owner has nothing to type. */
export function shouldPoll(attempt: Attempt): boolean {
  if (isTerminal(attempt.state)) return false;
  return (
    attempt.pollAfterMs > 0 ||
    attempt.state === "awaiting_user" ||
    attempt.state === "validating" ||
    attempt.state === "created"
  );
}

/** Whether the server can start `method` here. A method the server did not report on is usable. */
export function isUsable(method: AuthMethod, availability: readonly MethodAvailability[]): boolean {
  return availability.find((entry) => entry.method === method)?.available !== false;
}

/**
 * The method a new attempt starts with: the first usable one that is not a file import, else the
 * first usable one. Null when the server can start none of them.
 */
export function defaultMethod(
  methods: readonly AuthMethod[],
  availability: readonly MethodAvailability[] = [],
): AuthMethod | null {
  const usable = methods.filter((method) => isUsable(method, availability));
  return usable.find((method) => method !== "import") ?? usable[0] ?? null;
}

/** Plain words for a method the server cannot start. `provider` is the display name, as in "Codex". */
export function unavailableNote(
  provider: string,
  entry: MethodAvailability,
  alternatives: readonly AuthMethod[],
): string {
  const need =
    entry.reason === "cli_not_installed"
      ? `服务器上需要安装 ${provider} CLI。`
      : "此服务器上不可用。";
  if (alternatives.includes("import")) return `${need}请安装它，或使用“导入文件”。`;
  if (alternatives.length > 0) return `${need}请安装它，或使用其他方式。`;
  return `${need}请安装它，然后重试。`;
}

export type Accepts = "url" | "code" | "url_or_code";

/** Choose the submit kind for a pasted value; "url_or_code" decides by shape. */
export function pasteInputKind(accepts: Accepts, value: string): "redirect" | "code" {
  if (accepts === "url") return "redirect";
  if (accepts === "code") return "code";
  return /^https?:\/\//i.test(value.trim()) ? "redirect" : "code";
}

const acceptsLabels: Record<Accepts, string> = {
  url: "你到达的地址",
  code: "显示的代码",
  url_or_code: "地址或代码",
};

export function acceptsLabel(accepts: Accepts): string {
  return acceptsLabels[accepts];
}

const acceptsPlaceholders: Record<Accepts, string> = {
  url: "http://localhost:…/callback?code=…",
  code: "粘贴代码",
  url_or_code: "粘贴地址或代码",
};

export function acceptsPlaceholder(accepts: Accepts): string {
  return acceptsPlaceholders[accepts];
}

/** "9:42" for the time left. Zero once it has passed. */
export function clockLeft(expiresAt: number, now: number): string {
  const seconds = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

const stoppedReasons = {
  expired: "批准已过期。未保存任何内容。",
  cancelled: "登录已取消。未保存任何内容。",
  failed: "服务商拒绝了此次登录。未保存任何内容。请检查账户后重试。",
} as const;

/** Plain words for each category of failure the server reports as "category: detail". */
const categoryReasons: Record<string, string> = {
  approval_expired: stoppedReasons.expired,
  approval_denied: "登录被拒绝。未保存任何内容。",
  authentication_required: stoppedReasons.failed,
  permission_denied: "此账户不能共享它的额度。未保存任何内容。",
  rate_limited: "服务商要求放慢速度。未保存任何内容。请一分钟后重试。",
  provider_unavailable: "服务商没有响应。未保存任何内容。请一分钟后重试。",
  identity_mismatch: "这与要重新连接的账户不是同一个账户。未保存任何内容。",
  invalid_response: "服务商的回复无法读取。未保存任何内容。请检查你粘贴的内容。",
  unsupported_metric: "服务商没有报告此账户的额度。未保存任何内容。",
  selection_required: "请先选择一个账户。未保存任何内容。",
  internal_error: "检查登录时出了问题。未保存任何内容。",
};

/** Plain words for why an attempt did not finish. Never shows the raw category or provider text. */
export function stoppedReason(attempt: Pick<Attempt, "state" | "error">): string {
  if (attempt.state === "expired") return stoppedReasons.expired;
  if (attempt.state === "cancelled") return stoppedReasons.cancelled;
  const category = attempt.error?.split(":")[0]?.trim() ?? "";
  return categoryReasons[category] ?? stoppedReasons.failed;
}
