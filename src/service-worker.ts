/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

declare let self: ServiceWorkerGlobalScope;

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE_NAME = `high-society-cache-${version}`;

// Files to cache immediately
const ASSETS = [
	...build, // app-built files
	...files  // static files
];

// Install event - cache assets
sw.addEventListener('install', (event) => {
	async function addFilesToCache() {
		const cache = await caches.open(CACHE_NAME);
		await cache.addAll(ASSETS);
	}

	event.waitUntil(addFilesToCache());
});

// Activate event - clean up old caches
sw.addEventListener('activate', (event) => {
	async function deleteOldCaches() {
		const cacheNames = await caches.keys();
		await Promise.all(
			cacheNames.map(cacheName => {
				if (cacheName !== CACHE_NAME) {
					return caches.delete(cacheName);
				}
			})
		);
	}

	event.waitUntil(deleteOldCaches());
	// Take control of all pages immediately
	return sw.clients.claim();
});

// Fetch event - serve from cache, fallback to network
sw.addEventListener('fetch', (event) => {
	// Only handle GET requests
	if (event.request.method !== 'GET') return;

	async function respond() {
		const url = new URL(event.request.url);
		const cache = await caches.open(CACHE_NAME);

		// Try to serve from cache first
		const cachedResponse = await cache.match(event.request);
		if (cachedResponse) {
			return cachedResponse;
		}

		// If not in cache, fetch from network
		try {
			const response = await fetch(event.request);
			
			// Cache successful responses
			if (response.status === 200) {
				cache.put(event.request, response.clone());
			}
			
			return response;
		} catch (error) {
			// Network failed, and not in cache
			return new Response('Network error happened', {
				status: 408,
				headers: { 'Content-Type': 'text/plain' }
			});
		}
	}

	event.respondWith(respond());
});

// Listen for messages from the client
sw.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'SKIP_WAITING') {
		sw.skipWaiting();
	}
});
