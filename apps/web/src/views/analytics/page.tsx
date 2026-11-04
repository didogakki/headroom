import { memo, useMemo, useState, type ReactNode } from "react";

import { convert } from "@headroom/view-model/wallet-money";
import { demoHistory } from "@headroom/view-model/history-demo";
import { monthlyOf } from "@headroom/view-model/wallet";
import { demoWallet } from "@headroom/view-model/wallet-demo";

import { LoadFailed, NoAccounts } from "../../dashboard/states.tsx";
import { useDevicePrefs } from "../../lib/device-prefs.ts";
import { useExchangeRates } from "../../lib/exchange-rates.ts";
import { useNow } from "../../lib/now.ts";
import { useSettings } from "../../lib/settings.tsx";
import { useWallet } from "../../lib/wallet-store.ts";
import { ErrorNotice } from "../../ui/error-notice.tsx";
import { Tabs } from "../../ui/tabs.tsx";
import type { ViewProps } from "../props.ts";
import { AccountFilter } from "./common.tsx";
import { fitLine, PlanFitCard } from "./fit.tsx";
import { Head, TabFace } from "./head.tsx";
import { buildAnalytics } from "./model.ts";
import { nowLine, RightNowCard } from "./now.tsx";
import { reportKeys, reports, reportStore, type Report } from "./reports.ts";
import { RhythmCard, summary } from "./rhythm.tsx";
import { buildSeries, narrowSeries } from "./series.ts";
import { AnalyticsSkeleton } from "./skeleton.tsx";
import { useStoredView } from "./stored-view.ts";
import { useHistory } from "./use-history.ts";
import "./analytics.css";
import "./common.css";

// The shared empty and error states take their words as props; this page shows them in Chinese.
const loadFailedText = {
  staleText: "无法刷新，正在显示上一次成功加载的数据。",
  failedText: "Headroom 无法加载你的账户。请确认 Headroom 服务正在运行，然后重试。",
  retryLabel: "重试",
  retryBusyLabel: "正在重试",
};
const noAccountsText = {
  title: "尚未连接账户",
  body: "连接服务商账户后，它的额度、余额和重置时间会在一分钟内显示在这里。",
  action: "连接账户",
};

/**
 * Analytics: three questions, one report each, shown one at a time. Rhythm: when limits are used and where they
 * ran out. Forecast: what runs out before its reset. Plan fit: the changes worth making. The header holds what
 * every report shares, and each tab states its report's answer, so all three read without opening one. Each
 * report switches between views of the same answer. Percentages from different accounts are never added, and a
 * missing reading is a gap, not zero.
 */
export function AnalyticsPage(props: ViewProps) {
  const { connections, failed, stale, reload } = props.overview;
  const { loaded } = useSettings();
  const [retrying, setRetrying] = useState(false);
  const retry = (): void => {
    setRetrying(true);
    void reload().finally(() => setRetrying(false));
  };
  if (connections === null) {
    return failed ? (
      <LoadFailed stale={false} busy={retrying} onRetry={retry} {...loadFailedText} />
    ) : (
      <AnalyticsSkeleton />
    );
  }
  if (!loaded) return <AnalyticsSkeleton />;
  if (connections.length === 0) {
    return (
      <div className="reveal">
        <NoAccounts {...noAccountsText} />
      </div>
    );
  }
  return (
    <div className="reveal an-page">
      {stale ? <LoadFailed stale busy={retrying} onRetry={retry} {...loadFailedText} /> : null}
      <AnalyticsBoard connections={connections} />
    </div>
  );
}

const rebuildEvery = 5 * 60_000;

// Each card redraws only when its series changes, not on every clock tick of the page.
const Rhythm = memo(RhythmCard);
const RightNow = memo(RightNowCard);
const PlanFit = memo(PlanFitCard);

type Connections = NonNullable<ViewProps["overview"]["connections"]>;

/**
 * Monthly cost in US dollars from the Wallet: 0 for a free or included plan. Null is unknown, with the reason in
 * `note`: no cost entry, the Wallet did not load, or the price is in a currency with no exchange rate.
 */
function monthlyUsd(
  cost: Parameters<typeof monthlyOf>[0],
  perUsd: Readonly<Partial<Record<string, number>>> | null,
  walletFailed: boolean,
): { readonly usd: number | null; readonly note: string } {
  if (walletFailed) return { usd: null, note: "价格不可用" };
  // A free plan, or one included in another subscription, is a known $0: monthlyOf returns zero for it.
  const monthly = monthlyOf(cost);
  if (monthly === null) return { usd: null, note: "未设置价格" };
  const usd = convert(monthly, "USD", perUsd ?? {});
  return usd === null
    ? { usd: null, note: `价格以 ${monthly.currency} 计，无汇率` }
    : { usd: usd.minor / 100, note: "" };
}

const wholeDays = (days: number): string => `${Math.floor(days)}天`;

/** The header's status line: how much history there is and how many accounts it covers. */
function statusLine(coverageDays: number | null, accounts: number): string {
  const covered =
    coverageDays === null
      ? null
      : `${coverageDays < 1 ? "不足1天" : wholeDays(coverageDays)}历史记录`;
  const counted = `${accounts}个账户`;
  return covered === null ? counted : `${covered} · ${counted}`;
}

/** One quiet line when the server keeps less than the longest range. */
function historyNote(retentionDays: number): string | null {
  return retentionDays < 90 ? `历史记录保留${retentionDays}天。` : null;
}

const clock = (at: number): string =>
  new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

type Answer = { readonly big: ReactNode; readonly cap: ReactNode };

/** The report tabs: each names its report and time span and states the report's answer. */
function ReportTabs(props: {
  readonly open: Report;
  readonly answers: Readonly<Record<Report, Answer>>;
  readonly onOpen: (report: Report) => void;
}) {
  const tabs = reports.map((entry) => ({
    value: entry.value,
    label: <TabFace {...entry} {...props.answers[entry.value]} />,
  }));
  return (
    <Tabs
      label="报告"
      tabs={tabs}
      value={props.open}
      onChange={props.onOpen}
      panelId="an-report"
      className="an-tabs"
      tabClassName="an-tab"
    />
  );
}

function AnalyticsBoard(props: { readonly connections: Connections }) {
  const { connections } = props;
  const prefs = useDevicePrefs();
  const rates = useExchangeRates();
  // The Wallet's costs price each account; Demo Mode reads its own in-memory book.
  const wallet = useWallet(
    prefs.demo
      ? {
          key: `${prefs.demoSeed}:${prefs.demoAnchor}`,
          make: () => demoWallet(prefs.demoSeed, connections, prefs.demoAnchor),
        }
      : null,
  );
  const idsKey = connections
    .map((connection) => connection.id)
    .toSorted()
    .join(",");
  const [retrying, setRetrying] = useState(false);
  const { state, reload } = useHistory(
    prefs.demo
      ? {
          key: `${prefs.demoSeed}:${prefs.demoAnchor}`,
          make: () => demoHistory(prefs.demoSeed, connections, prefs.demoAnchor, 90),
        }
      : null,
    idsKey,
  );
  // The cards read history, not the live second: rebuild every five minutes, not on each 30 second tick.
  const now = Math.floor(useNow() / rebuildEvery) * rebuildEvery;
  const priced = useMemo(
    () =>
      connections.map((connection) => ({
        id: connection.id,
        ...monthlyUsd(wallet.book.costs[connection.id] ?? null, rates.perUsd, wallet.loadFailed),
      })),
    [connections, wallet.book.costs, wallet.loadFailed, rates.perUsd],
  );
  const costs = useMemo(() => new Map(priced.map((item) => [item.id, item.usd])), [priced]);
  const priceNotes = useMemo(() => new Map(priced.map((item) => [item.id, item.note])), [priced]);
  const history = state.kind === "ready" ? state.history : null;
  // History reaches back 90 days; the rhythm and the actions read the last 30 of them.
  const analytics = useMemo(
    () =>
      history === null ? null : buildAnalytics(connections, history, now, 90, costs, priceNotes),
    [connections, history, now, costs, priceNotes],
  );
  const series = useMemo(
    () => (analytics === null ? null : buildSeries(analytics, now)),
    [analytics, now],
  );
  // One account filter for every report, in the page header. Null is every account.
  const [focus, setFocus] = useState<string | null>(null);
  const [open, setOpen] = useStoredView<Report>(reportStore, reportKeys, "rhythm");
  // A picked account that left the list (removed, or Demo Mode turned on) falls back to every account.
  const inView = series?.accounts.find((account) => account.id === focus) ?? null;
  const focused = useMemo(
    () => (series === null ? null : narrowSeries(series, inView?.id ?? null)),
    [series, inView],
  );
  // Each tab states its report's answer for the accounts in view: Rhythm's busiest hours, the Forecast and the
  // Plan fit History. Worked out once per rebuild, not on each clock tick.
  const answers = useMemo((): Readonly<Record<Report, Answer>> | null => {
    if (series === null || focused === null) return null;
    return { rhythm: summary(series, inView), now: nowLine(focused), fit: fitLine(focused) };
  }, [series, focused, inView]);
  if (state.kind === "failed") {
    return (
      <ErrorNotice
        busy={retrying}
        retryLabel="重试"
        retryBusyLabel="正在重试"
        onRetry={() => {
          setRetrying(true);
          void reload().finally(() => setRetrying(false));
        }}
      >
        Headroom 无法加载你的用量历史。请确认 Headroom 服务正在运行，然后重试。
      </ErrorNotice>
    );
  }
  if (
    analytics === null ||
    series === null ||
    focused === null ||
    answers === null ||
    !wallet.loaded
  ) {
    return <AnalyticsSkeleton />;
  }
  const note = [
    historyNote(analytics.history.retentionDays),
    state.kind === "ready" && state.refreshFailedAfter !== null
      ? `当前显示的是 ${clock(state.refreshFailedAfter)} 的历史记录，刷新失败。`
      : null,
    wallet.loadFailed ? "价格未能加载，因此费用与节省金额未知。" : null,
  ]
    .filter((line): line is string => line !== null)
    .join(" ");
  const status = statusLine(analytics.history.coverageDays, analytics.accounts.length);
  if (analytics.history.empty || analytics.accounts.length === 0) {
    return (
      <>
        <Head status={status} />
        <section className="an2-card" aria-label="分析">
          <p className="an-empty">
            {analytics.history.empty
              ? "暂无历史记录。Headroom 每隔几分钟读取一次你的额度，请一天后再来查看。"
              : "暂无可绘制的额度。分析页绘制的是用量额度，而你的账户只报告金额。"}
          </p>
        </section>
      </>
    );
  }
  return (
    <>
      <Head status={status}>
        <AccountFilter accounts={series.accounts} value={inView?.id ?? null} onChange={setFocus} />
      </Head>
      {note === "" ? null : <p className="an-note">{note}</p>}
      <ReportTabs open={open} answers={answers} onOpen={setOpen} />
      {/* Hidden, not unmounted: a view, range or pick made in one report survives a visit to another. */}
      <div
        id="an-report"
        role="tabpanel"
        aria-label={reports.find((entry) => entry.value === open)?.label}
      >
        <div hidden={open !== "rhythm"}>
          <Rhythm series={series} focused={focused} account={inView} />
        </div>
        <div hidden={open !== "now"}>
          <RightNow series={focused} />
        </div>
        <div hidden={open !== "fit"}>
          <PlanFit series={focused} />
        </div>
      </div>
    </>
  );
}
