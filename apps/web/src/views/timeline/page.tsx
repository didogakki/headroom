import { useCallback, useEffect, useMemo, useState } from "react";

import { useSettings } from "../../lib/settings.tsx";
import { useNow } from "../../lib/now.ts";
import { prefersReducedMotion } from "../../ui/motion.ts";
import { HoverPopover } from "../../ui/hover-popover.tsx";
import { Segmented } from "../../ui/segmented.tsx";
import { SlideSwap, type SwapDirection } from "../../ui/slide-swap.tsx";
import { LoadFailed, NoAccounts } from "../../dashboard/states.tsx";
import type { ViewProps } from "../props.ts";
import { UpNextCard, WatchListCard } from "./cards.tsx";
import { TimelineGrid, TimelineList } from "./chart.tsx";
import {
  laneGroups,
  runningLow,
  savedResets,
  sharedNames,
  timelineKinds,
  upNextItems,
  type TimelineKind,
} from "./lanes.ts";
import { axisFor, rangeLabel } from "./range.ts";
import { TimelineSkeleton } from "./skeleton.tsx";
import { RecentResetsCard } from "./recent-resets.tsx";
import { resetRows } from "./resets.ts";
import { laneTips, type TipContext } from "./tips.ts";
import "./timeline.css";

const introMs = 1400;

function Chevron(props: { readonly direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={props.direction === "left" ? "m15 6-6 6 6 6" : "m9 6 6 6-6 6"} />
    </svg>
  );
}

interface Position {
  readonly kind: TimelineKind;
  /** Whole steps away from now. */
  readonly step: number;
  /** Which way the last change moved, for the slide. */
  readonly direction: SwapDirection;
}

/** The Timeline: every account's quota windows on one time axis, then what resets next and what needs watching. */
export function TimelinePage(props: ViewProps) {
  const { connections, failed, stale, reload } = props.overview;
  const { loaded } = useSettings();
  const [retrying, setRetrying] = useState(false);
  if (connections === null) {
    if (!failed) return <TimelineSkeleton />;
    return (
      <LoadFailed
        stale={false}
        busy={retrying}
        onRetry={() => {
          setRetrying(true);
          void reload().finally(() => setRetrying(false));
        }}
      />
    );
  }
  if (!loaded) return <TimelineSkeleton />;
  if (connections.length === 0) {
    return (
      <div className="reveal">
        <NoAccounts />
      </div>
    );
  }
  return (
    <div className="tl-view reveal">
      {stale ? (
        <LoadFailed
          stale
          busy={retrying}
          onRetry={() => {
            setRetrying(true);
            void reload().finally(() => setRetrying(false));
          }}
        />
      ) : null}
      <TimelineBoard overview={props.overview} connections={connections} />
    </div>
  );
}

function TimelineBoard(props: {
  readonly overview: ViewProps["overview"];
  readonly connections: NonNullable<ViewProps["overview"]["connections"]>;
}) {
  const { connections } = props;
  const { providerOrder } = props.overview;
  const settingsState = useSettings();
  const { settings } = settingsState;
  const now = useNow();
  const [position, setPosition] = useState<Position>({
    kind: "weekly",
    step: 0,
    direction: "swap",
  });
  const [intro, setIntro] = useState(() => !prefersReducedMotion());
  useEffect(() => {
    if (!intro) return;
    const timer = setTimeout(() => setIntro(false), introMs);
    return () => clearTimeout(timer);
  }, [intro]);

  const { kind, step } = position;
  const context = useMemo<TipContext>(
    () => ({
      now,
      clock: settings.clock,
      view: settings.limitsView,
      low: settings.lowThresholdPercent,
    }),
    [now, settings.clock, settings.limitsView, settings.lowThresholdPercent],
  );
  const shared = useMemo(() => sharedNames(connections), [connections]);
  const look = useMemo(
    () => ({ ...context, timeStyle: settings.timeStyle, shared }),
    [context, settings.timeStyle, shared],
  );
  const axis = useMemo(() => axisFor(kind, now, step), [kind, now, step]);
  const groups = useMemo(
    () => laneGroups(connections, providerOrder, kind, now),
    [connections, providerOrder, kind, now],
  );
  const tips = useMemo(
    () =>
      laneTips(
        groups.flatMap((group) => group.lanes),
        context,
      ),
    [groups, context],
  );
  const resolve = useCallback((id: string) => tips.get(id) ?? null, [tips]);
  const upNext = useMemo(() => upNextItems(connections, now), [connections, now]);
  const low = useMemo(
    () => runningLow(connections, now, settings.lowThresholdPercent),
    [connections, now, settings.lowThresholdPercent],
  );
  const saved = useMemo(() => savedResets(connections, now), [connections, now]);
  const resets = useMemo(
    () => resetRows(connections, { now, clock: settings.clock, view: settings.limitsView }),
    [connections, now, settings.clock, settings.limitsView],
  );

  const move = (change: number): void =>
    setPosition({ kind, step: step + change, direction: change < 0 ? "prev" : "next" });
  const kindLabel = timelineKinds.find((entry) => entry.value === kind)?.label ?? "";

  return (
    <>
      <div className="tl-tools">
        <h2 className="tl-range" aria-live="polite">
          {rangeLabel(axis)}
        </h2>
        <div className="tl-ctl">
          <fieldset className="tl-step" aria-label="时间范围">
            <button type="button" aria-label={`前移${axis.stepWord}`} onClick={() => move(-1)}>
              <Chevron direction="left" />
            </button>
            <button
              type="button"
              className="tl-today-button"
              aria-disabled={step === 0}
              onClick={() => {
                if (step !== 0) {
                  setPosition({ kind, step: 0, direction: step < 0 ? "next" : "prev" });
                }
              }}
            >
              今天
            </button>
            <button type="button" aria-label={`后移${axis.stepWord}`} onClick={() => move(1)}>
              <Chevron direction="right" />
            </button>
          </fieldset>
          <Segmented
            label="窗口类型"
            value={kind}
            options={timelineKinds}
            onChange={(next) => setPosition({ kind: next, step: 0, direction: "swap" })}
          />
          <Segmented
            label="额度显示方式"
            value={settings.limitsView}
            options={[
              { value: "used", label: "已用" },
              { value: "left", label: "剩余" },
            ]}
            onChange={(limitsView) => void settingsState.update({ limitsView })}
          />
        </div>
      </div>

      <div className={intro ? "tl-intro" : undefined}>
        <section className="tl-chart" aria-label="额度窗口时间线">
          <SlideSwap swapKey={`${kind}:${step}`} direction={position.direction}>
            {groups.length === 0 ? (
              <TimelineEmpty label={kindLabel} />
            ) : (
              <TimelineGrid axis={axis} groups={groups} tips={tips} context={context} />
            )}
          </SlideSwap>
        </section>
        <section className="tl-list" aria-label="按账户列出的额度窗口">
          <SlideSwap swapKey={kind} direction="swap">
            {groups.length === 0 ? (
              <TimelineEmpty label={kindLabel} />
            ) : (
              <TimelineList groups={groups} tips={tips} context={context} />
            )}
          </SlideSwap>
        </section>
      </div>

      <Legend />

      <div className="tl-pair">
        <UpNextCard items={upNext} look={look} />
        <WatchListCard low={low} saved={saved} look={look} />
      </div>
      <RecentResetsCard rows={resets} look={look} />
      <HoverPopover resolve={resolve} />
    </>
  );
}

function TimelineEmpty(props: { readonly label: string }) {
  return <p className="tl-none">{`没有可显示的${props.label}窗口。`}</p>;
}

function Legend() {
  return (
    <section className="tl-legend" aria-label="图例">
      <span>
        <i className="tl-lg tl-lg-cur" />
        当前窗口
      </span>
      <span>
        <i className="tl-lg tl-lg-passed" />
        已过时间
      </span>
      <span>
        <i className="tl-lg tl-lg-next" />
        下一个窗口
      </span>
      <span>
        <i className="tl-lg tl-lg-prev" />
        较早
      </span>
      <span>
        <i className="tl-lg tl-lg-bank" />
        已存重置到期
      </span>
      <span>
        <i className="tl-lg tl-lg-early" />
        提前重置
      </span>
      <span className="tl-tones">
        <i className="tl-dot" data-tone="good" />
        余量充足
        <i className="tl-dot" data-tone="warn" />
        余量偏低
        <i className="tl-dot" data-tone="bad" />
        即将耗尽
      </span>
    </section>
  );
}
