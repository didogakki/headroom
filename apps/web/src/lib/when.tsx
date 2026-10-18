import { useSettings } from "./settings.tsx";
import type { WhenKind } from "@headroom/view-model/time";
import { useNow } from "./now.ts";
import { zhWhen } from "./zh.ts";

interface WhenProps {
  readonly at: number;
  readonly kind: WhenKind;
  /** Words before the time, for example "最早". */
  readonly prefix?: string;
  /** Words after the time, for example "重置": "2小时后重置". */
  readonly suffix?: string;
}

/** An instant as a countdown or an exact time, with the other form in the hover title. */
export function When({ at, kind, prefix, suffix }: WhenProps) {
  const { settings } = useSettings();
  const now = useNow();
  const { text, title } = zhWhen(kind, at, now, settings);
  return (
    <>
      {prefix}
      <time className="when" dateTime={new Date(at).toISOString()} title={title}>
        {text}
      </time>
      {suffix}
    </>
  );
}
