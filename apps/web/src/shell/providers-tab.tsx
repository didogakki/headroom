import type { Provider } from "@headroom/core/contracts";
import { providerName } from "@headroom/view-model/labels";

import { useSettings } from "../lib/settings.tsx";
import type { SettingsPatch } from "../lib/settings-store.ts";
import { Section, SwitchRow } from "./settings-rows.tsx";
import "./providers-tab.css";

/**
 * The providers whose panels have balance figures, and how to word the hide-at-zero choice. The choice covers every
 * balance figure of the provider (see `presentPanel`), so a new one needs no new switch.
 */
const balanceChoices: Partial<Record<Provider, { readonly title: string; readonly note: string }>> =
  {
    claude: {
      title: "积分为 $0 时隐藏",
      note: "任何积分余额为 $0 时会隐藏，高于 $0 后重新显示。",
    },
  };

/** Display choices per provider, one section each, for the providers with a connected account. */
export function ProvidersTab(props: {
  readonly providers: readonly Provider[];
  readonly change: (patch: SettingsPatch) => void;
}) {
  const { settings } = useSettings();
  const shown = props.providers.filter((provider) => balanceChoices[provider] !== undefined);
  if (shown.length === 0) {
    return (
      <Section title="服务商">
        <p className="prov-empty muted">你已连接的服务商都没有可调整的显示选项。</p>
      </Section>
    );
  }
  return (
    <>
      {shown.map((provider) => {
        const choice = balanceChoices[provider];
        if (choice === undefined) return null;
        return (
          <Section key={provider} title={providerName(provider)}>
            <SwitchRow
              title={choice.title}
              note={choice.note}
              checked={settings.providers[provider]?.hideZeroBalance === true}
              onChange={(hideZeroBalance) =>
                props.change({ providers: { [provider]: { hideZeroBalance } } })
              }
            />
          </Section>
        );
      })}
    </>
  );
}
