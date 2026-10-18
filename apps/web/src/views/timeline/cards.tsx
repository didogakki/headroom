import { useId, useState, type ReactNode } from "react";

import type { OverviewConnection } from "../../api.ts";
import { BrandMark } from "../../icons.tsx";
import type { TimeStyle } from "@headroom/view-model/time";
import { displayMeter } from "@headroom/view-model/tone";
import { zhCaption, zhCountdown, zhExactFull, zhLabel, zhShort } from "../../lib/zh.ts";
import { cx } from "../../ui/cx.ts";
import {
  expiresSoonMs,
  upNextGroups,
  type RunningLow,
  type SavedResets,
  type UpNextItem,
} from "./lanes.ts";
import { dayClock, shortDay } from "./range.ts";
import { kindLabel, laneName, sharedIdentity, type TipContext } from "./tips.ts";

/** The two cards under the grid: what resets next, and what needs watching. */

const rowLimit = 6;

/** The groups of Up Next, keyed by the English label `upNextGroups` gives them. */
const groupTitles: Readonly<Record<string, string>> = {
  "Next 24 Hours": "未来 24 小时",
  "This Week": "本周",
  Later: "更晚",
};

interface Look extends TipContext {
  readonly timeStyle: TimeStyle;
  /** Accounts that share a name with another of their provider; see `sharedNames`. */
  readonly shared: ReadonlySet<string>;
}

/** A small tone bar with the figure the owner reads now; "未报告" when unknown. */
function Usage(props: { readonly used: number | null; readonly look: Look }) {
  const { used, look } = props;
  if (used === null) return <span className="tl-use tl-unk">未报告</span>;
  const shown = displayMeter(used, look.view, look.low, 0);
  return (
    <span className="tl-use" data-tone={shown.tone ?? undefined}>
      <span className="tl-mbar" aria-hidden="true">
        <i style={{ width: `${shown.fill ?? 0}%` }} />
      </span>
      <b>{`${shown.value ?? 0}%`}</b>
      <span className="tl-sr">{look.view === "left" ? " 剩余" : " 已用"}</span>
    </span>
  );
}

/** Countdown over the short time, or the other way round under the Exact time style. */
function WhenCell(props: { readonly at: number; readonly look: Look }) {
  const { at, look } = props;
  const count = `${zhCountdown(at, look.now)}后`;
  const exact = dayClock(at, look.clock);
  const first = look.timeStyle === "countdown" ? count : exact;
  const second = look.timeStyle === "countdown" ? exact : count;
  return (
    <span className="tl-when">
      <b>{first}</b>
      <span>{second}</span>
    </span>
  );
}

/** The identity under an account name, only when the name alone would not tell two accounts apart. */
export function SharedIdentity(props: {
  readonly connection: OverviewConnection;
  readonly shared: ReadonlySet<string>;
}) {
  const identity = sharedIdentity(props.connection, props.shared);
  return identity === null ? null : <span className="who tl-shared">{identity}</span>;
}

function Row(props: {
  readonly connection: OverviewConnection;
  readonly shared: ReadonlySet<string>;
  readonly dim: boolean;
  readonly title?: string;
  readonly what: string;
  readonly children: ReactNode;
}) {
  const { connection } = props;
  return (
    <li className={cx(props.dim && "tl-dim")} title={props.title}>
      <BrandMark provider={connection.provider} />
      <span className="tl-what">
        <b>{laneName(connection)}</b>
        <SharedIdentity connection={connection} shared={props.shared} />
        <span>{props.what}</span>
      </span>
      {props.children}
    </li>
  );
}

/** The next resets in time order under 未来 24 小时, 本周 and 更晚; six rows, then 显示全部. */
export function UpNextCard(props: { readonly items: readonly UpNextItem[]; readonly look: Look }) {
  const { items, look } = props;
  const [all, setAll] = useState(false);
  const titleId = useId();
  const groups = upNextGroups(items, look.now, all ? null : rowLimit);
  return (
    <section className="tl-card" aria-labelledby={titleId}>
      <h2 id={titleId}>即将发生</h2>
      <div className="tl-card-body">
        {items.length === 0 ? <p className="tl-empty">接下来没有重置。</p> : null}
        {groups.map((group) => (
          <div key={group.label}>
            <h3 className="tl-sub">{groupTitles[group.label] ?? group.label}</h3>
            <ul>
              {group.items.map((item) => (
                <Row
                  key={item.id}
                  connection={item.connection}
                  shared={look.shared}
                  dim={item.inactive}
                  title={zhExactFull(item.end, look.now, look.clock)}
                  what={`${kindLabel(item.kind)}${item.kind === "cycle" ? "结束" : "重置"}`}
                >
                  <Usage used={item.used} look={look} />
                  <WhenCell at={item.end} look={look} />
                </Row>
              ))}
            </ul>
          </div>
        ))}
        {items.length > rowLimit ? (
          <button
            type="button"
            className="tl-more"
            aria-expanded={all}
            onClick={() => setAll((was) => !was)}
          >
            {all ? "收起" : `显示全部 ${items.length} 项`}
          </button>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Windows running low with when room returns, and the banked resets with their expiries. A section with nothing in
 * it is left out; with both empty, one line says so.
 */
export function WatchListCard(props: {
  readonly low: readonly RunningLow[];
  readonly saved: readonly SavedResets[];
  readonly look: Look;
}) {
  const { low, saved, look } = props;
  const titleId = useId();
  return (
    <section className="tl-card" aria-labelledby={titleId}>
      <h2 id={titleId}>观察列表</h2>
      <div className="tl-card-body">
        {low.length === 0 && saved.length === 0 ? (
          <p className="tl-empty">目前没有需要关注的内容。</p>
        ) : null}
        {low.length === 0 ? null : (
          <>
            <h3 className="tl-sub">余量偏低，直到</h3>
            <ul>
              {low.map((row) => (
                <Row
                  key={row.id}
                  connection={row.connection}
                  shared={look.shared}
                  dim={row.inactive}
                  title={zhExactFull(row.back, look.now, look.clock)}
                  what={`${zhShort(row.meter.short)} ${zhCaption(row.caption)}`}
                >
                  <Usage used={row.used} look={look} />
                  <WhenCell at={row.back} look={look} />
                </Row>
              ))}
            </ul>
          </>
        )}
        {saved.length === 0 ? null : (
          <>
            <h3 className="tl-sub">已存重置</h3>
            <ul>
              {saved.map((row) => {
                const first = row.expiries[0];
                return (
                  <li
                    key={row.connection.id}
                    className={cx("tl-bankrow", row.inactive && "tl-dim")}
                  >
                    <BrandMark provider={row.connection.provider} />
                    <span className="tl-what">
                      <b>{laneName(row.connection)}</b>
                      <SharedIdentity connection={row.connection} shared={look.shared} />
                      <span>
                        {`${row.count} 个${zhLabel(row.label)}`}
                        {first === undefined ? "" : ` · 最早 ${zhCountdown(first, look.now)}后到期`}
                      </span>
                    </span>
                    {row.soon ? <span className="tl-soon">即将到期</span> : null}
                    <span className="tl-exps">
                      {row.expiries.map((at) => (
                        <span
                          key={at}
                          className={cx("tl-exp", at - look.now < expiresSoonMs && "tl-exp-soon")}
                          title={zhExactFull(at, look.now, look.clock)}
                        >
                          <i aria-hidden="true" />
                          {shortDay(at)}
                        </span>
                      ))}
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
