// Service worker for reminder notifications only (no caching).
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || "دفتر الاستوديو", {
    body: data.body || "",
    dir: "rtl",
    lang: "ar",
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag: "daftar-digest",
    data: { url: data.url || "/app" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/app", self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) if (w.url.startsWith(self.location.origin) && "focus" in w) { await w.navigate(url); return w.focus(); }
    return self.clients.openWindow(url);
  })());
});
