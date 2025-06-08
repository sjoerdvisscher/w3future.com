const PRECACHE = "precache-v1";
const RUNTIME = "runtime";

// A list of local resources we always want to be cached.
const PRECACHE_URLS = [
  "index.html",
  "main.mjs",
  "note.mjs",
  "style.css",
  "../WebMIDIAPI.js",
  "https://cdn.glitch.com/d4395f6d-f5a9-4c72-baaf-d540b05e361d%2Frhodes.mp3?1515162947197"
];

// The install handler takes care of precaching the resources we always need.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(self.skipWaiting())
  );
});


// The activate handler takes care of cleaning up old caches.
self.addEventListener('activate', event => {
  const currentCaches = [PRECACHE, RUNTIME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return cacheNames.filter(cacheName => !currentCaches.includes(cacheName));
    }).then(cachesToDelete => {
      return Promise.all(cachesToDelete.map(cacheToDelete => {
        return caches.delete(cacheToDelete);
      }));
    }).then(() => self.clients.claim())
  );
});

function stripQueryStringAndHashFromPath(url) {
  return url.split("?")[0].split("#")[0];
}

// The fetch handler serves responses for same-origin resources from a cache.
// If no response is found, it populates the runtime cache with the response
// from the network before returning it to the page.
self.addEventListener('fetch', event => {
  const requestUrl = event.request.url.indexOf('sjoerdvisscher') != -1 ? stripQueryStringAndHashFromPath(event.request.url.replace(/^.*\/\/[^\/]+/, '')) : event.request.url;
  var req = new Request(requestUrl, requestUrl.indexOf('google') != -1 ? { mode: 'no-cors' } : {});
  event.respondWith(
    caches.match(req).then(cachedResponse => {
      return caches.open(RUNTIME).then(cache => {
        return fetch(req).then(response => {
          // Put a copy of the response in the runtime cache.
          return cache.put(req, response.clone()).then(() => {
            return response;
          });
        }).catch(() => {
          if (cachedResponse) {
            return cachedResponse;
          }
        });
      });
    })
  );
});