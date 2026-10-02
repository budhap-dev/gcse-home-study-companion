import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { searchGlossary } from '@study/shared'
import { GLOSSARY } from '../../content/glossary.ts'
import { Glossary } from './Glossary.tsx'

const render = (url: string) =>
  renderToStaticMarkup(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/glossary" element={<Glossary />} />
      </Routes>
    </MemoryRouter>,
  )

const cards = (html: string) => [...html.matchAll(/id="term-([^"]+)"/g)].map((m) => m[1]!)

describe('the glossary page', () => {
  it('opens on the A to Z, under its letters', () => {
    const html = render('/glossary')
    expect(html).toContain(`${GLOSSARY.length} terms`)
    expect(html).toContain('id="letter-A"')
    expect(cards(html)[0]).toBe(GLOSSARY[0]!.slug)
  })

  it('lists what a search matches, best first, without the letters', () => {
    const html = render('/glossary?q=upthrust')
    const hits = searchGlossary(GLOSSARY, 'upthrust').map((h) => (h.entry as (typeof GLOSSARY)[number]).slug)
    expect(hits.length).toBeGreaterThan(0)
    expect(cards(html)).toEqual(hits)
    expect(html).not.toContain('id="letter-')
    expect(html).toContain('matching “upthrust”')
  })

  it('shows the term a link names above the list', () => {
    const term = GLOSSARY.find((t) => t.term === 'Upthrust') ?? GLOSSARY[GLOSSARY.length - 1]!
    const html = render(`/glossary?term=${term.slug}`)
    expect(html).toContain('You looked up')
    expect(html.indexOf('You looked up')).toBeLessThan(html.indexOf('id="letter-'))
  })
})
