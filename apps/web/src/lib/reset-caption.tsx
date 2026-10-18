import type { Cell } from "@headroom/view-model/present";
import { When } from "./when.tsx";

type ResetWords = Extract<Cell, { kind: "meter" }>["resetWords"];

/** The verb that closes a reset line: a billing cycle ends, a rolling window resets. */
export function resetVerb(words: ResetWords): "重置" | "周期结束" {
  return words === "resets" || words === "not_started" ? "重置" : "周期结束";
}

/**
 * The reset of one meter in words: "2小时后重置", "12天后周期结束", "随周期重置" for a pool that follows the
 * billing cycle, "未开始" for a session that has not opened, or "无重置时间".
 */
export function ResetCaption(props: {
  readonly resetWords: ResetWords;
  readonly resetsAt: number | null;
}) {
  const { resetWords, resetsAt } = props;
  if (resetWords === "with_cycle") return "随周期重置";
  if (resetWords === "not_started") return "未开始";
  if (resetsAt === null) return "无重置时间";
  return <When at={resetsAt} kind="until" suffix={resetVerb(resetWords)} />;
}
