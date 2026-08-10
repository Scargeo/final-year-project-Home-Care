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

/**
 * ============================================================
 *  COMPLETE FIX: Bumped to v3 to force full cache invalidation
 *  on all existing clients. Old v1 and v2 caches are deleted
 *  during activate, ensuring API responses always come fresh
 *  from the network.
 * ============================================================
 */
const CACHE_VERSION = 'home-care-pwa-v4'
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

  // Never intercept Next.js dev-mode / HMR requests. The service worker can
  // serve a stale cached JS chunk during hot-reload, which desynchronizes the
  // router and triggers "Router action dispatched before initialization".
  // Bypassing /_next/* (and Vite/Next dev websockets) lets dev reloads work
  // normally while production caching still applies.
  if (requestUrl.pathname.startsWith('/_next/')) return
  if (requestUrl.searchParams.has('__nextImageOptimize')) return

  // CRITICAL: Bypass Next.js App Router client-side navigation payloads (RSC).
  // When navigating client-side, Next.js fetches the React Server Component
  // tree for the target route using special headers (RSC: 1 and
  // Next-Router-State-Tree). These fetches are same-origin GET requests that
  // are neither /_next/*, nor /api/*, nor mode: 'navigate', so they previously
  // fell through to the cache-first static-asset handler. Serving them from a
  // stale cache (or racing the cache) left the app stuck on the loading screen
  // until a full page refresh. Bypassing all RSC/router payload requests lets
  // client-side navigation resolve normally and always fetch fresh.
  if (
    event.request.headers.has('rsc') ||
    event.request.headers.has('next-router-state-tree') ||
    event.request.headers.has('next-url') ||
    requestUrl.searchParams.has('_rsc')
  ) {
    return
  }

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

