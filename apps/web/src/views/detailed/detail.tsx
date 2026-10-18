import type { ReactNode } from "react";

import type { OverviewConnection } from "../../api.ts";
import { CellView, cellColumns } from "../../dashboard/cells.tsx";
import { awaitingFirstRefresh, providerName } from "@headroom/view-model/labels";
import { presentPanel } from "@headroom/view-model/present";
import { useNow } from "../../lib/now.ts";
import { usePanelDisplay } from "../../lib/settings.tsx";
import { zhFactValue, zhLabel } from "../../lib/zh.ts";
import { href } from "../../router.ts";
import { BankedResets } from "../../ui/banked-resets.tsx";
import { ButtonLink } from "../../ui/button.tsx";

/** What the owner reads first on an account that is not being refreshed or has no figures yet. */
function noticeFor(connection: OverviewConnection, hasCells: boolean): ReactNode {
  if (connection.state === "reconnect_required") {
    return (
      <p className="d-note">
        此账户的登录已过期。{" "}
        <ButtonLink
          variant="primary"
          size="sm"
          href={href({ page: "reconnect", id: connection.id })}
        >
          重新连接
        </ButtonLink>
      </p>
    );
  }
  if (connection.state === "paused") {
    return <p className="d-note">已暂停。Headroom 不会刷新此账户。</p>;
  }
  if (!hasCells && awaitingFirstRefresh(connection)) {
    return <p className="d-note">刚刚连接。首次刷新正在进行。</p>;
  }
  if (connection.stale) {
    return (
      <p className="d-note">{`${providerName(connection.provider)} 已有一段时间没有响应。这些数字来自上一次成功的刷新。`}</p>
    );
  }
  return null;
}

/** The expanded part of a row: the same figures the Overview panel shows, without its header and actions. */
export function RowDetail(props: { readonly connection: OverviewConnection }) {
  const { connection } = props;
  const now = useNow();
  const model = presentPanel(connection, now, usePanelDisplay(connection.provider));
  const dim = connection.state === "paused" || connection.state === "reconnect_required";
  const notice = noticeFor(connection, model.cells.length > 0);
  return (
    <div className="d-body">
      {notice}
      {model.cells.length === 0 ? null : (
        <div className={dim ? "cells dim" : "cells"} data-cols={cellColumns(model.cells)}>
          {model.cells.map((cell, index) => (
            <CellView key={cell.key} cell={cell} index={index} />
          ))}
        </div>
      )}
      {model.banked === null && model.facts.length === 0 ? null : (
        <div className="facts">
          {model.banked === null ? null : (
            <span className="lead">
              <BankedResets {...model.banked} />
            </span>
          )}
          {model.facts.map((fact) => (
            <span className="kv" key={fact.key}>
              {zhLabel(fact.label)} <b>{zhFactValue(fact.value)}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
