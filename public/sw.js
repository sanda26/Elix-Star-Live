// Service Worker for Push Notifications
// File: public/sw.js

const CACHE_NAME = 'elix-star-live-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/pwa-192x192.svg',
  '/pwa-512x512.svg',
  '/Icons/bottombar.png',
];

// Install service worker and cache assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

// Activate service worker and clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// HTML/app shell: network first so new deploys are not stuck on old JS (e.g. old bottom nav).
// Other GET: cache first, then network (offline-friendly).
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') {
    return;
  }
  const accept = req.headers.get('accept') || '';
  const isNavigate = req.mode === 'navigate';
  const isDocument = accept.includes('text/html');

  if (isNavigate || isDocument) {
    event.respondWith(
      fetch(req)
        .then((response) => response)
        .catch(() =>
          caches.match(req).then((r) => r || caches.match('/index.html'))
        )
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((response) => response || fetch(req))
  );
});

// Handle push notifications
self.addEventListener('push', (event) => {
  const options = {
    body: event.data?.text(),
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Explore',
        icon: '/images/checkmark.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/images/xmark.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Elix Star Live', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'explore') {
    // Open the app to specific content
    event.waitUntil(
      self.clients.openWindow('/')
    );
  } else if (event.action === 'close') {
    // Just close the notification
    return;
  } else {
    // Default: open the app
    event.waitUntil(
      self.clients.openWindow('/')
    );
  }
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  // Log notification close for analytics
  console.log('Notification closed:', event.notification);
});