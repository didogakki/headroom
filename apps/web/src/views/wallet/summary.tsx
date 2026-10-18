import { Children, isValidElement, type ReactNode } from "react";

import { BrandMark, ChevronDownIcon } from "../../icons.tsx";
import { providerName } from "@headroom/view-model/labels";
import type { OverviewConnection } from "@headroom/view-model/overview";
import { formatMoney } from "@headroom/view-model/wallet-money";
import type { WalletSummary, WalletTopUp } from "@headroom/view-model/wallet";

import { zhAccountName, zhDay, zhLabel, zhMonthLabel } from "../../lib/zh.ts";
import { Pill } from "../../ui/pill.tsx";
import { Popover } from "../../ui/menu.tsx";
import { figureText, originalNote } from "./amount.ts";
import { Attention } from "./attention.tsx";
import {
  subscriptionIssues,
  topUpIssues,
  usageIssues,
  type AttentionFixes,
} from "./attention-items.ts";

/** One caption part. */
function Line(props: { readonly children: ReactNode }) {
  return <span>{props.children}</span>;
}

function Stat(props: {
  readonly label: string;
  /** The figure. `null` shows a dash: nothing to show is unknown, not zero. */
  readonly value: string | null;
  /** What shows in place of a missing figure. */
  readonly empty?: string;
  readonly unit?: string;
  /** The attention icon beside the label, when the figure leaves something out. */
  readonly attention?: ReactNode;
  /** Short parts of the caption under the figure; a dot splits them. */
  readonly children: ReactNode;
}) {
  const { value } = props;
  // `Children.toArray` drops null parts, so a part that renders nothing never leaves a dot behind.
  const caption: ReactNode[] = Children.toArray(props.children).flatMap<ReactNode>((part, index) =>
    index === 0 || !isValidElement(part)
      ? [part]
      : [
          // `Children.toArray` gave the part a stable key; the dot before it borrows it.
          <span key={`sep-${part.key}`} className="w-sep" aria-hidden="true">
            ·
          </span>,
          part,
        ],
  );
  return (
    <div className="w-stat">
      <dt>
        <span>{props.label}</span>
        {props.attention}
      </dt>
      <dd className={value === null ? "w-num unknown" : "w-num"}>
        {value ?? props.empty ?? "—"}
        {props.unit === undefined || value === null ? null : (
          <span className="unit">{props.unit}</span>
        )}
      </dd>
      <dd className="w-cap">{caption}</dd>
    </div>
  );
}

/** "3 笔充值": Chinese counts take one word, whatever the number. */
function counted(count: number, noun: string): string {
  return `${count} ${noun}`;
}

/** One top-up: provider and account, date and credits, then the amount with what was billed beneath it. */
function TopUpRow(props: {
  readonly topUp: WalletTopUp;
  readonly connection: OverviewConnection | undefined;
}) {
  const { topUp, connection } = props;
  const note = topUp.amount === null ? null : originalNote(topUp.amount, " 计费");
  const detail = [
    zhDay(topUp.date),
    topUp.credits === null ? null : `${topUp.credits.toLocaleString("en-US")} 积分`,
  ]
    .filter((part) => part !== null)
    .join(" · ");
  const who = connection === undefined ? null : zhAccountName(connection);
  return (
    <li>
      {connection === undefined ? <span /> : <BrandMark provider={connection.provider} />}
      <span className="w-pop-text">
        <span className="w-pop-name">
          {connection === undefined ? (
            "已删除的账户"
          ) : (
            <>
              {providerName(connection.provider)}
              {who === null ? null : (
                <>
                  {" · "}
                  <span className={who.includes("@") ? "who" : undefined}>{who}</span>
                </>
              )}
            </>
          )}
        </span>
        <span className="w-pop-sub">{detail}</span>
      </span>
      <span className="w-pop-amount num">
        {topUp.kind === "free" ? (
          <Pill tone="quiet">免费</Pill>
        ) : topUp.amount === null ? (
          <span className="w-pop-sub">未设置价格</span>
        ) : (
          <span className="w-pop-name">{figureText(topUp.amount)}</span>
        )}
        {note === null ? null : <span className="w-pop-sub">{note}</span>}
      </span>
    </li>
  );
}

/** This month's top-ups in a popover: the month and a count, a row per top-up, then the paid total. */
function TopUpsPopover(props: {
  readonly summary: WalletSummary;
  readonly connections: ReadonlyMap<string, OverviewConnection>;
  readonly caption: string;
}) {
  const { items, paid, paidCount, unpriced } = props.summary.topUpsThisMonth;
  return (
    <Popover
      label={`本月充值：${props.caption}`}
      panelLabel="本月充值"
      panelClassName="notif w-topups-pop"
      triggerClassName="w-cap-trigger"
      // The caption sits at the left of its column, so the panel opens rightward and never covers the next stat.
      align="start"
      trigger={
        <>
          {props.caption}
          <ChevronDownIcon />
        </>
      }
      openOnHover
    >
      <p className="w-pop-head">
        <span>{zhMonthLabel(props.summary.today.slice(0, 7))}</span>
        <span>{counted(items.length, "笔充值")}</span>
      </p>
      <ul className="w-pop-list">
        {items.map((topUp) => (
          <TopUpRow
            key={topUp.id}
            topUp={topUp}
            connection={props.connections.get(topUp.connectionId)}
          />
        ))}
      </ul>
      <p className="w-pop-total">
        {paidCount === 0 ? (
          <span>没有付费充值</span>
        ) : (
          <>
            <span>已付合计</span>
            <span className="num">{formatMoney(paid.money)}</span>
          </>
        )}
      </p>
      {paid.missing === 0 ? null : (
        <p className="w-pop-note">{counted(paid.missing, "笔金额")}没有汇率。</p>
      )}
      {unpriced === 0 ? null : (
        <p className="w-pop-note">{counted(unpriced, "笔充值")}还没有价格，已从合计中排除。</p>
      )}
    </Popover>
  );
}

/** Usage spend by account in a popover, like the top-ups one: who, what the provider reports, how much, then the total. */
function UsageSpendPopover(props: { readonly summary: WalletSummary; readonly caption: string }) {
  const accounts = props.summary.providers
    .flatMap((provider) => provider.accounts)
    .flatMap((account) =>
      // A reported zero adds nothing to the breakdown; an amount with no rate still shows, marked.
      account.usageSpend === null || account.usageSpend.shown?.minor === 0
        ? []
        : [{ connection: account.connection, spend: account.usageSpend }],
    )
    .toSorted((a, b) => (b.spend.shown?.minor ?? 0) - (a.spend.shown?.minor ?? 0));
  const { usageSpend } = props.summary;
  return (
    <Popover
      label={`用量支出：${props.caption}`}
      panelLabel="按账户划分的用量支出"
      panelClassName="notif w-topups-pop"
      triggerClassName="w-cap-trigger"
      align="start"
      trigger={
        <>
          {props.caption}
          <ChevronDownIcon />
        </>
      }
      openOnHover
    >
      <p className="w-pop-head">
        <span>由服务商报告</span>
        <span>{counted(accounts.length, "个账户")}</span>
      </p>
      <ul className="w-pop-list">
        {accounts.map(({ connection, spend }) => {
          const who = zhAccountName(connection);
          const note = originalNote(spend, "");
          return (
            <li key={connection.id}>
              <BrandMark provider={connection.provider} />
              <span className="w-pop-text">
                <span className="w-pop-name">
                  {providerName(connection.provider)}
                  {" · "}
                  <span className={who.includes("@") ? "who" : undefined}>{who}</span>
                </span>
                <span className="w-pop-sub">{zhLabel(spend.label)}</span>
              </span>
              <span className="w-pop-amount num">
                <span className="w-pop-name">{figureText(spend)}</span>
                {note === null ? null : <span className="w-pop-sub">{note}</span>}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="w-pop-total">
        <span>合计</span>
        <span className="num">{formatMoney(usageSpend.money)}</span>
      </p>
      {usageSpend.missing === 0 ? null : (
        <p className="w-pop-note">{counted(usageSpend.missing, "笔金额")}没有汇率。</p>
      )}
    </Popover>
  );
}

/** Paid subscriptions in a popover: who, cycle and renewal, the monthly figure with the billed one beneath. */
function SubscriptionsPopover(props: {
  readonly summary: WalletSummary;
  readonly caption: string;
}) {
  const { summary } = props;
  const paid = summary.providers
    .flatMap((provider) => provider.accounts)
    .filter((account) => account.cost?.kind === "paid");
  const { free, included } = summary.counts;
  const left = [
    free > 0 ? `${free} 个免费` : null,
    included > 0 ? `${included} 个包含在其他订阅中` : null,
  ].filter((part) => part !== null);
  return (
    <Popover
      label={`订阅：${props.caption}`}
      panelLabel="按账户划分的付费订阅"
      panelClassName="notif w-topups-pop"
      triggerClassName="w-cap-trigger"
      align="start"
      trigger={
        <>
          {props.caption}
          <ChevronDownIcon />
        </>
      }
      openOnHover
    >
      <p className="w-pop-head">
        <span>每月</span>
        <span>{counted(paid.length, "个付费账户")}</span>
      </p>
      <ul className="w-pop-list">
        {paid.map((account) => {
          const { connection, cost, monthly, billed } = account;
          const who = zhAccountName(connection);
          const note = monthly === null ? null : originalNote(monthly, " / 月");
          const annual = cost?.kind === "paid" && cost.cycle === "annual";
          const detail = [
            annual ? "按年" : "按月",
            annual && billed !== null ? `${figureText(billed)} / 年` : null,
            account.nextRenewal === null ? null : `${zhDay(account.nextRenewal)}续订`,
          ]
            .filter((part) => part !== null)
            .join(" · ");
          return (
            <li key={connection.id}>
              <BrandMark provider={connection.provider} />
              <span className="w-pop-text">
                <span className="w-pop-name">
                  {providerName(connection.provider)}
                  {" · "}
                  <span className={who.includes("@") ? "who" : undefined}>{who}</span>
                </span>
                <span className="w-pop-sub">{detail}</span>
              </span>
              <span className="w-pop-amount num">
                <span className="w-pop-name">{monthly === null ? "—" : figureText(monthly)}</span>
                {note === null ? null : <span className="w-pop-sub">{note}</span>}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="w-pop-total">
        <span>每月合计</span>
        <span className="num">{formatMoney(summary.monthly.money)}</span>
      </p>
      {summary.monthly.missing === 0 ? null : (
        <p className="w-pop-note">{counted(summary.monthly.missing, "笔金额")}没有汇率。</p>
      )}
      {left.length === 0 ? null : (
        <p className="w-pop-note">{left.join(" · ")}未列出：它们不计入合计。</p>
      )}
    </Popover>
  );
}

/** The four stats in one bordered group, split by hairlines. */
export function SummaryBand(
  props: AttentionFixes & {
    readonly summary: WalletSummary;
    readonly connections: readonly OverviewConnection[];
  },
) {
  const { summary } = props;
  const byId = new Map(props.connections.map((connection) => [connection.id, connection]));
  const { counts } = summary;
  const priced = counts.paid + counts.free + counts.included > 0;

  const spenders = summary.providers.filter((provider) =>
    provider.accounts.some((account) => account.usageSpend !== null),
  ).length;

  const topUps = summary.topUpsThisMonth;
  const topUpCaption = [
    topUps.paidCount > 0 ? `${topUps.paidCount} 笔付费` : null,
    topUps.freeCount > 0 ? `${topUps.freeCount} 笔免费` : null,
  ]
    .filter((part) => part !== null)
    .join(" · ");

  const subscriptions = subscriptionIssues(summary, props);
  const usage = usageIssues(summary);
  const topUpItems = topUpIssues(summary, byId, props);

  return (
    <dl className="w-band">
      {priced ? (
        <Stat
          label="订阅"
          value={formatMoney(summary.monthly.money)}
          unit="/ 月"
          attention={<Attention title="订阅" items={subscriptions} />}
        >
          {counts.paid === 0 ? (
            <Line>没有付费订阅</Line>
          ) : (
            <SubscriptionsPopover summary={summary} caption={`${counts.paid} 个付费`} />
          )}
        </Stat>
      ) : (
        <Stat label="订阅" value={null} empty="未设置">
          <Line>为每个账户设置费用</Line>
        </Stat>
      )}
      {spenders === 0 ? (
        <Stat label="用量支出" value={null}>
          <Line>没有账户报告支出</Line>
        </Stat>
      ) : (
        <Stat
          label="用量支出"
          value={formatMoney(summary.usageSpend.money)}
          attention={<Attention title="用量支出" items={usage} />}
        >
          <UsageSpendPopover summary={summary} caption={`来自 ${spenders} 个服务商`} />
        </Stat>
      )}
      <Stat
        label="本月充值"
        value={formatMoney(topUps.paid.money)}
        attention={<Attention title="本月充值" items={topUpItems} />}
      >
        {topUps.items.length === 0 ? (
          <Line>本月没有</Line>
        ) : (
          <TopUpsPopover summary={summary} connections={byId} caption={topUpCaption} />
        )}
      </Stat>
      <Stat
        label="本月总支出"
        value={formatMoney(summary.allIn.money)}
        attention={
          <Attention
            title="本月总支出"
            items={[...(priced ? subscriptions : []), ...usage, ...topUpItems]}
          />
        }
      >
        <Line>套餐、用量和充值</Line>
      </Stat>
    </dl>
  );
}
