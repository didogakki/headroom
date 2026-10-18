import { useCallback, useEffect, useRef, useState } from "react";

import type { AuthMethod, MethodAvailability, Provider } from "@headroom/core/contracts";

import { api, ApiError, type Attempt, type OverviewConnection } from "../api.ts";
import { BrandMark } from "../icons.tsx";
import { planLabel, providerName } from "@headroom/view-model/labels";
import { zhAccountName, zhAuthMethod, zhMessage } from "../lib/zh.ts";
import { Button, ButtonLink } from "../ui/button.tsx";
import { messageOf } from "../lib/load.ts";
import { Result } from "../ui/result.tsx";
import { Segmented } from "../ui/segmented.tsx";
import { Spinner } from "../ui/spinner.tsx";
import { StatusSlot } from "../ui/pill.tsx";
import { Stepper, type StepState } from "../ui/stepper.tsx";
import { CheckStage, SignInStage } from "./stages.tsx";
import {
  clockLeft,
  defaultMethod,
  isTerminal,
  isUsable,
  shouldPoll,
  stoppedReason,
  unavailableNote,
} from "./steps.ts";

type Step = 2 | 3 | 4;

const stepWords = ["选择", "登录", "检查", "完成"] as const;

/** Where the stepper stands, from the state of the attempt. */
function stepOf(attempt: Attempt | null, startFailed: boolean): { step: Step; state: StepState } {
  if (startFailed) return { step: 2, state: "failed" };
  if (attempt === null) return { step: 2, state: "current" };
  if (attempt.state === "succeeded") return { step: 4, state: "done" };
  if (isTerminal(attempt.state)) return { step: 3, state: "failed" };
  if (attempt.state === "validating") return { step: 3, state: "current" };
  return { step: 2, state: "current" };
}

/** Re-render every second, so the time left counts down. */
function useSecondClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

interface FlowProps {
  readonly provider: Provider;
  readonly methods: readonly AuthMethod[];
  /** What the server can start here; a method it does not list is usable. */
  readonly availability?: readonly MethodAvailability[];
  /** Set when the flow signs an existing account in again. */
  readonly reconnectId?: string | undefined;
  readonly connections: readonly OverviewConnection[];
  /** The flow ends without a result: back to the provider cards. */
  readonly onClose: () => void;
  /** An attempt succeeded: the table should load the new account. */
  readonly onConnected: () => void;
}

/** The panel that follows one sign-in attempt from the first step to its result. */
export function ConnectFlow(props: FlowProps) {
  const { provider, methods, reconnectId, onClose, onConnected } = props;
  const availability = props.availability ?? [];
  const name = providerName(provider);
  const [method, setMethod] = useState<AuthMethod | null>(() =>
    defaultMethod(methods, availability),
  );
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const live = useRef<Attempt | null>(null);
  const started = useRef(false);

  const begin = useCallback(
    async (next: AuthMethod) => {
      const mine = ++generation.current;
      setMethod(next);
      setAttempt(null);
      setStartError(null);
      setError(null);
      try {
        const created =
          reconnectId === undefined
            ? await api.beginAttempt(provider, next)
            : await api.reconnect(reconnectId, next);
        if (generation.current === mine) setAttempt(created);
      } catch (cause) {
        if (generation.current === mine) {
          setStartError(
            cause instanceof ApiError && cause.code === "method_unavailable"
              ? "此服务器上无法使用该方式。请安装它的 CLI，或使用其他方式。"
              : zhMessage(messageOf(cause)),
          );
        }
      }
    },
    [provider, reconnectId],
  );

  useEffect(() => {
    live.current = attempt;
  }, [attempt]);

  // Leaving the page with a sign-in half done cancels it.
  useEffect(
    () => () => {
      const open = live.current;
      if (open !== null && !isTerminal(open.state))
        api.cancelAttempt(open.id).catch(() => undefined);
    },
    [],
  );

  useEffect(() => {
    if (started.current || method === null) return;
    started.current = true;
    void begin(method);
  }, [begin, method]);

  // Ask the server again after the pause it names.
  useEffect(() => {
    if (attempt === null || !shouldPoll(attempt)) return;
    const mine = generation.current;
    const poll = async (): Promise<void> => {
      try {
        const next = await api.attempt(attempt.id);
        if (generation.current === mine) setAttempt(next);
      } catch (cause) {
        if (generation.current !== mine) return;
        setError(zhMessage(messageOf(cause)));
        // A new object makes this effect schedule the next poll.
        setAttempt({ ...attempt });
      }
    };
    const timer = setTimeout(() => void poll(), Math.max(attempt.pollAfterMs, 1000));
    return () => clearTimeout(timer);
  }, [attempt]);

  const succeededId = attempt?.state === "succeeded" ? attempt.id : null;
  useEffect(() => {
    if (succeededId !== null) onConnected();
  }, [succeededId, onConnected]);

  const waiting = attempt !== null && !isTerminal(attempt.state) && attempt.state !== "validating";
  const now = useSecondClock();
  const left = attempt !== null && waiting ? clockLeft(attempt.expiresAt, now) : null;

  function cancel(): void {
    generation.current += 1;
    if (attempt !== null && !isTerminal(attempt.state)) {
      api.cancelAttempt(attempt.id).catch(() => undefined);
    }
    live.current = null;
    onClose();
  }

  function switchMethod(next: AuthMethod): void {
    if (next === method) return;
    if (attempt !== null && !isTerminal(attempt.state)) {
      api.cancelAttempt(attempt.id).catch(() => undefined);
    }
    live.current = null;
    void begin(next);
  }

  async function submit(input: Parameters<typeof api.submitInput>[1]): Promise<void> {
    if (attempt === null) return;
    const mine = generation.current;
    setBusy(true);
    setError(null);
    try {
      const next = await api.submitInput(attempt.id, input);
      if (generation.current === mine) setAttempt(next);
    } catch (cause) {
      if (generation.current === mine) setError(zhMessage(messageOf(cause)));
    } finally {
      setBusy(false);
    }
  }

  const { step, state } = stepOf(attempt, startError !== null);
  const stopped = attempt !== null && isTerminal(attempt.state) && attempt.state !== "succeeded";
  const failed = startError !== null || stopped;
  const succeeded = attempt?.state === "succeeded";
  const checking = attempt?.state === "validating";

  let statusKey = "starting";
  let statusNode = (
    <span className="status">
      <Spinner />
      正在启动
    </span>
  );
  if (failed) {
    statusKey = "failed";
    statusNode = <span className="status">未完成</span>;
  } else if (succeeded) {
    statusKey = "done";
    statusNode = <span className="status">已连接</span>;
  } else if (checking) {
    statusKey = "checking";
    statusNode = (
      <span className="status">
        <Spinner />
        检查中
      </span>
    );
  } else if (attempt !== null) {
    statusKey = "waiting";
    statusNode = (
      <span className="status">
        <Spinner />
        {`等待你操作${left === null ? "" : ` · 剩余 ${left}`}`}
      </span>
    );
  }

  const connectedId = attempt?.state === "succeeded" ? attempt.connectionId : null;
  const connected = props.connections.find((entry) => entry.id === connectedId);
  const who =
    connected === undefined
      ? `你的 ${name} 账户`
      : [zhAccountName(connected), planLabel(connected.plan)]
          .filter((part) => part !== null)
          .join(" · ");

  const showMethods = methods.length > 1 && !failed && !succeeded && !checking;
  const blocked = availability.find((entry) => !entry.available && methods.includes(entry.method));
  const alternatives = methods.filter((entry) => isUsable(entry, availability));

  return (
    <section className="panel step flow" aria-live="polite">
      <div className="title">
        <h2>
          <BrandMark provider={provider} />
          {name}
        </h2>
        <StatusSlot statusKey={statusKey}>{statusNode}</StatusSlot>
      </div>
      <Stepper words={stepWords} step={step} state={state} />
      {showMethods && method !== null ? (
        <Segmented
          label="登录方式"
          value={method}
          onChange={switchMethod}
          options={methods.map((entry) => ({
            value: entry,
            label: zhAuthMethod(entry),
            disabled: !isUsable(entry, availability),
          }))}
        />
      ) : null}
      {blocked !== undefined && !failed && !succeeded && !checking ? (
        <p className="muted" style={{ margin: 0 }}>
          {unavailableNote(name, blocked, alternatives)}
        </p>
      ) : null}
      {method === null ? (
        <div className="stage">
          <Result ok={false} title="不可用">
            {blocked === undefined
              ? `${name} 无法在此服务器上登录。`
              : unavailableNote(name, blocked, alternatives)}
          </Result>
          <div className="row">
            <CloseAction reconnecting={reconnectId !== undefined} onClose={onClose} />
          </div>
        </div>
      ) : null}
      {startError !== null ? (
        <div className="stage">
          <Result ok={false} title="未完成">
            {`登录无法启动。${startError}`}
          </Result>
          <div className="row">
            <Button variant="primary" onClick={() => method !== null && void begin(method)}>
              重试
            </Button>
            <CloseAction reconnecting={reconnectId !== undefined} onClose={onClose} />
          </div>
        </div>
      ) : null}
      {method !== null && startError === null && attempt === null ? (
        <div className="stage">
          <div className="sk bar" style={{ width: "40%" }} />
        </div>
      ) : null}
      {attempt !== null && stopped ? (
        <div className="stage">
          <Result ok={false} title="未完成">
            {stoppedReason(attempt)}
          </Result>
          <div className="row">
            <Button variant="primary" onClick={() => method !== null && void begin(method)}>
              重试
            </Button>
            <CloseAction reconnecting={reconnectId !== undefined} onClose={onClose} />
          </div>
        </div>
      ) : null}
      {attempt !== null && succeeded ? (
        <div className="stage">
          <Result ok title="已连接">
            {`${who} 已连接。它的首次刷新正在进行，额度会在一分钟内显示在下方表格中。`}
          </Result>
          <div className="row">
            <ButtonLink variant="primary" href="#/">
              查看账户
            </ButtonLink>
            {reconnectId === undefined ? (
              <Button variant="quiet" onClick={onClose}>
                再连接一个
              </Button>
            ) : (
              <ButtonLink variant="quiet" href="#/connect">
                再连接一个
              </ButtonLink>
            )}
          </div>
        </div>
      ) : null}
      {attempt !== null && checking ? <CheckStage onCancel={cancel} /> : null}
      {attempt !== null && waiting && method !== null ? (
        <SignInStage
          key={attempt.nextStep?.kind ?? "waiting"}
          provider={name}
          method={attempt.method}
          step={attempt.nextStep}
          busy={busy}
          onSubmit={(input) => void submit(input)}
          onCancel={cancel}
        />
      ) : null}
      {error !== null && !failed ? (
        <p className="muted" role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      ) : null}
    </section>
  );
}

function CloseAction(props: { readonly reconnecting: boolean; readonly onClose: () => void }) {
  if (props.reconnecting) {
    return (
      <ButtonLink variant="quiet" href="#/">
        返回账户
      </ButtonLink>
    );
  }
  return (
    <Button variant="quiet" onClick={props.onClose}>
      选择其他服务商
    </Button>
  );
}
