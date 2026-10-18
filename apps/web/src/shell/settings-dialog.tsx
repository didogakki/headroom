import { useContext, useId, useState } from "react";

import type { NotificationKind, Provider } from "@headroom/core/contracts";
import type { OverviewConnection } from "@headroom/view-model/overview";

import { useDevicePrefs } from "../lib/device-prefs.ts";
import { isDemoSite } from "../lib/site.ts";
import { useSettings } from "../lib/settings.tsx";
import type { SettingsPatch } from "../lib/settings-store.ts";
import { zhMessage } from "../lib/zh.ts";
import { Dialog } from "../ui/dialog.tsx";
import { ErrorNotice } from "../ui/error-notice.tsx";
import { Segmented } from "../ui/segmented.tsx";
import { Sk } from "../ui/skeleton.tsx";
import { SlideSwap, type SwapDirection } from "../ui/slide-swap.tsx";
import { Tabs } from "../ui/tabs.tsx";
import { AutomationsTab } from "./automations-tab.tsx";
import { ChannelsTab } from "./delivery/tab.tsx";
import { ExchangeRatesSection } from "./exchange-rates-section.tsx";
import { ProviderCards } from "./provider-cards.tsx";
import { ProvidersTab } from "./providers-tab.tsx";
import { Body, Section, SwitchRow, WaitingContext } from "./settings-rows.tsx";

/** The placeholder width of a segment: 7px a Latin letter, 13px a Chinese character, and the padding. */
function labelWidth(label: string): number {
  return Array.from(label).reduce(
    (sum, char) => sum + ((char.codePointAt(0) ?? 0) > 0x2e80 ? 13 : 7),
    20,
  );
}

function ChoiceRow<T extends string>(props: {
  readonly title: string;
  readonly note: string;
  readonly value: T;
  readonly options: readonly { readonly value: T; readonly label: string }[];
  readonly onChange: (value: T) => void;
}) {
  const waiting = useContext(WaitingContext);
  return (
    <div className="srow srow-choice">
      <Body title={props.title} note={props.note} />
      {waiting ? (
        <span className="sk-segs" aria-hidden="true">
          {props.options.map((option) => (
            <Sk
              key={option.value}
              width={labelWidth(option.label)}
              height={26}
              className="sk-pill"
            />
          ))}
        </span>
      ) : (
        <Segmented
          label={props.title}
          value={props.value}
          options={props.options}
          onChange={props.onChange}
        />
      )}
    </div>
  );
}

/** A choice among numbers. The segments hold text; this maps it back to the number. */
function NumberRow<T extends number>(props: {
  readonly title: string;
  readonly note: string;
  readonly value: T;
  readonly values: readonly T[];
  readonly format: (value: T) => string;
  readonly onChange: (value: T) => void;
}) {
  return (
    <ChoiceRow
      title={props.title}
      note={props.note}
      value={String(props.value)}
      options={props.values.map((value) => ({ value: String(value), label: props.format(value) }))}
      onChange={(text) => {
        const next = props.values.find((value) => String(value) === text);
        if (next !== undefined) props.onChange(next);
      }}
    />
  );
}

const thresholds = [30, 20, 15] as const;
const intervals = [5, 10, 15, 30] as const;
const retentions = [30, 90, 180, 365] as const;

const tabs = [
  { value: "general", label: "常规" },
  { value: "providers", label: "服务商" },
  { value: "notifications", label: "通知" },
  { value: "automations", label: "自动化" },
  { value: "channels", label: "渠道" },
  { value: "privacy", label: "隐私" },
] as const;

/** The tabs of the dialog. */
export type SettingsTab = (typeof tabs)[number]["value"];

function General(props: { readonly change: (patch: SettingsPatch) => void }) {
  const { settings } = useSettings();
  const { change } = props;
  return (
    <>
      <Section title="额度">
        <NumberRow
          title="余量偏低阈值"
          note="剩余额度低于此值时，进度条变为琥珀色；低于 10% 时变为红色。"
          value={settings.lowThresholdPercent}
          values={thresholds}
          format={(value) => `${value}%`}
          onChange={(lowThresholdPercent) => change({ lowThresholdPercent })}
        />
      </Section>
      <Section title="刷新">
        <NumberRow
          title="刷新间隔"
          note="账户更新的频率。"
          value={settings.refreshIntervalMinutes}
          values={intervals}
          format={(value) => `${value}分钟`}
          onChange={(refreshIntervalMinutes) => change({ refreshIntervalMinutes })}
        />
      </Section>
      <Section title="数据">
        <NumberRow
          title="历史记录"
          note="更早的刷新历史会被删除。每个账户的最新读数始终保留。"
          value={settings.historyRetentionDays}
          values={retentions}
          format={(value) => (value === 365 ? "1年" : `${value}天`)}
          onChange={(historyRetentionDays) => change({ historyRetentionDays })}
        />
      </Section>
      <Section title="时间">
        <ChoiceRow
          title="时间显示"
          note="显示为“52分钟后”或“15:06”。"
          value={settings.timeStyle}
          options={[
            { value: "countdown", label: "倒计时" },
            { value: "exact", label: "精确时间" },
          ]}
          onChange={(timeStyle) => change({ timeStyle })}
        />
        <ChoiceRow
          title="时钟"
          note="15:06 或 下午3:06。"
          value={settings.clock}
          options={[
            { value: "24h", label: "24小时制" },
            { value: "12h", label: "12小时制" },
          ]}
          onChange={(clock) => change({ clock })}
        />
      </Section>
      <Section title="显示">
        <ChoiceRow
          title="密度"
          note="紧凑模式可在屏幕上显示更多内容。"
          value={settings.density}
          options={[
            { value: "comfortable", label: "舒适" },
            { value: "compact", label: "紧凑" },
          ]}
          onChange={(density) => change({ density })}
        />
        <SwitchRow
          title="非活动账户置底"
          note="已暂停和已断开的账户保持在底部。"
          checked={settings.keepInactiveLast}
          onChange={(keepInactiveLast) => change({ keepInactiveLast })}
        />
      </Section>
      <AccountActions change={change} />
      <ExchangeRatesSection />
    </>
  );
}

/** Device preferences, so they never wait for the server settings. */
function Privacy() {
  const prefs = useDevicePrefs();
  return (
    <Section>
      <SwitchRow
        device
        title="隐私模式"
        note="模糊邮箱和用户名，悬停时才会显示。保存在此设备上。"
        checked={prefs.privacy}
        onChange={prefs.setPrivacy}
      />
      {isDemoSite ? null : (
        <SwitchRow
          device
          title="演示模式"
          note="显示虚构的账户、数据和通知，用于截图和屏幕共享。保存在此设备上。"
          checked={prefs.demo}
          onChange={prefs.setDemo}
        />
      )}
    </Section>
  );
}

const leadDays = [1, 3, 7] as const;

type Kind = NotificationKind;

const kindGroups: readonly {
  readonly title: string;
  readonly rows: readonly { readonly kind: Kind; readonly title: string; readonly note: string }[];
}[] = [
  {
    title: "余额与积分",
    rows: [
      {
        kind: "balance_low",
        title: "余额偏低",
        note: "积分余额偏低，或 Claude 积分用完时。",
      },
      {
        kind: "top_up_detected",
        title: "检测到充值",
        note: "积分余额增加时。",
      },
      {
        kind: "credits_expiring",
        title: "积分即将到期",
        note: "钱包或 Claude 积分到期之前。",
      },
    ],
  },
  {
    title: "支出",
    rows: [
      {
        kind: "extra_usage_started",
        title: "开始按需使用",
        note: "账户开始使用付费的按需用量或额外用量时（包括 Copilot）。",
      },
      {
        kind: "spend_near_cap",
        title: "接近支出上限",
        note: "支出接近服务商设置的上限时。",
      },
      {
        kind: "spend_cap_reached",
        title: "已达支出上限",
        note: "支出达到服务商设置的上限时。",
      },
      {
        kind: "budget_near",
        title: "接近你的预算",
        note: "支出接近你在“自动化”中设置的预算时。",
      },
      {
        kind: "budget_exceeded",
        title: "超出你的预算",
        note: "支出超过你在“自动化”中设置的预算时。",
      },
    ],
  },
  {
    title: "登录",
    rows: [
      {
        kind: "refresh_failed",
        title: "刷新失败",
        note: "账户连续两次更新失败时。",
      },
      {
        kind: "disconnected",
        title: "已断开",
        note: "登录过期、账户需要重新连接时。",
      },
    ],
  },
];

function Notifications(props: {
  readonly change: (patch: SettingsPatch) => void;
  readonly providers: readonly Provider[];
}) {
  const { settings } = useSettings();
  const on = settings.notifications;
  const notifyKind = (kind: Kind) => (checked: boolean) =>
    props.change({ notifications: { kinds: { [kind]: checked } } });
  const kindRow = (row: { kind: Kind; title: string; note: string }) => (
    <SwitchRow
      key={row.kind}
      title={row.title}
      note={row.note}
      checked={on.kinds[row.kind]}
      onChange={notifyKind(row.kind)}
    />
  );
  const mute = (provider: Provider) => (shown: boolean) =>
    props.change({
      notifications: {
        mutedProviders: shown
          ? on.mutedProviders.filter((name) => name !== provider)
          : [...on.mutedProviders, provider],
      },
    });
  return (
    <>
      <Section title="额度">
        {kindRow({
          kind: "running_low",
          title: "余量偏低",
          note: "额度剩余不多时（按你设置的阈值）。",
        })}
        {kindRow({
          kind: "almost_out",
          title: "即将耗尽",
          note: "额度剩余不足 10% 时。",
        })}
        {kindRow({
          kind: "pacing",
          title: "将提前用完",
          note: "按当前速度，每周额度会在重置前至少一天用完时。",
        })}
        <SwitchRow
          title="包含 5 小时会话"
          note="关闭后只提醒每周和每月额度。"
          checked={on.includeSessions}
          onChange={(includeSessions) => props.change({ notifications: { includeSessions } })}
        />
      </Section>
      <Section title="重置">
        {kindRow({
          kind: "reset_expiring",
          title: "重置即将到期",
          note: "已存重置即将到期时。",
        })}
        <NumberRow
          title="到期提前提醒"
          note="已存重置或 Claude 积分到期前，提前多久提醒。"
          value={on.resetLeadDays}
          values={leadDays}
          format={(value) => `${value}天`}
          onChange={(resetLeadDays) => props.change({ notifications: { resetLeadDays } })}
        />
        {kindRow({
          kind: "reset_granted",
          title: "新增已存重置",
          note: "账户新增一次已存重置时。",
        })}
        {kindRow({
          kind: "early_reset",
          title: "提前重置",
          note: "额度在计划时间之前重置时。",
        })}
        {kindRow({
          kind: "auto_reset",
          title: "自动重置结果",
          note: "Headroom 替你使用已存重置，或尝试失败时。",
        })}
      </Section>
      {kindGroups.map((group) => (
        <Section key={group.title} title={group.title}>
          {group.rows.map(kindRow)}
        </Section>
      ))}
      <Section title="服务商">
        <ProviderCards
          providers={props.providers}
          muted={on.mutedProviders}
          onToggle={(provider, shown) => mute(provider)(shown)}
        />
      </Section>
    </>
  );
}

function AccountActions(props: { readonly change: (patch: SettingsPatch) => void }) {
  const { settings } = useSettings();
  return (
    <Section title="账户操作">
      <SwitchRow
        title="允许账户操作"
        note="允许长按按钮使用 Codex 的重置。"
        checked={settings.accountActions}
        onChange={(accountActions) => props.change({ accountActions })}
      />
    </Section>
  );
}

/** The owner's preferences, in tabs. Every change applies at once and is saved by the settings store. */
export function SettingsDialog(props: {
  readonly open: boolean;
  /** Providers with a connected account, in the saved order. */
  readonly providers: readonly Provider[];
  /** The accounts the Automations tab lists; null until the overview loads. */
  readonly connections: readonly OverviewConnection[] | null;
  /** Reload the overview after an automation changed. */
  readonly onAccountsChanged: () => Promise<void>;
  readonly onClose: () => void;
}) {
  const store = useSettings();
  const { loaded, loadFailed } = store;
  const [retrying, setRetrying] = useState(false);
  const [tab, setTab] = useState<SettingsTab>("general");
  const [direction, setDirection] = useState<SwapDirection>("swap");
  const [wasOpen, setWasOpen] = useState(props.open);
  const panelId = useId();
  // The dialog opens on General every time.
  if (props.open !== wasOpen) {
    setWasOpen(props.open);
    if (props.open) setTab("general");
  }
  const retry = (): void => {
    setRetrying(true);
    void store.reload().finally(() => setRetrying(false));
  };
  const choose = (next: SettingsTab): void => {
    const index = (value: SettingsTab): number => tabs.findIndex((entry) => entry.value === value);
    setDirection(index(next) > index(tab) ? "next" : "prev");
    setTab(next);
  };
  const change = (patch: SettingsPatch): void => void store.update(patch);
  return (
    <Dialog open={props.open} onClose={props.onClose} title="设置" variant="settings">
      {loadFailed ? (
        <section className="dsec">
          <ErrorNotice inline busy={retrying} onRetry={retry}>
            Headroom 无法加载你的设置。请确认 Headroom 服务正在运行，然后重试。
          </ErrorNotice>
        </section>
      ) : (
        <WaitingContext value={!loaded}>
          <Tabs
            label="设置"
            className="stabs"
            tabClassName="stab"
            indicator
            panelId={panelId}
            tabs={tabs}
            value={tab}
            onChange={choose}
          />
          <div
            id={panelId}
            role="tabpanel"
            aria-label={tabs.find((t) => t.value === tab)?.label}
            aria-busy={!loaded}
          >
            {store.error === null ? null : (
              <section className="dsec">
                <p className="form-error" role="alert">
                  {zhMessage(store.error)}
                </p>
              </section>
            )}
            <SlideSwap swapKey={tab} direction={direction}>
              {tab === "general" ? <General change={change} /> : null}
              {tab === "providers" ? (
                <ProvidersTab providers={props.providers} change={change} />
              ) : null}
              {tab === "notifications" ? (
                <Notifications change={change} providers={props.providers} />
              ) : null}
              {tab === "automations" ? (
                <AutomationsTab
                  connections={props.connections}
                  onChanged={props.onAccountsChanged}
                />
              ) : null}
              {tab === "channels" ? <ChannelsTab /> : null}
              {tab === "privacy" ? <Privacy /> : null}
            </SlideSwap>
          </div>
        </WaitingContext>
      )}
    </Dialog>
  );
}
