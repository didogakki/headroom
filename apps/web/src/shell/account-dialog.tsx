import { useState, type FormEvent } from "react";

import { api } from "../api.ts";
import { authClient } from "../auth.ts";
import { FingerprintIcon, PlusIcon } from "../icons.tsx";
import { isDemoSite } from "../lib/site.ts";
import { useLoad } from "../lib/load.ts";
import { shortDate } from "@headroom/view-model/time";
import { zhDates } from "../lib/zh.ts";
import { Button } from "../ui/button.tsx";
import { Dialog } from "../ui/dialog.tsx";
import { EmptyState } from "../ui/empty-state.tsx";
import { ErrorNotice } from "../ui/error-notice.tsx";
import { PasswordField } from "../ui/password-field.tsx";
import { PasswordStrength, type StrengthCopy } from "../ui/password-strength.tsx";
import { LoadingNote, Sk } from "../ui/skeleton.tsx";

const resultMs = 1600;
const fallbackMinimum = 12;

interface Failure {
  readonly code?: string | undefined;
  readonly status?: number | undefined;
}

const changeFailed = "无法修改密码，请重试。";

/** Which field a failed password change belongs to, with plain words. Anything else shows under the form. */
function passwordError(
  error: Failure,
  minimum: number,
): { readonly field: "current" | "next" | "form"; readonly message: string } {
  if (error.code === "INVALID_PASSWORD") {
    return { field: "current", message: "当前密码不正确。" };
  }
  if (error.code === "PASSWORD_TOO_SHORT") {
    return { field: "next", message: `请至少使用 ${minimum} 个字符。` };
  }
  if (error.status === 429) {
    return { field: "form", message: "尝试次数过多。请等一分钟后再试。" };
  }
  return { field: "form", message: changeFailed };
}

const strengthWords: Readonly<Record<string, string>> = {
  "Too Short": "太短",
  Weak: "弱",
  Fair: "一般",
  Good: "良好",
  Strong: "强",
};

/** The strength meter in Chinese. The score's English labels and rule ids stay the keys. */
const strengthCopy: StrengthCopy = {
  meter: "密码强度",
  checks: "密码检查项",
  none: "尚未输入密码",
  word: (label) => strengthWords[label] ?? label,
  rule: (id, minimum) =>
    id === "length"
      ? `至少 ${minimum} 个字符`
      : id === "plain"
        ? "不含常见词或键盘连续字符"
        : "不以重复或连续字符为主",
  passed: "，已通过",
  notPassed: "，未通过",
  more: (count) => `还差 ${count} 个`,
  summary: (label, met, total) =>
    `强度：${strengthWords[label] ?? label}。已通过 ${met} 项检查，共 ${total} 项。`,
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Two rows in the final layout while the passkey list loads. */
function PasskeysSkeleton() {
  return (
    <>
      <LoadingNote>正在加载通行密钥</LoadingNote>
      <ul className="plist" aria-busy="true">
        {[0, 1].map((index) => (
          <li key={index} aria-hidden="true">
            <Sk width={32} height={32} className="sk-tile" />
            <span className="pbody">
              <b>
                <Sk kind="text" width={index === 0 ? 120 : 96} />
              </b>
              <span className="muted">
                <Sk kind="text" width={80} />
              </span>
            </span>
            <Sk width={64} height={30} className="sk-pill" />
          </li>
        ))}
      </ul>
    </>
  );
}

function Passkeys() {
  const list = authClient.useListPasskeys();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passkeys = list.data ?? [];
  const failed = !list.isPending && Boolean(list.error);
  const ready = !list.isPending && !failed;

  const add = async (): Promise<void> => {
    setAdding(true);
    setError(null);
    try {
      const name = passkeys.length === 0 ? "Passkey" : `Passkey ${passkeys.length + 1}`;
      const result = await authClient.passkey.addPasskey({ name });
      if (result.error) setError("无法添加通行密钥，请重试。");
      else await list.refetch();
    } catch {
      setError("无法添加通行密钥，请重试。");
    }
    setAdding(false);
  };
  const remove = async (id: string): Promise<void> => {
    setError(null);
    try {
      const result = await authClient.passkey.deletePasskey({ id });
      if (result.error) setError("无法移除通行密钥，请重试。");
      else await list.refetch();
    } catch {
      setError("无法移除通行密钥，请重试。");
    }
  };

  return (
    <section className="dsec">
      <div className="dsec-head">
        <h3>通行密钥</h3>
        <Button
          size="sm"
          icon={<PlusIcon />}
          busy={adding}
          busyLabel="等待你的设备"
          disabled={!ready}
          onClick={() => void add()}
        >
          添加通行密钥
        </Button>
      </div>
      {list.isPending ? <PasskeysSkeleton /> : null}
      {failed ? (
        <ErrorNotice inline busy={list.isRefetching} onRetry={() => void list.refetch()}>
          Headroom 无法加载你的通行密钥。请确认 Headroom 服务正在运行，然后重试。
        </ErrorNotice>
      ) : null}
      {ready && passkeys.length === 0 ? (
        <EmptyState compact icon={<FingerprintIcon />} title="还没有通行密钥">
          添加一个，即可无需密码登录。
        </EmptyState>
      ) : null}
      {ready && passkeys.length > 0 ? (
        <ul className="plist">
          {passkeys.map((passkey) => {
            const name = passkey.name?.trim() ? passkey.name.trim() : "通行密钥";
            return (
              <li key={passkey.id}>
                <span className="pk">
                  <FingerprintIcon />
                </span>
                <span className="pbody">
                  <b>{name}</b>
                  <span className="muted">{`添加于${zhDates(shortDate(passkey.createdAt.getTime()))}`}</span>
                </span>
                <Button
                  variant="quiet-danger"
                  size="sm"
                  aria-label={`移除${name}`}
                  onClick={() => void remove(passkey.id)}
                >
                  移除
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {error === null ? null : (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function Password() {
  const setup = useLoad(() => api.setup(), "setup");
  const minimum = setup.data?.minimumPasswordLength ?? fallbackMinimum;
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [changed, setChanged] = useState(false);
  const [currentError, setCurrentError] = useState<string | undefined>(undefined);
  const [nextError, setNextError] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setCurrentError(undefined);
    setNextError(undefined);
    try {
      const result = await authClient.changePassword({
        currentPassword: current,
        newPassword: next,
      });
      if (result.error) {
        const failure = passwordError(result.error, minimum);
        if (failure.field === "current") setCurrentError(failure.message);
        else if (failure.field === "next") setNextError(failure.message);
        else setError(failure.message);
        setBusy(false);
        return;
      }
    } catch {
      setError(changeFailed);
      setBusy(false);
      return;
    }
    setCurrent("");
    setNext("");
    setBusy(false);
    setChanged(true);
    await wait(resultMs);
    setChanged(false);
  };

  return (
    <section className="dsec">
      <div className="dsec-head">
        <h3>密码</h3>
      </div>
      <form className="pform" onSubmit={(event) => void submit(event)}>
        <PasswordField
          label="当前密码"
          showLabel="显示密码"
          name="current"
          autoComplete="current-password"
          value={current}
          error={currentError}
          onChange={(event) => {
            setCurrent(event.currentTarget.value);
            setCurrentError(undefined);
          }}
          required
        />
        <PasswordStrength
          label="新密码"
          showLabel="显示密码"
          copy={strengthCopy}
          name="next"
          autoComplete="new-password"
          minimum={minimum}
          minLength={minimum}
          value={next}
          error={nextError}
          onChange={(event) => {
            setNext(event.currentTarget.value);
            setNextError(undefined);
          }}
          required
        />
        {error === null ? null : (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="row">
          <Button variant="primary" type="submit" busy={busy} busyLabel="正在修改">
            {changed ? "密码已修改" : "修改密码"}
          </Button>
        </div>
      </form>
    </section>
  );
}

/** Passkeys and password; the demo site has neither. The content mounts only while the dialog is open, so it loads fresh each time. */
export function AccountDialog(props: { readonly open: boolean; readonly onClose: () => void }) {
  return (
    <Dialog open={props.open} onClose={props.onClose} title="账户">
      {props.open ? (
        <>
          {isDemoSite ? null : <Passkeys />}
          {isDemoSite ? null : <Password />}
        </>
      ) : null}
    </Dialog>
  );
}
