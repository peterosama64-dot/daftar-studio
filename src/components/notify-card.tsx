"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "./ui";

type State = "loading" | "unsupported" | "ios-install" | "blocked" | "off" | "on";

const b64ToBytes = (b64: string) => {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

export function NotifyCard() {
  const [state, setState] = useState<State>("loading");
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setState(ios && !standalone ? "ios-install" : "unsupported"); return;
      }
      if (Notification.permission === "denied") { setState("blocked"); return; }
      const reg = await navigator.serviceWorker.getRegistration("/");
      setState((await reg?.pushManager.getSubscription()) ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function enable() {
    setBusy(true); setMsg(null);
    try {
      if ((await Notification.requestPermission()) !== "granted") { setState("blocked"); return; }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const { publicKey } = await (await fetch("/api/push/key")).json();
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) });
      const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      if (!res.ok) throw new Error();
      setState("on"); setMsg({ text: "اتفعّلت ✓ جرّب «ابعتلي تجربة»." });
    } catch {
      setMsg({ text: "ما اتفعّلتش. جرّب تاني، أو من Chrome.", err: true });
    } finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true); setMsg(null);
    try {
      const sub = await (await navigator.serviceWorker.getRegistration("/"))?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setState("off"); setMsg({ text: "اتقفلت على الجهاز ده." });
    } finally { setBusy(false); }
  }

  // Shows a notification from this browser directly, with no server or push service involved.
  // If this one doesn't appear either, the device (Windows/macOS/phone settings) is hiding notifications.
  async function localTest() {
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      if (!reg) throw new Error();
      await reg.showNotification("دفتر الاستوديو", { body: "تجربة من الجهاز نفسه ✓", dir: "rtl", lang: "ar", icon: "/icon.svg", tag: "daftar-local-test" });
      setMsg({ text: "لو التنبيه ده ظهر، يبقى الجهاز تمام. لو مظهرش، التنبيهات مقفولة من إعدادات الجهاز (شوف تحت)." });
    } catch {
      setMsg({ text: "المتصفح رفض يعرض التنبيه. افتحه من علامة القفل جنب اللينك ← Notifications ← Allow.", err: true });
    }
  }

  async function test() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      setMsg(res.ok ? { text: "اتبعت. المفروض يظهرلك دلوقتي." } : { text: j.error ?? "ما اتبعتش.", err: true });
    } finally { setBusy(false); }
  }

  return (
    <Card className="grid content-start gap-3 p-5">
      <h2 className="text-lg font-bold">التذكيرات</h2>
      <p className="text-sm text-ink2">كل يوم الصبح يوصلك تنبيه على الجهاز ده بالمتأخر، واللي ميعاده النهارده وبكرة. لو مفيش مواعيد، مش هيبعت حاجة.</p>
      {state === "loading" && <p className="text-sm text-muted">لحظة…</p>}
      {state === "unsupported" && <p className="text-sm text-muted">المتصفح ده مش بيدعم التنبيهات. افتح الموقع من Chrome أو Edge أو Safari.</p>}
      {state === "ios-install" && (
        <p className="text-sm text-ink2">على الآيفون: دوس <b>مشاركة</b> ← <b>Add to Home Screen</b>، وافتح الدفتر من أيقونته على الشاشة، وارجع هنا فعّل التذكيرات.</p>
      )}
      {state === "blocked" && <p className="text-sm text-risk">التنبيهات مقفولة للموقع ده من المتصفح. افتحها من علامة القفل جنب اللينك ← Notifications ← Allow، وبعدين حدّث الصفحة.</p>}
      {state === "off" && <div><Button onClick={enable} disabled={busy}>{busy ? "لحظة…" : "فعّل التذكيرات"}</Button></div>}
      {state === "on" && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={test} disabled={busy}>ابعتلي تجربة</Button>
          <Button kind="secondary" onClick={localTest} disabled={busy}>تجربة من الجهاز</Button>
          <Button kind="secondary" onClick={disable} disabled={busy}>وقّفها على الجهاز ده</Button>
        </div>
      )}
      {msg && <p role="status" className={`text-sm ${msg.err ? "text-risk" : "text-money"}`}>{msg.text}</p>}
      <p className="text-[13px] text-muted">فعّلها على كل جهاز عايزها عليه (الموبايل واللابتوب).</p>
      {state === "on" && (
        <details className="text-[13px] text-muted">
          <summary className="cursor-pointer text-ink2">التنبيه مش بيظهر؟</summary>
          <ul className="mt-1.5 list-inside list-disc">
            <li>ويندوز: الإعدادات ← System ← Notifications ← شغّلها، وشغّل Google Chrome (أو Edge) تحتها، واقفل Do not disturb / Focus.</li>
            <li>ماك: System Settings ← Notifications ← Google Chrome ← Allow notifications.</li>
            <li>أندرويد: إعدادات التطبيقات ← Chrome ← الإشعارات ← مسموحة.</li>
          </ul>
        </details>
      )}
    </Card>
  );
}
