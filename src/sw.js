const CACHE_VERSION = 'v1';
const STATIC_CACHE = `kiss-static-${CACHE_VERSION}`;
const NOTEBOOKS_CACHE = `kiss-notebooks-${CACHE_VERSION}`;
const UPLOADS_CACHE = `kiss-uploads-${CACHE_VERSION}`;

const SHELL_URLS = ['/', '/index.html'];

/** @param {Request} request @param {string} cacheName */
async function cacheFirst(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
}

/** @param {Request} request @param {string} cacheName */
async function staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    const fetchPromise = fetch(request)
        .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
        })
        .catch(() => cached);
    return cached ?? (await fetchPromise) ?? Response.error();
}

/** @param {Request} request */
async function networkFirstNavigate(request) {
    try {
        return await fetch(request);
    } catch {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match('/index.html');
        return cached ?? Response.error();
    }
}

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(SHELL_URLS)));
});

self.addEventListener('activate', (event) => {
    const current = new Set([STATIC_CACHE, NOTEBOOKS_CACHE, UPLOADS_CACHE]);
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(keys.filter((k) => !current.has(k)).map((k) => caches.delete(k)))
            )
            .then(() => self.clients.claim())
    );
});

self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    if (url.origin !== self.location.origin) return;

    if (url.pathname.startsWith('/api/v1/auth/') || url.pathname.startsWith('/api/v1/runner/')) {
        return;
    }

    if (url.pathname.startsWith('/api/v1/') && event.request.method !== 'GET') {
        return;
    }

    if (url.pathname.startsWith('/api/v1/notebooks')) {
        event.respondWith(staleWhileRevalidate(event.request, NOTEBOOKS_CACHE));
        return;
    }

    if (url.pathname.startsWith('/api/v1/')) {
        return;
    }

    if (url.pathname.startsWith('/uploads/')) {
        event.respondWith(cacheFirst(event.request, UPLOADS_CACHE));
        return;
    }

    if (event.request.mode === 'navigate') {
        event.respondWith(networkFirstNavigate(event.request));
        return;
    }

    if (
        url.pathname.startsWith('/assets/') ||
        url.pathname.startsWith('/favicon/') ||
        url.pathname.startsWith('/images/')
    ) {
        event.respondWith(cacheFirst(event.request, STATIC_CACHE));
    }
});
