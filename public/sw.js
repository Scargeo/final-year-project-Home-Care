/**
 * ============================================================
 *  FIXED: PWA Service Worker
 *  -------------------------------------------
 *  ROOT CAUSE OF POSTS VANISHING AFTER REFRESH:
 *  The old service worker used "cache-first" for all GET
 *  requests, including /api/posts. This meant the browser
 *  served a stale cached response instead of fetching fresh
 *  data from the server. New posts existed in MongoDB but
 *  the UI never saw them because the cached API response
 *  was always returned first.
 *  -------------------------------------------
 *  FIX: API routes (/api/*) now use "network-first"
 *  strategy so the latest data is always fetched from the
 *  server. Only navigation pages and static assets use
 *  "cache-first" for offline support.
 * ============================================================
 */

const CACHE_VERSION = 'home-care-pwa-v2'
const PRECACHE = `${CACHE_VERSION}-precache`
const RUNTIME = `${CACHE_VERSION}-runtime`

const PRECACHE_URLS = [
  '/',
  '/login',
  '/signup',
  '/doctor-signup',
  '/secure/home',
  '/secure/notifications',
  '/secure/emergency',
  '/manifest.webmanifest',
  '/favicon.svg',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key !== PRECACHE && key !== RUNTIME)
        .map((key) => caches.delete(key)),
    )).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  // Only intercept GET requests
  if (event.request.method !== 'GET') return

  const requestUrl = new URL(event.request.url)
  const isNavigation = event.request.mode === 'navigate'
  const isApiRequest = requestUrl.pathname.startsWith('/api/')

  /**
   * ============================================================
   *  API REQUESTS (/api/*) — NETWORK-FIRST STRATEGY
   *  -------------------------------------------
   *  For API calls (like /api/posts), always try the network
   *  first so the user sees the latest data (new posts,
   *  updated comments, etc.). Only fall back to cache when
   *  offline.
   * ============================================================
   */
  if (isApiRequest) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache the fresh response for offline use
          const clone = response.clone()
          caches.open(RUNTIME).then((cache) => cache.put(event.request, clone)).catch(() => {})
          return response
        })
        .catch(async () => {
          // Offline: serve from cache
          const cached = await caches.match(event.request)
          return cached || new Response(JSON.stringify({ message: 'Offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          })
        }),
    )
    return
  }

  /**
   * ============================================================
   *  NAVIGATION REQUESTS (HTML pages) — NETWORK-FIRST WITH
   *  CACHE FALLBACK
   *  -------------------------------------------
   *  Try network first for pages so deleted content shows
   *  immediately. Fall back to cache if offline.
   * ============================================================
   */
  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone()
          caches.open(RUNTIME).then((cache) => cache.put(event.request, clone)).catch(() => {})
          return response
        })
        .catch(async () => {
          const cached = await caches.match(event.request)
          return cached || caches.match('/')
        }),
    )
    return
  }

  /**
   * ============================================================
   *  STATIC ASSETS (JS, CSS, images from same origin) —
   *  CACHE-FIRST STRATEGY
   *  -------------------------------------------
   *  These rarely change between builds, so cache-first is
   *  fine and improves load speed.
   * ============================================================
   */
  if (requestUrl.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached
        return fetch(event.request).then((response) => {
          const clone = response.clone()
          caches.open(RUNTIME).then((cache) => cache.put(event.request, clone)).catch(() => {})
          return response
        })
      }),
    )
  }
})

