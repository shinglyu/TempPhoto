// Dynamic cache versioning - update this timestamp when deploying
const CACHE_VERSION = "20250611-1"
const CACHE_NAME = `expiring-photos-v${CACHE_VERSION}`;
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './manifest.json'
];

self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker with cache:', CACHE_NAME);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching assets');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => {
                console.log('[SW] Skip waiting to activate immediately');
                return self.skipWaiting();
            })
    );
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && cacheName.startsWith('expiring-photos-v')) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[SW] Claiming clients');
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', (event) => {
    // Cache-first strategy for better performance
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    // Serve from cache immediately (fast!)
                    console.log('[SW] Serving from cache:', event.request.url);
                    
                    // For HTML files, also check for updates in background
                    if (event.request.destination === 'document' || 
                        event.request.url.endsWith('.html') ||
                        event.request.url.endsWith('/')) {
                        
                        // Background fetch to update cache
                        fetch(event.request)
                            .then((networkResponse) => {
                                if (networkResponse && networkResponse.status === 200) {
                                    const responseClone = networkResponse.clone();
                                    caches.open(CACHE_NAME)
                                        .then((cache) => {
                                            cache.put(event.request, responseClone);
                                        });
                                }
                            })
                            .catch(() => {
                                // Network failed, but we already have cached version
                                console.log('[SW] Background update failed, using cached version');
                            });
                    }
                    
                    return cachedResponse;
                }
                
                // Not in cache, fetch from network
                console.log('[SW] Fetching from network:', event.request.url);
                return fetch(event.request)
                    .then((networkResponse) => {
                        // Cache successful responses
                        if (networkResponse && networkResponse.status === 200) {
                            const responseClone = networkResponse.clone();
                            caches.open(CACHE_NAME)
                                .then((cache) => {
                                    cache.put(event.request, responseClone);
                                });
                        }
                        return networkResponse;
                    });
            })
    );
});

// Listen for messages from the app
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'CHECK_UPDATE') {
        console.log('[SW] Checking for updates...');
        checkForUpdates().then((hasUpdate) => {
            event.ports[0].postMessage({ hasUpdate });
        });
    }
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('[SW] Skip waiting requested');
        self.skipWaiting();
    }
});

async function checkForUpdates() {
    try {
        // Check if there's a new service worker waiting
        const registration = await self.registration;
        if (registration.waiting) {
            console.log('[SW] Update available (waiting worker exists)');
            return true;
        }
        
        // Force check for new service worker
        await registration.update();
        
        if (registration.waiting) {
            console.log('[SW] Update available after update check');
            return true;
        }
        
        console.log('[SW] No updates available');
        return false;
    } catch (error) {
        console.error('[SW] Error checking for updates:', error);
        return false;
    }
}
