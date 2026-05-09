/// <reference lib="webworker" />
/// <reference lib="es2022" />

export {};

declare const self: ServiceWorkerGlobalScope;

const CACHE_VERSION = 'v2';
const CACHE_NAME = `kiss-${CACHE_VERSION}`;

const PRECACHE_URLS: readonly string[] = [
    '/app/index.html',
    '/app/index.css',
    '/app/index.js',
    '/favicon/site.webmanifest'
];

/**
 * Стратегия network-first: сначала пытается загрузить ресурс по сети,
 * при успехе кэширует ответ; при неудаче возвращает кэшированный fallback
 * на /app/index.html (нужно чтобы SPA работал офлайн при навигации).
 * @param request - входящий запрос
 * @returns ответ из сети либо кэшированный index.html
 */
async function networkFirst(request: Request): Promise<Response> {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const clone = response.clone();
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, clone);
        }
        return response;
    } catch {
        const fallback = await caches.match('/app/index.html');
        if (fallback) return fallback;
        throw new Error('Network and cache both unavailable');
    }
}

/**
 * Стратегия stale-while-revalidate: мгновенно возвращает кэшированную копию
 * (если есть) и параллельно обновляет кэш свежим ответом из сети.
 * Если кэша нет — ждёт сетевой ответ.
 * @param request - входящий запрос
 * @returns кэшированный или сетевой ответ
 */
async function staleWhileRevalidate(request: Request): Promise<Response> {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    const networkFetch = fetch(request).then((response) => {
        if (response.ok) {
            void cache.put(request, response.clone());
        }
        return response;
    });
    return cached ?? networkFetch;
}

/**
 * Стратегия cache-first: возвращает кэшированную копию если она есть,
 * иначе идёт в сеть и кэширует успешный ответ. Применяется к статичным
 * иммутабельным ресурсам (изображения, шрифты).
 * @param request - входящий запрос
 * @returns ответ из кэша или из сети
 */
async function cacheFirst(request: Request): Promise<Response> {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) {
        const clone = response.clone();
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, clone);
    }
    return response;
}

/**
 * Проверяет, является ли путь статичным ассетом приложения (JS/CSS/manifest).
 * Используется для выбора stale-while-revalidate стратегии.
 * @param pathname - путь URL без origin
 * @returns true если ресурс — статика приложения
 */
function isStaticAsset(pathname: string): boolean {
    return (
        pathname.endsWith('.js') || pathname.endsWith('.css') || pathname.endsWith('.webmanifest')
    );
}

/**
 * Проверяет, является ли путь иммутабельным медиа-ассетом (картинки, шрифты).
 * Используется для выбора cache-first стратегии.
 * @param pathname - путь URL без origin
 * @returns true если ресурс — изображение или шрифт
 */
function isImageAsset(pathname: string): boolean {
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

/**
 * Обработчик install: предзагружает критичные ресурсы в кэш и сразу
 * активирует новую версию SW (skipWaiting), не дожидаясь закрытия вкладок.
 */
self.addEventListener('install', (event: ExtendableEvent) => {
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then((cache) => cache.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting())
    );
});

/**
 * Обработчик activate: удаляет устаревшие кэши предыдущих версий
 * (всё что начинается с 'kiss-' но не равно текущему CACHE_NAME)
 * и сразу берёт под контроль все открытые клиенты.
 */
self.addEventListener('activate', (event: ExtendableEvent) => {
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

/**
 * Обработчик fetch: маршрутизирует запросы между тремя стратегиями кэширования.
 * Игнорирует не-GET запросы, кросс-доменные запросы, /api/ и /uploads/
 * (они должны всегда идти в сеть напрямую).
 */
self.addEventListener('fetch', (event: FetchEvent) => {
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
