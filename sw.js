/* BobyMusc — permet à l'appli de marcher sans internet.
   Changer CACHE à chaque nouvelle version pour que les téléphones la récupèrent. */
const CACHE = 'bobymusc-1.5.0';
const FILES = ['./', 'index.html', 'styles.css', 'app.js', 'exercises.js', 'motivation.js', 'cloud.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
const SDK = 'https://www.gstatic.com/firebasejs/';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== 'bobymusc-sdk').map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Bibliothèque Firebase : une version fixe, donc la copie enregistrée suffit
  if (e.request.url.startsWith(SDK)) {
    e.respondWith(caches.open('bobymusc-sdk').then(c => c.match(e.request).then(r => r || fetch(e.request).then(res => {
      if (res.ok) c.put(e.request, res.clone());
      return res;
    }))));
    return;
  }
  if (new URL(e.request.url).origin !== location.origin) return;
  // Réseau d'abord (pour avoir les mises à jour), sinon la copie enregistrée
  e.respondWith(
    fetch(e.request)
      .then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});
