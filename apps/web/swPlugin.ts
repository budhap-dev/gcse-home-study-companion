import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'

/**
 * The service worker (UXI-5), written at build time with this build's file names in it.
 *
 * Every deploy renames the files whose contents changed, so the worker has to know the names
 * of the build it belongs to: which files to keep on the device at once (the app's code), which
 * to keep only once they have been opened (topics, the search text), and which topic files make
 * up each subject, so that a subject can be saved for a journey without the page reading and
 * checking every topic in it. A new deploy gives a new worker, since its lists differ.
 */
export interface SwManifest {
  version: string
  /** Fetched when the worker installs: the code of every screen, the styles, the maths fonts. */
  precache: string[]
  /** Every file this build has under /assets/; anything else in the cache is from an old build. */
  build: string[]
  /** The topic files of each subject, for saving a subject for offline. */
  subjects: Record<string, string[]>
  /** Kept once fetched but not fetched ahead: the search text is 1.5 MB compressed. */
  extras: string[]
}

interface BundleFile { fileName: string; type: 'chunk' | 'asset'; facadeModuleId?: string | null }

const TOPIC = /\/supabase\/seed\/content\/([^/]+)\/[^/]+\.json$/

/**
 * Sorts a build's files into the lists above. Fonts other than woff2 are left to be fetched
 * on demand, since every browser that can run a service worker takes woff2 first, and the
 * older formats would double what the first visit downloads.
 */
export function swManifest(files: BundleFile[], version: string): SwManifest {
  const precache: string[] = []
  const build: string[] = []
  const subjects: Record<string, string[]> = {}
  const extras: string[] = []
  for (const f of files) {
    if (!f.fileName.startsWith('assets/')) continue
    const path = `/${f.fileName}`
    build.push(path)
    if (f.fileName.endsWith('.map')) continue
    const topic = f.type === 'chunk' && f.facadeModuleId ? TOPIC.exec(f.facadeModuleId) : null
    if (topic) { (subjects[topic[1]!] ??= []).push(path); continue }
    if (f.facadeModuleId?.includes('virtual:search-text')) { extras.push(path); continue }
    if (/\.(ttf|woff)$/.test(f.fileName)) continue
    precache.push(path)
  }
  for (const list of Object.values(subjects)) list.sort()
  return { version, precache: precache.sort(), build: build.sort(), subjects, extras }
}

/** Emits /sw.js: the worker's source with this build's manifest written in at the top. */
export function serviceWorkerPlugin(version: () => string): Plugin {
  return {
    name: 'study-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = Object.values(bundle).map((b) => ({ fileName: b.fileName, type: b.type, facadeModuleId: b.type === 'chunk' ? b.facadeModuleId : undefined }))
      const manifest = swManifest(files, version())
      const source = readFileSync(join(import.meta.dirname, 'sw-worker.js'), 'utf8')
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: `self.MANIFEST = ${JSON.stringify(manifest)};\n${source}` })
    },
  }
}
