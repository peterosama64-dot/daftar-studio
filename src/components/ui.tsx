import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="13" cy="13" r="7" />
      <path d="M13 1v24M1 13h24" />
      <circle cx="13" cy="13" r="2.5" fill="var(--cyan)" stroke="none" />
    </svg>
  );
}

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 font-display text-[19px] font-bold no-underline">
      <Logo /> دفتر الاستوديو
    </Link>
  );
}

export function MicIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className={className} aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

export type Tone = "neutral" | "urgent" | "money" | "waiting" | "later" | "inverse";
const TONE: Record<Tone, string> = {
  neutral: "bg-paper text-ink2",
  urgent: "bg-risk-soft text-risk",
  money: "bg-money-soft text-money",
  waiting: "bg-wait-soft text-wait",
  later: "bg-cyan-soft text-cyan",
  inverse: "bg-ink text-paper",
};
export function Pill({ tone = "neutral", mono, children }: { tone?: Tone; mono?: boolean; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE[tone]} ${mono ? "num" : ""}`}>
      {children}
    </span>
  );
}

type BtnKind = "primary" | "secondary" | "danger" | "ghost";
const BTN: Record<BtnKind, string> = {
  primary: "bg-ink text-paper border-ink",
  secondary: "bg-sheet text-ink border-rule hover:border-cyan",
  danger: "bg-sheet text-risk border-risk",
  ghost: "bg-transparent text-muted border-transparent hover:text-ink",
};
export const btnClass = (kind: BtnKind = "primary", small = false) =>
  `inline-flex items-center justify-center gap-2 rounded-xl border font-display font-semibold transition-transform active:translate-y-px disabled:opacity-50 ${
    small ? "min-h-9 px-3.5 text-sm" : "min-h-12 px-5 text-[15px]"
  } ${BTN[kind]}`;

export function Button({ kind = "primary", small, className = "", ...p }: ComponentProps<"button"> & { kind?: BtnKind; small?: boolean }) {
  return <button {...p} className={`${btnClass(kind, small)} ${className}`} />;
}

export function Card({ className = "", ...p }: ComponentProps<"div">) {
  return <div {...p} className={`rounded-2xl border border-rule bg-sheet ${className}`} />;
}

export function SectionHead({ title, count, rule = "ink" }: { title: string; count?: number | string; rule?: "ink" | "risk" | "cyan" | "money" }) {
  const c = { ink: "border-ink", risk: "border-risk", cyan: "border-cyan", money: "border-money" }[rule];
  return (
    <div className={`mb-3 flex items-baseline justify-between border-b-2 pb-2 ${c}`}>
      <h2 className="text-lg font-bold">{title}</h2>
      {count !== undefined && <span className="num text-sm text-muted">{count}</span>}
    </div>
  );
}

export const inputClass = "w-full min-w-0 rounded-[10px] border border-rule bg-paper px-3.5 py-2.5 text-[15px] text-ink placeholder:text-muted focus:border-cyan focus:outline-none";

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      {children}
      {hint}
    </label>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-rule p-4 text-center text-sm text-muted">{children}</div>;
}
