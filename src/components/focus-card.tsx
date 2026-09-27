"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PLANS, clock, nextPhase, todayKey, type FocusPlan, type FocusState } from "@/lib/focus";
import { Button } from "./ui";

const KEY = "daftar-focus";
const load = (): FocusState | null => { try { return JSON.parse(localStorage.getItem(KEY) ?? "null"); } catch { return null; } };
const save = (s: FocusState | null) => { try { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); } catch { /* private mode */ } };
const count = () => { try { return Number(localStorage.getItem(todayKey()) ?? 0); } catch { return 0; } };
const bump = () => { try { localStorage.setItem(todayKey(), String(count() + 1)); } catch { /* ignore */ } };

/** Two short tones; no audio file needed. */
function chime() {
  try {
    const ctx = new AudioContext();
    [0, 0.35].forEach((t, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = i ? 880 : 660; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.3);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.32);
    });
  } catch { /* no audio */ }
}

async function notify(title: string, body: string) {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, dir: "rtl", lang: "ar", icon: "/icon.svg", tag: "daftar-focus" });
    else new Notification(title, { body, dir: "rtl", lang: "ar" });
  } catch { /* ignore */ }
}

/**
 * Pomodoro on a task: a work block runs the task's timer (so the time is logged) and counts down;
 * then a break. State lives in localStorage, so a reload or coming back later picks up where it was.
 */
export function FocusCard({ taskId, title, timerRunning, start, stopAt }: {
  taskId: string; title: string; timerRunning: boolean; start: () => Promise<void>; stopAt: (untilMs: number) => Promise<void>;
}) {
  const router = useRouter();
  const [s, setS] = useState<FocusState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [done, setDone] = useState(0);
  const [plan, setPlan] = useState<FocusPlan>(PLANS[0]);
  const busy = useRef(false);

  useEffect(() => { setS(load()); setDone(count()); }, []);
  useEffect(() => {
    if (!s) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [s]);

  const finishPhase = useCallback(async (cur: FocusState) => {
    if (busy.current) return;
    busy.current = true;
    try {
      if (cur.phase === "work") {
        await stopAt(cur.endsAt);
        bump(); setDone(count());
        chime(); await notify("خلصت فترة التركيز 👏", `«${title}» — خد ${cur.plan.rest} دقايق راحة.`);
      } else {
        chime(); await notify("الراحة خلصت", "يلا نرجع للشغل.");
      }
      const n = nextPhase(cur, Date.now());
      save(n); setS(n);
      router.refresh();
    } finally { busy.current = false; }
  }, [router, stopAt, title]);

  useEffect(() => { if (s && s.taskId === taskId && now >= s.endsAt) void finishPhase(s); }, [now, s, taskId, finishPhase]);

  async function begin() {
    if (typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission().catch(() => {});
    const st: FocusState = { taskId, phase: "work", endsAt: Date.now() + plan.work * 60_000, plan };
    if (!timerRunning) await start();
    save(st); setS(st); setNow(Date.now());
    router.refresh();
  }
  async function cancel() {
    if (s?.phase === "work") await stopAt(Date.now());
    save(null); setS(null);
    router.refresh();
  }

  const other = s && s.taskId !== taskId;
  const mine = s && s.taskId === taskId ? s : null;
  return (
    <div className={`grid gap-2.5 rounded-xl border p-3.5 ${mine ? (mine.phase === "work" ? "border-cyan bg-cyan-soft" : "border-money bg-money-soft") : "border-rule bg-paper"}`} aria-label="وضع التركيز">
      {mine ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs text-muted">{mine.phase === "work" ? "تركيز" : "راحة"} · {mine.plan.work}/{mine.plan.rest}</div>
              <div className="num text-[2rem] font-semibold leading-tight" role="timer" aria-live="off">{clock(mine.endsAt - now)}</div>
            </div>
            <Button kind="secondary" small type="button" onClick={cancel}>{mine.phase === "work" ? "وقّف التركيز" : "خلّص الراحة"}</Button>
          </div>
          <p className="text-[0.8125rem] text-ink2">{mine.phase === "work" ? "التايمر شغال على المهمة، وهينبهك لما الوقت يخلص." : "قوم اتحرك شوية واشرب مية."}</p>
        </>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-semibold">وضع التركيز</div>
            <div className="text-xs text-muted">{other ? "فيه تركيز شغال على مهمة تانية." : done ? `خلّصت ${done} ${done === 1 ? "فترة" : "فترات"} النهارده` : "شغل من غير مقاطعة، وبعده راحة"}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-rule bg-sheet p-0.5 text-xs" role="group" aria-label="مدة التركيز">
              {PLANS.map((p) => (
                <button key={p.work} type="button" onClick={() => setPlan(p)} aria-pressed={plan.work === p.work}
                  className={`num rounded-md px-2 py-1 ${plan.work === p.work ? "bg-ink text-paper" : "text-muted"}`}>{p.work}/{p.rest}</button>
              ))}
            </div>
            <Button small type="button" onClick={begin} disabled={!!other}>ابدأ</Button>
          </div>
        </div>
      )}
    </div>
  );
}
