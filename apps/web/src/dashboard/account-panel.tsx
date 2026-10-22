import { useId, type ReactNode } from "react";

import { ApiError, api, type OverviewConnection } from "../api.ts";
import { AlertIcon, ClockIcon, PauseIcon, PlayIcon, ResetIcon, RetryIcon } from "../icons.tsx";
import {
  awaitingFirstRefresh,
  planLabel,
  providerName,
  refreshFailed,
  statusOf,
} from "@headroom/view-model/labels";
import { useDevicePrefs } from "../lib/device-prefs.ts";
import { isDemoSite } from "../lib/site.ts";
import { useNow } from "../lib/now.ts";
import { zhAccountName, zhAutoResetSummary, zhFactValue, zhLabel } from "../lib/zh.ts";
import { presentPanel } from "@headroom/view-model/present";
import { usePanelDisplay, useSettings } from "../lib/settings.tsx";
import { When } from "../lib/when.tsx";
import { ActionButton } from "../ui/action-button.tsx";
import { resetOutcome, resetOutcomeOfError } from "../ui/action-state.ts";
import { BankedResets } from "../ui/banked-resets.tsx";
import { ButtonLink } from "../ui/button.tsx";
import { cx } from "../ui/cx.ts";
import { HoldButton } from "../ui/hold-button.tsx";
import { HealthyStatus, Pill, StatusPill, StatusSlot, statusKindOf } from "../ui/pill.tsx";
import { href } from "../router.ts";
import { PanelActions } from "./actions.tsx";
import { AccountTitle } from "./account-title.tsx";
import { CellView, cellColumns } from "./cells.tsx";
import { SkeletonCells } from "./skeletons.tsx";

const reconnectWords: Record<NonNullable<OverviewConnection["reconnectReason"]>, string> = {
  refresh_rejected: "此账户的登录已过期。请重新连接以继续跟踪。",
  token_rejected: "此账户的登录已过期。请重新连接以继续跟踪。",
  identity_changed: "这个登录现在属于另一个账户。请重新连接以继续跟踪。",
  revoked_by_owner: "对此账户的访问已被撤销。请重新连接以继续跟踪。",
};

function Notice(props: {
  readonly tone: "bad" | "warn" | "neutral";
  readonly icon: ReactNode;
  readonly action?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <div className={cx("notice", props.tone)}>
      <span className="text">
        {props.icon}
        {props.children}
      </span>
      {props.action}
    </div>
  );
}

/** One account: header, a notice when it needs attention, its figures, and its facts and actions. */
export function AccountPanel(props: {
  readonly connection: OverviewConnection;
  readonly closed: boolean;
  readonly onChanged: () => Promise<void>;
  readonly onDisconnected: (id: string) => void;
}) {
  const { connection, onChanged } = props;
  const headingId = useId();
  const { actionsEnabled } = useSettings();
  // In Demo Mode every change is refused, so the failed faces say why.
  const { demo } = useDevicePrefs();
  const status = statusOf(connection);
  const now = useNow();
  const model = presentPanel(connection, now, usePanelDisplay(connection.provider));
  const disconnected = connection.state === "reconnect_required";
  const paused = connection.state === "paused";
  const waiting = awaitingFirstRefresh(connection);
  const hold = model.hold;
  const banked = model.banked;

  const resume = async (): Promise<void> => {
    try {
      await api.pause(connection.id, false);
    } finally {
      await onChanged();
    }
  };

  let notice: ReactNode = null;
  if (disconnected) {
    notice = (
      <Notice
        tone="bad"
        icon={<AlertIcon />}
        action={
          <ButtonLink
            variant="primary"
            size="sm"
            href={href({ page: "reconnect", id: connection.id })}
          >
            重新连接
          </ButtonLink>
        }
      >
        {reconnectWords[connection.reconnectReason ?? "refresh_rejected"]}
      </Notice>
    );
  } else if (paused) {
    notice = (
      <Notice
        tone="neutral"
        icon={<PauseIcon />}
        action={
          <ActionButton
            size="sm"
            icon={<PlayIcon />}
            label="恢复"
            pendingLabel="正在恢复"
            successLabel="已恢复"
            failedLabel={demo ? "演示模式" : "失败"}
            onAction={resume}
          />
        }
      >
        已暂停。Headroom 不会刷新此账户。
      </Notice>
    );
  } else if (waiting) {
    notice = (
      <Notice tone="neutral" icon={<ClockIcon />}>
        刚刚连接。首次刷新正在进行。
      </Notice>
    );
  } else if (refreshFailed(connection.latestRun)) {
    notice = (
      <Notice tone="neutral" icon={<RetryIcon />}>
        Headroom 无法刷新此账户，几分钟后会再次尝试。
      </Notice>
    );
  } else if (connection.stale) {
    notice = (
      <Notice tone="warn" icon={<ClockIcon />}>
        {`${providerName(connection.provider)} 已有一段时间没有响应。下方数字来自上一次成功的刷新。`}
      </Notice>
    );
  }

  let right: ReactNode;
  let statusKey: string = status.word;
  if (waiting) {
    statusKey = "waiting";
    right = <StatusPill kind="waiting" />;
  } else if (status.word === "Active" && connection.lastSuccessAt !== null) {
    right = <HealthyStatus age={<When at={connection.lastSuccessAt} kind="ago" />} />;
  } else {
    right = <StatusPill kind={statusKindOf(status.word)} />;
  }

  const autoRule = connection.automation.autoReset;
  const autoOn = autoRule !== null && autoRule.enabled;
  const showFacts =
    model.facts.length > 0 || hold !== null || banked !== null || autoOn || !waiting;
  return (
    <div className={cx("collapse", props.closed && "closed")}>
      <section
        className={cx("panel", (disconnected || paused) && "dim", paused && "paused")}
        aria-labelledby={headingId}
      >
        <header>
          <AccountTitle
            id={connection.id}
            headingId={headingId}
            name={zhAccountName(connection)}
            custom={connection.name?.trim() ? connection.name.trim() : null}
            plan={planLabel(connection.plan)}
            identity={connection.identity}
            onRenamed={onChanged}
          />
          <div className="right">
            <StatusSlot statusKey={statusKey}>{right}</StatusSlot>
          </div>
        </header>
        {notice}
        {waiting && model.cells.length === 0 ? <SkeletonCells count={2} /> : null}
        {model.cells.length === 0 ? null : (
          <div className="cells" data-cols={cellColumns(model.cells)}>
            {model.cells.map((cell, index) => (
              <CellView key={cell.key} cell={cell} index={index} />
            ))}
          </div>
        )}
        {showFacts ? (
          <div className="facts">
            {hold === null && banked === null && !autoOn ? null : (
              <span className="lead">
                {hold === null ? null : (
                  <HoldButton
                    size="sm"
                    label="长按重置额度"
                    // An unknown outcome re-arms only after a newer successful collection shows the real state.
                    settleKey={connection.lastSuccessAt}
                    // Follows the Settings switch directly; the server refuses the action whenever the saved setting is off.
                    off={!actionsEnabled}
                    {...(demo
                      ? { failedLabel: isDemoSite ? "仅限演示" : "请关闭演示模式后再重置" }
                      : {})}
                    onConfirm={async () => {
                      try {
                        const outcome = await api.consumeResetCredit(connection.id, hold.creditId);
                        // A failed dashboard read must not change the reset's confirmed outcome.
                        void onChanged().catch(() => undefined);
                        return resetOutcome(outcome.action.state);
                      } catch (error) {
                        return resetOutcomeOfError(error instanceof ApiError ? error.status : null);
                      }
                    }}
                  />
                )}
                {banked === null ? null : <BankedResets {...banked} />}
                {autoRule === null || !autoRule.enabled ? null : (
                  <span className="auto-chip" title={zhAutoResetSummary(autoRule)}>
                    <Pill tone="quiet" icon={<ResetIcon />}>
                      自动重置已开启
                    </Pill>
                    <span className="sr">{zhAutoResetSummary(autoRule)}</span>
                  </span>
                )}
              </span>
            )}
            {model.facts.map((fact) => (
              <span className="kv" key={fact.key}>
                {zhLabel(fact.label)} <b>{zhFactValue(fact.value)}</b>
              </span>
            ))}
            {waiting ? null : (
              <PanelActions
                id={connection.id}
                paused={paused}
                signedIn={!disconnected}
                onChanged={onChanged}
                onDisconnected={() => props.onDisconnected(connection.id)}
              />
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}
