import { PlugIcon, PlusIcon } from "../icons.tsx";
import { href } from "../router.ts";
import { ButtonLink } from "../ui/button.tsx";
import { EmptyState } from "../ui/empty-state.tsx";
import { ErrorNotice } from "../ui/error-notice.tsx";

/** The words are optional so a page can word them its own way; the defaults are the signed-in app's Chinese. */
export function NoAccounts(props: {
  readonly title?: string;
  readonly body?: string;
  readonly action?: string;
}) {
  const {
    title = "尚未连接账户",
    body = "连接服务商账户后，它的额度、余额和重置时间会在一分钟内显示在这里。",
    action = "连接账户",
  } = props;
  return (
    <EmptyState
      framed
      icon={<PlugIcon />}
      title={title}
      actions={
        <ButtonLink variant="primary" href={href({ page: "connect" })}>
          {action}
        </ButtonLink>
      }
    >
      {body}
    </EmptyState>
  );
}

/**
 * The overview did not load. With `stale`, the panels below are the last good load. The words are optional so a
 * page can word them its own way; the defaults are the signed-in app's Chinese.
 */
export function LoadFailed(props: {
  readonly stale: boolean;
  readonly busy: boolean;
  readonly onRetry: () => void;
  readonly staleText?: string;
  readonly failedText?: string;
  readonly retryLabel?: string;
  readonly retryBusyLabel?: string;
}) {
  const {
    staleText = "无法刷新，正在显示上一次成功加载的数据。",
    failedText = "Headroom 无法加载你的账户。请确认 Headroom 服务正在运行，然后重试。",
  } = props;
  return (
    <ErrorNotice
      busy={props.busy}
      onRetry={props.onRetry}
      {...(props.retryLabel === undefined ? {} : { retryLabel: props.retryLabel })}
      {...(props.retryBusyLabel === undefined ? {} : { retryBusyLabel: props.retryBusyLabel })}
    >
      {props.stale ? staleText : failedText}
    </ErrorNotice>
  );
}

export function AddAccountLink() {
  return (
    <a className="add" href={href({ page: "connect" })}>
      <PlusIcon /> 再连接一个账户
    </a>
  );
}
