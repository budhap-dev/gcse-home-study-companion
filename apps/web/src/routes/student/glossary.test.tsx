import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { GLOSSARY_LETTERS, letterOf, searchGlossary } from '@study/shared'
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
  it('opens on the first batch of the A to Z, under its letters, and offers the rest', () => {
    const html = render('/glossary')
    expect(html).toContain(`${GLOSSARY.length} terms`)
    const drawn = cards(html)
    expect(drawn).toHaveLength(30)
    expect(html).toContain(`Show more terms (${GLOSSARY.length - 30} left)`)
    // Every letter can still be pressed, though only the first few are drawn.
    for (const letter of new Set(GLOSSARY.map((t) => letterOf(t)))) expect(html, letter).toContain(`>${letter}</button>`)
    expect(html).toContain('id="letter-A"')
    expect(html).not.toContain('id="letter-Z"')
    // Each letter's terms sit together, in the order the letters run.
    const order = drawn.map((slug) => GLOSSARY_LETTERS.indexOf(letterOf(GLOSSARY.find((t) => t.slug === slug)!)))
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  it('lists what a search matches, best first, without the letters', () => {
    const html = render('/glossary?q=upthrust')
    const hits = searchGlossary(GLOSSARY, 'upthrust').map((h) => (h.entry as (typeof GLOSSARY)[number]).slug)
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.length).toBeLessThanOrEqual(30)
    expect(cards(html)).toEqual(hits)
    expect(html).not.toContain('id="letter-')
    expect(html).not.toContain('Show more terms')
    expect(html).toContain('matching “upthrust”')
  })

  it('draws only the best of a search that matches hundreds', () => {
    const hits = searchGlossary(GLOSSARY, 'e').map((h) => (h.entry as (typeof GLOSSARY)[number]).slug)
    expect(hits.length).toBeGreaterThan(300)
    const html = render('/glossary?q=e')
    expect(cards(html)).toEqual(hits.slice(0, 30))
    expect(html).toContain(`${hits.length} terms matching “e”`)
    expect(html).toContain(`Show more terms (${hits.length - 30} left)`)
  })

  it('shows the term a link names above the list, wherever in the alphabet it files', () => {
    const term = GLOSSARY.find((t) => t.term === 'Upthrust')!
    expect(term).toBeDefined()
    const html = render(`/glossary?term=${term.slug}`)
    expect(html).toContain('You looked up')
    expect(html.indexOf('You looked up')).toBeLessThan(html.indexOf('id="letter-'))
    // Its card is the one above the list: U is far past the first batch.
    expect(html).not.toContain(`id="term-${term.slug}"`)
    expect(html.slice(html.indexOf('You looked up'), html.indexOf('id="letter-'))).toContain('Upthrust')
  })
})
