import { describe, expect, test } from "bun:test";
import { zhFactValue, zhLabel, zhWindow } from "./zh";

describe("Cursor pool wording", () => {
  test("translates the shared pool and subscription facts", () => {
    expect(zhLabel("Team Pool")).toBe("团队共享池");
    expect(zhLabel("Week")).toBe("周");
    expect(zhLabel("Renews")).toBe("续费日期");
    expect(zhWindow("$20 shared")).toBe("$20 共享额度");
  });
});

describe("zhFactValue", () => {
  test("translates a Cursor spend against its cap", () => {
    expect(zhFactValue("$3.00 of $20.00")).toBe("已支出 $3.00，上限 $20.00");
    expect(zhFactValue("$1,250 of $2,000")).toBe("已支出 $1,250，上限 $2,000");
  });

  test("translates Grok credits used against a cap, decimals included", () => {
    expect(zhFactValue("1,200 of 5,000 credits")).toBe("已用 1,200 积分，上限 5,000 积分");
    expect(zhFactValue("12 of 25.50 credits")).toBe("已用 12 积分，上限 25.50 积分");
    expect(zhFactValue("1,234.50 of 2,000.00 credits")).toBe(
      "已用 1,234.50 积分，上限 2,000.00 积分",
    );
  });

  test("keeps Unknown, Up to and unrelated text out of the slash form", () => {
    expect(zhFactValue("Unknown")).toBe("未知");
    expect(zhFactValue("Up to 5 credits")).toBe("最多 5 积分");
    expect(zhFactValue("5 credits of 10 credits")).toBe("5 积分 / 10 积分");
  });
});
