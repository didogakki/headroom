import { useState, type FormEvent } from "react";

import type { Provider } from "@headroom/core/contracts";
import { planLabel, providerName } from "@headroom/view-model/labels";
import type { Cycle } from "@headroom/view-model/wallet-dates";
import { currencies, formatMoney, type Currency } from "@headroom/view-model/wallet-money";
import { suggestPrices, type Cost, type WalletAccount } from "@headroom/view-model/wallet";

import { zhAccountName, zhMonthLabel } from "../../lib/zh.ts";
import { TextField } from "../../shell/delivery/form-parts.tsx";
import { Button } from "../../ui/button.tsx";
import { DatePicker } from "../../ui/date-picker.tsx";
import { Dialog } from "../../ui/dialog.tsx";
import { MoneyInput } from "../../ui/money-input.tsx";
import { RadioCards, type RadioCard } from "../../ui/radio-cards.tsx";
import { Segmented } from "../../ui/segmented.tsx";

type Kind = Cost["kind"];

const kinds: readonly RadioCard<Kind>[] = [
  { value: "paid", label: "付费", description: "你为这个套餐付费。" },
  { value: "free", label: "免费", description: "在合计中按零计算。" },
  { value: "included", label: "已包含", description: "包含在另一项订阅中。" },
];

const cycles: readonly { readonly value: Cycle; readonly label: string }[] = [
  { value: "monthly", label: "按月" },
  { value: "annual", label: "按年" },
];

/** Quick answers for "Included With": what each provider's accounts usually come with. */
const includedWith: Partial<Record<Provider, readonly string[]>> = {
  grok: ["X Premium"],
  copilot: ["GitHub Pro", "GitHub Education"],
  antigravity: ["Google AI Pro"],
};

const cycleUnit: Record<Cycle, string> = { monthly: "月", annual: "年" };

function CostForm(props: {
  readonly account: WalletAccount;
  readonly defaultCurrency: Currency;
  readonly onSave: (cost: Cost | null) => Promise<void>;
  readonly onCancel: () => void;
}) {
  const { account } = props;
  const { provider, plan } = account.connection;
  const current = account.cost;
  const [kind, setKind] = useState<Kind>(current?.kind ?? "paid");
  const [price, setPrice] = useState<{ minor: number | null; currency: Currency }>({
    minor: current?.kind === "paid" ? current.price.minor : null,
    currency: current?.kind === "paid" ? current.price.currency : props.defaultCurrency,
  });
  const [cycle, setCycle] = useState<Cycle>(current?.kind === "paid" ? current.cycle : "monthly");
  const [renewsOn, setRenewsOn] = useState<string | null>(
    current?.kind === "paid" ? current.renewsOn : null,
  );
  const [included, setIncluded] = useState(
    current?.kind === "included" ? current.includedWith : "",
  );
  const [error, setError] = useState<string | null>(null);
  /** Which save is on its way to the server, and whether the last one failed. */
  const [pending, setPending] = useState<"save" | "clear" | null>(null);
  const [failed, setFailed] = useState(false);

  const save = (cost: Cost | null): void => {
    if (pending !== null) return;
    setPending(cost === null ? "clear" : "save");
    setFailed(false);
    props.onSave(cost).catch(() => {
      setPending(null);
      setFailed(true);
    });
  };

  const suggestions = kind === "paid" ? suggestPrices(provider, plan) : [];
  const quick = includedWith[provider] ?? [];

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (kind === "free") {
      save({ kind: "free" });
    } else if (kind === "included") {
      const words = included.trim();
      if (words === "") setError("请说明此账户包含在什么订阅中。");
      else save({ kind: "included", includedWith: words });
    } else {
      if (price.minor === null || price.minor <= 0) setError("请输入大于零的金额。");
      else {
        save({
          kind: "paid",
          price: { minor: price.minor, currency: price.currency },
          cycle,
          renewsOn,
        });
      }
    }
  };

  const description = [providerName(provider), zhAccountName(account.connection), planLabel(plan)]
    .filter((part) => part !== null)
    .join(" · ");

  return (
    <form onSubmit={submit} noValidate>
      <div className="dsec">
        <p className="w-desc">{description}</p>
        <RadioCards
          label="费用类型"
          hideLabel
          value={kind}
          options={kinds}
          onChange={(next) => {
            setKind(next);
            setError(null);
          }}
        />
      </div>
      {kind === "paid" ? (
        <div className="dsec">
          {suggestions.length === 0 ? null : (
            <div className="w-suggest">
              <p className="w-desc">标价，核对于 {zhMonthLabel(suggestions[0]?.asOf ?? "")}</p>
              <div className="w-chips">
                {suggestions.map((suggestion) => {
                  const chosen =
                    price.minor === suggestion.price.minor &&
                    price.currency === suggestion.price.currency &&
                    cycle === suggestion.cycle;
                  return (
                    <button
                      key={`${suggestion.label}:${suggestion.cycle}`}
                      type="button"
                      className="w-chip"
                      aria-pressed={chosen}
                      onClick={() => {
                        setPrice({
                          minor: suggestion.price.minor,
                          currency: suggestion.price.currency,
                        });
                        setCycle(suggestion.cycle);
                        setError(null);
                      }}
                    >
                      {suggestion.label} · {formatMoney(suggestion.price)}/
                      {cycleUnit[suggestion.cycle]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <MoneyInput
            label="价格"
            minor={price.minor}
            currency={price.currency}
            currencies={currencies}
            error={error}
            onChange={(next) => {
              setPrice(next);
              setError(null);
            }}
          />
          <div className="field">
            <span className="w-label">计费周期</span>
            <Segmented full label="计费周期" value={cycle} options={cycles} onChange={setCycle} />
          </div>
          <DatePicker label="续订日期" optional value={renewsOn} onChange={setRenewsOn} />
        </div>
      ) : null}
      {kind === "included" ? (
        <div className="dsec">
          <TextField
            label="包含在"
            value={included}
            placeholder={quick[0] ?? "另一项订阅"}
            error={error}
            onChange={(value) => {
              setIncluded(value);
              setError(null);
            }}
          />
          {quick.length === 0 ? null : (
            <div className="w-chips">
              {quick.map((words) => (
                <button
                  key={words}
                  type="button"
                  className="w-chip"
                  aria-pressed={included === words}
                  onClick={() => {
                    setIncluded(words);
                    setError(null);
                  }}
                >
                  {words}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
      {failed ? (
        <p className="w-save-error" role="alert">
          无法保存，未做任何更改。
        </p>
      ) : null}
      <div className="w-foot">
        {current === null ? null : (
          <Button
            variant="quiet-danger"
            className="w-clear"
            busy={pending === "clear"}
            disabled={pending === "save"}
            onClick={() => save(null)}
          >
            清除费用
          </Button>
        )}
        <Button disabled={pending !== null} onClick={props.onCancel}>
          取消
        </Button>
        <Button variant="primary" type="submit" busy={pending === "save"} busyLabel="正在保存">
          保存费用
        </Button>
      </div>
    </form>
  );
}

/**
 * Set or edit what one account costs. Closed while `account` is null. The form mounts fresh for each account,
 * so a half-typed entry never carries over.
 */
export function CostDialog(props: {
  readonly account: WalletAccount | null;
  /** The display currency, the starting choice for a new paid cost. */
  readonly defaultCurrency: Currency;
  /** Null clears the cost back to Not set. */
  readonly onSave: (connectionId: string, cost: Cost | null) => Promise<void>;
  readonly onClose: () => void;
}) {
  const { account, onClose } = props;
  return (
    <Dialog
      open={account !== null}
      onClose={onClose}
      title={account?.cost === null || account === null ? "设置费用" : "编辑费用"}
    >
      {account === null ? null : (
        <CostForm
          key={account.connection.id}
          account={account}
          defaultCurrency={props.defaultCurrency}
          onSave={(cost) => props.onSave(account.connection.id, cost).then(onClose)}
          onCancel={onClose}
        />
      )}
    </Dialog>
  );
}
