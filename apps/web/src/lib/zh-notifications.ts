import { providerName } from "@headroom/view-model/labels";
import type { AppNotification } from "@headroom/view-model/notifications";

import { zhAmountWords, zhDates, zhExact, zhLabel, zhShort, zhSpan } from "./zh.ts";

/**
 * The words of a notification in Chinese, for the bell. `deriveNotifications` also builds the events the server
 * sends, so they stay English; this reads the title and message of one event and rebuilds them from the same
 * templates, by kind. A title or message that does not fit its template is returned as it was, and the event,
 * its id, kind and figures are never touched.
 */

type Words = Pick<AppNotification, "kind" | "provider" | "title" | "message">;

function escape(text: string): string {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

/** "30 hours", "3 days", "1 hour" from the pace sentence. */
function zhHoursDays(text: string): string {
  const match = /^(\d+) (hour|hours|day|days)$/.exec(text);
  if (match === null) return text;
  return `${match[1]}${match[2]?.startsWith("hour") === true ? "小时" : "天"}`;
}

/** A limit's name in a title, with "额度" after it unless the name already ends so. */
function limitName(short: string): string {
  const zh = zhShort(short);
  if (zh.endsWith("额度")) return zh;
  return /[A-Za-z0-9]$/.test(zh) ? `${zh} 额度` : `${zh}额度`;
}

/** "3" from "3 Days" in a title, as "3天". */
function dayCount(count: string): string {
  return `${Number.parseInt(count, 10)}天`;
}

/** "in 2 h" and "at 15:06", the part after "Resets" in a message, as the clause that closes the reset. */
function resetClause(rest: string): string {
  if (rest.startsWith("in ")) return `${zhSpan(rest.slice(3))}后重置。`;
  return `${zhExact(rest)}重置。`;
}

function titleOf(item: Words): string | null {
  const { title } = item;
  const name = providerName(item.provider);
  const own = escape(name);
  const match = (pattern: string): RegExpExecArray | null => new RegExp(`^${pattern}$`).exec(title);
  switch (item.kind) {
    case "running_low": {
      const found = match(`${own} (.+) Limit Is Running Low`);
      return found?.[1] === undefined ? null : `${name} ${limitName(found[1])}余量偏低`;
    }
    case "almost_out": {
      const found = match(`${own} Is Almost Out of Its (.+) Limit`);
      return found?.[1] === undefined ? null : `${name} ${limitName(found[1])}即将耗尽`;
    }
    case "pacing": {
      const found = match(`${own} (.+) Limit Will Run Out Early`);
      return found?.[1] === undefined ? null : `${name} ${limitName(found[1])}将提前用完`;
    }
    case "reset_expiring": {
      const found = match(`A ${own} Reset Expires in (\\d+) Days?`);
      return found?.[1] === undefined ? null : `${name} 有重置将在${dayCount(found[1])}后到期`;
    }
    case "balance_low": {
      if (title === "Claude Usage Credits Ran Out") return "Claude 使用积分已用完";
      if (title === "Claude Cloud Credits Ran Out") return "Claude 云端积分已用完";
      if (title === `${name} Credits Are Almost Out`) return `${name} 积分即将耗尽`;
      if (title === `${name} Credits Are Running Low`) return `${name} 积分余量偏低`;
      return null;
    }
    case "credits_expiring": {
      const credits = match(`${own} (Usage Credits|Cloud Credits) Expire in (\\d+) Days?`);
      if (credits?.[1] !== undefined && credits[2] !== undefined) {
        return `${name} ${zhLabel(credits[1])}将在${dayCount(credits[2])}后到期`;
      }
      if (title === `${name} Credits Expire Today`) return `${name} 积分今天到期`;
      const topUp = match(`${own} Credits Expire in (\\d+) Days?`);
      return topUp?.[1] === undefined ? null : `${name} 积分将在${dayCount(topUp[1])}后到期`;
    }
    case "spend_cap_reached": {
      const found = match(`${own} (.+) Has Reached Its Cap`);
      return found?.[1] === undefined ? null : `${name} ${zhLabel(found[1])}已达上限`;
    }
    case "spend_near_cap": {
      const found = match(`${own} (.+) Is Near Its Cap`);
      return found?.[1] === undefined ? null : `${name} ${zhLabel(found[1])}已接近上限`;
    }
    case "extra_usage_started": {
      const found = match(`${own} Has Started (Extra Usage|On-Demand Usage)`);
      return found?.[1] === undefined ? null : `${name} 已开始产生${zhLabel(found[1])}`;
    }
    case "budget_near": {
      const found = match(`${own} (.+) Is Near Your Budget`);
      return found?.[1] === undefined ? null : `${name} ${zhLabel(found[1])}已接近你的预算`;
    }
    case "budget_exceeded": {
      const found = match(`${own} (.+) Is Over Your Budget`);
      return found?.[1] === undefined ? null : `${name} ${zhLabel(found[1])}已超出你的预算`;
    }
    case "auto_reset": {
      if (title === `${name} Auto-Reset Used a Banked Reset`) {
        return `${name} 自动重置已使用一次已存重置`;
      }
      if (title === `${name} Auto-Reset Failed`) return `${name} 自动重置失败`;
      if (title === `${name} Auto-Reset May Not Have Worked`) return `${name} 自动重置可能未生效`;
      return null;
    }
    case "reset_granted":
      return title === `${name} Banked a New Reset` ? `${name} 新增了一次已存重置` : null;
    case "early_reset": {
      const found = match(`${own} (.+) Limit Reset Early`);
      return found?.[1] === undefined ? null : `${name} ${limitName(found[1])}提前重置`;
    }
    case "top_up_detected":
      return title === `${name} Top-Up Detected` ? `${name} 检测到充值` : null;
    case "disconnected":
      return title === `${name} Is Disconnected` ? `${name} 已断开连接` : null;
    case "refresh_failed":
      return title === `${name} Refresh Failed` ? `${name} 刷新失败` : null;
    default:
      return null;
  }
}

/** "36% left." or "91% used.", with two groups: the figure and which view. */
const share = String.raw`(\d+)% (left|used)\.`;

function shareClause(count: string | undefined, view: string | undefined): string | null {
  if (count === undefined) return null;
  return view === "left" ? `剩余 ${count}%。` : `已用 ${count}%。`;
}

function messageOf(item: Words): string | null {
  const { message } = item;
  const match = (pattern: string): RegExpExecArray | null =>
    new RegExp(`^${pattern}$`).exec(message);
  switch (item.kind) {
    case "running_low":
    case "almost_out":
    case "pacing": {
      const found = match(
        `${share}(?: Resets ([^.]+)\\.)?(?: At this rate it runs out in about ([^,]+), ([^.]+) before it resets\\.)?`,
      );
      const lead = shareClause(found?.[1], found?.[2]);
      if (found === null || lead === null) return null;
      const reset = found[3] === undefined ? "" : resetClause(found[3]);
      const pace =
        found[4] === undefined || found[5] === undefined
          ? ""
          : `按当前速度，约${zhHoursDays(found[4])}后用完，比重置提前${zhHoursDays(found[5])}。`;
      return `${lead}${reset}${pace}`;
    }
    case "reset_expiring": {
      const found = match(
        String.raw`(\d+) of (\d+) banked full resets (expires|expire from) ([^.]+)\.`,
      );
      if (found === null) return null;
      const [, soon = "", all = "", verb = "", date = ""] = found;
      const when = verb === "expires" ? `将于${zhDates(date)}到期` : `将从${zhDates(date)}起到期`;
      return `${all} 个已存完整重置中有 ${soon} 个${when}。`;
    }
    case "balance_low": {
      if (message === "Extra usage has nothing left to spend until credits are added.") {
        return "在补充积分之前，额外用量已没有可花费的积分。";
      }
      const cloud = match(String.raw`All (\$[\d,.]+) of cloud credits are used\.`);
      if (cloud?.[1] !== undefined) return `${cloud[1]} 云端积分已全部用完。`;
      const gateway = match(`${share} ([\\d,.]+) of ([\\d,.]+) credits remain\\.`);
      const lead = shareClause(gateway?.[1], gateway?.[2]);
      if (gateway === null || lead === null) return null;
      return `${lead}共 ${gateway[4]} 积分，还剩 ${gateway[3]}。`;
    }
    case "credits_expiring": {
      const usage = match(String.raw`(\$[\d,.]+) of (usage|cloud) credits expire ([^.]+)\.`);
      if (usage?.[1] !== undefined && usage[2] !== undefined && usage[3] !== undefined) {
        const kind = usage[2] === "usage" ? "使用积分" : "云端积分";
        return `${usage[1]} ${kind}将于${zhDates(usage[3])}到期。`;
      }
      const topUp = match(
        String.raw`(Credits|[\d,.]+ credits?) from your ([^.]+?) top-up (expire today|expire ([^.]+?))\.`,
      );
      if (topUp?.[1] === undefined || topUp[2] === undefined || topUp[3] === undefined) return null;
      const credits = topUp[1] === "Credits" ? "积分" : zhAmountWords(topUp[1]);
      const when = topUp[3] === "expire today" ? "今天到期" : `将于${zhDates(topUp[4] ?? "")}到期`;
      return `你在${zhDates(topUp[2])}充值的${credits}${when}。`;
    }
    case "spend_cap_reached":
    case "spend_near_cap": {
      const found = match(String.raw`(\S+) of (\S+) (spent|credits used)\.`);
      if (found?.[1] === undefined || found[2] === undefined) return null;
      return `${found[3] === "spent" ? "已支出" : "已使用"} ${found[1]}，上限 ${found[2]}。`;
    }
    case "extra_usage_started": {
      const copilot = match(String.raw`([\d,.]+) extra credits? used this month\.`);
      if (copilot?.[1] !== undefined) return `本月已额外使用 ${copilot[1]} 积分。`;
      const found = match(String.raw`(.+) (spent|used) so far\.`);
      if (found?.[1] === undefined) return null;
      return `目前已${found[2] === "spent" ? "支出" : "使用"} ${zhAmountWords(found[1])}。`;
    }
    case "budget_near":
    case "budget_exceeded": {
      const found = match(String.raw`(.+) of your (.+) budget (spent|used)\.`);
      if (found?.[1] === undefined || found[2] === undefined) return null;
      const verb = found[3] === "spent" ? "已支出" : "已使用";
      return `${verb} ${zhAmountWords(found[1])}，预算 ${zhAmountWords(found[2])}。`;
    }
    case "auto_reset": {
      const used = match(
        String.raw`A limit reached (\d+)% used, so Headroom used a banked reset\.`,
      );
      if (used?.[1] !== undefined)
        return `某项额度已用到 ${used[1]}%，Headroom 已使用一次已存重置。`;
      const failed = match(
        String.raw`A limit reached (\d+)% used, but the reset did not go through\. Headroom will not retry until the limit resets\.`,
      );
      if (failed?.[1] !== undefined) {
        return `某项额度已用到 ${failed[1]}%，但重置未成功。在该额度重置之前，Headroom 不会再次尝试。`;
      }
      const unsure = match(
        String.raw`A limit reached (\d+)% used, but Headroom could not confirm the reset\. Check the account before you use another\.`,
      );
      if (unsure?.[1] !== undefined) {
        return `某项额度已用到 ${unsure[1]}%，但 Headroom 无法确认重置结果。请先检查账户，再决定是否使用下一次。`;
      }
      return null;
    }
    case "reset_granted": {
      const found = match(
        String.raw`(?:(\d+) banked (?:reset|resets) available\. )?(The new one has no expiry date\.|The new one expires ([^.]+)\.)`,
      );
      if (found === null) return null;
      const available = found[1] === undefined ? "" : `现有 ${found[1]} 个已存重置可用。`;
      const expiry =
        found[3] === undefined ? "新的重置没有到期日。" : `新的重置将于${zhDates(found[3])}到期。`;
      return `${available}${expiry}`;
    }
    case "early_reset": {
      const spent = String.raw`( A banked reset was used outside Headroom\.)?`;
      const left = match(
        String.raw`(\d+)% left, up from (\d+)%, before its scheduled reset\.${spent}`,
      );
      if (left?.[1] !== undefined && left[2] !== undefined) {
        return `剩余 ${left[1]}%（此前为 ${left[2]}%），在计划重置时间之前已重置。${left[3] === undefined ? "" : "已存重置在 Headroom 之外被使用。"}`;
      }
      const used = match(
        String.raw`Usage fell from (\d+)% to (\d+)% before its scheduled reset\.${spent}`,
      );
      if (used?.[1] === undefined || used[2] === undefined) return null;
      return `用量从 ${used[1]}% 降到 ${used[2]}%，在计划重置时间之前已重置。${used[3] === undefined ? "" : "已存重置在 Headroom 之外被使用。"}`;
    }
    case "top_up_detected": {
      const found = match(String.raw`(.+) added\. The balance is now (.+)\.`);
      if (found?.[1] === undefined || found[2] === undefined) return null;
      return `已增加 ${zhAmountWords(found[1])}，当前余额 ${zhAmountWords(found[2])}。`;
    }
    case "disconnected":
      return message === "The sign-in for this account has expired. Reconnect to keep tracking it."
        ? "此账户的登录已过期。请重新连接以继续跟踪。"
        : null;
    case "refresh_failed":
      return message ===
        "Headroom could not refresh this account. It will try again in a few minutes."
        ? "Headroom 无法刷新此账户，几分钟后会再次尝试。"
        : null;
    default:
      return null;
  }
}

/**
 * The title and message of a notification in Chinese. Each is rebuilt only when it fits the template of its kind
 * exactly; otherwise the original English is kept, so a new or changed message still shows.
 */
export function zhNotification(item: Words): { readonly title: string; readonly message: string } {
  return { title: titleOf(item) ?? item.title, message: messageOf(item) ?? item.message };
}
