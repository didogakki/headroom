import { useEffect, useState } from "react";

import { currencies } from "@headroom/view-model/wallet-money";
import { formatNumber } from "@headroom/view-model/present";
import { age } from "@headroom/view-model/time";
import { dayLabel } from "@headroom/view-model/wallet-dates";
import { zhAge, zhCurrencyName, zhDates, zhMessage } from "../lib/zh.ts";

import { RetryIcon } from "../icons.tsx";
import { refreshExchangeRates, useExchangeRates } from "../lib/exchange-rates.ts";
import { Button } from "../ui/button.tsx";
import { ErrorNotice } from "../ui/error-notice.tsx";
import { Body, Section } from "./settings-rows.tsx";
import "./exchange-rates-section.css";

/** The server allows one fetch a minute; the button rests for the same time after a press. */
const restMs = 60_000;

/** A rate with enough digits to compare: more for small numbers, fewer for large ones. */
function rateText(rate: number): string {
  return formatNumber(rate, rate >= 100 ? 2 : 4);
}

/** Settings, General: where the Wallet's exchange rates come from, how fresh they are, and a refresh button. */
export function ExchangeRatesSection() {
  const rates = useExchangeRates();
  const [pressedAt, setPressedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // One tick a few seconds keeps "5 min ago" honest and ends the rest after a press.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);
  const busy = rates.status === "refreshing" || rates.status === "loading";
  const resting = pressedAt !== null && now - pressedAt < restMs;
  const press = (): void => {
    const at = Date.now();
    setPressedAt(at);
    setNow(at);
    void refreshExchangeRates();
  };
  const status = [
    rates.fetchedAt === null ? null : `更新于${zhAge(age(rates.fetchedAt, now))}`,
    rates.date === null ? null : `ECB ${zhDates(dayLabel(rates.date))}`,
  ].filter((part) => part !== null);
  return (
    <Section title="汇率">
      <div className="srow">
        <Body title="汇率" note="每日 ECB 汇率。钱包中的合计金额为近似值。" />
        <span className="xr-status">
          {status.length === 0 ? null : (
            // Each part keeps its words together; a narrow screen moves a whole part to the next line.
            <span className="xr-status-text muted">
              {status.map((part, index) => (
                <span key={part}>
                  {index === 0 ? null : <span aria-hidden="true">· </span>}
                  {part}
                </span>
              ))}
            </span>
          )}
          <Button
            variant="quiet"
            size="sm"
            aria-label="刷新汇率"
            title={resting ? "已刷新。请一分钟后再试。" : "刷新汇率"}
            busy={busy}
            busyLabel="正在刷新"
            disabled={resting}
            onClick={press}
          >
            <RetryIcon />
          </Button>
        </span>
      </div>
      {rates.error === null ? null : (
        <ErrorNotice inline>
          {zhMessage(rates.error)}
          {rates.perUsd === null ? "" : "下方显示的是上一次成功获取的汇率。"}
        </ErrorNotice>
      )}
      {rates.perUsd === null ? (
        <p className="xr-empty muted">{busy ? "正在加载汇率。" : "暂无汇率。"}</p>
      ) : (
        <div className="xr-card">
          <table className="xr-table">
            <thead>
              <tr>
                <th scope="col">币种</th>
                <th scope="col">每 1 美元</th>
                <th scope="col">1 单位折合美元</th>
              </tr>
            </thead>
            <tbody>
              {currencies
                .filter((currency) => currency !== "USD")
                .map((currency) => {
                  const rate = rates.perUsd?.[currency];
                  return (
                    <tr key={currency}>
                      <th scope="row">
                        <span className="xr-code">{currency}</span>
                        <span className="muted">{zhCurrencyName(currency)}</span>
                      </th>
                      <td className="num">{rate === undefined ? "—" : rateText(rate)}</td>
                      <td className="num">{rate === undefined ? "—" : rateText(1 / rate)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
