const V = 'rw-2';
const SHELL = ['./', './manifest.json', './favicon.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== V).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Let API and font requests go straight to the network
  if (url.hostname === 'api.github.com' ||
      url.hostname === 'fonts.googleapis.com' ||
      url.hostname === 'fonts.gstatic.com') return;

  // Stale-while-revalidate for the shell
  e.respondWith(
    caches.open(V).then(cache =>
      cache.match(e.request).then(cached => {
        const fresh = fetch(e.request).then(res => {
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        }).catch(() => cached);
        return cached || fresh;
      })
    )
  );
});
