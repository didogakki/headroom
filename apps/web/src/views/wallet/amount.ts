import { planLabel, providerName } from "@headroom/view-model/labels";
import type { OverviewConnection } from "@headroom/view-model/overview";
import { formatMoney } from "@headroom/view-model/wallet-money";
import type { Amount } from "@headroom/view-model/wallet";

import { zhAccountName } from "../../lib/zh.ts";

/** The figure to show for an amount: the converted one, or the original when there is no rate. */
export function figureText(amount: Amount): string {
  const money = amount.shown ?? amount.original;
  return money === null ? "—" : formatMoney(money);
}

/**
 * The muted line under a figure: the amount as entered when it was converted ("₹1,999 计费"), or "INR 无汇率"
 * when it could not be. Null when the figure is already what was entered. `suffix` follows the original.
 */
export function originalNote(amount: Amount, suffix = ""): string | null {
  if (amount.shown === null) return amount.noRate === null ? null : `${amount.noRate} 无汇率`;
  return amount.original === null ? null : `${formatMoney(amount.original)}${suffix}`;
}

/** "Claude Max 20x": the provider and its plan, or its account name when no plan is reported. */
export function renewalName(connection: OverviewConnection): string {
  return `${providerName(connection.provider)} ${planLabel(connection.plan) ?? zhAccountName(connection)}`;
}
