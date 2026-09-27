import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { SUBJECTS, SYLLABUS } from '@study/shared'
import { describe, expect, it } from 'vitest'
import { topicsForSubject } from '../../content/index.ts'
import { TopicMap } from './TopicMap.tsx'

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
