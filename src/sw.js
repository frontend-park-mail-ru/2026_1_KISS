const CACHE_VERSION = 'v2';
const CACHE_NAME = `kiss-${CACHE_VERSION}`;

const PRECACHE_URLS = [
    '/app/index.html',
    '/app/index.css',
    '/app/index.js',
    '/favicon/site.webmanifest'
];

function networkFirst(request) {
    return fetch(request)
        .then((response) => {
            if (response.ok) {
                const clone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
        })
        .catch(() => caches.match('/app/index.html'));
}

function staleWhileRevalidate(request) {
    return caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
            const networkFetch = fetch(request).then((response) => {
                if (response.ok) {
                    cache.put(request, response.clone());
                }
                return response;
            });
            return cached || networkFetch;
        })
    );
}

function cacheFirst(request) {
    return caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
            if (response.ok) {
                const clone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
        });
    });
}

function isStaticAsset(pathname) {
    return (
        pathname.endsWith('.js') || pathname.endsWith('.css') || pathname.endsWith('.webmanifest')
    );
}

function isImageAsset(pathname) {
    return (
        pathname.endsWith('.svg') ||
        pathname.endsWith('.png') ||
        pathname.endsWith('.jpg') ||
        pathname.endsWith('.jpeg') ||
        pathname.endsWith('.ico') ||
        pathname.endsWith('.gif') ||
        pathname.endsWith('.woff2') ||
        pathname.endsWith('.woff')
    );
}

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then((cache) => cache.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(
                    keys
                        .filter((key) => key.startsWith('kiss-') && key !== CACHE_NAME)
                        .map((key) => caches.delete(key))
                )
            )
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    if (event.request.method !== 'GET') return;
    if (url.origin !== self.location.origin) return;
    if (url.pathname.startsWith('/api/')) return;
    if (url.pathname.startsWith('/uploads/')) return;

    if (event.request.mode === 'navigate') {
        event.respondWith(networkFirst(event.request));
        return;
    }

    if (isImageAsset(url.pathname)) {
        event.respondWith(cacheFirst(event.request));
        return;
    }

    if (isStaticAsset(url.pathname)) {
        event.respondWith(staleWhileRevalidate(event.request));
    }
});
