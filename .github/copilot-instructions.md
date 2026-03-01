# Copilot Instructions for TempPhoto

## Service Worker Cache

**Whenever you modify any file that is cached by the service worker** (`index.html`, `styles.css`, `app.js`, `manifest.json`), you **must** bump `CACHE_VERSION` in `service-worker.js`.

Use the current date plus a sequence number: `"YYYYMMDD-N"` (e.g. `"20260301-1"`, `"20260301-2"`).

```js
// service-worker.js
const CACHE_VERSION = "YYYYMMDD-N"  // ← update this on every deploy
```

Failing to bump the cache version means users with a cached PWA will continue to receive stale assets after the update is deployed.
