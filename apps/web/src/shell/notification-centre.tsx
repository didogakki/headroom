import type { CSSProperties, ReactNode } from "react";

import { AlertIcon, BellIcon, CheckIcon, ClockIcon, ResetIcon } from "../icons.tsx";
import { When } from "../lib/when.tsx";
import type { NotificationsView } from "../lib/use-notifications.ts";
import { zhNotification } from "../lib/zh-notifications.ts";
import { Button } from "../ui/button.tsx";
import { cx } from "../ui/cx.ts";
import { EmptyState } from "../ui/empty-state.tsx";
import { Popover } from "../ui/menu.tsx";
import { LoadingNote, Sk } from "../ui/skeleton.tsx";

const icons: Record<string, ReactNode> = {
  bad: <AlertIcon />,
  warn: <ClockIcon />,
  info: <ResetIcon />,
};

function indexStyle(index: number): CSSProperties {
  const style: CSSProperties & Record<string, string> = {};
  style["--index"] = String(index);
  return style;
}

/** Two rows in the final layout while the first load runs. */
function NotificationsSkeleton() {
  return (
    <>
      <LoadingNote>正在加载通知</LoadingNote>
      <ul className="nlist" aria-busy="true">
        {[0, 1].map((index) => (
          <li key={index} className="nrow" aria-hidden="true">
            <Sk width={32} height={32} className="sk-tile" />
            <span className="nbody">
              <span className="ntitle">
                <Sk kind="text" width={index === 0 ? 150 : 120} />
              </span>
              <span className="ndesc">
                <Sk kind="text" width="90%" />
              </span>
            </span>
            <span className="ntime">
              <Sk kind="text" width={32} />
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

function subline(view: NotificationsView): string {
  if (view.status === "loading") return "正在检查更新";
  if (view.status === "unavailable") return "无法检查";
  if (view.items.length === 0) return "暂无需要报告的内容";
  if (view.unread === 0) return "你已查看全部通知";
  return `有 ${view.unread} 条更新待查看`;
}

/** The bell with its unread badge and the list it opens. Unread rows are tinted. */
export function NotificationCentre(props: { readonly notifications: NotificationsView }) {
  const { items, unread, status } = props.notifications;
  const sub = subline(props.notifications);
  return (
    <Popover
      label={unread === 0 ? "通知" : `通知，${unread} 条未读`}
      triggerClassName="bell"
      panelLabel="通知"
      openOnHover
      trigger={
        <>
          <BellIcon />
          <span className={cx("badge", "num", unread === 0 && "zero")} aria-hidden="true">
            {unread === 0 ? "" : unread}
          </span>
        </>
      }
    >
      <div className="nhead">
        <div>
          <h2>通知</h2>
          <p className="nsub">{sub}</p>
        </div>
        <Button
          variant="quiet"
          size="sm"
          disabled={unread === 0}
          onClick={props.notifications.markAllRead}
        >
          全部标为已读
        </Button>
      </div>
      {status === "loading" ? <NotificationsSkeleton /> : null}
      {status === "unavailable" ? (
        <EmptyState compact icon={<AlertIcon />} title="无法获取更新">
          Headroom 无法加载你的账户，所以暂时没有可报告的内容。
        </EmptyState>
      ) : null}
      {status === "ready" && items.length === 0 ? (
        <EmptyState compact icon={<CheckIcon />} title="你已查看全部通知">
          额度、重置和刷新问题会显示在这里。
        </EmptyState>
      ) : null}
      {status === "ready" && items.length > 0 ? (
        <ul className="nlist">
          {items.map((item, index) => {
            const words = zhNotification(item);
            return (
              <li
                key={item.id}
                className={cx("nrow", !item.read && "unread")}
                data-tone={item.tone}
                style={indexStyle(index)}
              >
                <span className="nicon">{icons[item.tone]}</span>
                <span className="nbody">
                  <span className="ntitle">{words.title}</span>
                  <span className="ndesc">{words.message}</span>
                </span>
                <span className="ntime">
                  <When at={item.occurredAt} kind="ago" />
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </Popover>
  );
}
