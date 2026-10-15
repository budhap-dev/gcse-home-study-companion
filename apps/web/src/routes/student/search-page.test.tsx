import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { getSubject, searchGlossary } from '@study/shared'
import { GLOSSARY } from '../../content/glossary.ts'
import { loadSearchIndex, search } from '../../search/index.ts'
import { Search } from './Search.tsx'

// Fetched before rendering, so the page draws its results on the first pass.
const INDEX = await loadSearchIndex()

const render = (url: string) =>
  renderToStaticMarkup(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/search" element={<Search />} />
      </Routes>
    </MemoryRouter>,
  )

/** Each chip's label and count, and whether it is pressed. */
const chips = (html: string) =>
  [...html.matchAll(/<button type="button" aria-pressed="(true|false)"[^>]*>([^<]+)(?:<span[^>]*>(\d+)<\/span>)?<\/button>/g)].map((m) => ({
    name: m[2]!, on: m[1] === 'true', count: m[3] === undefined ? undefined : Number(m[3]),
  }))
const resultSubjects = (html: string) => [...html.matchAll(/<span class="font-bold accent-ink"[^>]*>([^<]+)<\/span>/g)].map((m) => m[1]!)
const countFor = (q: string, subjectId: string) =>
  searchGlossary(GLOSSARY, q).filter((h) => h.entry.subjectId === subjectId).length + search(q, INDEX).filter((h) => h.record.subjectId === subjectId).length

describe('the search page subject filter', () => {
  it('offers every subject before anything is typed, without counts', () => {
    const shown = chips(render('/search'))
    expect(shown[0]).toEqual({ name: 'All subjects', on: true, count: undefined })
    expect(shown.map((c) => c.name)).toContain('Mathematics')
    expect(shown.map((c) => c.name)).toContain('Physics')
    expect(shown.every((c) => c.count === undefined)).toBe(true)
  })

  it('counts each subject’s results for the query, and All counts them all', () => {
    const q = 'momentum'
    const shown = chips(render(`/search?q=${q}`))
    const all = shown.find((c) => c.name === 'All subjects')!
    const physics = shown.find((c) => c.name === 'Physics')!
    expect(all.count).toBe(searchGlossary(GLOSSARY, q).length + search(q, INDEX).length)
    expect(physics.count).toBe(countFor(q, 'physics'))
    expect(physics.count).toBeGreaterThan(0)
    // The subjects' counts add up to All's: nothing is counted twice or missed.
    expect(shown.filter((c) => c !== all).reduce((n, c) => n + (c.count ?? 0), 0)).toBe(all.count)
  })

  it('greys a subject with nothing for the query, and only that kind', () => {
    const html = render('/search?q=covalent')
    const style = (name: string) => new RegExp(`class="([^"]*)"[^>]*>${name}<span`).exec(html)?.[1] ?? ''
    expect(countFor('covalent', 'french')).toBe(0)
    expect(style('French')).toContain('text-ink-3')
    expect(style('Chemistry')).toContain('text-ink-2')
    // Before a query nothing is greyed: there is nothing yet to find.
    const before = [...render('/search').matchAll(/aria-pressed="false" class="([^"]*)"/g)].map((m) => m[1]!)
    expect(before.length).toBeGreaterThan(5)
    expect(before.filter((c) => c.includes('text-ink-3'))).toEqual([])
  })

  it('shows only the chosen subject’s results, glossary and content alike', () => {
    const html = render('/search?q=energy&subject=chemistry')
    const pressed = chips(html).filter((c) => c.on)
    expect(pressed.map((c) => c.name)).toEqual(['Chemistry'])
    const named = resultSubjects(html)
    expect(named.length).toBeGreaterThan(0)
    expect(new Set(named)).toEqual(new Set(['Chemistry']))
    // Unfiltered, the same query reaches other subjects, so the filter is doing the work.
    expect(new Set(resultSubjects(render('/search?q=energy'))).size).toBeGreaterThan(1)
  })

  it('says when the chosen subject has nothing but others do, and offers them', () => {
    const q = 'covalent'
    expect(countFor(q, 'french')).toBe(0)
    expect(countFor(q, 'chemistry')).toBeGreaterThan(0)
    const html = render(`/search?q=${q}&subject=french`)
    expect(html).toContain(`Nothing in ${getSubject('french')!.name} matched “${q}”`)
    expect(html).toContain('Search all subjects')
    expect(resultSubjects(html)).toEqual([])
  })

  it('keeps the subject on the link to the rest of the glossary', () => {
    const q = 'ion'
    const terms = searchGlossary(GLOSSARY, q).filter((h) => h.entry.subjectId === 'chemistry')
    expect(terms.length).toBeGreaterThan(8)
    expect(render(`/search?q=${q}&subject=chemistry`)).toContain(`href="/glossary?q=${q}&amp;subject=chemistry"`)
  })

  it('ignores a subject it does not know, rather than showing nothing', () => {
    const html = render('/search?q=momentum&subject=astrology')
    expect(chips(html).filter((c) => c.on).map((c) => c.name)).toEqual(['All subjects'])
    expect(resultSubjects(html).length).toBeGreaterThan(0)
  })
})
