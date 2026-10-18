import type { AuthMethod, AutoResetRule, ConnectionScope } from "@headroom/core/contracts";
import type { OverviewConnection } from "@headroom/view-model/overview";
import {
  age,
  countdown,
  exactFull,
  resolveWhen,
  type Clock,
  type TimeStyle,
  type WhenKind,
} from "@headroom/view-model/time";
import { dayLabel } from "@headroom/view-model/wallet-dates";
import { currencyName } from "@headroom/view-model/wallet-money";

/**
 * Chinese wording for the signed-in pages. The view-model also feeds the server's notification events, so it keeps
 * writing English; these pure functions translate only what is shown. Matching is strict: text that is not a known
 * template comes back unchanged, so a name, a model or a phrase added later is never mangled.
 */

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthPattern = months.join("|");
const weekdayPattern = "Sun|Mon|Tue|Wed|Thu|Fri|Sat";
const weekdayWords: Readonly<Record<string, string>> = {
  Sun: "周日",
  Mon: "周一",
  Tue: "周二",
  Wed: "周三",
  Thu: "周四",
  Fri: "周五",
  Sat: "周六",
};

// ---------- dates and times ----------

/** "Oct 5" anywhere in a text becomes "10月5日". */
export function zhDates(text: string): string {
  return text.replace(
    new RegExp(`\\b(${monthPattern}) (\\d{1,2})\\b`, "g"),
    (_whole, month: string, day: string) => `${months.indexOf(month) + 1}月${Number(day)}日`,
  );
}

/** "3:06 PM" becomes "下午3:06"; a 24-hour time is already fine. */
function zhClock(text: string): string {
  const match = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(text);
  if (match === null) return text;
  const [, hour = "", minute = "", half = ""] = match;
  return `${half === "AM" ? "上午" : "下午"}${hour}:${minute}`;
}

/** The view-model's exact time: "15:06", "at 3:06 PM", "Wed, Oct 8 · 08:14", "Today · 15:06". */
export function zhExact(text: string): string {
  const at = /^at (.+)$/.exec(text);
  if (at?.[1] !== undefined) return zhExact(at[1]);
  const today = /^Today · (.+)$/.exec(text);
  if (today?.[1] !== undefined) return `今天 ${zhClock(today[1])}`;
  const full = new RegExp(`^(${weekdayPattern}), (.+) · (.+)$`).exec(text);
  if (full !== null) {
    const [, weekday = "", date = "", clock = ""] = full;
    return `${zhDates(date)} ${weekdayWords[weekday] ?? weekday} ${zhClock(clock)}`;
  }
  return zhClock(text);
}

const spanPattern = /^(?:(\d+) days?)?(?: ?(\d+) h)?(?: ?(\d+) min)?$/;

/** "52 min", "3 h", "1 day 6 h", "12 days" and "Under 1 min" from the view-model, in Chinese. */
export function zhSpan(text: string): string {
  if (text === "Under 1 min" || text === "under 1 min") return "不到1分钟";
  const match = text === "" ? null : spanPattern.exec(text);
  if (match === null) return text;
  const [, days, hours, minutes] = match;
  if (days === undefined && hours === undefined && minutes === undefined) return text;
  return `${days === undefined ? "" : `${days}天`}${hours === undefined ? "" : `${hours}小时`}${
    minutes === undefined ? "" : `${minutes}分钟`
  }`;
}

/** "12 min ago" and "Just now". */
export function zhAge(text: string): string {
  if (text === "Just now" || text === "just now") return "刚刚";
  const ago = /^(.+) ago$/.exec(text);
  const span = ago?.[1] === undefined ? null : zhSpan(ago[1]);
  return span === null || span === ago?.[1] ? text : `${span}前`;
}

/** `countdown` in Chinese: "52分钟", "2天8小时", "不到1分钟". */
export function zhCountdown(target: number, now: number): string {
  return zhSpan(countdown(target, now));
}

/** `age` in Chinese: "3分钟前", "刚刚". */
export function zhAgo(past: number, now: number): string {
  return zhAge(age(past, now));
}

/** `exactFull` in Chinese: "今天 15:06", "10月8日 周三 08:14". */
export function zhExactFull(at: number, now: number, clock: Clock): string {
  return zhExact(exactFull(at, now, clock));
}

/** What the When component shows: text and hover title, in Chinese, under the owner's time settings. */
export function zhWhen(
  kind: WhenKind,
  at: number,
  now: number,
  style: { readonly timeStyle: TimeStyle; readonly clock: Clock },
): { readonly text: string; readonly title: string } {
  const { lead, text, title } = resolveWhen(kind, at, now, style);
  if (style.timeStyle === "countdown") {
    return {
      text: lead === "in" ? `${zhSpan(text)}后` : kind === "ago" ? zhAge(text) : zhSpan(text),
      title: zhExact(title),
    };
  }
  return { text: zhExact(text), title: kind === "until" ? `${zhSpan(title)}后` : zhAge(title) };
}

/** A Wallet day, `YYYY-MM-DD`, as "10月12日". */
export function zhDay(text: string): string {
  return zhDates(dayLabel(text));
}

/** A Wallet month, `YYYY-MM`, as "2026年10月". */
export function zhMonthLabel(text: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(text);
  return match === null ? text : `${match[1]}年${Number(match[2])}月`;
}

/** A Wallet month, `YYYY-MM`, as "10月". */
export function zhMonthName(text: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(text);
  return match === null ? text : `${Number(match[2])}月`;
}

/** How far ahead a day is: "今天", "明天", "5天后". Past days read "今天" too, as `dueIn` does. */
export function zhDueIn(days: number): string {
  if (days <= 0) return "今天";
  return days === 1 ? "明天" : `${days}天后`;
}

// ---------- amounts ----------

const currencyWords: Readonly<Record<string, string>> = {
  USD: "美元",
  EUR: "欧元",
  GBP: "英镑",
  INR: "印度卢比",
  CAD: "加拿大元",
  AUD: "澳大利亚元",
  JPY: "日元",
  SGD: "新加坡元",
  CHF: "瑞士法郎",
  BRL: "巴西雷亚尔",
};

/** The Chinese name of a currency; a code outside the Wallet list keeps its English name. */
export function zhCurrencyName(currency: string): string {
  return currencyWords[currency] ?? currencyName(currency);
}

/** `creditBalanceText` in Chinese: "1,128 积分", "无限积分". */
export function zhCreditBalance(balance: { readonly value: number | null }): string {
  if (balance.value === null) return "无限积分";
  const decimals = Number.isInteger(balance.value) ? 0 : 2;
  const number = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(balance.value);
  return `${number} 积分`;
}

/** `bankedText` in Chinese: "已存 2 次重置". */
export function zhBanked(resets: number): string {
  return `已存 ${resets} 次重置`;
}

/** "5 credits" and "1 request" become "5 积分" and "1 次请求". Credits are the provider's points, not limits. */
export function zhAmountWords(text: string): string {
  return text
    .replace(/(\d[\d,]*(?:\.\d+)?) credits?\b/g, "$1 积分")
    .replace(/(\d[\d,]*(?:\.\d+)?) requests?\b/g, "$1 次请求");
}

// ---------- panel words ----------

const labels: Readonly<Record<string, string>> = {
  Session: "会话",
  Weekly: "每周",
  Daily: "每日",
  Limit: "额度",
  Included: "包含用量",
  "Included Usage": "包含用量",
  "Auto Pool": "自动池",
  "API Pool": "API 池",
  "Weekly Pool": "每周池",
  "AI Credits": "AI 积分",
  "Usage Credits": "使用积分",
  "Cloud Credits": "云端积分",
  "Extra Usage": "额外用量",
  "On-Demand Usage": "按需用量",
  "On-Demand Spend": "按需支出",
  "On-Demand Use": "按需用量",
  "On-Demand": "按需",
  "On-Demand Used": "已用按需",
  Credits: "积分",
  "Reset Credits": "重置次数",
  "Reset Credit": "重置次数",
  "Reset Grant": "重置授权",
  "Reset Grants": "重置授权",
  "Banked Resets": "已存重置",
  "Credit Balance": "积分余额",
  "Credits Used": "已用积分",
  "Prepaid Balance": "预付余额",
  "Top-Up Credits": "充值积分",
  "30-Day Spend": "30天支出",
  Spend: "支出",
  Cycle: "周期",
  Chat: "聊天",
  Completions: "补全",
  "Extra usage this month": "本月额外用量",
  "On-demand this cycle": "本周期按需用量",
  "Last 30 days": "最近 30 天",
  Account: "账户",
  "Room Left": "剩余额度",
};

/** A meter, amount or fact label of the panel ("Weekly", "Credit Balance"); anything unknown stays as it came. */
export function zhLabel(label: string): string {
  return labels[label] ?? label;
}

const windows: Readonly<Record<string, string>> = {
  "all models": "所有模型",
  "this month": "本月",
  balance: "余额",
  banked: "已存",
  "billing cycle": "计费周期",
  "share of pool": "占池比例",
  lifetime: "累计",
  weekly: "每周",
  monthly: "每月",
};

function zhWindowPart(part: string): string {
  const known = windows[part];
  if (known !== undefined) return known;
  const hours = /^(\d+) hours?$/.exec(part);
  if (hours?.[1] !== undefined) return `${hours[1]}小时`;
  const days = /^(\d+) days?$/.exec(part);
  if (days?.[1] !== undefined) return `${days[1]}天`;
  const plan = /^(\$[\d,.]+) plan$/.exec(part);
  if (plan?.[1] !== undefined) return `${plan[1]} 套餐`;
  return part;
}

/** The window under a label: "5 hours", "all models", "Sonnet · 5 hours". A model name stays. */
export function zhWindow(window: string): string {
  return window.split(" · ").map(zhWindowPart).join(" · ");
}

/** "Weekly Sonnet", "Gemini 5-Hour", "Fable Share": the name a limit has in a sentence. */
export function zhShort(short: string): string {
  const known = labels[short];
  if (known !== undefined) return known;
  const patterns: readonly [RegExp, (name: string) => string][] = [
    [/^Weekly (.+)$/, (name) => `每周 ${name}`],
    [/^(.+) Weekly$/, (name) => `${name} 每周`],
    [/^(.+) 5-Hour$/, (name) => `${name} 5小时`],
    [/^(.+) Session$/, (name) => `${name} 会话`],
    [/^(.+) Share$/, (name) => `${name} 占比`],
    [/^(.+) Limit$/, (name) => `${name} 额度`],
  ];
  for (const [pattern, build] of patterns) {
    const name = pattern.exec(short)?.[1];
    if (name !== undefined) return build(name);
  }
  return short;
}

/** "Weekly (Sonnet)" as the Compare view names a window: label, then a model in brackets. */
export function zhWindowName(name: string): string {
  const match = /^(.+) \((.+)\)$/.exec(name);
  if (match === null) return zhLabel(name);
  const [, label = "", window = ""] = match;
  return `${zhLabel(label)} (${zhWindow(window)})`;
}

/** A fact value of the panel: "Unknown", "$3 of $20", "Up to 5 credits", "Oct 5 to Nov 4". */
export function zhFactValue(value: string): string {
  if (value === "Unknown") return "未知";
  if (value === "Unlimited") return "无限制";
  if (value === "Off") return "关闭";
  const upTo = /^Up to (.+)$/.exec(value);
  if (upTo?.[1] !== undefined) return `最多 ${zhAmountWords(upTo[1])}`;
  const dates = new RegExp(
    `^((?:${monthPattern}) \\d{1,2}) to ((?:${monthPattern}) \\d{1,2})$`,
  ).exec(value);
  if (dates?.[1] !== undefined && dates[2] !== undefined) {
    return `${zhDates(dates[1])} 至 ${zhDates(dates[2])}`;
  }
  const spent = /^(\$\d[\d,]*(?:\.\d+)?) of (\$\d[\d,]*(?:\.\d+)?)$/.exec(value);
  if (spent?.[1] !== undefined && spent[2] !== undefined) {
    return `已支出 ${spent[1]}，上限 ${spent[2]}`;
  }
  const used = /^(\d[\d,]*(?:\.\d+)?) of (\d[\d,]*(?:\.\d+)?) credits?$/.exec(value);
  if (used?.[1] !== undefined && used[2] !== undefined) {
    return `已用 ${used[1]} 积分，上限 ${used[2]} 积分`;
  }
  const share = /^(.+) of (.+)$/.exec(value);
  if (share?.[1] !== undefined && share[2] !== undefined) {
    return `${zhAmountWords(share[1])} / ${zhAmountWords(share[2])}`;
  }
  return zhAmountWords(zhDates(value));
}

/** The caption under an amount: "$10.00 expires Nov 4", "of $250.00 · expires Nov 5", "On this gateway key". */
export function zhNote(note: string): string {
  return note
    .split(" · ")
    .map((part) => {
      if (part === "On this gateway key") return "此网关密钥";
      const both = /^(\$[\d,.]+) expires (.+)$/.exec(part);
      if (both?.[1] !== undefined && both[2] !== undefined) {
        return `${both[1]} 将于${zhDates(both[2])}到期`;
      }
      const expires = /^expires (.+)$/.exec(part);
      if (expires?.[1] !== undefined) return `${zhDates(expires[1])}到期`;
      const used = /^([\d,.]+) used of ([\d,.]+)$/.exec(part);
      if (used?.[1] !== undefined && used[2] !== undefined) return `已用 ${used[1]} / ${used[2]}`;
      const total = /^of (.+)$/.exec(part);
      if (total?.[1] !== undefined) return `共 ${total[1]}`;
      return part;
    })
    .join(" · ");
}

// ---------- state words ----------

const statusWords: Readonly<Record<string, string>> = {
  Active: "正常",
  Paused: "已暂停",
  Disconnected: "已断开",
  "Refresh Failed": "刷新失败",
  "Out of Date": "数据过期",
  Partial: "部分",
  Waiting: "等待中",
  "Waiting for First Refresh": "等待首次刷新",
};

/** The word `statusOf` gives an account. The English word stays the key; this is only what is shown. */
export function zhStatus(word: string): string {
  return statusWords[word] ?? word;
}

/** The unit `displayMeter` gives a figure: "%" for used stays, "% left" reads "% 剩余". */
export function zhUnit(unit: string): string {
  return unit === "% left" ? "% 剩余" : unit;
}

const captionWords: Readonly<Record<string, string>> = {
  "Running Low": "余量偏低",
  "Almost Out": "即将耗尽",
  "Over the Limit": "已超限",
};

/** The caption `captionOf` gives a limit that is low. */
export function zhCaption(caption: string): string {
  return captionWords[caption] ?? caption;
}

const scopeWords: Readonly<Record<ConnectionScope, string>> = {
  individual: "个人",
  member: "工作",
  team_admin: "团队",
  organization: "团队",
};

/** The owner's name for the account, else a word for its scope, in Chinese. */
export function zhAccountName(connection: Pick<OverviewConnection, "name" | "scope">): string {
  const name = connection.name?.trim();
  return name ? name : scopeWords[connection.scope];
}

const methodWords: Readonly<Record<AuthMethod, string>> = {
  cli_login: "登录",
  device_code: "输入代码",
  paste_redirect: "粘贴地址",
  approval_poll: "在浏览器中批准",
  api_key: "API 密钥",
  import: "导入文件",
};

/** Short words for how a provider signs in. */
export function zhAuthMethod(method: AuthMethod): string {
  return methodWords[method];
}

const autoResetWindows: Readonly<Record<AutoResetRule["window"], string>> = {
  weekly: "每周",
  session: "5 小时",
  either: "每周或 5 小时",
};

/** One sentence on what an auto-reset rule does, for a tooltip, written from the rule itself. */
export function zhAutoResetSummary(
  rule: Pick<AutoResetRule, "window" | "thresholdPercent" | "minHoursLeft">,
): string {
  return `当${autoResetWindows[rule.window]}额度已用到 ${rule.thresholdPercent}%，且距其自身重置超过 ${rule.minHoursLeft} 小时时，使用最先到期的已存重置。`;
}

// ---------- messages ----------

const messages: Readonly<Record<string, string>> = {
  "Turn off Demo Mode to change accounts.": "关闭演示模式后才能修改账户。",
  "This is a demo. Deploy your own Headroom to use this.":
    "这是演示站点。请部署你自己的 Headroom 来使用此功能。",
  "This is a demo. Deploy your own Headroom to connect accounts.":
    "这是演示站点。请部署你自己的 Headroom 来连接账户。",
  "A refresh is running for this account. Try again in a moment.": "此账户正在刷新，请稍后再试。",
  "Could not reach the server.": "无法连接到服务器。",
  "Could not save your settings. Nothing was changed.": "无法保存你的设置，未做任何更改。",
  "The server sent an unexpected response": "服务器返回了意外的响应。",
  "Request failed": "请求失败",
  "Failed to fetch": "无法连接到服务器。",
  "Load failed": "无法连接到服务器。",
};

/** A message the client or the view-model wrote in English (a refusal, a failed request), in Chinese. */
export function zhMessage(message: string): string {
  const known = messages[message];
  if (known !== undefined) return known;
  const failed = /^Request failed \((\d+)\)$/.exec(message);
  if (failed?.[1] !== undefined) return `请求失败(${failed[1]})`;
  return message;
}
