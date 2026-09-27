import { describe, it, expect, vi, beforeEach } from "vitest";

const generateContent = vi.fn();
vi.mock("@google/genai", async (orig) => {
  const real = await orig<typeof import("@google/genai")>();
  return { ...real, GoogleGenAI: class { models = { generateContent }; } };
});

import { readReceipt } from "../src/lib/ai";

describe("readReceipt (Gemini)", () => {
  beforeEach(() => { generateContent.mockReset(); delete process.env.ANTHROPIC_API_KEY; process.env.GEMINI_API_KEY = "k"; });
  const img = new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]);

  it("sends the photo inline and returns the total", async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify({ found: true, name: "طباعة", amount: 350, currency: "EGP", date: "2026-09-20" }) });
    expect(await readReceipt(img, "image/jpeg", "EGP")).toMatchObject({ name: "طباعة", amount: 350 });
    const part = generateContent.mock.calls[0][0].contents[0].parts[0];
    expect(part.inlineData).toEqual({ mimeType: "image/jpeg", data: Buffer.from(img).toString("base64") });
  });
  it("returns null when nothing was found or the amount is zero", async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify({ found: false, name: "", amount: 0, currency: "", date: "" }) });
    expect(await readReceipt(img, "image/jpeg", "EGP")).toBeNull();
    generateContent.mockResolvedValue({ text: JSON.stringify({ found: true, name: "x", amount: 0, currency: "EGP", date: "" }) });
    expect(await readReceipt(img, "image/jpeg", "EGP")).toBeNull();
  });
  it("returns null on API errors or bad JSON", async () => {
    generateContent.mockRejectedValue(new Error("boom"));
    expect(await readReceipt(img, "image/jpeg", "EGP")).toBeNull();
    generateContent.mockResolvedValue({ text: "not json" });
    expect(await readReceipt(img, "image/jpeg", "EGP")).toBeNull();
  });
  it("returns null without any AI key", async () => {
    delete process.env.GEMINI_API_KEY;
    expect(await readReceipt(img, "image/jpeg", "EGP")).toBeNull();
    expect(generateContent).not.toHaveBeenCalled();
  });
});
