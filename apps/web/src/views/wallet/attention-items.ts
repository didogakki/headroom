import type { OverviewConnection } from "@headroom/view-model/overview";
import type { Amount, WalletSummary, WalletTopUp } from "@headroom/view-model/wallet";

import { zhDay, zhLabel } from "../../lib/zh.ts";

/** One thing a total leaves out, named exactly, with the fix when there is one. */
export interface AttentionItem {
  readonly key: string;
  /** The account it is on; undefined for a top-up whose account was removed. */
  readonly connection: OverviewConnection | undefined;
  readonly issue: string;
  readonly fix?: { readonly label: string; readonly run: () => void };
}

export interface AttentionFixes {
  readonly onSetCost: (connectionId: string) => void;
  readonly onEditTopUp: (topUp: WalletTopUp) => void;
}

function noRate(amount: Amount | null): boolean {
  return amount !== null && amount.shown === null;
}

function rateIssue(amount: Amount, what: string): string {
  return `${what}以 ${amount.noRate ?? "某种货币"} 计价，今天没有该货币的汇率，因此未计入。`;
}

function topUpWhen(topUp: WalletTopUp): string {
  const credits = topUp.credits === null ? "" : `（${topUp.credits.toLocaleString("en-US")} 积分）`;
  return `${zhDay(topUp.date)}的充值${credits}`;
}

/** Accounts with no cost, and subscription costs with no exchange rate. */
export function subscriptionIssues(summary: WalletSummary, fixes: AttentionFixes): AttentionItem[] {
  return summary.providers
    .flatMap((group) => group.accounts)
    .flatMap((account): AttentionItem[] => {
      const { connection } = account;
      if (account.cost === null) {
        return [
          {
            key: `cost:${connection.id}`,
            connection,
            issue: "未设置费用，因此未计入任何合计。",
            fix: { label: "设置费用", run: () => fixes.onSetCost(connection.id) },
          },
        ];
      }
      if (account.monthly !== null && noRate(account.monthly)) {
        return [
          {
            key: `cost-rate:${connection.id}`,
            connection,
            issue: rateIssue(account.monthly, "费用"),
          },
        ];
      }
      return [];
    });
}

/** Usage spend the provider reported in a currency with no exchange rate. */
export function usageIssues(summary: WalletSummary): AttentionItem[] {
  return summary.providers
    .flatMap((group) => group.accounts)
    .flatMap((account): AttentionItem[] =>
      account.usageSpend !== null && noRate(account.usageSpend)
        ? [
            {
              key: `usage-rate:${account.connection.id}`,
              connection: account.connection,
              issue: rateIssue(account.usageSpend, zhLabel(account.usageSpend.label)),
            },
          ]
        : [],
    );
}

/** This month's paid top-ups with no price yet, or a price with no exchange rate. */
export function topUpIssues(
  summary: WalletSummary,
  connections: ReadonlyMap<string, OverviewConnection>,
  fixes: AttentionFixes,
): AttentionItem[] {
  return summary.topUpsThisMonth.items.flatMap((topUp): AttentionItem[] => {
    if (topUp.kind !== "paid") return [];
    const connection = connections.get(topUp.connectionId);
    if (topUp.price === null) {
      const found = topUp.source === "detected" ? "Headroom 是从余额上升检测到它的。" : "";
      return [
        {
          key: `price:${topUp.id}`,
          connection,
          issue: `${topUpWhen(topUp)}没有价格，因此未计入。${found}`,
          fix: { label: "添加价格", run: () => fixes.onEditTopUp(topUp) },
        },
      ];
    }
    if (noRate(topUp.amount) && topUp.amount !== null) {
      return [
        {
          key: `top-up-rate:${topUp.id}`,
          connection,
          issue: rateIssue(topUp.amount, topUpWhen(topUp)),
        },
      ];
    }
    return [];
  });
}
