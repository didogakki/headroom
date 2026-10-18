import { ResetIcon } from "../icons.tsx";
import { useNow } from "../lib/now.ts";
import { useSettings } from "../lib/settings.tsx";
import { exactFull } from "@headroom/view-model/time";
import { When } from "../lib/when.tsx";
import { zhExact, zhLabel } from "../lib/zh.ts";
import { InfoTip } from "./info-tip.tsx";

/**
 * A one-line, read-only summary of banked resets: "3 个重置授权 · 4天后到期". It is information, not a
 * control, and sits at the left of a panel's facts row.
 */
export function BankedResets(props: {
  readonly count: number;
  /** The view-model's singular noun, for example "Reset Grant"; shown in Chinese. */
  readonly label: string;
  /** Expiry instants, soonest first. */
  readonly expiries: readonly number[];
}) {
  const { count, label, expiries } = props;
  const { settings } = useSettings();
  const now = useNow();
  const first = expiries[0];
  const noun = zhLabel(label);
  return (
    <span className="banked">
      <span className="banked-chip" aria-hidden="true">
        <ResetIcon />
      </span>
      <span className="banked-text">
        {count === 0 ? (
          <span className="banked-zero">{`无${noun}`}</span>
        ) : (
          <>
            <b className="banked-count">{`${count} 个${noun}`}</b>
            {first === undefined ? null : (
              <>
                <span className="banked-dot" aria-hidden="true">
                  ·
                </span>
                <span className="banked-when">
                  <When at={first} kind="until" suffix="到期" />
                </span>
              </>
            )}
          </>
        )}
      </span>
      {expiries.length > 1 ? (
        <InfoTip label={`所有${noun}的到期时间`}>
          <b>{`已存${noun}`}</b>
          {expiries.map((at, index) => (
            <span
              key={at}
            >{`${noun} ${index + 1} · ${zhExact(exactFull(at, now, settings.clock))}到期`}</span>
          ))}
        </InfoTip>
      ) : null}
    </span>
  );
}
