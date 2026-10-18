import { useId } from "react";

import { BrandMark, PencilIcon, PlusIcon } from "../../icons.tsx";
import { planLabel, providerName } from "@headroom/view-model/labels";
import { presentPanel } from "@headroom/view-model/present";
import { formatMoney } from "@headroom/view-model/wallet-money";
import type { WalletAccount, WalletProvider } from "@headroom/view-model/wallet";

import { useNow } from "../../lib/now.ts";
import { useSettings } from "../../lib/settings.tsx";
import { zhAccountName, zhBanked, zhCreditBalance, zhDay, zhLabel } from "../../lib/zh.ts";
import { Button } from "../../ui/button.tsx";
import { Pill } from "../../ui/pill.tsx";
import { headlineOf, RowLimit } from "../detailed/limit.tsx";
import { figureText, originalNote } from "./amount.ts";

/** What the account costs per month: a price, Free, Included, or Not Set. */
function CostCell(props: { readonly account: WalletAccount }) {
  const { cost, monthly, billed } = props.account;
  if (cost === null) return <span className="w-unset">未设置</span>;
  if (cost.kind === "free") return <Pill tone="quiet">免费</Pill>;
  if (cost.kind === "included") {
    return (
      <span className="w-included">
        <Pill tone="quiet">已包含</Pill>
        <span className="muted">含在 {cost.includedWith} 中</span>
      </span>
    );
  }
  if (monthly === null || billed === null) return null;
  const yearly = cost.cycle === "annual" ? (billed.original ?? billed.shown) : null;
  const notes: string[] = [];
  // No rate: say so. A yearly plan names its yearly price; a monthly one names what it was converted from.
  if (monthly.shown === null) notes.push(originalNote(monthly) ?? "");
  if (yearly !== null) notes.push(`${formatMoney(yearly)} / 年`);
  else if (monthly.shown !== null) notes.push(originalNote(monthly, " 计费") ?? "");
  return (
    <span className="w-cost">
      <span className="w-figure num">{figureText(monthly)}</span>
      {notes
        .filter((note) => note !== "")
        .map((note) => (
          <span key={note} className="muted num">
            {note}
          </span>
        ))}
    </span>
  );
}

/** Usage spend the provider reports: the figure alone, with what it is in the tooltip. */
function SpendCell(props: { readonly account: WalletAccount }) {
  const { usageSpend } = props.account;
  if (usageSpend === null) return null;
  const note = originalNote(usageSpend);
  return (
    <span className="w-cost" title={zhLabel(usageSpend.label)}>
      <span className="w-figure num">{figureText(usageSpend)}</span>
      {note === null ? null : <span className="muted num">{note}</span>}
    </span>
  );
}

/**
 * The provider credits the account holds, in the provider's own unit and never converted to money: the balance,
 * then banked resets beneath it. A dash when the provider reports none.
 */
function CreditsCell(props: { readonly account: WalletAccount }) {
  const { credits } = props.account;
  if (credits === null) return <span className="muted">—</span>;
  const { balance, resets } = credits;
  return (
    <span className="w-cost">
      {balance === null ? null : <span className="w-figure num">{zhCreditBalance(balance)}</span>}
      {resets === null ? null : (
        <span className={balance === null ? "w-figure num" : "muted num"}>{zhBanked(resets)}</span>
      )}
    </span>
  );
}

/**
 * The account's tightest current limit, as the Detailed view shows it. Unknown shows a dash, never zero. A credit
 * balance is not repeated here: it has its own Credits column.
 */
function UsedCell(props: { readonly account: WalletAccount }) {
  const { connection } = props.account;
  const now = useNow();
  const headline = headlineOf(connection, presentPanel(connection, now).cells);
  if (headline.kind === "balance") return <span className="muted">—</span>;
  return <RowLimit headline={headline} />;
}

function AccountRow(props: {
  readonly account: WalletAccount;
  readonly usedLabel: string;
  readonly onEdit: () => void;
  readonly onAddTopUp: () => void;
}) {
  const { account } = props;
  const { connection, nextRenewal } = account;
  const name = zhAccountName(connection);
  const plan = planLabel(connection.plan);
  return (
    <li className="w-row">
      <div className="w-who">
        <span className="w-name">
          {name}
          {plan === null ? null : (
            <span className="plan">
              <span className="sep" aria-hidden="true">
                ·
              </span>
              {plan}
            </span>
          )}
        </span>
        {connection.identity === null ? null : (
          <span className="w-sub who">{connection.identity}</span>
        )}
      </div>
      <div className="w-col w-c-cost" data-label="费用 / 月">
        <CostCell account={account} />
      </div>
      <div className="w-col w-c-used" data-label={props.usedLabel}>
        <UsedCell account={account} />
      </div>
      <div className="w-col w-c-renew" data-label="续订">
        {nextRenewal === null ? (
          <span className="muted">—</span>
        ) : (
          <span>{zhDay(nextRenewal)}</span>
        )}
      </div>
      <div className="w-col w-c-spend" data-label="用量支出">
        <SpendCell account={account} />
      </div>
      <div className="w-col w-c-credits" data-label="积分">
        <CreditsCell account={account} />
      </div>
      <div className="w-act">
        {account.cost === null ? (
          <Button variant="quiet" size="sm" onClick={props.onEdit}>
            设置费用
          </Button>
        ) : (
          <Button variant="quiet" size="sm" aria-label={`编辑${name}的费用`} onClick={props.onEdit}>
            <PencilIcon />
          </Button>
        )}
        <Button
          variant="quiet"
          size="sm"
          aria-label={`为${name}添加充值`}
          title="添加充值"
          onClick={props.onAddTopUp}
        >
          <PlusIcon />
        </Button>
      </div>
    </li>
  );
}

/** The provider's monthly subtotal: "$300 / 月", or 未设置 when no account has a cost. */
function Subtotal(props: { readonly group: WalletProvider }) {
  const { group } = props;
  if (group.accounts.every((account) => account.cost === null)) {
    return <span className="w-subtotal muted">未设置</span>;
  }
  return (
    <span className="w-subtotal">
      <span className="num">{formatMoney(group.monthly.money)}</span>
      <span className="muted"> / 月</span>
      {group.monthly.missing > 0 ? (
        <span className="muted"> · {group.monthly.missing} 项未计入</span>
      ) : null}
    </span>
  );
}

/** A provider's group row: mark, name, account count and the monthly subtotal. */
function GroupRow(props: { readonly group: WalletProvider }) {
  const { group } = props;
  return (
    <li className="w-group" data-accent={group.provider}>
      <BrandMark provider={group.provider} />
      <h3>{providerName(group.provider)}</h3>
      {group.accounts.length > 1 ? (
        <span className="muted">{group.accounts.length} 个账户</span>
      ) : null}
      <Subtotal group={group} />
    </li>
  );
}

/**
 * Every account in one bordered table: a column header row once, then per provider a group row with its
 * subtotal followed by that provider's accounts.
 */
export function AccountsTable(props: {
  readonly groups: readonly WalletProvider[];
  readonly onEdit: (connectionId: string) => void;
  readonly onAddTopUp: (connectionId: string) => void;
}) {
  const headingId = useId();
  // The limit shows as used or as left, following the owner's Limits setting; the column says which.
  const usedLabel = useSettings().settings.limitsView === "left" ? "剩余" : "已用";
  return (
    <section className="provider w-accounts" aria-labelledby={headingId}>
      <header>
        <h2 id={headingId}>账户</h2>
      </header>
      <div className="w-card">
        <div className="w-colhead">
          <span>账户</span>
          <span>费用 / 月</span>
          <span>{usedLabel}</span>
          <span>续订</span>
          <span>用量支出</span>
          <span>积分</span>
          <span />
        </div>
        <ul className="w-rows">
          {props.groups.flatMap((group) => [
            <GroupRow key={group.provider} group={group} />,
            ...group.accounts.map((account) => (
              <AccountRow
                key={account.connection.id}
                account={account}
                usedLabel={usedLabel}
                onEdit={() => props.onEdit(account.connection.id)}
                onAddTopUp={() => props.onAddTopUp(account.connection.id)}
              />
            )),
          ])}
        </ul>
      </div>
    </section>
  );
}
