import type { Cell } from "@headroom/view-model/present";
import { formatNumber } from "@headroom/view-model/present";
import { useSettings } from "../lib/settings.tsx";
import { exactFull } from "@headroom/view-model/time";
import { displayMeter, toneOf } from "@headroom/view-model/tone";
import { useNow } from "../lib/now.ts";
import { ResetCaption } from "../lib/reset-caption.tsx";
import { When } from "../lib/when.tsx";
import { zhCaption, zhExact, zhLabel, zhNote, zhUnit, zhWindow } from "../lib/zh.ts";
import { Bar } from "../ui/bar.tsx";
import { CountUp } from "../ui/count-up.tsx";
import { InfoTip } from "../ui/info-tip.tsx";

function Label(props: { readonly label: string; readonly window: string | null }) {
  return (
    <div className="label">
      <span>{zhLabel(props.label)}</span>
      {props.window === null ? null : <span className="window">{zhWindow(props.window)}</span>}
    </div>
  );
}

function Unknown() {
  return (
    <div className="value unknown" aria-hidden="true">
      —
    </div>
  );
}

function Unlimited() {
  return <div className="value">无限制</div>;
}

function MeterCell(props: {
  readonly cell: Extract<Cell, { kind: "meter" }>;
  readonly index: number;
}) {
  const { cell } = props;
  const { settings } = useSettings();
  const shown = displayMeter(
    cell.used,
    settings.limitsView,
    settings.lowThresholdPercent,
    cell.decimals,
  );
  const label = zhLabel(cell.label);
  const name = cell.window === null ? label : `${label} ${zhWindow(cell.window)}`;
  if (cell.unlimited) {
    return (
      <div className="cell">
        <Label label={cell.label} window={cell.window} />
        <Unlimited />
        <div className="caption">此账户没有限制</div>
      </div>
    );
  }
  if (shown.value === null || shown.fill === null) {
    return (
      <div className="cell">
        <Label label={cell.label} window={cell.window} />
        <Unknown />
        <Bar unknown label={`${name} 未报告`} />
        <div className="caption">未报告</div>
      </div>
    );
  }
  const toneWord = shown.caption === null ? null : shown.caption;
  return (
    <div className="cell">
      <Label label={cell.label} window={cell.window} />
      <div className="value">
        <CountUp value={shown.value} decimals={cell.decimals} delay={props.index * 60} />
        <span className="unit">{zhUnit(shown.unit)}</span>
      </div>
      <Bar
        percent={shown.fill}
        tone={shown.tone ?? "good"}
        {...(cell.used === null ? {} : { valueNow: cell.used })}
        label={`${name} 已用 ${cell.used ?? 0}%`}
      />
      <div className="caption">
        {toneWord === null ? null : (
          <>
            <span className={`tone ${toneWord === "Running Low" ? "warn" : "bad"}`}>
              {zhCaption(toneWord)}
            </span>
            {" · "}
          </>
        )}
        <ResetCaption resetWords={cell.resetWords} resetsAt={cell.resetsAt} />
      </div>
    </div>
  );
}

const unitWords = { credits: "积分", usd: "", count: "", requests: "次请求" } as const;

function AmountCell(props: { readonly cell: Extract<Cell, { kind: "amount" }> }) {
  const { cell } = props;
  const { settings } = useSettings();
  if (cell.unlimited) {
    return (
      <div className="cell fact">
        <Label label={cell.label} window={cell.window} />
        <Unlimited />
        {cell.note === null ? null : <div className="caption">{zhNote(cell.note)}</div>}
      </div>
    );
  }
  if (cell.value === null) {
    return (
      <div className="cell fact">
        <Label label={cell.label} window={cell.window} />
        <Unknown />
        <div className="caption">未报告</div>
      </div>
    );
  }
  const total = cell.of === null ? Number.NaN : Number(cell.of.replaceAll(",", ""));
  const hasBar = Number.isFinite(total) && total > 0;
  const usedPercent = hasBar ? Math.min(100, Math.max(0, ((total - cell.value) / total) * 100)) : 0;
  const unitWord = unitWords[cell.unit];
  const tone = hasBar ? (toneOf(usedPercent, settings.lowThresholdPercent) ?? "good") : "good";
  return (
    <div className={hasBar ? "cell" : "cell fact"}>
      <Label label={cell.label} window={cell.window} />
      <div className="value">
        <CountUp
          value={cell.value}
          decimals={cell.decimals}
          {...(cell.unit === "usd" ? { prefix: "$" } : {})}
        />
        {unitWord === "" ? null : <span className="unit">{unitWord}</span>}
      </div>
      {hasBar ? (
        <Bar
          thin
          percent={100 - usedPercent}
          tone={tone}
          label={`${zhLabel(cell.label)} 剩余 ${formatNumber(cell.value, cell.decimals)}，共 ${cell.of}`}
        />
      ) : null}
      {cell.note === null ? null : <div className="caption">{zhNote(cell.note)}</div>}
    </div>
  );
}

function ResetsCell(props: { readonly cell: Extract<Cell, { kind: "resets" }> }) {
  const { cell } = props;
  const { settings } = useSettings();
  const now = useNow();
  const first = cell.expiries[0];
  if (cell.count === null) {
    return (
      <div className="cell fact">
        <Label label={cell.label} window={cell.window} />
        <Unknown />
        <div className="caption">未报告</div>
      </div>
    );
  }
  return (
    <div className="cell fact">
      <Label label={cell.label} window={cell.window} />
      <div className="value">
        <CountUp value={cell.count} />
        <span className="of">次完整重置</span>
      </div>
      <div className="caption">
        {first === undefined ? (
          "未报告到期时间"
        ) : (
          <>
            <When at={first} kind="until" prefix="最早" suffix="到期" />
            <InfoTip label="所有重置的到期时间">
              <b>已存重置</b>
              {cell.expiries.map((at, index) => (
                <span key={at}>
                  {`第 ${index + 1} 次 · ${zhExact(exactFull(at, now, settings.clock))}到期`}
                </span>
              ))}
            </InfoTip>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Three meters followed by other figures keep the meters' three columns, so a money figure sits under a meter
 * and the row ends with an empty column instead of stretching. Undefined keeps the default wrapping.
 */
export function cellColumns(cells: readonly Cell[]): "3" | undefined {
  const meters = cells.filter((cell) => cell.kind === "meter").length;
  return meters === 3 && cells.length > meters ? "3" : undefined;
}

/** One figure of an account panel. Unknown values show a dash, never zero. */
export function CellView(props: { readonly cell: Cell; readonly index: number }) {
  const { cell } = props;
  switch (cell.kind) {
    case "meter":
      return <MeterCell cell={cell} index={props.index} />;
    case "amount":
      return <AmountCell cell={cell} />;
    case "resets":
      return <ResetsCell cell={cell} />;
  }
}
