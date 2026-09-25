import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { aiProvider, parseText } from "../src/lib/ai";

const keys = ["ANTHROPIC_API_KEY", "GEMINI_API_KEY"] as const;
afterEach(() => { for (const k of keys) delete process.env[k]; vi.unstubAllGlobals(); });

describe("ai provider", () => {
  it("prefers Claude, then Gemini, else none", () => {
    expect(aiProvider()).toBeNull();
    process.env.GEMINI_API_KEY = "g";
    expect(aiProvider()).toBe("gemini");
    process.env.ANTHROPIC_API_KEY = "a";
    expect(aiProvider()).toBe("claude");
  });
  it("falls back to the offline parser when Gemini fails", async () => {
    process.env.GEMINI_API_KEY = "g";
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("network down"); }));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await parseText("قبضت 3000 من كافيه سكر", "EGP");
    expect(r.via).toBe("offline");
    expect(r.data.income[0]?.amount).toBe(3000);
    spy.mockRestore();
  });
  it("sends a JSON-schema request to Gemini and returns its parsed answer", async () => {
    process.env.GEMINI_API_KEY = "g";
    const answer = { tasks: [{ title: "لوجو", client: "كافيه سكر", due: "", priority: "normal", status: "done" }],
      income: [{ name: "لوجو", client: "كافيه سكر", amount: 3000, date: "2026-09-25" }], subscriptions: [], expenses: [] };
    let url = "", body: any = null;
    vi.stubGlobal("fetch", vi.fn(async (u: any, init: any) => {
      url = String(u); body = JSON.parse(init.body);
      return new Response(JSON.stringify({ candidates: [{ content: { role: "model", parts: [{ text: JSON.stringify(answer) }] }, finishReason: "STOP" }] }),
        { status: 200, headers: { "content-type": "application/json" } });
    }));
    const r = await parseText("خلصت لوجو كافيه سكر وقبضت 3000", "EGP");
    expect(r.via).toBe("gemini");
    expect(r.data).toEqual(answer);
    expect(url).toContain("models/gemini-flash-latest:generateContent");
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseJsonSchema.properties.tasks).toBeTruthy();
    expect(JSON.stringify(body.systemInstruction)).toContain("EGP");
  });
});
