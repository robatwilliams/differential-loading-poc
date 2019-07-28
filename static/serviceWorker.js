const CACHE_NAME = 'v1';

// Activate new version immediately
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('fetch', event => {
  if (event.request.destination !== 'script') {
    return;
  }

  event.respondWith(handleFetch(event));
});

async function handleFetch({ request }) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  const fetchedResponse = await fetchOk(request);
  caches.open(CACHE_NAME)
    .then(cache => cache.put(request, fetchedResponse.clone()));

  return fetchedResponse.clone();
}

function fetchOk(...args) {
  return fetch(...args).then(response => response.ok ? response : Promise.reject(response));
}
