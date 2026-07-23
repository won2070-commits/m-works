/* M-WORKS 서비스워커 — 네트워크 우선, 실패 시 캐시 (오프라인 지원) */
const CACHE = 'mworks-v91';
const CORE = ['.', 'index.html', 'style.css?v=91', 'app.js?v=91', 'prompts.js?v=91', 'manifest.json', 'icon-192.png?v=91', 'icon-512.png?v=91'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // API 호출·외부 요청은 그대로 통과
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/') || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
