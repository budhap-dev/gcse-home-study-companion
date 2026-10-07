import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { SUBJECTS, SYLLABUS } from '@study/shared'
import { describe, expect, it } from 'vitest'
import { topicsForSubject } from '../../content/index.ts'
import { setProfile } from '../../progress/store.ts'
import { TopicMap } from './TopicMap.tsx'

// The store writes through localStorage and drops the write without it, so a profile set
// by a test would never reach the page.
const stored = new Map<string, string>()
globalThis.localStorage = { getItem: (k: string) => stored.get(k) ?? null, setItem: (k: string, v: string) => void stored.set(k, v), removeItem: (k: string) => void stored.delete(k) } as unknown as Storage

const render = (subjectId: string, query = '') =>
  renderToStaticMarkup(
    <MemoryRouter initialEntries={[`/subjects/${subjectId}${query}`]}>
      <Routes>
        <Route path="/subjects/:subjectId" element={<TopicMap />} />
      </Routes>
    </MemoryRouter>,
  )

const escape = (s: string) => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll("'", '&#x27;')

describe('the subject map', () => {
  /** The map's promise is every topic: each one a square that names itself, in every subject. */
  it.each(SUBJECTS.map((s) => [s.id]))('draws every written topic as a named button: %s', (subjectId) => {
    const html = render(subjectId)
    for (const t of topicsForSubject(subjectId)) expect(html, t.id).toContain(`aria-label="${escape(t.title)}, Year ${t.year}, Not started"`)
    expect(html.match(/aria-pressed="true" aria-label=/g)).toHaveLength(1)
  })

  it('opens a topic in the panel, with the ladder and what comes next', () => {
    const html = render('maths')
    expect(html).toContain('aria-label="Topic"')
    expect(html).toContain('Mastery: not started')
    expect(html).toContain('Start the lesson.')
  })

  it('names every square, for the screens with room to show it', () => {
    const html = render('maths')
    for (const t of topicsForSubject('maths')) expect(html, t.id).toContain(`md:line-clamp-3">${escape(t.title)}</span>`)
  })

  /** UXI-10: the year being studied is what the map is for; the whole subject is a click away. */
  it("opens on the student's own year, and picks a topic from it", () => {
    setProfile({ year: 10 })
    try {
      const html = render('maths')
      expect(html).toMatch(/aria-pressed="true"[^>]*>Year 10<\/button>/)
      const nine = topicsForSubject('maths').find((t) => t.year === 9)!
      expect(html).not.toContain(`aria-label="${escape(nine.title)}, Year 9`)
      expect(html).toMatch(/aria-pressed="true" aria-label="[^"]*, Year 10, Not started"/)
      expect(html).toContain('Year 10</span>')
    } finally {
      setProfile({})
    }
  })

  it('opens on all years for a student who has not said theirs, or whose year the subject does not teach', () => {
    expect(render('maths')).toMatch(/aria-pressed="true"[^>]*>All years<\/button>/)
    setProfile({ year: 9 })
    try {
      expect(render('further-maths')).toMatch(/aria-pressed="true"[^>]*>All years<\/button>/)
    } finally {
      setProfile({})
    }
  })
})

describe('the list view', () => {
  /** The school's whole plan, every row, as before the map: scope stays visible (see show-the-whole-plan). */
  it('still lists every row of the school plan by year', () => {
    const html = render('maths', '?view=list')
    const rows = (SYLLABUS.maths ?? []).flatMap((b) => b.topics)
    expect(rows.length).toBeGreaterThan(0)
    for (const year of new Set((SYLLABUS.maths ?? []).map((b) => b.year))) expect(html).toContain(`Year ${year}</span>`)
    expect(html).toContain('Coming soon')
    expect(html).not.toContain('aria-label="Topic"')
  })
})
