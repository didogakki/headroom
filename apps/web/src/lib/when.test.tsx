import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";

import { defaultSettings } from "./settings-store.ts";
import { SettingsContext, SettingsProvider, useSettings, type SettingsValue } from "./settings.tsx";
import { When } from "./when.tsx";

function Probe() {
  const { settings, actionsEnabled, loaded } = useSettings();
  return <p>{`${settings.refreshIntervalMinutes}|${actionsEnabled}|${loaded}`}</p>;
}

const exactValue: SettingsValue = {
  settings: { ...defaultSettings, timeStyle: "exact", clock: "12h" },
  loaded: true,
  loadFailed: false,
  error: null,
  actionsEnabled: false,
  update: () => Promise.resolve(),
  reload: () => Promise.resolve(),
};

describe("When", () => {
  const soon = Date.now() + 52 * 60_000 + 30_000;
  test("countdown by default, with the exact time in the title", () => {
    const html = renderToString(<When at={soon} kind="until" suffix="重置" />);
    expect(html).toContain(">52分钟后</time>重置");
    expect(html).toContain('class="when"');
    expect(html).toContain(`dateTime="${new Date(soon).toISOString()}"`);
    expect(html).toMatch(/title="(今天 |\d{1,2}月\d{1,2}日 周.)/);
  });
  test("exact style drops the countdown's 后", () => {
    const html = renderToString(
      <SettingsContext.Provider value={exactValue}>
        <When at={soon} kind="until" suffix="重置" />
      </SettingsContext.Provider>,
    );
    expect(html).not.toContain("52分钟后</time>");
    // Near midnight the time falls on the next day, which names the date.
    expect(html).toMatch(
      /<time[^>]*>(\d{1,2}月\d{1,2}日 周. )?(上午|下午)\d{1,2}:\d{2}<\/time>重置/,
    );
    expect(html).toContain('title="52分钟后"');
  });
  test("a prefix comes before the time", () => {
    const html = renderToString(<When at={soon} kind="until" prefix="最早" suffix="到期" />);
    expect(html).toContain("最早<time");
    expect(html).toContain("</time>到期");
  });
  test("ago without a prefix", () => {
    const html = renderToString(<When at={Date.now() - 12 * 60_000 - 5_000} kind="ago" />);
    expect(html).toContain(">12分钟前</time>");
  });
});

describe("settings context", () => {
  test("defaults without a provider", () => {
    expect(renderToString(<Probe />)).toBe("<p>15|false|false</p>");
  });
  test("the provider starts on the defaults before the first load", () => {
    const client = {
      settings: () => Promise.reject(new Error("not reached on the server")),
      saveSettings: () => Promise.reject(new Error("not reached on the server")),
    };
    const html = renderToString(
      <SettingsProvider client={client}>
        <Probe />
      </SettingsProvider>,
    );
    expect(html).toBe("<p>15|false|false</p>");
  });
});
