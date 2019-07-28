# Differential bundle loading POC
> Using service workers and a version-aware server to reduce network data transfer of slightly-different application bundles.

Proof of concept only, to solve an unconfirmed problem. Would require significant benefit analysis, development, and proving, before being suitable for production use. It might not be a good idea.


## Motivation
**Continuous delivery (CD).** When we deploy updated application bundles, our users incur a network transfer cost of downloading them. This happens more often when doing CD. It's wasteful because only a fraction of bundle content typically changes each time.

**Micro frontends with libraries.** Allowing each sub-application to use their own version of a given library avoids coupling; each one can upgrade to a newer version as and when they want to. Using multiple versions however incurs a network transfer cost, for files that are very similar to each other.


## How it works
Normally when a browser doesn't have a file it needs already cached, it downloads it in full.

Often however, we have an older, very similar, version of the same file already cached. Instead of requesting the full file, we request only the differences (delta) compared to the cached file - a much smaller amount of data to transfer. We then apply these differences to the cached file, which gives us the full updated content - just as if we'd downloaded the file in full. That content is then cached so it can be served immediately when next required.

The existing pattern of service worker driven caching is extended to be aware of resources' versions, and paired with a smart web server that's also version-aware.

Correctness is verified by the server test-applying the deltas it generates, and the service worker checking the final content against an expected hash (checksum) sent by the server.


## Gains
Consider the scenario of upgrading `react-dom` from version 16.8.0 to 16.8.1. These are the network transfer sizes in KB.

<pre>
            Uncompressed    gzip   brotli
Complete           104.7    41.4     33.1
Delta               33.6     2.5      1.5
</pre>

There are overheads in calculating the delta on the server, and in applying it on the client. I haven't measured or optimised either. The former could probably be eliminated using output caching. The latter could make the entire approach yield a net negative time-wise, depending on network quality and device performance. Setting a maximum patch size would probably be wise.


## Example differential fetch
Request made by the service worker, and response received.

<pre>
curl http://localhost/react-dom/<strong>16.8.1</strong>/react-dom.production.min.js -I \
  -H 'Accept-Encoding: gzip' \
  <strong>-H 'Accept: application/delta+json'</strong> \
  <strong>-H 'x-differential-base-version: 16.8.0'</strong>

HTTP/1.1 200 OK
Cache-Control: public, max-age=31536000
Vary: Accept, x-differential-base-version, Accept-Encoding
<strong>x-differential-target-checksum: b45b7f77871a78d00ac134ff65d209c08361703853e57eacfd46c5a0b6bf26ee</strong>
<strong>x-differential-base-version: 16.8.0</strong>
Content-Type: application/delta+json; charset=utf-8
Content-Length: 34434
</pre>


## Demo
Take a look in devtools at the console, Network tab, and Cache Storage on the Application tab, while following the below.

1. `npm install`
1. `npm run server`
1. Open http://localhost
1. Reload the page; observe requests served from cache
1. Increment the patch version of the `react-dom` script tag in `static/index.html`
1. Reload the page, observe differential request & response
1. Reload the page, observe requests served from cache


## Prior art
1. [The HTTP Distribution and Replication Protocol](https://www.w3.org/TR/NOTE-drp-19970825), 1997. Section 2.5: Differential Downloads.
1. [RFC 3229: Delta encoding in HTTP](https://tools.ietf.org/html/rfc3229), 2002. No implementations.
