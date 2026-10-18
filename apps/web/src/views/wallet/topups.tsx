import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { BrandMark, PencilIcon, PlusIcon, RadarIcon, TrashIcon } from "../../icons.tsx";
import { providerName } from "@headroom/view-model/labels";
import type { OverviewConnection } from "@headroom/view-model/overview";
import { formatNumber } from "@headroom/view-model/present";
import type { WalletTopUp } from "@headroom/view-model/wallet";

import { zhAccountName, zhDay } from "../../lib/zh.ts";
import { Button } from "../../ui/button.tsx";
import { EmptyState } from "../../ui/empty-state.tsx";
import { Pill } from "../../ui/pill.tsx";
import { figureText, originalNote } from "./amount.ts";
import { keepsCount, nextCount, pageSize } from "./paging.ts";

const askMs = 6000;
const detectedLabel = "由 Headroom 根据余额变化自动检测";

/** Remove one top-up. The first press asks in place, as Disconnect does; the question lapses after a few seconds. */
function RemoveTopUp(props: { readonly label: string; readonly onRemove: () => Promise<void> }) {
  const [asking, setAsking] = useState(false);
  const [removing, setRemoving] = useState(false);
  const cancel = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!asking) return;
    cancel.current?.focus();
    const timer = setTimeout(() => setAsking(false), askMs);
    return () => clearTimeout(timer);
  }, [asking]);
  const close = (): void => {
    setAsking(false);
    requestAnimationFrame(() => root.current?.querySelector("button")?.focus());
  };
  const onKey = (event: KeyboardEvent<HTMLFieldSetElement>): void => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    close();
  };
  return (
    <span ref={root}>
      {asking ? (
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape cancels the question from any control inside it
        <fieldset className="confirm" aria-label="确认移除" onKeyDown={onKey}>
          <span className="q">移除？</span>
          <button ref={cancel} className="btn sm" type="button" onClick={close}>
            取消
          </button>
          <button
            className="btn sm primary"
            type="button"
            aria-disabled={removing}
            onClick={() => {
              if (removing) return;
              setRemoving(true);
              props.onRemove().then(
                () => setRemoving(false),
                () => {
                  setRemoving(false);
                  setAsking(false);
                },
              );
            }}
          >
            {removing ? "正在移除" : "移除"}
          </button>
        </fieldset>
      ) : (
        <Button variant="quiet" size="sm" aria-label={props.label} onClick={() => setAsking(true)}>
          <TrashIcon />
        </Button>
      )}
    </span>
  );
}

function TopUpRow(props: {
  readonly topUp: WalletTopUp;
  readonly connection: OverviewConnection | undefined;
  readonly onRemove: () => Promise<void>;
  readonly onEdit: () => void;
}) {
  const { topUp, connection } = props;
  const note = topUp.amount === null ? null : originalNote(topUp.amount);
  const name =
    connection === undefined
      ? "已删除的账户"
      : `${providerName(connection.provider)} · ${zhAccountName(connection)}`;
  return (
    <li className="w-row w-topup">
      <span className="w-date num">
        {zhDay(topUp.date)}
        {topUp.source === "detected" ? (
          <span className="w-detected" title={detectedLabel}>
            <RadarIcon />
            <span className="sr">{detectedLabel}</span>
          </span>
        ) : null}
      </span>
      <span className="w-account">
        {connection === undefined ? null : <BrandMark provider={connection.provider} />}
        <span className="w-name">{name}</span>
      </span>
      <span className="w-credits num" data-label="积分">
        {topUp.credits === null ? (
          <span className="muted">—</span>
        ) : (
          formatNumber(topUp.credits, Number.isInteger(topUp.credits) ? 0 : 2)
        )}
      </span>
      <span className="w-paid">
        {topUp.kind === "free" ? (
          <Pill tone="quiet">免费</Pill>
        ) : topUp.amount === null ? (
          // Paid with no price entered, as a detected top-up is: unknown, never zero.
          <span className="muted">未设置价格</span>
        ) : (
          <span className="w-cost">
            <span className="w-figure num">{figureText(topUp.amount)}</span>
            {note === null ? null : <span className="muted num">{note}</span>}
          </span>
        )}
      </span>
      <span className="w-note-text muted">
        {topUp.note}
        {topUp.expiresOn === null ? null : (
          <span className="w-expiry">{`${topUp.note === null ? "" : " · "}${zhDay(topUp.expiresOn)}到期`}</span>
        )}
      </span>
      <span className="w-act">
        <Button
          variant="quiet"
          size="sm"
          aria-label={`编辑${zhDay(topUp.date)}为${name}的充值`}
          onClick={props.onEdit}
        >
          <PencilIcon />
        </Button>
        <RemoveTopUp label={`移除${zhDay(topUp.date)}为${name}的充值`} onRemove={props.onRemove} />
      </span>
    </li>
  );
}

/** Every top-up, newest first, in one bordered group under a column header row. */
export function TopUpsSection(props: {
  readonly topUps: readonly WalletTopUp[];
  readonly connections: readonly OverviewConnection[];
  readonly onRemove: (id: string) => Promise<void>;
  readonly onEdit: (topUp: WalletTopUp) => void;
}) {
  const [failed, setFailed] = useState(false);
  const [limit, setLimit] = useState(pageSize);
  const sentinel = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState<readonly string[]>([]);
  const total = props.topUps.length;
  const ids = props.topUps.map((topUp) => topUp.id);
  // A different book starts over at the first page; one top-up more or less keeps the place.
  if (ids.length !== seen.length || ids.some((id, index) => id !== seen[index])) {
    setSeen(ids);
    if (!keepsCount(seen, ids)) setLimit(pageSize);
  }
  const shown = Math.min(limit, total);
  // Scrolling near the end loads the next page. The Show More button covers keyboards and no observer.
  useEffect(() => {
    const node = sentinel.current;
    if (node === null || shown >= total || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setLimit((count) => nextCount(Math.min(count, total), total));
        }
      },
      { rootMargin: "240px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [shown, total]);
  const byId = new Map(props.connections.map((connection) => [connection.id, connection]));
  return (
    <section className="provider w-topups" aria-labelledby="w-topups-title">
      <header>
        <h2 id="w-topups-title">充值</h2>
      </header>
      {failed ? (
        <p className="w-save-error" role="alert">
          无法移除这笔充值，未做任何更改。
        </p>
      ) : null}
      {props.topUps.length === 0 ? (
        <div className="w-card">
          <EmptyState compact icon={<PlusIcon />} title="还没有充值">
            购买或获得积分时，在这里添加一笔。
          </EmptyState>
        </div>
      ) : (
        <div className="w-card">
          <div className="w-colhead">
            <span>日期</span>
            <span>账户</span>
            <span>积分</span>
            <span>价格</span>
            <span>备注</span>
            <span />
          </div>
          <ul className="w-rows">
            {props.topUps.slice(0, shown).map((topUp) => (
              <TopUpRow
                key={topUp.id}
                topUp={topUp}
                connection={byId.get(topUp.connectionId)}
                onEdit={() => props.onEdit(topUp)}
                onRemove={() =>
                  props.onRemove(topUp.id).then(
                    () => setFailed(false),
                    (cause: unknown) => {
                      setFailed(true);
                      throw cause;
                    },
                  )
                }
              />
            ))}
          </ul>
          {total <= pageSize ? null : (
            <div className="w-more" ref={sentinel}>
              <span className="muted num">
                显示 {shown} / {total}
              </span>
              {shown >= total ? null : (
                <Button
                  size="sm"
                  onClick={() => setLimit((count) => nextCount(Math.min(count, total), total))}
                >
                  显示更多
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
