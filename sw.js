// Offline cache for the iPhone app (and the PC site): every shipped file is cached on install, then served from the
// cache while a fresh copy is fetched in the background, so a new release shows on the next launch.
// FILES and VERSION are rewritten by `node tools/update-sw.mjs` (test/sw.test.js checks the list).
const VERSION = 10;
const FILES = [
  './',
  'app.js',
  'domain/csv.js',
  'domain/dates.js',
  'domain/earnings.js',
  'domain/importPlan.js',
  'domain/paid.js',
  'domain/rate.js',
  'domain/seasons.js',
  'domain/stats.js',
  'domain/validate.js',
  'icons/icon-180.png',
  'icons/icon-512.png',
  'index.html',
  'link/connection.js',
  'link/crypto.js',
  'link/pairing.js',
  'link/phoneSide.js',
  'link/protocol.js',
  'manifest.webmanifest',
  'source/backup.js',
  'source/core.js',
  'source/demo.js',
  'source/idbStore.js',
  'source/linked.js',
  'source/local.js',
  'styles.css',
  'ui/banner.js',
  'ui/calendar.js',
  'ui/empty.js',
  'ui/files.js',
  'ui/html.js',
  'ui/lessonDialog.js',
  'ui/lessons.js',
  'ui/link.js',
  'ui/m/app.js',
  'ui/m/backup.js',
  'ui/m/i18n.js',
  'ui/m/lessons.js',
  'ui/m/links.js',
  'ui/m/overview.js',
  'ui/m/scan.js',
  'ui/m/settings.js',
  'ui/m/sheet.js',
  'ui/money.js',
  'ui/overview.js',
  'ui/phone.js',
  'ui/settings.js',
  'ui/splash.js',
  'ui/stats.js',
  'vendor/jsQR.js',
  'vendor/qrcode.js',
];
const CACHE = `karvo-v${VERSION}`;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // the relay and Play links go to the network
  e.respondWith(caches.open(CACHE).then(async cache => {
    const hit = await cache.match(e.request, { ignoreSearch: true });
    const fresh = fetch(e.request, { cache: 'no-cache' }).then(r => { if (r.ok) cache.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit ?? fresh;
  }));
});
