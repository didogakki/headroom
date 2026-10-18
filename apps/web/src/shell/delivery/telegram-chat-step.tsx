import { useState } from "react";

import type { FoundChat } from "../../api.ts";
import { ExternalIcon } from "../../icons.tsx";
import { Button, ButtonLink } from "../../ui/button.tsx";
import { Result } from "../../ui/result.tsx";
import { Spinner } from "../../ui/spinner.tsx";
import { ChatList } from "./chat-list.tsx";
import { Disclosure, Problem, TextField } from "./form-parts.tsx";
import { chatIdProblem, isChatId } from "./validate.ts";
import { useChats, type ChatSource } from "./use-chats.ts";

/** The chat the owner picked. `title` is absent when they typed an id. */
export interface ChatChoice {
  readonly id: string;
  readonly title?: string;
}

/** Step 2 of Telegram: the owner messages the bot, Headroom finds the chat, the owner picks it. */
export function TelegramChatStep(props: {
  readonly source: ChatSource;
  readonly username: string;
  /** True when the token was just checked. */
  readonly verified: boolean;
  readonly initial: ChatChoice | null;
  readonly onBack: () => void;
  readonly onContinue: (chat: ChatChoice) => void;
}) {
  const { chats, stopped, problem, again } = useChats(props.source, true);
  const [picked, setPicked] = useState<string | null>(props.initial?.id ?? null);
  const [typed, setTyped] = useState("");
  const [touched, setTouched] = useState(false);

  const typedClean = typed.trim();
  const typedOk = typedClean !== "" && isChatId(typedClean);
  // The newest chat is chosen until the owner picks another.
  const chosen = chats.find((chat) => chat.id === picked) ?? chats[0] ?? null;
  const choice: ChatChoice | null = typedOk
    ? { id: typedClean }
    : chosen === null
      ? null
      : { id: chosen.id, title: chosen.title };
  const typedError = touched && typedClean !== "" && !typedOk ? chatIdProblem : null;

  const pick = (chat: FoundChat): void => {
    setPicked(chat.id);
    setTyped("");
  };

  return (
    <div className="dl-form">
      {props.verified ? (
        <Result ok title={`${props.username} 已验证`}>
          你的机器人令牌有效。
        </Result>
      ) : null}
      <div className="dl-lead-row">
        <p className="secondary dl-lead">{`打开 ${props.username}，并给它发送任意一条消息。`}</p>
        <ButtonLink
          size="sm"
          href={`https://t.me/${props.username.replace(/^@/, "")}`}
          target="_blank"
          rel="noreferrer noopener"
          icon={<ExternalIcon />}
        >
          {`打开 ${props.username}`}
        </ButtonLink>
      </div>
      {chats.length > 0 ? (
        <ChatList chats={chats} value={typedOk ? null : (chosen?.id ?? null)} onChange={pick} />
      ) : stopped ? (
        <p className="muted dl-note">还没有找到消息。</p>
      ) : (
        <output className="dl-waiting">
          <Spinner />
          <span>正在等待你的消息…</span>
        </output>
      )}
      {stopped ? (
        <div>
          <Button size="sm" onClick={again}>
            再检查一次
          </Button>
        </div>
      ) : null}
      <Problem>
        {problem === "rejected"
          ? "Telegram 不接受这个机器人令牌。"
          : problem === "failed" && chats.length === 0
            ? "Headroom 无法连接到 Telegram，它会继续尝试。"
            : null}
      </Problem>
      <Disclosure label="改为输入聊天 ID">
        <TextField
          label="聊天 ID"
          value={typed}
          error={typedError}
          placeholder="123456789"
          onChange={setTyped}
          onBlur={() => setTouched(true)}
        />
      </Disclosure>
      <div className="dl-actions">
        <Button
          variant="primary"
          disabled={choice === null}
          onClick={() => choice !== null && props.onContinue(choice)}
        >
          继续
        </Button>
        <Button variant="quiet" onClick={props.onBack}>
          返回
        </Button>
      </div>
    </div>
  );
}
