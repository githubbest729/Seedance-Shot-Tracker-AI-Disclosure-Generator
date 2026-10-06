const CACHE = 'shot-tracker-v6';
const FILES = [
  './', './index.html', './style.css', './app.js', './manifest.json',
  './icon.svg', './favicon.ico', './apple-touch-icon.png',
  './icon-192.png', './icon-512.png', './icon-maskable-192.png', './icon-maskable-512.png'
];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== CACHE).map(n => caches.delete(n)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  const swr = r.mode === 'navigate' || /\.(html|js|css|json)$/.test(u.pathname);
  e.respondWith(caches.match(r, { ignoreSearch: true }).then(hit => {
    if (hit && !swr) return hit; // icons: cache-first
    // Stale-while-revalidate: answer from cache now, refresh the cache in the background.
    const net = fetch(r, { cache: 'no-cache' }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); }
      return res;
    }).catch(() => hit);
    if (hit) e.waitUntil(net);
    return hit || net;
  }));
});
