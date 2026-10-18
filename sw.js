// Rep Quest offline support. Bump VERSION whenever app files change.
// App pages load fresh from the network when online and fall back to the saved copy offline.
const VERSION = 'rq-v8';
const SHELL = ['./', 'index.html', 'manifest.json', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => Promise.all(SHELL.map(u => fetch(u, { cache: 'reload' }).then(r => { if (r.ok) return c.put(u, r); }).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function networkFirst(req) {
  const fresh = fetch(req.url, { cache: 'no-cache' }).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  });
  const timeout = new Promise(resolve => setTimeout(resolve, 3000));
  const fallback = () => caches.match(req).then(hit => hit || caches.match('index.html'));
  return Promise.race([fresh.catch(() => null), timeout]).then(res => res || fallback());
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;
  const isPage = req.mode === 'navigate' || (sameOrigin && /\.(html|json)$|\/$/.test(url.pathname));
  if (sameOrigin && isPage) { e.respondWith(networkFirst(req)); return; }
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (sameOrigin || url.host.endsWith('fonts.googleapis.com') || url.host.endsWith('fonts.gstatic.com')) {
        const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match('index.html')))
  );
});
