const SHELL_CACHE = 'runa-shell-v1';
const RUNTIME_CACHE = 'runa-runtime-v1';
const OFFLINE_FALLBACK_URL = new URL('./', self.location.origin).toString();
const PRECACHE_URLS = [
	OFFLINE_FALLBACK_URL,
	new URL('./manifest.json', self.location.origin).toString(),
	new URL('./favicon.svg', self.location.origin).toString(),
	new URL('./icons/icon-192.png', self.location.origin).toString(),
	new URL('./icons/icon-512.png', self.location.origin).toString(),
	new URL('./icons/apple-touch-icon.png', self.location.origin).toString(),
];

function isCacheableRequest(request) {
	if (request.method !== 'GET') {
		return false;
	}

	const requestUrl = new URL(request.url);

	if (requestUrl.origin !== self.location.origin) {
		return false;
	}

	return !requestUrl.pathname.startsWith('/auth') && !requestUrl.pathname.startsWith('/ws');
}

self.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(SHELL_CACHE);
			await cache.addAll(PRECACHE_URLS);
			await self.skipWaiting();
		})(),
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const cacheNames = await caches.keys();
			await Promise.all(
				cacheNames
					.filter((cacheName) => cacheName !== SHELL_CACHE && cacheName !== RUNTIME_CACHE)
					.map((cacheName) => caches.delete(cacheName)),
			);
			await self.clients.claim();
		})(),
	);
});

self.addEventListener('fetch', (event) => {
	if (!isCacheableRequest(event.request)) {
		return;
	}

	const requestUrl = new URL(event.request.url);

	if (event.request.mode === 'navigate') {
		event.respondWith(
			(async () => {
				try {
					const networkResponse = await fetch(event.request);
					const cache = await caches.open(SHELL_CACHE);
					await cache.put(OFFLINE_FALLBACK_URL, networkResponse.clone());
					return networkResponse;
				} catch {
					const cachedResponse =
						(await caches.match(event.request)) || (await caches.match(OFFLINE_FALLBACK_URL));

					return cachedResponse ?? Response.error();
				}
			})(),
		);
		return;
	}

	const isStaticAssetRequest =
		requestUrl.pathname.startsWith('/assets/') ||
		requestUrl.pathname.startsWith('/icons/') ||
		requestUrl.pathname === '/manifest.json' ||
		requestUrl.pathname === '/favicon.svg';

	if (!isStaticAssetRequest) {
		return;
	}

	event.respondWith(
		(async () => {
			const cachedResponse = await caches.match(event.request);
			const networkResponsePromise = fetch(event.request)
				.then(async (response) => {
					if (response.ok) {
						const cache = await caches.open(RUNTIME_CACHE);
						await cache.put(event.request, response.clone());
					}

					return response;
				})
				.catch(() => null);

			return cachedResponse ?? (await networkResponsePromise) ?? Response.error();
		})(),
	);
});
