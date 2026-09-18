import { describe, expect, it } from 'vitest'
import { scriptsInHtml } from './useNewBuild.ts'

/**
 * The content pack is compiled into the bundle, so a tab left open across a deploy keeps
 * serving old content and calls a newly added topic unknown. This comparison is what
 * notices, so it has to be exact about what counts as a different build.
 */
describe('scriptsInHtml', () => {
  const page = (...srcs: string[]) => `<html><head>${srcs.map((s) => `<script type="module" src="${s}"></script>`).join('')}</head></html>`

  it('picks out the fingerprinted assets', () => {
    expect(scriptsInHtml(page('/assets/index-Bxax7RDT.js'))).toBe('/assets/index-Bxax7RDT.js')
  })

  it('sees a rebuilt bundle as a different build', () => {
    expect(scriptsInHtml(page('/assets/index-AAA.js'))).not.toBe(scriptsInHtml(page('/assets/index-BBB.js')))
  })

  it('does not mistake a reordered head for a new build', () => {
    expect(scriptsInHtml(page('/assets/a.js', '/assets/b.js'))).toBe(scriptsInHtml(page('/assets/b.js', '/assets/a.js')))
  })

  /** A third-party tag appearing or going must not be read as a deploy. */
  it('ignores scripts that are not build assets', () => {
    expect(scriptsInHtml(page('/assets/index-AAA.js', 'https://example.com/analytics.js')))
      .toBe(scriptsInHtml(page('/assets/index-AAA.js')))
  })

  it('finds nothing in a page with no assets, so the check stays quiet', () => {
    expect(scriptsInHtml('<html><head></head></html>')).toBe('')
    expect(scriptsInHtml(page('/src/main.tsx'))).toBe('')
  })
})
