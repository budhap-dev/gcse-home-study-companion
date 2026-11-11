import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { swManifest } from './swPlugin.ts'

const ROOT = '/repo/supabase/seed/content'
const files = [
  { fileName: 'assets/index-abc12345.js', type: 'chunk' as const, facadeModuleId: '/repo/apps/web/index.html' },
  { fileName: 'assets/index-def67890.css', type: 'asset' as const },
  { fileName: 'assets/algebraic-fractions-11111111.js', type: 'chunk' as const, facadeModuleId: `${ROOT}/maths/algebraic-fractions.json` },
  { fileName: 'assets/box-plots-22222222.js', type: 'chunk' as const, facadeModuleId: `${ROOT}/maths/box-plots.json` },
  { fileName: 'assets/cells-33333333.js', type: 'chunk' as const, facadeModuleId: `${ROOT}/biology/cells.json` },
  { fileName: 'assets/_virtual_search-text-44444444.js', type: 'chunk' as const, facadeModuleId: '\0virtual:search-text' },
  { fileName: 'assets/KaTeX_Main-Regular-55555555.woff2', type: 'asset' as const },
  { fileName: 'assets/KaTeX_Main-Regular-66666666.ttf', type: 'asset' as const },
  { fileName: 'assets/KaTeX_Main-Regular-77777777.woff', type: 'asset' as const },
  { fileName: 'sw.js', type: 'asset' as const },
  { fileName: 'index.html', type: 'asset' as const },
]

describe('the service worker manifest (UXI-5)', () => {
  const m = swManifest(files, '1.0.0+abc')

  it('keeps the code, the styles and the woff2 fonts at once', () => {
    expect(m.precache).toEqual(['/assets/KaTeX_Main-Regular-55555555.woff2', '/assets/index-abc12345.js', '/assets/index-def67890.css'])
  })

  it('leaves topics, the search text and the older font formats to be fetched when wanted', () => {
    for (const p of m.precache) expect(p).not.toMatch(/algebraic|box-plots|cells|search-text|\.ttf$|\.woff$/)
    expect(m.extras).toEqual(['/assets/_virtual_search-text-44444444.js'])
  })

  it('lists each subject’s topic files, for saving a subject', () => {
    expect(m.subjects).toEqual({
      maths: ['/assets/algebraic-fractions-11111111.js', '/assets/box-plots-22222222.js'],
      biology: ['/assets/cells-33333333.js'],
    })
  })

  it('knows every asset of the build, so the worker can delete the ones a deploy left behind', () => {
    expect(m.build).toHaveLength(9)
    expect(m.build).not.toContain('/sw.js')
    expect(m.build).not.toContain('/index.html')
  })

  it('names a topic only from the content folder', () => {
    const odd = swManifest([{ fileName: 'assets/glossary-88888888.js', type: 'chunk', facadeModuleId: '/repo/supabase/seed/glossary/terms.json' }], 'v')
    expect(odd.subjects).toEqual({})
    expect(odd.precache).toEqual(['/assets/glossary-88888888.js'])
  })
})

describe('the deployment serves the worker', () => {
  const vercel = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8')) as {
    rewrites: { source: string }[]
    headers: { source: string; headers: { key: string; value: string }[] }[]
  }

  it('as itself, not as the app page every other path is rewritten to', () => {
    const rule = new RegExp(`^${vercel.rewrites[0]!.source}$`)
    expect(rule.test('/sw.js')).toBe(false)
    expect(rule.test('/subjects/maths')).toBe(true)
  })

  it('unfingerprinted and never cached for long, so a deploy reaches devices', () => {
    const sw = vercel.headers.find((h) => h.source === '/sw.js')
    expect(sw?.headers).toContainEqual({ key: 'Cache-Control', value: 'no-cache' })
  })
})
