import type { MeterWindow } from "@headroom/view-model/accounts";
import { ResetCaption } from "../../lib/reset-caption.tsx";

/** The word that marks the window an account is limited by. The same word everywhere. */
export function LimitTag() {
  return <span className="cmp-tag">限制项</span>;
}

/** When a window resets, or why it has no time. */
export function ResetLine(props: {
  readonly window: Pick<MeterWindow, "unlimited" | "notStarted" | "end" | "resetWords">;
}) {
  const { window } = props;
  if (window.unlimited) return <>此账户没有限制</>;
  if (window.notStarted) return <>尚未开始计时</>;
  return <ResetCaption resetWords={window.resetWords} resetsAt={window.end} />;
}
