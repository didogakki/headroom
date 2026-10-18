import { useId, useState } from "react";

import { BrandMark } from "../../icons.tsx";
import type { TimeStyle } from "@headroom/view-model/time";
import { zhAgo, zhExactFull } from "../../lib/zh.ts";
import { cx } from "../../ui/cx.ts";
import type { ResetRow } from "./resets.ts";
import { SharedIdentity } from "./cards.tsx";
import { laneName, type TipContext } from "./tips.ts";

const rowLimit = 8;

interface Look extends TipContext {
  readonly timeStyle: TimeStyle;
  /** Accounts that share a name with another of their provider; see `sharedNames`. */
  readonly shared: ReadonlySet<string>;
}

/** How long ago over the exact time, or the other way round under the Exact time style. */
function Ago(props: { readonly at: number; readonly look: Look }) {
  const { at, look } = props;
  const ago = zhAgo(at, look.now);
  const exact = zhExactFull(at, look.now, look.clock);
  return (
    <span className="tl-when">
      <b>{look.timeStyle === "countdown" ? ago : exact}</b>
      <span>{look.timeStyle === "countdown" ? exact : ago}</span>
    </span>
  );
}

/**
 * Resets the owner did not start, newest first, from the last 7 days: early resets, banked resets used or granted,
 * and Headroom's auto-resets. Eight rows, then Show All. A table on wider screens; on a phone, a list that leads
 * with what happened, so a row does not read as another account.
 */
export function RecentResetsCard(props: {
  readonly rows: readonly ResetRow[];
  readonly look: Look;
}) {
  const { rows, look } = props;
  const [all, setAll] = useState(false);
  const titleId = useId();
  const shown = all ? rows : rows.slice(0, rowLimit);
  return (
    <section className="tl-card tl-resets-card" aria-labelledby={titleId}>
      <div className="tl-card-head">
        <h2 id={titleId}>最近的重置</h2>
        <span>最近 7 天</span>
      </div>
      {rows.length === 0 ? (
        <p className="tl-empty">最近 7 天没有重置。</p>
      ) : (
        <table className="tl-resets">
          <thead>
            <tr>
              <th scope="col">时间</th>
              <th scope="col">账户</th>
              <th scope="col">额度</th>
              <th scope="col">发生了什么</th>
              <th scope="col">变化</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.id} className={cx(row.inactive && "tl-dim")}>
                <td className="tl-r-when">
                  <Ago at={row.at} look={look} />
                </td>
                <th scope="row" className="tl-r-acct">
                  <span className="tl-r-who">
                    <BrandMark provider={row.connection.provider} />
                    <span className="tl-r-name">
                      <span>{laneName(row.connection)}</span>
                      <SharedIdentity connection={row.connection} shared={look.shared} />
                    </span>
                  </span>
                </th>
                <td className="tl-r-limit">{row.limit}</td>
                <td className="tl-r-event">
                  <span className="tl-r-what">
                    <span className="tl-r-head">
                      <i className="tl-r-mark" data-mark={row.mark} aria-hidden="true" />
                      <b>{row.what}</b>
                    </span>
                    {row.detail === null ? null : <span className="tl-r-detail">{row.detail}</span>}
                  </span>
                </td>
                <td className="tl-r-change">{row.change ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rows.length === 0 ? null : (
        <ul className="tl-resets-list">
          {shown.map((row) => (
            <li key={row.id} className={cx(row.inactive && "tl-dim")}>
              <i className="tl-r-mark" data-mark={row.mark} aria-hidden="true" />
              <b className="tl-rl-what">{row.what}</b>
              <span className="tl-rl-ago" title={zhExactFull(row.at, look.now, look.clock)}>
                {zhAgo(row.at, look.now)}
              </span>
              <BrandMark provider={row.connection.provider} />
              <span className="tl-rl-who">
                {row.onLimit
                  ? `${laneName(row.connection)} · ${row.limit}`
                  : laneName(row.connection)}
              </span>
              <SharedIdentity connection={row.connection} shared={look.shared} />
              <span className="tl-rl-facts">
                {[row.change, row.detail].filter((part) => part !== null).join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      )}
      {rows.length > rowLimit ? (
        <button
          type="button"
          className="tl-more"
          aria-expanded={all}
          onClick={() => setAll((was) => !was)}
        >
          {all ? "收起" : `显示全部 ${rows.length} 项`}
        </button>
      ) : null}
    </section>
  );
}
