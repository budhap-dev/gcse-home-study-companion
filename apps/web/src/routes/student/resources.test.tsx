import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { isComingSoon } from '@study/shared'
import { RESOURCES } from '../../content/resources.ts'
import { NAV } from '../../app/nav.ts'
import { Resources } from './Resources.tsx'
import { ResourcePage } from './ResourcePage.tsx'

const render = (url: string) =>
  renderToStaticMarkup(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/resources" element={<Resources />} />
        <Route path="/resources/:subjectId/:resourceId" element={<ResourcePage />} />
      </Routes>
    </MemoryRouter>,
  )

describe('the resources pages', () => {
  it('is on the menu', () => {
    expect(NAV.map((n) => n.to)).toContain('/resources')
  })

  it('lists every resource, planned ones included', () => {
    const html = render('/resources')
    for (const r of RESOURCES) expect(html, r.id).toContain(`/resources/${r.subjectId}/${r.id}`)
    if (RESOURCES.some(isComingSoon)) expect(html).toContain('Coming soon')
  })

  it('narrows to one subject', () => {
    const html = render('/resources?subject=business')
    expect(html).toContain('/resources/business/')
    expect(html).not.toContain('/resources/physics/')
  })

  /** Every page renders, and no Markdown or maths source is left showing on it. */
  it('renders every resource without a raw delimiter showing', () => {
    for (const r of RESOURCES) {
      const html = render(`/resources/${r.subjectId}/${r.id}`)
      expect(html, r.id).toContain(r.title.replace(/'/g, '&#x27;'))
      expect(html, r.id).not.toContain('Unknown resource')
      expect(html, r.id).not.toMatch(/\*\*[^<]*</)
      expect(html, r.id).not.toMatch(/\$[^$<]*\\/)
      // Any maths left unrendered: a formula's name was printed as plain text, so
      // "Solving $ax^2 + bx + c = 0$" showed its dollar signs, and the check above,
      // which needs a backslash, passed it.
      expect(html.replace(/<[^>]+>/g, ' '), r.id).not.toMatch(/\$[^$\n]{1,120}\$/)
      for (const l of r.sources) expect(html, r.id).toContain(l.url.replace(/&/g, '&amp;'))
      if (!isComingSoon(r)) {
        expect(html, r.id).toContain('Print this sheet')
        expect(html, r.id).toContain('Where you meet it')
      }
    }
  })

  it('prints in colour, with its controls left off the paper', () => {
    const r = RESOURCES[0]!
    const html = render(`/resources/${r.subjectId}/${r.id}`)
    expect(html).toContain('print-colour')
    expect(html).toContain('print-sheet')
  })

  it('says so plainly for a resource that does not exist', () => {
    expect(render('/resources/physics/not-a-sheet')).toContain('Unknown resource')
  })
})
