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
    console.log('Serving cached:', request.url);
    return cachedResponse;
  }

  const differentialResponse = await tryDifferential(request);
  if (differentialResponse) {
    console.log('Serving differentialed:', request.url);
    addToCache(request, differentialResponse);
    return differentialResponse.clone();
  }

  console.log('Serving from network; will cache:', request.url);
  const fetchedResponse = await fetchOk(request);
  addToCache(request, fetchedResponse);
  return fetchedResponse.clone();
}

function addToCache(request, response) {
  caches.open(CACHE_NAME)
    .then(cache => cache.put(request, response.clone()));
}

async function tryDifferential(request) {
  const package = parsePackageUrl(request.url);
  const cachedDifferentVersion = await findCachedDifferentVersion(package);

  if (!cachedDifferentVersion) {
    console.log('No cached different version present');
    return;
  }

  return fetchDifferential(request, package, cachedDifferentVersion);
}

async function findCachedDifferentVersion(package) {
  const cache = await caches.open(CACHE_NAME);
  const cachedRequests = await cache.keys();

  for (let candidateRequest of cachedRequests) {
    const candidatePackage = parsePackageUrl(candidateRequest.url);

    if (candidatePackage.name === package.name && candidatePackage.file === package.file) {
      return candidatePackage;
    }
  }
}

async function fetchDifferential(request, package, cachedPackage) {
  const deltaResponse = await fetchOk(package.url, {
    headers: {
      Accept: 'application/delta+json',
      'x-differential-base-version': cachedPackage.version,
    },
  });

  const cachedResponse = await caches.match(cachedPackage.url, { ignoreVary: true });
  const cachedContent = await cachedResponse.text();
  const delta = await deltaResponse.json();

  const updatedContent = applyDelta(delta, cachedContent);
  const checksum = await sha256(updatedContent);

  if (checksum !== deltaResponse.headers.get('x-differential-target-checksum')) {
    throw new Error('Applying delta did not yield expected checksum. Actual: ' + checksum);
  }

  return new Response(updatedContent);
}

function parsePackageUrl(url) {
  const path = new URL(url).pathname;
  const [, name, version, file] = path.match(/\/([^/]+)\/([^/]+)\/(.+)/);

  return { name, version, file, url };
}

function fetchOk(...args) {
  return fetch(...args).then(response => response.ok ? response : Promise.reject(response));
}

// Duplicated in deltaUtil.js
function applyDelta(delta, str) {
  // From https://github.com/kpdecker/jsdiff/issues/95#issuecomment-218429097

  var result = str;
  var pos = 0;
  for (var i = 0; i < delta.length; i++) {
    if (delta[i].added) {
      result = insertAt(result, pos, delta[i].value);
      pos += delta[i].count;
    }
    else if (delta[i].removed) {
      result = removeAt(result, pos, delta[i].count);
    } else {
      pos += delta[i].count;
    }
  }
  return result;
}

function insertAt(str, index, add) {
  return [str.slice(0, index), add, str.slice(index)].join('');
}

function removeAt(str, index, count) {
  return str.slice(0, index) + str.slice(index + count);
}

async function sha256(message) {
  // From https://stackoverflow.com/a/48161723/1373514
  // & https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest

  // encode as UTF-8
  const msgBuffer = new TextEncoder('utf-8').encode(message);

  // hash the message
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);

  // convert ArrayBuffer to Array
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  // convert bytes to hex string
  const hashHex = hashArray.map(b => ('00' + b.toString(16)).slice(-2)).join('');
  return hashHex;
}
