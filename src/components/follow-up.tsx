"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markNudged } from "@/app/app/actions";
import { whatsappMessageLink } from "@/lib/remind";
import { followUpText, type WaitKind } from "@/lib/waiting";
import { Button } from "./ui";

/** The ready follow-up for one item: send on WhatsApp (marks it followed up) or copy it. */
export function FollowUp({ kind, id, title, client, link, phone, sender }: { kind: WaitKind; id: string; title: string; client: string; link: string; phone: string | null; sender: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(location.origin), []);
  const text = followUpText({ kind, title, client }, `${origin}${link}`, sender);
  const mark = () => start(async () => { await markNudged(kind, id); router.refresh(); });
  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* no clipboard */ }
  }
  return (
    <div className="grid gap-2">
      <details className="text-sm">
        <summary className="cursor-pointer text-cyan">الرسالة</summary>
        <p className="mt-2 whitespace-pre-line rounded-xl bg-paper p-3 text-ink2 [overflow-wrap:anywhere]">{text}</p>
      </details>
      <div className="flex flex-wrap items-center gap-2">
        <a href={whatsappMessageLink(phone, text)} target="_blank" rel="noopener noreferrer" onClick={mark}
          className="rounded-xl bg-money px-3 py-1.5 text-sm font-semibold text-on-accent">ابعت متابعة واتساب</a>
        <Button small kind="secondary" type="button" onClick={copy}>{copied ? "اتنسخ ✓" : "انسخ الرسالة"}</Button>
        <Button small kind="ghost" type="button" disabled={pending} onClick={mark}>تابعت خلاص</Button>
      </div>
    </div>
  );
}
