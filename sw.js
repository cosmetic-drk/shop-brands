/* Service worker «Магазин ДРК». При каждом обновлении index.html меняйте VERSION. */
const VERSION = 'drk-2026-12-01';
const CORE = 'core-' + VERSION;
const IMG = 'img-v1';
const FONTS = 'fonts-v1';
const CORE_FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
const IMG_MAX = 600;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CORE).then(c => c.addAll(CORE_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('core-') && k !== CORE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trim(cacheName, max) {
  const c = await caches.open(cacheName);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Страница: сначала сеть (чтобы видеть свежие цены), без сети — из кэша
  if (req.mode === 'navigate' || (url.origin === location.origin && /\/(index\.html)?$/.test(url.pathname))) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CORE).then(c => c.put('./index.html', copy));
        return res;
      }).catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // Шрифты Google: из кэша
  if (url.host === 'fonts.googleapis.com' || url.host === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then(c => c.match(req).then(hit => hit || fetch(req).then(res => { c.put(req, res.clone()); return res; }))));
    return;
  }

  // Фото товаров и логотипы с других сайтов: показываем из кэша, обновляем в фоне
  if (req.destination === 'image' && url.origin !== location.origin) {
    e.respondWith(caches.open(IMG).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) { c.put(req, res.clone()); trim(IMG, IMG_MAX); }
        return res;
      }).catch(() => hit);
      return hit || net;
    }));
    return;
  }

  // Остальные файлы сайта: кэш, затем сеть
  if (url.origin === location.origin) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone(); caches.open(CORE).then(c => c.put(req, copy)); return res;
    })));
  }
});
