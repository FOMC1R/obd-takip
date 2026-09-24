// Çevrimdışı açılış. Uygulamanın kendi dosyaları (sayfa, features/*.js, simgeler) önce ağdan
// alınır ki güncellemeler hemen gelsin; ağ yoksa son kaydedilen kopya kullanılır.
// Dış kütüphane (Leaflet, cdnjs) sürümü sabit olduğu için önbellekten verilir.
const CACHE = "obd-takip-v8";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png",
  "./features/layout.js", "./features/hud.js", "./features/misfire.js", "./features/ai.js",
  "./features/maintenance.js", "./features/expenses.js", "./features/report.js",
  "./features/score.js", "./features/perf.js", "./features/ev.js", "./features/diagpack.js", "./features/prices.js",
  "./features/vehicles-data.js", "./features/vehicles.js", "./features/cluster.js", "./features/stats.js", "./features/autoview.js",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"];

self.addEventListener("install", e => {
  // Bir dosya alınamazsa kurulum tümden düşmesin
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;
  if (url.hostname.endsWith("tile.openstreetmap.org")) return;   // harita karoları önbelleğe alınmaz
  if (url.hostname === "api.anthropic.com") return;              // yapay zekâ isteği hiç önbelleğe girmez
  if (url.hostname === "vpic.nhtsa.dot.gov") return;             // araç tanıma yedeği: sonucu uygulama kendisi saklar
  if (url.hostname === "raw.githubusercontent.com") return;      // güncel yakıt fiyatı: her seferinde ağdan (uygulama son fiyatı kendisi saklar)
  if (url.origin === location.origin) {
    // Önce ağ, olmazsa önbellek
    e.respondWith(fetch(req).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return r;
    }).catch(() => caches.match(req, {ignoreSearch: true}).then(r => r || (req.mode === "navigate" ? caches.match("./index.html") : undefined))));
    return;
  }
  // Dış dosyalar: önce önbellek
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok || r.type === "opaque") { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return r;
  })));
});
