import type { OverviewConnection } from "../api.ts";
import { formatNumber, formatUsd, presentPanel } from "@headroom/view-model/present";
import { useSettings } from "../lib/settings.tsx";
import { displayMeter } from "@headroom/view-model/tone";
import { ResetCaption } from "../lib/reset-caption.tsx";
import { When } from "../lib/when.tsx";
import { zhLabel, zhShort, zhUnit } from "../lib/zh.ts";
import { Bar } from "../ui/bar.tsx";
import { cx } from "../ui/cx.ts";

type Balance = NonNullable<ReturnType<typeof presentPanel>["balance"]>;

/** Money as dollars; credits and counts by their own word. Never a dollar sign for credits. */
function balanceText(balance: Balance): string {
  const { value, unit } = balance;
  const decimals = Number.isInteger(value) ? 0 : 2;
  if (unit === "usd") return `剩余 ${formatUsd(value)}`;
  if (unit === "credits") return `剩余 ${formatNumber(value, decimals)} 积分`;
  return `剩余 ${formatNumber(value, decimals)}`;
}

function meterDecimals(provider: OverviewConnection["provider"], used: number): number {
  if (provider === "copilot") return 1;
  return used > 0 && used < 1 ? 1 : 0;
}

/** The Limits cell: the tightest meter, or the balance, with when it resets beneath. */
export function LimitsCell(props: { readonly connection: OverviewConnection }) {
  const { connection } = props;
  const { settings } = useSettings();
  const panel = presentPanel(connection);
  const dim = connection.state === "paused" || connection.state === "reconnect_required";
  const observed = connection.snapshot?.observedAt ?? connection.lastSuccessAt;
  const lastKnown =
    observed === null ? (
      "暂无数据"
    ) : (
      <>
        <When at={observed} kind="ago" prefix="最后已知：" />
      </>
    );

  if (panel.tightest !== null) {
    const { used, resetsAt, resetWords, label } = panel.tightest;
    const meter = displayMeter(
      used,
      settings.limitsView,
      settings.lowThresholdPercent,
      meterDecimals(connection.provider, used),
    );
    const tone = dim ? "neutral" : (meter.tone ?? "neutral");
    const words = zhUnit(meter.unit);
    return (
      <td className={cx("troom", dim && "dim")}>
        <span className="rtop">
          <span className={cx("rnum", !dim && meter.tone !== "good" && meter.tone)}>
            {meter.value}
            {words}
          </span>
          <span className="rwin">{zhShort(label)}</span>
        </span>
        <Bar
          thin
          percent={meter.fill ?? 0}
          tone={tone}
          valueNow={used}
          label={`${zhShort(label)} 已用 ${used}%`}
        />
        <span className="rsub">
          {dim ? lastKnown : <ResetCaption resetWords={resetWords} resetsAt={resetsAt} />}
        </span>
      </td>
    );
  }

  if (panel.balance !== null) {
    return (
      <td className={cx("troom", dim && "dim")}>
        <span className="rtop">
          <span className="rnum">{balanceText(panel.balance)}</span>
          <span className="rwin">{zhLabel(panel.balance.label)}</span>
        </span>
        <span className="rsub">{dim ? lastKnown : "无重置"}</span>
      </td>
    );
  }

  return (
    <td className="troom dim">
      <span className="rtop">
        <span className="rnum">未报告额度</span>
      </span>
      <span className="rsub">{dim ? lastKnown : "等待首次刷新"}</span>
    </td>
  );
}
