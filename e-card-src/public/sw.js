/*
 * Eカードのサービスワーカー。目的はオフライン起動（地下鉄などの圏外でも遊べること）。
 * - index.html などはネットワーク優先。圏外のときだけキャッシュを返すので、公開した更新はすぐ反映される
 * - assets/ 配下はファイル名にハッシュが付いた不変ファイルなのでキャッシュ優先
 * - インストール時に index.html が参照するファイルを先読みし、初回訪問の直後からオフラインで動くようにする
 */
const CACHE = 'ecard-v1'
const SCOPE = self.registration.scope

/** index.html から参照されているファイルの URL を取り出す */
function referencedUrls(html) {
  const urls = new Set()
  for (const m of html.matchAll(/(?:src|href)="(\.\/[^"]+)"/g)) {
    urls.add(new URL(m[1], SCOPE).href)
  }
  return [...urls]
}

/** 現在の index.html から参照されなくなった古い assets/ を捨てる */
async function prune(cache, keep) {
  const keepSet = new Set(keep)
  for (const req of await cache.keys()) {
    if (req.url.includes('/assets/') && !keepSet.has(req.url)) await cache.delete(req)
  }
}

async function precache() {
  const cache = await caches.open(CACHE)
  const res = await fetch(SCOPE, { cache: 'no-cache' })
  if (!res.ok) return
  const html = await res.clone().text()
  await cache.put(SCOPE, res)
  const urls = referencedUrls(html)
  await Promise.all(urls.map((u) => cache.add(u).catch(() => {})))
  await prune(cache, urls)
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().catch(() => {}))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(names.filter((n) => n.startsWith('ecard-') && n !== CACHE).map((n) => caches.delete(n)))
      await self.clients.claim()
    })(),
  )
})

async function cacheFirst(request) {
  const cache = await caches.open(CACHE)
  const hit = await cache.match(request)
  if (hit) return hit
  const res = await fetch(request)
  if (res.ok) cache.put(request, res.clone()).catch(() => {})
  return res
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE)
  try {
    const res = await fetch(request)
    if (res.ok) {
      cache.put(request, res.clone()).catch(() => {})
      if (request.mode === 'navigate') {
        // 新しい index.html を取れたら、参照されなくなった古いビルドの assets/ を掃除する
        res
          .clone()
          .text()
          .then((html) => prune(cache, referencedUrls(html)))
          .catch(() => {})
      }
    }
    return res
  } catch (err) {
    const hit = (await cache.match(request)) || (request.mode === 'navigate' ? await cache.match(SCOPE) : undefined)
    if (hit) return hit
    throw err
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  // このアプリの配下（scope）だけを扱う。同じドメインの他ページには触れない
  if (!request.url.startsWith(SCOPE)) return
  event.respondWith(request.url.includes('/assets/') ? cacheFirst(request) : networkFirst(request))
})
