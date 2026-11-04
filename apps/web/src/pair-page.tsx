import { useEffect, useState } from "react";

import { ApiError, api } from "./api.ts";
import { AuthFrame, AuthSkeleton, Unreachable } from "./auth-pages.tsx";
import { useLoad } from "./lib/load.ts";
import { href } from "./router.ts";
import { Button, ButtonLink } from "./ui/button.tsx";

const expired = "此代码已过期，请在 Mac 上重新发起连接。";

/** Where a Mac that asked to connect (D48) meets the signed-in owner: allow it, or not. */
export function PairPage(props: { readonly code: string }) {
  const pairing = useLoad(() => api.pairing(props.code), `pairing:${props.code}`);
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A lookup that once succeeded keeps its data when a later one fails, so 404 is checked first.
  const gone = pairing.status === 404;
  const pending = !gone && pairing.data?.status === "pending";
  const { reload } = pairing;
  // The account setup approves in the background, and another tab may answer first.
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(reload, 2000);
    return () => clearInterval(timer);
  }, [pending, reload]);

  async function decide(decision: "approve" | "deny"): Promise<void> {
    setBusy(decision);
    setError(null);
    try {
      await api.decidePairing(props.code, decision);
      pairing.reload();
    } catch (cause) {
      // Already decided, or gone: the reload shows which.
      if (cause instanceof ApiError && cause.status !== 500) pairing.reload();
      else setError("请求失败，请重试。");
    } finally {
      setBusy(null);
    }
  }

  if (gone) return <AuthFrame title="代码已过期" note={expired} />;
  if (pairing.data === null) {
    if (pairing.error === null) return <AuthSkeleton />;
    return (
      <Unreachable
        task="加载此请求"
        status={pairing.status}
        busy={pairing.pending}
        onRetry={pairing.reload}
      />
    );
  }
  const { name, status } = pairing.data;
  if (status === "approved") {
    return (
      <AuthFrame title="已连接">
        <ButtonLink variant="primary" href={href({ page: "connect" })}>
          连接 AI 账户
        </ButtonLink>
      </AuthFrame>
    );
  }
  if (status === "denied") return <AuthFrame title="未授权" />;
  if (status === "expired") return <AuthFrame title="代码已过期" note={expired} />;
  return (
    <AuthFrame title={`允许 ${name} 连接？`}>
      <p className="pair-code" aria-label="代码">
        {props.code}
      </p>
      <ul className="pair-can">
        <li>可以查看你的账户、额度和重置</li>
        <li>可以将通知标为已读</li>
        <li>无法修改账户、连接新账户或使用你的套餐</li>
      </ul>
      {error === null ? null : (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      <div className="pair-actions">
        <Button disabled={busy !== null} busy={busy === "deny"} onClick={() => void decide("deny")}>
          拒绝
        </Button>
        <Button
          variant="primary"
          disabled={busy !== null}
          busy={busy === "approve"}
          onClick={() => void decide("approve")}
        >
          允许
        </Button>
      </div>
    </AuthFrame>
  );
}
