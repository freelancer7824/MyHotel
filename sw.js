// sw.js - Service Worker for offline support
const CACHE_NAME = 'hisab-v1';
const ASSETS = [
  '/',
  '/index.html',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js'
];

// Install event - cache assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
    .then(cache => {
      console.log('Caching assets...');
      return cache.addAll(ASSETS);
    })
    .then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
        .map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache if offline
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
    .then(response => {
      // Return cached response if found
      if (response) {
        return response;
      }
      // Otherwise fetch from network
      return fetch(event.request)
        .then(response => {
          // Cache the fetched response for future offline use
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseClone);
            });
          return response;
        })
        .catch(() => {
          // If both cache and network fail, return a fallback
          return new Response('Offline - Please check your connection', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
    })
  );
});

// Background sync for pending operations
self.addEventListener('sync', event => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  // This will be called when the browser is online
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_TRIGGERED' });
  });
}

// Handle messages from the main page
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'REGISTER_SYNC') {
    self.registration.sync.register('sync-data')
      .then(() => console.log('Sync registered'))
      .catch(err => console.log('Sync registration failed:', err));
  }
});