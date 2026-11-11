/* The app's service worker (UXI-5). swPlugin.ts writes `self.MANIFEST` above this line at
 * build time: this build's file names, sorted into what to keep at once, what to keep once
 * opened, and which topic files make up each subject.
 *
 * Three caches:
 *   assets  every fingerprinted file under /assets/. A name changes when its contents do, so
 *           a cached file is never out of date; a deploy only leaves files nobody asks for,
 *           and those are deleted when the new worker takes over.
 *   page    the app's one HTML page, refreshed from the network on every visit with a signal
 *           and used when there is none.
 *   meta    which subjects the student saved for offline, so a deploy that changes one of
 *           their topics fetches the new file too.
 *
 * Only this site's own requests are handled. Sign-in and progress go to Supabase directly,
 * and the Google fonts are left to the browser's own cache, falling back to the system font.
 */
const M = self.MANIFEST
const ASSETS = 'assets'
const PAGE = 'page'
const META = 'meta'
const BUILD = new Set(M.build)
/** Files outside /assets/ that the page asks for and that have no fingerprint. */
const STATIC = new Set(['/manifest.webmanifest', '/favicon.svg', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'])
/** How long a page request waits for the network before the saved page is shown instead. */
const PAGE_WAIT_MS = 4000

/** Fetches into `cache` whichever of `paths` it does not hold yet, a few at a time. */
async function fill(cache, paths, onEach) {
  const have = new Set((await cache.keys()).map((r) => new URL(r.url).pathname))
  const need = paths.filter((p) => !have.has(p))
  let done = paths.length - need.length
  if (onEach) onEach(done)
  for (let i = 0; i < need.length; i += 6) {
    await Promise.all(need.slice(i, i + 6).map(async (p) => {
      const res = await fetch(p)
      if (res.ok) await cache.put(p, res)
      done++
    }))
    if (onEach) onEach(done)
  }
}

async function savedSubjects() {
  const hit = await (await caches.open(META)).match('/__saved')
  return hit ? await hit.json() : { subjects: [], extras: false }
}

async function setSaved(saved) {
  await (await caches.open(META)).put('/__saved', new Response(JSON.stringify(saved), { headers: { 'content-type': 'application/json' } }))
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const assets = await caches.open(ASSETS)
    await fill(assets, [...M.precache, ...STATIC])
    // This build's page, so the first visit without a signal opens the same build as its code.
    const page = await fetch('/', { cache: 'reload' })
    if (page.ok) await (await caches.open(PAGE)).put('/', page)
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (![ASSETS, PAGE, META].includes(name)) await caches.delete(name)
    const assets = await caches.open(ASSETS)
    for (const req of await assets.keys()) {
      const path = new URL(req.url).pathname
      if (!BUILD.has(path) && !STATIC.has(path)) await assets.delete(req)
    }
    await self.clients.claim()
    // A deploy that changed a topic renamed its file: fetch the new one for a saved subject.
    const saved = await savedSubjects()
    try {
      await fill(assets, [...saved.subjects.flatMap((s) => M.subjects[s] ?? []), ...(saved.extras ? M.extras : [])])
    } catch {
      // No signal: the subject reads as partly saved on Settings until it is saved again.
    }
  })())
})

async function fromCache(request) {
  const path = new URL(request.url).pathname
  const assets = await caches.open(ASSETS)
  const hit = await assets.match(path)
  if (hit) return hit
  const res = await fetch(request)
  if (res.ok && (BUILD.has(path) || STATIC.has(path))) await assets.put(path, res.clone())
  return res
}

async function pageRequest(request) {
  const page = await caches.open(PAGE)
  const network = fetch(request).then(async (res) => {
    if (res.ok && (res.headers.get('content-type') ?? '').includes('text/html')) await page.put('/', res.clone())
    return res
  })
  const saved = await page.match('/')
  if (!saved) return network
  // A slow signal is worse than none: after a few seconds the saved page is shown, and the
  // network copy, when it comes, still replaces it for next time.
  const timeout = new Promise((resolve) => setTimeout(() => resolve(saved), PAGE_WAIT_MS))
  return Promise.race([network.catch(() => saved), timeout])
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (request.mode === 'navigate') event.respondWith(pageRequest(request))
  else if (url.pathname.startsWith('/assets/') || STATIC.has(url.pathname)) event.respondWith(fromCache(request))
})

/** How much of each subject, and of the search text, is on the device. */
async function status() {
  const have = new Set((await (await caches.open(ASSETS)).keys()).map((r) => new URL(r.url).pathname))
  const subjects = {}
  for (const [id, paths] of Object.entries(M.subjects)) subjects[id] = { saved: paths.filter((p) => have.has(p)).length, total: paths.length }
  const saved = await savedSubjects()
  return { type: 'status', version: M.version, subjects, extras: M.extras.every((p) => have.has(p)), chosen: saved.subjects }
}

self.addEventListener('message', (event) => {
  const data = event.data ?? {}
  const reply = (msg) => event.source && event.source.postMessage(msg)
  if (data.type === 'status') {
    event.waitUntil(status().then(reply))
  } else if (data.type === 'save') {
    event.waitUntil((async () => {
      const wanted = (data.subjects ?? []).filter((s) => M.subjects[s])
      const saved = await savedSubjects()
      await setSaved({ subjects: [...new Set([...saved.subjects, ...wanted])], extras: saved.extras || Boolean(data.extras) })
      const paths = [...wanted.flatMap((s) => M.subjects[s]), ...(data.extras ? M.extras : [])]
      try {
        await fill(await caches.open(ASSETS), paths, (done) => reply({ type: 'progress', done, total: paths.length }))
        reply(await status())
      } catch {
        reply({ type: 'failed' })
        reply(await status())
      }
    })())
  } else if (data.type === 'forget') {
    event.waitUntil((async () => {
      const assets = await caches.open(ASSETS)
      for (const s of data.subjects ?? []) for (const p of M.subjects[s] ?? []) await assets.delete(p)
      const saved = await savedSubjects()
      await setSaved({ subjects: saved.subjects.filter((s) => !(data.subjects ?? []).includes(s)), extras: saved.extras })
      reply(await status())
    })())
  }
})
