import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { api } from "../api.ts";
import { CheckIcon, PauseIcon, PlayIcon, RetryIcon } from "../icons.tsx";
import { connectionBusyMessage, isConnectionBusy } from "../lib/connection-busy.ts";
import { useDevicePrefs } from "../lib/device-prefs.ts";
import { isDemoSite } from "../lib/site.ts";
import { zhMessage } from "../lib/zh.ts";
import { ActionButton } from "../ui/action-button.tsx";
import { Button } from "../ui/button.tsx";
import { Spinner } from "../ui/spinner.tsx";

const resultMs = 1600;
const askMs = 6000;
const doneMs = 700;
// The busy note has more to read than a failure word, so it stays up longer.
const busyMs = 2800;

type DisconnectPhase = "closed" | "asking" | "working" | "done" | "failed";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Pause or resume, refresh and disconnect for one account. Disconnect asks in place first. */
export function PanelActions(props: {
  readonly id: string;
  readonly paused: boolean;
  /** A disconnected account has nothing to pause or refresh. */
  readonly signedIn: boolean;
  /** Reload the overview; resolves when the new list is in. */
  readonly onChanged: () => Promise<void>;
  /** The account is gone on the server. The panel collapses, then the overview reloads. */
  readonly onDisconnected: () => void;
}) {
  const { id, paused, signedIn, onChanged, onDisconnected } = props;
  // In Demo Mode the server is never asked, and every change is refused; the failed faces say why.
  const { demo } = useDevicePrefs();
  const failedWord = demo ? "演示模式" : "失败";
  const [disconnect, setDisconnect] = useState<DisconnectPhase>("closed");
  /** The last disconnect failed because a refresh was running; the failed face says so. */
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const live = useRef(true);
  const alive = (): boolean => live.current;
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  useEffect(() => {
    if (disconnect !== "asking") return;
    cancel.current?.focus();
    const timer = setTimeout(() => setDisconnect("closed"), askMs);
    return () => clearTimeout(timer);
  }, [disconnect]);

  /** A refresh is a read-only collection. The overview reloads either way, so the panel shows what happened. */
  const runRefresh = async (): Promise<void> => {
    let failure: unknown = null;
    try {
      await api.refresh(id);
    } catch (cause) {
      failure = cause;
    }
    await onChanged();
    if (failure !== null) throw failure;
  };

  const runPause = async (): Promise<void> => {
    await api.pause(id, !paused);
    await onChanged();
  };

  const runDisconnect = async (): Promise<void> => {
    setDisconnect("working");
    try {
      await api.disconnect(id);
    } catch (cause) {
      if (!alive()) return;
      const refreshing = isConnectionBusy(cause);
      setBusy(refreshing);
      setDisconnect("failed");
      await wait(refreshing ? busyMs : resultMs);
      if (alive()) setDisconnect("closed");
      return;
    }
    if (!alive()) return;
    setDisconnect("done");
    await wait(doneMs);
    onDisconnected();
  };

  const closeAsk = (): void => {
    setDisconnect("closed");
    requestAnimationFrame(() =>
      root.current?.querySelector<HTMLElement>("[data-disconnect]")?.focus(),
    );
  };
  const onAskKey = (event: KeyboardEvent<HTMLFieldSetElement>): void => {
    if (event.key === "Escape" && disconnect === "asking") {
      event.stopPropagation();
      closeAsk();
    }
  };

  return (
    <span className="acts" ref={root}>
      {signedIn ? (
        <>
          <ActionButton
            variant="quiet"
            size="sm"
            icon={paused ? <PlayIcon /> : <PauseIcon />}
            label={paused ? "恢复" : "暂停"}
            pendingLabel={paused ? "正在恢复" : "正在暂停"}
            successLabel={paused ? "已恢复" : "已暂停"}
            failedLabel={failedWord}
            onAction={runPause}
          />
          <ActionButton
            variant="quiet"
            size="sm"
            icon={<RetryIcon />}
            label="刷新"
            pendingLabel="正在刷新"
            successLabel="已刷新"
            failedLabel={failedWord}
            onAction={runRefresh}
          />
        </>
      ) : null}
      {disconnect === "closed" ? (
        <Button
          variant="quiet-danger"
          size="sm"
          data-disconnect=""
          onClick={() => setDisconnect("asking")}
        >
          断开连接
        </Button>
      ) : (
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape cancels the question from any control inside it
        <fieldset className="confirm" aria-label="确认断开连接" onKeyDown={onAskKey}>
          {disconnect === "asking" ? (
            <>
              <span className="q">断开连接？</span>
              <button ref={cancel} className="btn sm" type="button" onClick={closeAsk}>
                取消
              </button>
              <button className="btn sm primary" type="button" onClick={() => void runDisconnect()}>
                断开连接
              </button>
            </>
          ) : (
            <output className="q">
              {disconnect === "working" ? (
                <>
                  <Spinner /> 正在断开连接
                </>
              ) : disconnect === "done" ? (
                <>
                  <CheckIcon /> 已断开连接
                </>
              ) : demo ? (
                isDemoSite ? (
                  "仅限演示"
                ) : (
                  "请关闭演示模式"
                )
              ) : busy ? (
                // The pill is one short line, so the full note is the hover text and the spoken text.
                <span title={zhMessage(connectionBusyMessage)}>
                  正在刷新<span className="sr"> - {zhMessage(connectionBusyMessage)}</span>
                </span>
              ) : (
                "无法断开连接"
              )}
            </output>
          )}
        </fieldset>
      )}
    </span>
  );
}
