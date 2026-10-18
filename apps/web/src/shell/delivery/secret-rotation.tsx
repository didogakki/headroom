import { useState } from "react";

import { api } from "../../api.ts";
import { Button } from "../../ui/button.tsx";
import { Problem } from "./form-parts.tsx";
import { SecretCard } from "./secret-card.tsx";
import { codeOf, rotationProblem } from "./status.ts";

/** New Secret: a confirm step, then the new secret shown once with Copy. */
export function SecretRotation(props: {
  readonly channelId: string;
  readonly onClose: () => void;
}) {
  const [secret, setSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const make = (): void => {
    setBusy(true);
    setProblem(null);
    api
      .newChannelSecret(props.channelId)
      .then((made) => setSecret(made.secret))
      .catch((cause: unknown) => setProblem(rotationProblem(codeOf(cause))))
      .finally(() => setBusy(false));
  };

  if (secret !== null) {
    return (
      <div className="dl-rotation stage">
        <SecretCard secret={secret} />
        <p className="muted dl-note">只显示这一次。请现在把它添加到你的接收端。</p>
        <div className="dl-actions">
          <Button variant="primary" size="sm" onClick={props.onClose}>
            完成
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="dl-rotation stage">
      <p className="secondary dl-lead">旧密钥会立即失效。</p>
      <Problem>{problem}</Problem>
      <div className="dl-actions">
        <Button variant="primary" size="sm" busy={busy} busyLabel="正在生成" onClick={make}>
          生成新密钥
        </Button>
        <Button variant="quiet" size="sm" disabled={busy} onClick={props.onClose}>
          取消
        </Button>
      </div>
    </div>
  );
}
