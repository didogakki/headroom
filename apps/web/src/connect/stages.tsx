import { useId, useState, type FormEvent, type ReactNode } from "react";

import type { AuthMethod, NextStepPayload, SubmitInput } from "@headroom/core/contracts";

import { ExternalIcon } from "../icons.tsx";
import { Button, ButtonLink } from "../ui/button.tsx";
import { CopyButton } from "../ui/copy-button.tsx";
import { acceptsLabel, acceptsPlaceholder, pasteInputKind, type Accepts } from "./steps.ts";

function OpenLink(props: {
  readonly url: string;
  readonly primary?: boolean;
  readonly children: string;
}) {
  return (
    <ButtonLink
      href={props.url}
      target="_blank"
      rel="noreferrer noopener"
      variant={props.primary === false ? "default" : "primary"}
      icon={<ExternalIcon />}
    >
      {props.children}
    </ButtonLink>
  );
}

function CancelButton(props: { readonly onCancel: () => void; readonly disabled?: boolean }) {
  return (
    <Button variant="quiet" disabled={props.disabled === true} onClick={props.onCancel}>
      取消
    </Button>
  );
}

function Lead(props: { readonly children: ReactNode }) {
  return (
    <p className="secondary" style={{ margin: 0 }}>
      {props.children}
    </p>
  );
}

interface StageProps {
  readonly provider: string;
  readonly method: AuthMethod;
  readonly step: NextStepPayload | null;
  readonly busy: boolean;
  readonly onSubmit: (input: SubmitInput) => void;
  readonly onCancel: () => void;
}

function PasteStage(
  props: StageProps & { readonly step: Extract<NextStepPayload, { kind: "paste_redirect" }> },
) {
  const { step } = props;
  const id = useId();
  const [value, setValue] = useState("");
  const accepts: Accepts = step.accepts;
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const trimmed = value.trim();
    if (trimmed === "") return;
    setValue("");
    props.onSubmit({ kind: pasteInputKind(accepts, trimmed), value: trimmed });
  };
  return (
    <form className="stage" onSubmit={submit}>
      <Lead>
        打开 {props.provider} 登录页并登录。{" "}
        {accepts === "code"
          ? "把它显示的代码粘贴到这里。"
          : accepts === "url"
            ? "当它跳转到一个打不开的页面时，把那个地址粘贴到这里。"
            : "粘贴它显示的代码，或那个打不开的页面的地址。"}
      </Lead>
      <div className="field">
        <label htmlFor={id}>{acceptsLabel(accepts)}</label>
        <input
          id={id}
          type={accepts === "url" ? "url" : "text"}
          value={value}
          placeholder={acceptsPlaceholder(accepts)}
          onChange={(event) => setValue(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          required
        />
      </div>
      <div className="row">
        <Button type="submit" variant="primary" busy={props.busy} busyLabel="正在发送">
          继续
        </Button>
        <OpenLink url={step.url} primary={false}>
          {`打开 ${props.provider} 登录页`}
        </OpenLink>
        <CancelButton onCancel={props.onCancel} />
      </div>
    </form>
  );
}

function KeyStage(
  props: StageProps & { readonly step: Extract<NextStepPayload, { kind: "api_key" }> },
) {
  const { step } = props;
  const id = useId();
  const [values, setValues] = useState<Record<string, string>>({});
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const sent = { ...values };
    setValues({});
    props.onSubmit({ kind: "api_key", values: sent });
  };
  return (
    <form className="stage" onSubmit={submit}>
      {step.fields.map((field) => (
        <div className="field" key={field.name}>
          <label htmlFor={`${id}-${field.name}`}>{field.label}</label>
          <input
            id={`${id}-${field.name}`}
            type={field.secret ? "password" : "text"}
            value={values[field.name] ?? ""}
            onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}
            autoComplete="off"
            spellCheck={false}
            required
          />
        </div>
      ))}
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        密钥会被加密保存，且不会再次显示。
      </p>
      <div className="row">
        <Button type="submit" variant="primary" busy={props.busy} busyLabel="正在发送">
          连接
        </Button>
        <OpenLink url={step.keyPageUrl} primary={false}>
          {`打开 ${props.provider} 密钥页面`}
        </OpenLink>
        <CancelButton onCancel={props.onCancel} />
      </div>
    </form>
  );
}

function FileStage(
  props: StageProps & { readonly step: Extract<NextStepPayload, { kind: "paste_file" }> },
) {
  const { step } = props;
  const id = useId();
  const [contents, setContents] = useState("");
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (contents.trim() === "") return;
    const sent = contents;
    setContents("");
    props.onSubmit({ kind: "file", contents: sent });
  };
  return (
    <form className="stage" onSubmit={submit}>
      {step.hint === "" ? null : <Lead>{step.hint}</Lead>}
      <div className="field">
        <label htmlFor={id}>{`${step.expectedFileName} 的内容`}</label>
        <textarea
          id={id}
          value={contents}
          rows={8}
          onChange={(event) => setContents(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          required
        />
      </div>
      <div className="row">
        <Button type="submit" variant="primary" busy={props.busy} busyLabel="正在发送">
          导入
        </Button>
        <CancelButton onCancel={props.onCancel} />
      </div>
    </form>
  );
}

function SelectStage(
  props: StageProps & { readonly step: Extract<NextStepPayload, { kind: "select_account" }> },
) {
  const { step } = props;
  const [selected, setSelected] = useState("");
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (selected === "") return;
    props.onSubmit({ kind: "selection", id: selected });
  };
  return (
    <form className="stage" onSubmit={submit}>
      <Lead>请选择要连接的账户。</Lead>
      <fieldset className="choices">
        <legend className="sr">账户</legend>
        {step.options.map((option) => (
          <label key={option.id} className="choice">
            <input
              type="radio"
              name="account"
              value={option.id}
              checked={selected === option.id}
              onChange={() => setSelected(option.id)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>
      <div className="row">
        <Button
          type="submit"
          variant="primary"
          disabled={selected === ""}
          busy={props.busy}
          busyLabel="正在发送"
        >
          继续
        </Button>
        <CancelButton onCancel={props.onCancel} />
      </div>
    </form>
  );
}

/** The Sign In step: what the owner does at the provider, drawn per kind of next step. */
export function SignInStage(props: StageProps) {
  const { step, provider, method } = props;
  if (step === null) {
    return (
      <div className="stage">
        <Lead>正在启动 {provider} 登录。此页面会自动更新。</Lead>
        <div className="row">
          <CancelButton onCancel={props.onCancel} />
        </div>
      </div>
    );
  }
  switch (step.kind) {
    case "open_url":
      return (
        <div className="stage">
          {method === "approval_poll" ? (
            <Lead>打开 {provider} 的批准页面并在那里批准 Headroom。此页面会自动更新。</Lead>
          ) : (
            <Lead>打开 {provider} 登录页并在那里完成登录。此页面会自动更新。</Lead>
          )}
          <div className="row">
            <OpenLink url={step.url}>
              {method === "approval_poll" ? "打开批准页面" : `打开 ${provider} 登录页`}
            </OpenLink>
            <CopyButton value={step.url} label="复制链接" />
            <CancelButton onCancel={props.onCancel} />
          </div>
        </div>
      );
    case "device_code":
      return (
        <div className="stage">
          <Lead>
            打开 {provider} 并输入此代码。{provider} 批准后，Headroom 会自动完成。
          </Lead>
          <div className="row">
            <span className="code">
              {step.userCode}
              <CopyButton value={step.userCode} label="复制代码" size="sm" iconOnly />
            </span>
            <OpenLink url={step.verificationUrl}>{`打开 ${provider} 登录页`}</OpenLink>
            <CancelButton onCancel={props.onCancel} />
          </div>
        </div>
      );
    case "paste_redirect":
      return <PasteStage {...props} step={step} />;
    case "api_key":
      return <KeyStage {...props} step={step} />;
    case "paste_file":
      return <FileStage {...props} step={step} />;
    case "select_account":
      return <SelectStage {...props} step={step} />;
  }
}

/** The Check step: the sign-in was accepted and Headroom looks at what the account reports. */
export function CheckStage(props: { readonly onCancel: () => void }) {
  return (
    <div className="stage">
      <Lead>已登录。正在检查此账户的额度。</Lead>
      <div className="sk bar" style={{ width: "40%" }} />
      <div className="row">
        <CancelButton onCancel={props.onCancel} />
      </div>
    </div>
  );
}
