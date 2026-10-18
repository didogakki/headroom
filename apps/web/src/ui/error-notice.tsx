import type { ReactNode } from "react";

import { AlertIcon } from "../icons.tsx";
import { Button } from "./button.tsx";
import { cx } from "./cx.ts";

/**
 * A failed load, in plain words, with a retry button. `busy` shows the retry in progress. Without `onRetry` it is
 * only a message. Use `inline` inside a card, where the notice needs no outer margin.
 */
export function ErrorNotice(props: {
  readonly children: ReactNode;
  readonly onRetry?: () => void;
  readonly busy?: boolean;
  readonly inline?: boolean;
  readonly retryLabel?: string;
  readonly retryBusyLabel?: string;
}) {
  return (
    <div className={cx("notice", "bad", props.inline === true && "inline")} role="alert">
      <span className="text">
        <AlertIcon />
        {props.children}
      </span>
      {props.onRetry === undefined ? null : (
        <Button
          size="sm"
          busy={props.busy === true}
          busyLabel={props.retryBusyLabel ?? "重试中"}
          onClick={props.onRetry}
        >
          {props.retryLabel ?? "重试"}
        </Button>
      )}
    </div>
  );
}
