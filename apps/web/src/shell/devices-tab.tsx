import { useEffect, useId, useState } from "react";

import { shortDate } from "@headroom/view-model/time";

import { api, type ApiToken } from "../api.ts";
import { KeyIcon } from "../icons.tsx";
import { When } from "../lib/when.tsx";
import { Button } from "../ui/button.tsx";
import { CopyButton } from "../ui/copy-button.tsx";
import { EmptyState } from "../ui/empty-state.tsx";
import { ErrorNotice } from "../ui/error-notice.tsx";
import { Segmented } from "../ui/segmented.tsx";
import { Sk } from "../ui/skeleton.tsx";
import { Section } from "./settings-rows.tsx";
import "./devices.css";

/** The token's visible start, what it may do, its last use and, when set, its expiry. */
function DeviceNote(props: { readonly token: ApiToken }) {
  const { token } = props;
  return (
    <span className="muted">
      <code>{token.start ?? token.prefix}…</code>
      {token.scopes.includes("refresh") ? " · 读写" : " · 只读"}
      {" · "}
      {token.lastUsedAt === null ? (
        "从未使用"
      ) : (
        <>
          使用于 <When at={token.lastUsedAt} kind="ago" />
        </>
      )}
      {" · 添加于 "}
      {shortDate(token.createdAt)}
      {token.expiresAt === null ? null : ` · 到期于 ${shortDate(token.expiresAt)}`}
    </span>
  );
}

/** Keys live only in this mounted tab and are discarded when it closes. The parent remounts it when Demo Mode changes. */
export function DevicesTab() {
  const [tokens, setTokens] = useState<ApiToken[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [refresh, setRefresh] = useState(false);
  const [created, setCreated] = useState<{ readonly name: string; readonly key: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const nameId = useId();
  const reload = async (): Promise<void> => {
    setError(null);
    try {
      setTokens((await api.tokens()).tokens);
    } catch {
      setError("Headroom 无法加载你的设备。");
    }
  };
  useEffect(() => {
    let active = true;
    void api
      .tokens()
      .then((result) => {
        if (active) setTokens(result.tokens);
        return undefined;
      })
      .catch(() => {
        if (active) setError("Headroom 无法加载你的设备。");
      });
    return () => {
      active = false;
    };
  }, []);
  const create = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const token = await api.createToken(name.trim(), refresh);
      setCreated({ name: token.name ?? name.trim(), key: token.key });
      setName("");
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Headroom 无法创建令牌。");
    } finally {
      setBusy(false);
    }
  };
  const revoke = async (id: string): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.revokeToken(id);
      setConfirm(null);
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Headroom 无法撤销令牌。");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Section title="新设备">
        {created === null ? (
          <form
            className="device-form"
            onSubmit={(event) => {
              event.preventDefault();
              void create();
            }}
          >
            <div className="device-head">
              <label htmlFor={nameId} className="sbody">
                <b>设备名称</b>
                <span className="muted">
                  {refresh
                    ? "令牌允许 Headroom for Mac 读取此服务器并更改刷新间隔。"
                    : "令牌允许 Headroom for Mac 读取此服务器。"}
                </span>
              </label>
              <Segmented
                label="访问权限"
                value={refresh ? "write" : "read"}
                options={[
                  { value: "read", label: "只读" },
                  { value: "write", label: "读写" },
                ]}
                onChange={(value) => setRefresh(value === "write")}
              />
            </div>
            <div className="device-create">
              <input
                id={nameId}
                value={name}
                maxLength={40}
                required
                placeholder="我的 Mac"
                onChange={(event) => setName(event.target.value)}
              />
              <Button type="submit" variant="primary" busy={busy} disabled={!name.trim()}>
                创建令牌
              </Button>
            </div>
          </form>
        ) : (
          <div className="device-key">
            <span className="sbody">
              <b>{created.name} 的令牌</b>
              <span className="muted">仅显示一次。请连同此服务器地址粘贴到 Headroom for Mac。</span>
            </span>
            <div className="device-create">
              <div className="key-field">
                <code aria-label="令牌">{created.key}</code>
                <CopyButton value={created.key} label="复制令牌" size="sm" iconOnly />
              </div>
              <Button onClick={() => setCreated(null)}>完成</Button>
            </div>
          </div>
        )}
      </Section>
      <Section title="已连接设备">
        {error === null ? null : (
          <ErrorNotice inline onRetry={() => void reload()}>
            {error}
          </ErrorNotice>
        )}
        {tokens === null ? (
          <div className="srow" aria-busy="true">
            <span className="sbody">
              <Sk width={120} height={14} />
              <Sk width={220} height={12} />
            </span>
            <Sk width={76} height={30} className="sk-pill" />
          </div>
        ) : tokens.length === 0 ? (
          <EmptyState compact icon={<KeyIcon />} title="尚无设备">
            在上方创建令牌，然后在 Headroom for Mac 中添加此服务器。
          </EmptyState>
        ) : (
          tokens.map((token) => {
            const label = token.name ?? "未命名设备";
            return (
              <div key={token.id} className="srow device-row">
                {confirm === token.id ? (
                  <span className="sbody">
                    <b>撤销 {label}？</b>
                    <span className="muted">此设备将立即失去对此服务器的访问权限。</span>
                  </span>
                ) : (
                  <span className="sbody">
                    <b>{label}</b>
                    <DeviceNote token={token} />
                  </span>
                )}
                {confirm === token.id ? (
                  <span className="device-actions">
                    <Button size="sm" disabled={busy} onClick={() => setConfirm(null)}>
                      取消
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      busy={busy}
                      onClick={() => void revoke(token.id)}
                    >
                      撤销
                    </Button>
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="quiet-danger"
                    disabled={busy}
                    onClick={() => setConfirm(token.id)}
                  >
                    撤销
                  </Button>
                )}
              </div>
            );
          })
        )}
      </Section>
    </>
  );
}
