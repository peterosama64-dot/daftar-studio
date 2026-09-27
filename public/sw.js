// Service worker: reminder notifications, and offline use.
// Offline: app pages are network-first (the last good copy is kept per URL, shown when there's no
// connection); built assets are cache-first (their names change with every deploy).
const PAGES = "daftar-pages-v1";
const STATIC = "daftar-static-v1";
const OFFLINE_HTML = `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>مفيش نت</title><body style="font-family:system-ui,sans-serif;background:#f6f4ef;color:#1c1b19;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px">
<div><h1 style="font-size:22px">مفيش نت دلوقتي</h1><p>الصفحة دي لسه متفتحتش قبل كده على الموبايل ده، فمش محفوظة.<br>افتح الرئيسية أو جرّب تاني لما النت يرجع.</p>
<p><a href="/app" style="color:#0e7490">الرئيسية</a></p></div></body></html>`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("daftar-") && k !== PAGES && k !== STATIC) await caches.delete(k);
    await self.clients.claim();
  })());
});

const isPage = (url) => url.pathname === "/app" || url.pathname.startsWith("/app/");
const isStatic = (url) => url.pathname.startsWith("/_next/static/") || /^\/(icon\.svg|favicon\.ico|manifest\.webmanifest)$/.test(url.pathname);

async function pageFromNetwork(req) {
  const res = await fetch(req);
  const url = new URL(res.url);
  // Signed out (or suspended): drop every saved page, they belong to that session.
  if (res.redirected && url.pathname.startsWith("/login")) { await caches.delete(PAGES); return res; }
  if (res.ok && res.type === "basic" && !res.redirected) (await caches.open(PAGES)).put(req.url, res.clone());
  return res;
}

async function pageOffline(req) {
  const cache = await caches.open(PAGES);
  const hit = (await cache.match(req.url)) || (await cache.match(req.url, { ignoreSearch: true }));
  if (hit) return hit;
  return new Response(OFFLINE_HTML, { status: 503, headers: { "content-type": "text/html; charset=utf-8" } });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === "navigate" && isPage(url)) {
    event.respondWith(pageFromNetwork(req).catch(() => pageOffline(req)));
    return;
  }
  if (isStatic(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    })());
  }
});

// Saves a page and every built file it loads, so it also works offline when it was never opened.
async function warmPage(u) {
  const res = await pageFromNetwork(new Request(u, { credentials: "same-origin" }));
  if (!res.ok || res.redirected) return;
  const html = await res.text();
  const files = [...new Set(html.match(/\/_next\/static\/[^"'\s\\)]+/g) || [])];
  const cache = await caches.open(STATIC);
  await Promise.all(files.map((f) => cache.match(f).then((hit) => hit || cache.add(f)).catch(() => null)));
}

// The app asks to save its main pages in the background so they open offline even if not visited yet.
self.addEventListener("message", (event) => {
  const d = event.data || {};
  if (d.type === "warm" && Array.isArray(d.urls)) {
    const assets = (Array.isArray(d.assets) ? d.assets : []).filter((u) => { try { return isStatic(new URL(u, self.location.origin)); } catch { return false; } });
    event.waitUntil(Promise.all([
      ...d.urls.map((u) => warmPage(u).catch(() => null)),
      caches.open(STATIC).then((c) => Promise.all(assets.map((u) => c.match(u).then((hit) => hit || c.add(u)).catch(() => null)))),
    ]));
  }
  if (d.type === "forget") event.waitUntil(caches.delete(PAGES));
});

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || "دفتر الاستوديو", {
    body: data.body || "",
    dir: "rtl",
    lang: "ar",
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag: data.tag || "daftar-digest",
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
