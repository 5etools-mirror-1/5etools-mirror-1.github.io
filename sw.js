/**
 * Dbgging notes:
 *   - **CTRL+F5 is unreliable**
 *   - spam "Clear Site Data" in DevTools
 *   - use "update on reload" in Service Workers DevTools section
 *   - sanity-check code to ensure it has updated
 */

"use strict";

importScripts("./js/sw-files.js");

const cacheName = /* 5ETOOLS_VERSION__OPEN */"1.141.1"/* 5ETOOLS_VERSION__CLOSE */;
const cacheableFilenames = new Set(filesToCache);

let isCacheRunning;

function getPath (urlOrPath) {
	// Add a fake domain name to allow proper URL conversion
	if (urlOrPath.startsWith("/")) urlOrPath = `https://5e.com${urlOrPath}`;
	return (new URL(urlOrPath)).pathname;
}

/** Estimate a reasonable cache timeout depending on file type. */
function getCacheTimeout (url) {
	const ext = url.toLowerCase().trim().split(".").slice(-1)[0];
	switch (ext) {
		case "mp3":
		case "png":
		case "jpg":
		case "jpeg":
		case "webp":
		case "svg":
		case "gif":
			return 15 * 1000;
		case "html":
		case "webmanifest":
		case "tff":
		case "eot":
		case "woff":
		case "woff2":
			return 3 * 1000;
		case "json":
		case "css":
		case "js":
			return 7.5 * 1000;
		default:
			return 7.5 * 1000;
	}
}

// Installing Service Worker
self.addEventListener("install", () => {
	self.skipWaiting();
});

self.addEventListener("activate", e => {
	clients.claim();

	// Remove any outdated caches
	e.waitUntil((async () => {
		const cacheNames = await caches.keys();
		await Promise.all(cacheNames.filter(name => name !== cacheName).map(name => caches.delete(name)));
	})());
});

async function pGetOrCache (url) {
	const path = getPath(url);

	let retryCount = 2;
	while (true) {
		let response;
		try {
			const controller = new AbortController();
			setTimeout(() => controller.abort(), getCacheTimeout(url));
			response = await fetch(url, {signal: controller.signal});
		} catch (e) {
			if (--retryCount) continue;
			console.error(e, url);
			break;
		}
		const cache = await caches.open(cacheName);
		// throttle this with `await` to ensure Firefox doesn't die under load
		await cache.put(path, response.clone());
		return response;
	}

	// If the request fails, try to respond with a cached copy
	console.log(`Returning cached copy of ${url} (if it exists)`);
	return caches.match(path);
}

async function pDelay (msecs) {
	return new Promise(resolve => setTimeout(() => resolve(), msecs));
}

// All data loading (JSON, images, etc) passes through here when the service worker is active
self.addEventListener("fetch", e => {
	const url = e.request.url;
	const path = getPath(url);

	if (!cacheableFilenames.has(path)) return e.respondWith(fetch(e.request));

	e.respondWith(pGetOrCache(url));
});

self.addEventListener("message", async evt => {
	const send = (msgOut) => evt.ports[0].postMessage(msgOut);

	const msg = evt.data;
	switch (msg.type) {
		case "cache-cancel":
			isCacheRunning = false;
			break;
		case "cache-start": {
			isCacheRunning = true;
			for (let i = 0; i < filesToCache.length; ++i) {
				if (!isCacheRunning) return send({type: "download-cancelled"});
				try {
					// Wrap this in a second timeout, because the internal abort controller doesn't work(?)
					const raceResult = await Promise.race([
						pGetOrCache(filesToCache[i]),
						pDelay(getCacheTimeout(filesToCache[i])),
					]);
					if (raceResult == null) return send({type: "download-error", message: `Failed to cache "${filesToCache[i]}"`});
				} catch (e) {
					console.error(e, filesToCache[i]);
					debugger
					return send({type: "download-error", message: ((e.stack || "").trim()) || e.name});
				}
				if (!isCacheRunning) return send({type: "download-cancelled"});
				if (i % 50) send({type: "download-progress", data: {pct: `${((i / filesToCache.length) * 100).toFixed(2)}%`}});
			}
			send({type: "download-progress", data: {pct: `100%`}});
			break;
		}
	}
});
