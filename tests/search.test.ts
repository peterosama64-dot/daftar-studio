import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { foldArabic } from "../src/lib/search";

describe("search folding", () => {
  it("treats Arabic letter forms, harakat and digits alike", () => {
    expect(foldArabic("أحمد")).toBe(foldArabic("احمد"));
    expect(foldArabic("مكتبة الهدى")).toBe(foldArabic("مكتبه الهدي"));
    expect(foldArabic("مُنْيُو")).toBe("منيو");
    expect(foldArabic("  Logo   ٢٠٢٦ ")).toBe("logo 2026");
  });
});
