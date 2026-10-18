import { useRef, useState } from "react";

import { api } from "../../api.ts";
import { BrandMark, ReorderIcon } from "../../icons.tsx";
import { groupByProvider, providerName } from "@headroom/view-model/labels";
import { moveProvider, orderBody, orderOf } from "../../lib/reorder.ts";
import { buttonClass } from "../../ui/button.tsx";
import { Popover } from "../../ui/menu.tsx";
import { SortableList } from "../../ui/sortable-list.tsx";
import type { ViewProps } from "../props.ts";

/**
 * The Arrange button and the small panel it opens: the providers in the owner's order, to drag. Moving one
 * shows at once and saves through the shared order; a failed save puts it back and says so.
 */
export function ArrangePopover(props: { readonly overview: ViewProps["overview"] }) {
  const { connections, providerOrder, applyOrder } = props.overview;
  const newest = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const shown = groupByProvider(connections ?? [], providerOrder).map((group) => group.provider);

  const move = (id: string, to: number): void => {
    const provider = shown.find((entry) => entry === id);
    if (provider === undefined || connections === null) return;
    const base = orderOf(connections, providerOrder);
    const next = moveProvider(base, shown, provider, to);
    const seq = (newest.current += 1);
    setError(null);
    applyOrder(next);
    api.saveOrder(orderBody(next)).catch(() => {
      // A later move sends the full order again, so only the newest save rolls back.
      if (seq !== newest.current) return;
      applyOrder(base);
      setError("无法保存服务商顺序，未做任何更改。");
    });
  };

  return (
    <Popover
      label="调整顺序"
      panelLabel="服务商顺序"
      panelClassName="notif arrange-pop"
      triggerClassName={buttonClass("quiet", "sm", "d-arrange")}
      trigger={
        <>
          <ReorderIcon />
          调整顺序
        </>
      }
    >
      <div className="arrange-head">
        <h2>服务商顺序</h2>
        <p className="muted">拖动以调整顺序。</p>
      </div>
      <SortableList
        label="服务商顺序"
        items={shown.map((provider) => ({
          id: provider,
          label: providerName(provider),
          icon: <BrandMark provider={provider} />,
        }))}
        onMove={move}
      />
      {error === null ? null : (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </Popover>
  );
}
