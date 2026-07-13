// Cashflow service worker — cache-first, offline-resilient.
// Pre-caches the app shell AND the CDN libraries on install so the app
// works fully offline after the first successful load, even after the
// browser is closed or the phone is restarted.
const C = 'cf-v6';
const ASSETS = [
  './',
  './index.html',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400..800&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/dexie/3.2.4/dexie.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(C).then(c =>
      // Cache each asset independently so one slow/failed CDN request
      // can't abort the whole install. Runtime caching self-heals the rest.
      Promise.all(ASSETS.map(u =>
        c.add(new Request(u, { cache: 'reload' })).catch(() => {})
      ))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then(ks =>
      Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))
    )
  ]));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      // Stale-while-revalidate: serve cache instantly, refresh in background.
      const net = fetch(e.request).then(res => {
        if (res && (res.ok || res.type === 'opaque')) {
          const cl = res.clone();
          caches.open(C).then(c => c.put(e.request, cl));
        }
        return res;
      }).catch(() => cached);
      return cached || net;
    }).catch(() =>
      // Navigation offline with no exact match → fall back to the app shell.
      caches.match('./index.html').then(r => r || new Response('Offline', { status: 503 }))
    )
  );
});
