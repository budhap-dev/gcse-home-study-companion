import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { staleBuild } from './screens.ts'

/** A browser tab, as far as a missing screen file is concerned. */
function tab(href: string, { online = true, storage = true } = {}) {
  const kept = new Map<string, string>()
  const reload = vi.fn()
  vi.stubGlobal('window', { location: { href, reload } })
  vi.stubGlobal('navigator', { onLine: online })
  vi.stubGlobal('sessionStorage', storage
    ? { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v), removeItem: (k: string) => void kept.delete(k) }
    : { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') }, removeItem: () => { throw new Error('blocked') } })
  return { reload, kept }
}

const gone = new TypeError('Failed to fetch dynamically imported module')
/** Settled or not, without waiting on a promise that is meant never to settle. */
const settles = (p: Promise<unknown>) => Promise.race([p.then(() => 'settled', () => 'settled'), new Promise((r) => setTimeout(() => r('pending'), 20))])

describe('a screen whose file a deploy has replaced', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('reloads the page at the address being opened, and shows no error meanwhile', async () => {
    const { reload, kept } = tab('https://app.example/glossary')
    const result = staleBuild(gone)
    expect(reload).toHaveBeenCalledTimes(1)
    expect([...kept.values()]).toEqual(['https://app.example/glossary'])
    expect(await settles(result)).toBe('pending')
  })

  it('does not reload a second time for the same address', () => {
    const { reload } = tab('https://app.example/glossary')
    void staleBuild(gone)
    expect(() => staleBuild(gone)).toThrow(gone)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('reloads again for a different address', () => {
    const { reload } = tab('https://app.example/glossary')
    void staleBuild(gone)
    window.location.href = 'https://app.example/resources'
    void staleBuild(gone)
    expect(reload).toHaveBeenCalledTimes(2)
  })

  it('does not reload while offline, where a reload would lose the page', () => {
    const { reload } = tab('https://app.example/glossary', { online: false })
    expect(() => staleBuild(gone)).toThrow(gone)
    expect(reload).not.toHaveBeenCalled()
  })

  it('does not reload where it cannot remember having done so', () => {
    const { reload } = tab('https://app.example/glossary', { storage: false })
    expect(() => staleBuild(gone)).toThrow(gone)
    expect(reload).not.toHaveBeenCalled()
  })
})

/**
 * Every file the first download holds: what main.tsx imports, and what those import, by
 * ordinary imports only. A file reached only through import() is fetched on demand, and a
 * type-only import is erased by the build.
 */
function firstDownload(): Set<string> {
  const SRC = join(import.meta.dirname, '..')
  const seen = new Set<string>()
  const queue = [join(SRC, 'main.tsx')]
  while (queue.length) {
    const file = queue.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(/^(?:import|export)\s+(?!type\b)(?:[^'";]*?\sfrom\s+)?'(\.{1,2}\/[^']+)'/gm)) {
      const target = join(dirname(file), m[1]!)
      if (/\.tsx?$/.test(target) && existsSync(target)) queue.push(target)
    }
  }
  return new Set([...seen].map((f) => relative(SRC, f)))
}

// Home once took one small helper from the Mistakes screen, and with it every question type
// and diagram came into the first download. Nothing failed; the app was only slower to open.
describe('the first download', () => {
  const files = firstDownload()

  it('holds the shell and the screens on the menu', () => {
    // Floors, so that a walk which followed no imports could not pass as one that found nothing heavy.
    expect(files.size).toBeGreaterThan(40)
    for (const file of ['app/AppShell.tsx', 'app/router.tsx', 'routes/student/Home.tsx', 'routes/student/TopicMap.tsx', 'content/index.ts', 'progress/store.ts']) expect(files, file).toContain(file)
  })

  it('holds no screen that is fetched on demand, nor what only those screens need', () => {
    const heavy = [
      'routes/study.ts', 'routes/lookup.ts', 'routes/reference.ts', 'routes/parent/Family.tsx',
      'routes/student/Lesson.tsx', 'routes/student/Quiz.tsx', 'routes/student/Mistakes.tsx', 'routes/student/Glossary.tsx', 'routes/student/Resources.tsx',
      'components/Visual.tsx', 'components/RichText.tsx', 'components/questions/QuestionInput.tsx', 'content/load.ts', 'content/resources.ts',
    ]
    // Each must exist, or the list has gone stale and checks nothing.
    for (const file of heavy) expect(existsSync(join(import.meta.dirname, '..', file)), file).toBe(true)
    expect(heavy.filter((file) => files.has(file))).toEqual([])
  })
})
