import type { CSSProperties, ReactNode } from "react";

import { resetVerb } from "../../lib/reset-caption.tsx";
import { zhCountdown, zhExactFull } from "../../lib/zh.ts";
import { cx } from "../../ui/cx.ts";
import { DayLabel } from "./day-label.tsx";
import { LaneBars, type Tips } from "./lane-bars.tsx";
import { GroupHeader, rowStyle, WhoCell } from "./lane-who.tsx";
import type { LaneGroup } from "./lanes.ts";
import {
  clockText,
  columnOf,
  positionOf,
  resetShort,
  shortDay,
  weekday,
  type Axis,
} from "./range.ts";
import type { TipContext } from "./tips.ts";

function ColumnHead(props: {
  readonly axis: Axis;
  readonly start: number;
  readonly index: number;
  readonly now: boolean;
  readonly clock: TipContext["clock"];
}) {
  const { axis, start, index } = props;
  let top = "";
  let bottom: ReactNode = "";
  if (axis.kind === "weekly") {
    top = weekday(start);
    bottom = <DayLabel t={start} />;
  } else if (axis.kind === "session") {
    const midnight = new Date(start).getHours() === 0;
    top = index === 0 || midnight ? `${weekday(start)} ${new Date(start).getDate()}日` : "";
    bottom = clockText(start, props.clock);
  } else {
    top = "周起始";
    bottom = shortDay(start);
  }
  return (
    <div className={cx("tl-col", props.now && "tl-today")}>
      <span>{top}</span>
      <b>{bottom}</b>
    </div>
  );
}

/** The desktop grid: day headers, the Now line, provider groups, one lane per account. */
export function TimelineGrid(props: {
  readonly axis: Axis;
  readonly groups: readonly LaneGroup[];
  readonly tips: Tips;
  readonly context: TipContext;
}) {
  const { axis, groups, tips, context } = props;
  const nowX = positionOf(axis, context.now);
  const nowColumn = columnOf(axis, context.now);
  const gridStyle: CSSProperties & Record<string, string> = {};
  gridStyle["--cols"] = String(axis.columns.length);
  let index = 0;
  return (
    <div className="tl-grid" style={gridStyle}>
      <div className="tl-hrow">
        <div className="tl-corner">
          账户<span>{`额度 · ${context.view === "left" ? "剩余" : "已用"}`}</span>
        </div>
        <div className="tl-cols">
          {axis.columns.map((start, column) => (
            <ColumnHead
              key={start}
              axis={axis}
              start={start}
              index={column}
              now={nowColumn === column}
              clock={context.clock}
            />
          ))}
        </div>
      </div>
      {groups.map((group) => (
        <div key={group.provider} className="tl-set">
          <GroupHeader group={group} />
          {group.lanes.map((lane) => (
            <div
              key={lane.id}
              className={cx("tl-row", lane.inactive && "tl-dim")}
              style={rowStyle(index++)}
            >
              <WhoCell lane={lane} context={context} />
              <div className="tl-track">
                <div className="tl-bars">
                  <LaneBars lane={lane} axis={axis} tips={tips} context={context} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
      <div className="tl-plot" aria-hidden="true">
        {nowColumn === null ? null : (
          <span
            className="tl-todaycol"
            style={{
              left: `${(nowColumn / axis.columns.length) * 100}%`,
              width: `${100 / axis.columns.length}%`,
            }}
          />
        )}
        {nowX === null ? null : (
          <span className="tl-nowline" style={{ left: `${nowX}%` }}>
            <b>现在</b>
          </span>
        )}
      </div>
    </div>
  );
}

/** The phone list: a mini timeline per account, the current window and the next one. */
export function TimelineList(props: {
  readonly groups: readonly LaneGroup[];
  readonly tips: Tips;
  readonly context: TipContext;
}) {
  const { groups, tips, context } = props;
  const { now, clock } = context;
  let index = 0;
  return (
    <div className="tl-lists">
      {groups.map((group) => (
        <div key={group.provider} className="tl-set">
          <GroupHeader group={group} />
          {group.lanes.map((lane) => {
            const span = lane.phase === "current" ? lane.lengthMs * 2 : lane.lengthMs;
            const axis = { base: lane.start, end: lane.start + span };
            const caption =
              lane.phase === "idle"
                ? "未开始 · 下次使用时开启"
                : lane.phase === "ended"
                  ? `已结束 ${resetShort(lane.kind, lane.end, clock)}`
                  : `${zhCountdown(lane.end, now)}后${resetVerb(lane.drawn.resetWords)} · ${zhExactFull(lane.end, now, clock)}`;
            return (
              <div
                key={lane.id}
                className={cx("tl-mrow", lane.inactive && "tl-dim")}
                style={rowStyle(index++)}
              >
                <WhoCell lane={lane} context={context} />
                <div className="tl-mini">
                  <div className="tl-bars">
                    <LaneBars lane={lane} axis={axis} tips={tips} context={context} />
                  </div>
                </div>
                <p className="tl-mcap">{caption}</p>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
