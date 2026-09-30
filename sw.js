"use strict";

/*
 * BudgetFlow service worker
 * Menyimpan aplikasi di perangkat agar bisa dipakai offline.
 * Ubah nomor versi CACHE setiap kali file aplikasi diperbarui.
 */

const CACHE = "budgetflow-v2";

const CORE = [
    "./",
    "index.html",
    "style.css",
    "app.js",
    "manifest.webmanifest",
    "apple-touch-icon.png",
    "icon-192.png",
    "icon-512.png",
    "icon-maskable-512.png"
];

const EXTERNAL = [
    "https://unpkg.com/lucide@1.48.0/dist/umd/lucide.min.js"
];

self.addEventListener("install", event => {

    event.waitUntil((async () => {

        const cache = await caches.open(CACHE);

        await cache.addAll(CORE);

        await Promise.all(
            EXTERNAL.map(url =>
                cache
                    .add(new Request(url, { mode: "no-cors" }))
                    .catch(() => {})
            )
        );

        await self.skipWaiting();

    })());

});

self.addEventListener("activate", event => {

    event.waitUntil((async () => {

        const keys = await caches.keys();

        await Promise.all(
            keys
                .filter(key => key !== CACHE)
                .map(key => caches.delete(key))
        );

        await self.clients.claim();

    })());

});

self.addEventListener("fetch", event => {

    const request = event.request;

    if (request.method !== "GET") return;

    if (!/^https?:$/.test(new URL(request.url).protocol)) return;

    if (request.mode === "navigate") {

        event.respondWith(networkFirst(request));

        return;

    }

    event.respondWith(staleWhileRevalidate(request));

});

async function networkFirst(request) {

    const cache = await caches.open(CACHE);

    try {

        const response = await fetch(request);

        if (response.ok) {
            cache.put(request, response.clone());
        }

        return response;

    } catch (error) {

        return (
            (await cache.match(request, { ignoreSearch: true })) ||
            (await cache.match("index.html")) ||
            (await cache.match("./"))
        );

    }

}

async function staleWhileRevalidate(request) {

    const cache = await caches.open(CACHE);

    const cached = await cache.match(request);

    const network = fetch(request)
        .then(response => {

            if (response && (response.ok || response.type === "opaque")) {
                cache.put(request, response.clone());
            }

            return response;

        })
        .catch(() => cached);

    return cached || network;

}