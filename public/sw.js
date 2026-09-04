// ═══════════════════════════════════════════════════════════
// SERVICE WORKER — Offline support & caching
// ───────────────────────────────────────────────────────────
// IMPORTANT: index.html is NEVER cached.
//
// Vite har build me hashed asset banata hai (index-ABC123.js).
// Agar index.html cache ho jaye to purana HTML naye deploy ke baad
// ek DELETE ho chuki JS file maangta hai → 404 → WHITE SCREEN.
// Isliye:
//   • navigation / HTML  → hamesha network (network-only + offline page)
//   • hashed assets      → cache-first (hash badalta hai to naya fetch)
// ═══════════════════════════════════════════════════════════

const CACHE_NAME = 'fcoy-erp-v3';

// Install — turant activate, kuch pre-cache nahi
self.addEventListener('install', () => {
  self.skipWaiting();
});

// Activate — v3 ke alawa sab purane cache uda do (stale HTML bhi)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Sirf apne origin ke requests handle karo
  if (url.origin !== self.location.origin) return;

  // Firebase / Google APIs — hamesha network, chhedo mat
  if (url.hostname.includes('firebaseio.com') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('firebase') ||
      url.hostname.includes('sentry')) {
    return;
  }

  // ── HTML / navigation — NETWORK ONLY (kabhi cache se mat do) ──
  // Yahi white-screen ka asli ilaaj hai.
  if (request.mode === 'navigate' ||
      url.pathname === '/' ||
      url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(
          '<!doctype html><meta charset="utf-8">' +
          '<title>Offline</title>' +
          '<body style="font-family:system-ui;padding:2rem;text-align:center">' +
          '<h2>Internet nahi hai</h2>' +
          '<p>Connection wapas aane par page refresh karo.</p></body>',
          { headers: { 'Content-Type': 'text/html' } }
        )
      )
    );
    return;
  }

  // ── Hashed static assets — cache first ──
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.ok && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
  }
});
