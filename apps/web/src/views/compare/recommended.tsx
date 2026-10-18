import { formatNumber } from "@headroom/view-model/present";
import { zhAccountName, zhWindowName } from "../../lib/zh.ts";
import { InfoTip } from "../../ui/info-tip.tsx";
import { VerifiedSeal } from "../../ui/verified-seal.tsx";
import { driversOf, type Pick, type Row } from "./compare-model.ts";
import { figureOfRoom, figureOfWindow, type Look } from "./figure.ts";
import { LimitTag } from "./parts.tsx";

function Chip(props: {
  readonly name: string;
  readonly body: string;
  readonly limiting: boolean;
  readonly showTag: boolean;
}) {
  return (
    <span className={props.limiting ? "cmp-chip limit" : "cmp-chip"}>
      {props.name} <b>{props.body}</b>
      {props.limiting && props.showTag ? <LimitTag /> : null}
    </span>
  );
}

/** The chips for the windows that set the account's room, or its credit balance. */
function Chips(props: { readonly row: Row; readonly look: Look }) {
  const { row, look } = props;
  const provider = row.connection.provider;
  if (row.balance !== null) {
    const { value, total, decimals } = row.balance;
    const body =
      total === null
        ? `${formatNumber(value, decimals)} 积分`
        : `${formatNumber(value, decimals)} / ${formatNumber(total, decimals)}`;
    return (
      <span className="cmp-chips">
        <Chip name="积分余额" body={body} limiting={false} showTag={false} />
      </span>
    );
  }
  const drivers = driversOf(row.room);
  return (
    <span className="cmp-chips">
      {drivers.map((driver) => {
        const figure = figureOfWindow(driver.ref, provider, look);
        const body =
          figure.kind === "known"
            ? figure.text
            : figure.kind === "not_started"
              ? "未开始"
              : "无限制";
        return (
          <Chip
            key={driver.ref.key}
            name={zhWindowName(driver.name)}
            body={body}
            limiting={driver.limiting}
            showTag={drivers.length > 1}
          />
        );
      })}
    </span>
  );
}

/** How much room the runner-up has, in words for the tooltip. */
function nextWords(next: Row, look: Look): string {
  const left = next.room.left;
  if (left === null) return "";
  if (next.room.unit === "credits") return `剩余 ${formatNumber(left, 2)} 积分`;
  const figure = figureOfRoom(left, next.connection.provider, look);
  if (figure.kind !== "known") return "";
  return look.view === "left" ? figure.text : `已用 ${figure.text}`;
}

function whyNone(pick: Pick, total: number, provider: string): string {
  if (pick.inactive === total) {
    return `没有可用的账户。每个 ${provider} 账户都已暂停或需要重新登录。`;
  }
  return "还没有账户报告自己剩余多少额度。";
}

/**
 * One slim line that names the account to use now and why: the active account with the most room. Inactive
 * accounts are never named. With no candidate it says so, calmly.
 */
export function Recommended(props: {
  readonly pick: Pick;
  readonly providerName: string;
  readonly total: number;
  readonly look: Look;
}) {
  const { pick, look } = props;
  const { best, next } = pick;
  if (best === null) {
    return (
      <section className="cmp-best" aria-label="推荐">
        <VerifiedSeal tone="muted" />
        <span className="lead off">推荐</span>
        <span className="why">{whyNone(pick, props.total, props.providerName)}</span>
      </section>
    );
  }
  const nextLine = next === null ? "" : nextWords(next, look);
  return (
    <section className="cmp-best" aria-label="推荐">
      <VerifiedSeal />
      <span className="lead">推荐</span>
      <span className="acct">
        <b>{zhAccountName(best.connection)}</b>
        {best.plan === null ? null : (
          <span className="plan">
            <span className="sep" aria-hidden="true">
              ·
            </span>
            {best.plan}
          </span>
        )}
      </span>
      <span className="why">
        {pick.counted > 1 ? `在 ${pick.counted} 个活动账户中余量最多` : "唯一的活动账户"}
      </span>
      <span className="cmp-best-tip">
        <InfoTip label="关于这个推荐">
          <b>为什么推荐这个账户</b>
          {next !== null && nextLine !== "" ? (
            <span>{`次选：${zhAccountName(next.connection)}，${nextLine}。`}</span>
          ) : null}
          <span>百分比不考虑套餐大小，因此剩余比例相同时，更大的套餐能提供更多额度。</span>
        </InfoTip>
      </span>
      <Chips row={best} look={look} />
    </section>
  );
}
