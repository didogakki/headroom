import type { ReactNode } from "react";

import { BrandMark } from "../../icons.tsx";
import { awaitingFirstRefresh, providerName, statusOf } from "@headroom/view-model/labels";
import { formatNumber } from "@headroom/view-model/present";
import { zhAccountName, zhCaption, zhLabel, zhWindow } from "../../lib/zh.ts";
import { Bar } from "../../ui/bar.tsx";
import { cx } from "../../ui/cx.ts";
import { StatusPill, statusKindOf } from "../../ui/pill.tsx";
import type { Row } from "./compare-model.ts";
import { figureOfRoom, figureOfWindow, type Figure, type Look } from "./figure.ts";
import { ResetLine } from "./parts.tsx";

/** One window or balance of a single account: the figure, its name, a thin bar and a line of words. */
function Line(props: {
  readonly figure: Figure;
  readonly name: string;
  readonly caption: ReactNode;
}) {
  const { figure, name } = props;
  if (figure.kind === "known") {
    return (
      <div className="line-row">
        <div className="top-line">
          <b>{figure.text}</b>
          <span className="window">{name}</span>
          {figure.caption === null ? null : (
            <span className={cx("tone", figure.tone)}>{zhCaption(figure.caption)}</span>
          )}
        </div>
        <Bar
          thin
          percent={figure.fill}
          tone={figure.tone}
          valueNow={figure.used}
          label={`${name} 已用 ${figure.used}%`}
        />
        <div className="cap">{props.caption}</div>
      </div>
    );
  }
  const words =
    figure.kind === "not_started" ? "未开始" : figure.kind === "unlimited" ? "无限制" : "—";
  return (
    <div className="line-row">
      <div className="top-line">
        <b className={figure.kind === "unknown" ? "muted" : undefined}>{words}</b>
        <span className="window">{name}</span>
      </div>
      {figure.kind === "unlimited" ? null : <Bar thin unknown label={`${name} ${words}`} />}
      <div className="cap">{props.caption}</div>
    </div>
  );
}

/**
 * A provider with one account has nothing to compare, so its card is compact: the brand, the account and its
 * status, then each window as a thin bar with its figure and reset.
 */
export function SingleCard(props: { readonly row: Row; readonly look: Look }) {
  const { row, look } = props;
  const { connection } = row;
  const provider = connection.provider;
  const kind = awaitingFirstRefresh(connection)
    ? "waiting"
    : statusKindOf(statusOf(connection).word);
  return (
    <article className={cx("cmp-single", row.inactive && "dim")}>
      <header>
        <BrandMark provider={provider} size={24} />
        <span className="titles">
          <span className="pname">{providerName(provider)}</span>
          <span className="sub">
            {zhAccountName(connection)}
            {row.plan === null ? null : ` · ${row.plan}`}
          </span>
        </span>
        <StatusPill kind={kind} />
      </header>
      <div className="rows">
        {row.windows.map((window) => (
          <Line
            key={window.key}
            figure={figureOfWindow(window, provider, look)}
            name={
              window.window === null
                ? zhLabel(window.label)
                : `${zhLabel(window.label)} · ${zhWindow(window.window)}`
            }
            caption={<ResetLine window={window} />}
          />
        ))}
        {row.balance === null ? null : (
          <Line
            figure={
              row.balance.total === null || row.room.left === null
                ? { kind: "unknown" }
                : figureOfRoom(row.room.left, provider, look)
            }
            name="积分余额"
            caption={
              row.balance.total === null
                ? `剩余 ${formatNumber(row.balance.value, row.balance.decimals)} 积分`
                : `剩余 ${formatNumber(row.balance.value, row.balance.decimals)}，共 ${formatNumber(row.balance.total, row.balance.decimals)}`
            }
          />
        )}
        {row.windows.length === 0 && row.balance === null ? (
          <p className="none">暂无报告。</p>
        ) : null}
      </div>
    </article>
  );
}
