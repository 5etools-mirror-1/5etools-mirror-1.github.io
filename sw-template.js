/* eslint-disable no-console */

import { precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst, NetworkFirst, Strategy, StrategyHandler } from "workbox-strategies";
import {ExpirationPlugin} from "workbox-expiration";

import { createCacheKey } from "workbox-precaching/utils/createCacheKey";

/*
this comment will attempt to explain the caching strategy employed by this service worker

at a high level, it strives to enable a good compromise of speed and freshness without surprising behavior

the runtime manifest provides hashes for the files it contains, preventing stale files from being served.

when loaded, the sw will:
	purge any files in the precache that are no longer in the manifest
	fetch any files that are missing from the precache
	purge any files in the runtime cache that have a different revision from the manifest
	purge any images in the external-images cache that have not been recently accessed (7 days)

routes are resolved in descending order.
any file request:
	Is it in the Precache Manifest (essential files: script, html, css, some fonts, most data)?
		serve it from the cache

	Is it in the Runtime Manifest (optional files: images and adventure data)?
		Has it been cached?
			yes: serve it from the cache
			no:	 fetch it from the network and cache it

	Is it a font?
		Is it in the font-cache?
			yes: serve it from the font cache
			no:  fetch it from the network and cache it

	Is it an image (external images)?
		Fetch it from the network, and cache it
		If the fetch fails, serve from the cache

	Default is load from network.
	A file request not caught by any above policy won't be available offline.
*/

// nabbed from https://github.com/GoogleChrome/workbox/blob/0cc6975f17b60d67a71d8b717e73ef7ddb79a891/packages/workbox-core/src/_private/waitUntil.ts#L19-L26
/**
 * wait until an event happens
 * @param {ExtendableEvent} event event to wait until on
 * @param {() => Promise<any>} asyncFn the function to pass to waitUntil
 * @returns {Promise<any>}
 */
function waitUntil (
	event,
	asyncFn,
) {
	const returnPromise = asyncFn();
	event.waitUntil(returnPromise);
	return returnPromise;
}

const offlineAlert = async (url) => {
	console.log(`fetch failure - we are offline, cannot access ${url}`);
	const clients = await self.clients.matchAll({type: "window"});
	let payload = "generic";
	if (/\.(?:png|gif|webm|jpg|webp|jpeg|svg)$/m.test(url)) payload = "image";
	else if (/\.json$/m.test(url)) payload = "json";

	for (const client of clients) {
		client.postMessage({type: "FETCH_ERROR", payload});
	}
};

/*
routes take precedence in order listed. if a higher route and a lower route both match a file, the higher route will resolve it
https://stackoverflow.com/questions/52423473/workbox-routing-registerroute-idempotence
*/

// the self value is replaced with key: value pair of file: hash, to allow workbox to carry files over between caches if they match
precacheAndRoute(self.__WB_PRECACHE_MANIFEST);

class RevisionCacheFirst extends Strategy {
	constructor () {
		super({ cacheName: "runtime-revision" });

		// bind this for activate method
		this.activate = this.activate.bind(this);
		this.cacheRoutes = this.cacheRoutes.bind(this);
		addEventListener("message", (event) => {
			if (event.data.type === "CACHE_ROUTES") event.waitUntil(this.cacheRoutes(event.data, event.source));
		});
	}

	/**
   * @param {Request} request
   * @param {StrategyHandler} handler
   * @returns {Promise<Response | undefined>}
   */
	async _handle (request, handler) {
		/** the full url of the request, https://example.com/slug/ */
		const url = request.url;
		/**
		 * the route of the url, with a query string for the revision
		 *
		 * this way, we can invalidate the cache entry if the revision is wrong
		 */
		const cacheKey = createCacheKey({url, revision: runtimeManifest.get(url)}).cacheKey;

		console.log(`trying to resolve ${url} with key ${cacheKey}`);

		const cacheResponse = await handler.cacheMatch(cacheKey);
		// undefined is returned if we don't have a cache response for the key
		if (cacheResponse !== undefined) return cacheResponse;

		// we need to fetch the request from the network and store it with revision for next time
		console.log(`fetching ${url} over the network for RevisionFirstCache`);
		try {
			const fetchResponse = await handler.fetch(request);
			// no await because it can happen later
			handler.cachePut(cacheKey, fetchResponse.clone());
			return fetchResponse;
		} catch (e) {
			// no await because it can happen later
			offlineAlert(url);
			// empty response, we cant get the file
			return new Response();
		}
	}

	/**
	 * the cache busting portion of the Strategy.
	 * Iterate the cache, and remove anything that is not in the manifest, or from a different revision.
	 *
	 * call this from the activate event
	 *
	 * @param {ExtendableEvent} event
	 * @returns {Promise}
	 */
	activate (event) {
		return waitUntil(event, async () => {
			const cache = await caches.open(this.cacheName);

			const currentCacheKeys = (await cache.keys()).map(request => request.url);
			const validCacheKeys = new Set(Array.from(runtimeManifest).map(([url, revision]) => createCacheKey({url, revision}).cacheKey));

			// queue up all the deletions
			await Promise.allSettled(
				currentCacheKeys.map(async key => {
				// this will happen if a revision is updated or a file is no longer included in the glob
					if (!validCacheKeys.has(key)) {
						// we can save space by deleting this element - it wouldn't be served bc the revision is wrong
						console.log(`deleting ${key} from the cache because its revision does not match`);
						await cache.delete(key);
					}
				}),
			);
		});
	}

	/**
	 *
	 * @param {{payload: {routeRegex: RegExp}}} data the data sent with the request
	 * @param {MessagePort} source the source of the event, to give updates to
	 */
	async cacheRoutes (data, source) {
		const cache = await caches.open(this.cacheName);

		const currentCacheKeys = new Set((await cache.keys()).map(request => request.url));
		const validCacheKeys = Array.from(runtimeManifest).map(([url, revision]) => createCacheKey({url, revision}).cacheKey);

		/**
		 * These are the keys which have not been cached yet, and are able to be matched against
		 */
		const uncachedKeys = validCacheKeys.filter((key) => !currentCacheKeys.has(key));

		const routeRegex = data.payload.routeRegex;

		const routesToCache = uncachedKeys.filter((key) => routeRegex.test(key));

		const fetchTotal = routesToCache.length;
		let fetched = 0;

		const postProgress = async () => {
			source.postMessage({type: "CACHE_ROUTES_PROGRESS", payload: {fetched, fetchTotal}});
		};

		await postProgress();

		/**
		 * The number of fetches to run at the same time
		 */
		const concurrentFetches = 5;

		const fetchPromise = async () => {
			while (true) {
				// each instance of this function will keep popping urls off the array until there are none left
				const url = routesToCache.pop();
				if (url === undefined) return;

				// this regex is a very bad idea, but it trims the cache version off the url
				const cleanUrl = url.replace(/\?__WB_REVISION__=\w+$/m, "");
				const response = await fetch(cleanUrl);
				await cache.put(url, response);
				fetched++;
				postProgress();
			}
		};

		const fetchPromises = [];

		console.time(`concurrent fetching with up to ${concurrentFetches} fetches open at once`);

		for (let i = 0; i < concurrentFetches; i++) {
			fetchPromises.push(fetchPromise());
		}

		await Promise.allSettled(fetchPromises);

		console.timeEnd(`concurrent fetching with up to ${concurrentFetches} fetches open at once`);
	}
}

/**
 * Map([url, revision])
 *
 * __WB_RUNTIME_MANIFEST is injected as [route, revision] array, mapped into [url, revision], and constructed as map
 */
const runtimeManifest = new Map(self.__WB_RUNTIME_MANIFEST.map(
	([
		route,
		revision,
	]) =>
		[
			`${self.location.origin}/${route}`,
			revision,
		],
));

const revisionCacheFirst = new RevisionCacheFirst();

registerRoute(
	({request}) => runtimeManifest.has(request.url),
	revisionCacheFirst,
);

// purge the old entries from cache
addEventListener("activate", revisionCacheFirst.activate);

/*
this tells workbox to cache fonts, and serve them cache first after first load
this works on the assumption that fonts are static assets and won't change
 */
registerRoute(({request}) => request.destination === "font", new CacheFirst({
	cacheName: "font-cache",
}));

/*
the base case route - for images that have fallen through every other route
this is external images, for homebrew as an example
*/
registerRoute(({request}) => request.destination === "image", new NetworkFirst({
	cacheName: "external-image-cache",
	plugins: [
		// this is a safeguard against an utterly massive cache - these numbers may need tweaking
		new ExpirationPlugin({maxAgeSeconds: 7 /* days */ * 24 * 60 * 60, maxEntries: 100, purgeOnQuotaError: true}),
	],
}));

addEventListener("install", () => {
	self.skipWaiting();
});

// this only serves to delete cache from old versions of page - pre sw rework
addEventListener("activate", event => {
	event.waitUntil((async () => {
		const cacheNames = await caches.keys();
		for (const cacheName of cacheNames) {
			if (/\d+\.\d+\.\d+/.test(cacheName)) {
				await caches.delete(cacheName);
				console.log(`deleted cache: ${cacheName} because it is from old service worker`);
			}
		}
	})());
});
