import { useId, useState } from "react";

import { PasswordField, type PasswordFieldProps } from "./password-field.tsx";
import { scorePassword, type StrengthLevel } from "./password-score.ts";

const segments = [0, 1, 2, 3] as const;

/** The tick draws on its short stroke as the rule is met. */
function Tick() {
  return (
    <svg
      className="pw-tick"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4.75 8.25 7 10.5l4.25-4.75" pathLength="1" />
    </svg>
  );
}

/**
 * Words the caller may give the strength meter in another language. Every part is optional and falls back to the
 * English wording, so the sign-in pages need pass nothing. The score's own English `label` and rule ids stay the
 * keys; these only change what is shown.
 */
export interface StrengthCopy {
  /** Accessible name of the meter. */
  readonly meter?: string;
  /** Accessible name of the list of rules. */
  readonly checks?: string;
  /** Spoken value while nothing is typed. */
  readonly none?: string;
  /** The word for a score label such as "Weak". */
  readonly word?: (label: string) => string;
  /** The text of a rule, given its id and the server minimum. */
  readonly rule?: (id: string, minimum: number) => string;
  readonly passed?: string;
  readonly notPassed?: string;
  /** "3 more" characters. */
  readonly more?: (count: number) => string;
  /** The spoken summary of the level and the rules met. */
  readonly summary?: (label: string, met: number, total: number) => string;
}

/**
 * A new-password field that shows how strong the password is while it is typed: four segments fill and change
 * tone, the strength word rises or drops with the level, and each rule checks off. The server minimum is the
 * floor: under it the word is "Too Short". Scoring runs on the device. Controlled: pass `value` and `onChange`.
 */
export function PasswordStrength(
  props: Omit<PasswordFieldProps, "children" | "value"> & {
    readonly value: string;
    /** The server minimum password length. */
    readonly minimum: number;
    readonly copy?: StrengthCopy;
  },
) {
  const { minimum, value, copy = {}, ...field } = props;
  const rulesId = useId();
  const score = scorePassword(value, minimum);
  const [word, setWord] = useState<{ level: StrengthLevel; direction: "up" | "down" }>({
    level: score.level,
    direction: "up",
  });
  if (word.level !== score.level) {
    setWord({ level: score.level, direction: score.level > word.level ? "up" : "down" });
  }
  const metCount = score.rules.filter((rule) => rule.met).length;
  const shown = (label: string): string => copy.word?.(label) ?? label;
  const summary =
    score.level === 0
      ? ""
      : (copy.summary?.(score.label, metCount, score.rules.length) ??
        `Strength: ${score.label}. ${metCount} of ${score.rules.length} checks passed.`);
  return (
    <PasswordField
      {...field}
      value={value}
      aria-describedby={[field["aria-describedby"], rulesId].filter(Boolean).join(" ")}
    >
      <div
        className="pw-strength"
        data-level={score.level}
        data-short={score.label === "Too Short" || undefined}
      >
        <div className="pw-meterrow">
          <meter
            className="sr"
            aria-label={copy.meter ?? "Password strength"}
            min={0}
            max={4}
            value={score.level}
            aria-valuetext={
              score.level === 0 ? (copy.none ?? "No password yet") : shown(score.label)
            }
          />
          <div className="pw-meter" aria-hidden="true">
            {segments.map((index) => (
              <span key={index} className="pw-segment">
                <span
                  className="pw-fill"
                  data-on={index < score.level || undefined}
                  style={{ transitionDelay: `${index * 50}ms` }}
                />
              </span>
            ))}
          </div>
          <span className="pw-word" aria-hidden="true">
            {score.level === 0 ? null : (
              <span key={score.label} className="pw-wordtext" data-direction={word.direction}>
                {shown(score.label)}
              </span>
            )}
          </span>
        </div>
        <ul id={rulesId} className="pw-rules" aria-label={copy.checks ?? "Password checks"}>
          {score.rules.map((rule) => (
            <li key={rule.id} className="pw-rule" data-met={rule.met || undefined}>
              <span className="pw-mark" aria-hidden="true">
                <Tick />
              </span>
              <span>
                {copy.rule?.(rule.id, minimum) ?? rule.label}
                <span className="sr">
                  {rule.met ? (copy.passed ?? ", passed") : (copy.notPassed ?? ", not passed")}
                </span>
              </span>
              {value !== "" && rule.remaining > 0 ? (
                <span className="pw-remaining" aria-hidden="true">
                  {copy.more?.(rule.remaining) ?? `${rule.remaining} more`}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        <output className="sr">{summary}</output>
      </div>
    </PasswordField>
  );
}
