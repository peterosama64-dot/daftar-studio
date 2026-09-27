"use client";

import { useEffect, useState } from "react";
import { Card } from "./ui";

type Theme = "auto" | "light" | "dark";
type Size = "md" | "lg" | "xl";
const YEAR = 60 * 60 * 24 * 365;

function read<T extends string>(name: string, allowed: T[], fallback: T): T {
  const m = new RegExp(`(?:^|; )${name}=([a-z]+)`).exec(document.cookie);
  return m && (allowed as string[]).includes(m[1]) ? (m[1] as T) : fallback;
}
/** Saved per device (a cookie), applied instantly and before paint on the next load. */
function save(name: string, value: string | null, attr: "theme" | "size") {
  document.cookie = value ? `${name}=${value}; path=/; max-age=${YEAR}; samesite=lax` : `${name}=; path=/; max-age=0`;
  if (value) document.documentElement.dataset[attr] = value; else delete document.documentElement.dataset[attr];
}

const THEMES: [Theme, string][] = [["auto", "زي الموبايل"], ["light", "فاتح"], ["dark", "غامق"]];
const SIZES: [Size, string][] = [["md", "عادي"], ["lg", "كبير"], ["xl", "أكبر"]];

/** «الشكل»: light / dark / follow the device, and a bigger text size. */
export function AppearanceCard() {
  const [theme, setTheme] = useState<Theme>("auto");
  const [size, setSize] = useState<Size>("md");
  useEffect(() => { setTheme(read<Theme>("theme", ["light", "dark"], "auto")); setSize(read<Size>("size", ["lg", "xl"], "md")); }, []);

  const group = <T extends string>(label: string, opts: [T, string][], value: T, pick: (v: T) => void) => (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      <div className="grid grid-cols-3 gap-1 rounded-[10px] bg-sunken p-1" role="radiogroup" aria-label={label}>
        {opts.map(([v, l]) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => pick(v)}
            className={`rounded-lg py-2 text-sm ${value === v ? "bg-sheet font-semibold text-ink" : "text-muted"}`}>{l}</button>
        ))}
      </div>
    </fieldset>
  );
  return (
    <Card className="grid gap-4 p-5">
      <h2 className="text-lg font-bold">الشكل</h2>
      {group("الوضع", THEMES, theme, (v) => { setTheme(v); save("theme", v === "auto" ? null : v, "theme"); })}
      {group("حجم الخط", SIZES, size, (v) => { setSize(v); save("size", v === "md" ? null : v, "size"); })}
      <p className="text-[0.8125rem] text-muted">بيتحفظ على الجهاز ده بس. الفواتير بتتطبع فاتح دايمًا.</p>
    </Card>
  );
}
