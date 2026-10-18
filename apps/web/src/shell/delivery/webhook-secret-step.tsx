import { useId, useState } from "react";

import { Button } from "../../ui/button.tsx";
import { Segmented } from "../../ui/segmented.tsx";
import { Disclosure } from "./form-parts.tsx";
import { SecretCard } from "./secret-card.tsx";

/** Step 2 of the webhook: the signing secret. In change mode the saved secret can stay. */
export function WebhookSecretStep(props: {
  readonly secret: string;
  /** Set only when changing a saved webhook: true keeps its secret. */
  readonly keep: boolean | null;
  readonly onKeep: (keep: boolean) => void;
  readonly onRegenerate: () => void;
  readonly onBack: () => void;
  readonly onContinue: () => void;
}) {
  const [saved, setSaved] = useState(false);
  const boxId = useId();
  const showing = props.keep !== true;
  return (
    <div className="dl-form">
      {props.keep === null ? null : (
        <Segmented
          label="密钥"
          value={props.keep ? "keep" : "new"}
          onChange={(value) => props.onKeep(value === "keep")}
          options={[
            { value: "keep", label: "保留当前密钥" },
            { value: "new", label: "使用新密钥" },
          ]}
        />
      )}
      {showing ? (
        <>
          <p className="secondary dl-lead">
            把这个密钥添加到你的接收端。Headroom 会用它为每个请求签名。
          </p>
          <SecretCard
            secret={props.secret}
            onRegenerate={() => {
              setSaved(false);
              props.onRegenerate();
            }}
          />
          <Disclosure label="请求如何签名">
            <ul className="dl-signing">
              <li>请求头：webhook-id、webhook-timestamp、webhook-signature。</li>
              <li>签名：对 id.timestamp.body 做 HMAC-SHA256，密钥为上面的签名密钥。</li>
              <li>遵循 Standard Webhooks 格式。</li>
            </ul>
          </Disclosure>
          <label className="dl-check" htmlFor={boxId}>
            <input
              id={boxId}
              type="checkbox"
              checked={saved}
              onChange={(event) => setSaved(event.currentTarget.checked)}
            />
            我已保存密钥
          </label>
        </>
      ) : (
        <p className="secondary dl-lead">你的接收端当前使用的密钥会继续有效。</p>
      )}
      <div className="dl-actions">
        <Button variant="primary" disabled={showing && !saved} onClick={props.onContinue}>
          继续
        </Button>
        <Button variant="quiet" onClick={props.onBack}>
          返回
        </Button>
      </div>
    </div>
  );
}
