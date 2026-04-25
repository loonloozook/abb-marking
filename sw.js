// Service worker для PWA.
// Стратегия:
//   • HTML-навигация → network-first (чтобы после деплоя на GitHub пользователи
//     сразу получали свежий index.html, а не его кэш).
//   • Статика (иконки, manifest) → cache-first для офлайна.
// Базу EAN service worker не кэширует: после ручной загрузки приложение
// сохраняет её в IndexedDB прямо на устройстве.
//
// При любом изменении index.html / логики кэширования — поднимите версию CACHE,
// тогда у пользователей при следующем открытии старый кэш удалится в activate.
const CACHE = 'abb-marking-v4';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // HTML / навигация → network-first: свежая версия при любом открытии,
  // офлайн-фолбэк через кэш.
  const accept = req.headers.get('accept') || '';
  const isHTML = req.mode === 'navigate'
              || req.destination === 'document'
              || accept.includes('text/html');

  if (isHTML) {
    e.respondWith(
      fetch(req).then(res => {
        // обновляем кэш свежим HTML для офлайн-запуска
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put('./index.html', copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  // Остальное (иконки, manifest, прочая статика) → cache-first
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).catch(() => caches.match('./index.html')))
  );
});
