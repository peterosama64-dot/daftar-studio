import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { buildXlsx, sheetName } from "../src/lib/xlsx";
import { exportSheets } from "../src/lib/export";

describe("excel export", () => {
  it("builds a valid xlsx package with RTL sheets, escaped text and numbers", () => {
    const zip = unzipSync(buildXlsx([{ name: "الشغل", rows: [["المهمة", "المبلغ"], ['لوجو <"سكر"> & كافيه', 3000], ["فاضي", null]] }]));
    expect(Object.keys(zip).sort()).toEqual(["[Content_Types].xml", "_rels/.rels", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/workbook.xml", "xl/worksheets/sheet1.xml"]);
    const sheet = strFromU8(zip["xl/worksheets/sheet1.xml"]);
    expect(sheet).toContain('rightToLeft="1"');
    expect(sheet).toContain("لوجو &lt;&quot;سكر&quot;&gt; &amp; كافيه");
    expect(sheet).toContain('<c r="B2"><v>3000</v></c>');
    expect(sheet).not.toContain('r="B3"');
    expect(strFromU8(zip["xl/workbook.xml"])).toContain('name="الشغل"');
  });
  it("keeps sheet names legal", () => {
    expect(sheetName("a/b:c*d?[e]")).toBe("a b c d  e ");
    expect(sheetName("x".repeat(40))).toHaveLength(31);
  });
  it("lays out tasks, money and subscriptions", () => {
    const d = new Date(2026, 8, 5);
    const s = exportSheets(
      [{ title: "لوجو", client: "سكر", status: "done", priority: "high", due: d, doneAt: d, agreed: 3000, paid: 1000, notes: "", createdAt: d }],
      [
        { kind: "income", name: "لوجو", client: "سكر", amount: 1000, date: d, startMonth: null, endMonth: null },
        { kind: "expense", name: "طباعة", client: "", amount: 200, date: d, startMonth: null, endMonth: null },
        { kind: "subscription", name: "Adobe", client: "", amount: 900, date: null, startMonth: "2026-01", endMonth: null },
      ], "ج.م");
    expect(s.map((x) => x.name)).toEqual(["الشغل", "الدخل والمصاريف", "الاشتراكات"]);
    expect(s[0].rows[1]).toEqual(["لوجو", "سكر", "خلصت", "مستعجل", "2026-09-05", "2026-09-05", 3000, 1000, 2000, "", "2026-09-05"]);
    expect(s[1].rows.slice(1).map((r) => r[3])).toEqual([1000, -200]);
    expect(s[2].rows[1]).toEqual(["Adobe", 900, "2026-01", "", "شغال"]);
  });
});
