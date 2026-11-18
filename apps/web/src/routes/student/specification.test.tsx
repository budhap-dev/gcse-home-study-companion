import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { SPEC_POINTS } from '@study/shared'
import { describe, expect, it } from 'vitest'
import { Specification } from './Specification.tsx'

const render = (subjectId: string) =>
  renderToStaticMarkup(
    <MemoryRouter initialEntries={[`/subjects/${subjectId}/specification`]}>
      <Routes>
        <Route path="/subjects/:subjectId/specification" element={<Specification />} />
      </Routes>
    </MemoryRouter>,
  )

describe('the specification checklist', () => {
  it.each(Object.keys(SPEC_POINTS).map((id) => [id]))('lists every point of the board’s specification: %s', (subjectId) => {
    const html = render(subjectId)
    const codes = SPEC_POINTS[subjectId]!.flatMap((s) => s.points.map((p) => p.code))
    for (const c of codes) expect(html, c).toContain(`id="point-${c}"`)
    expect(html.match(/<li id="point-/g)).toHaveLength(codes.length)
  })

  it('names the Maths gaps: A8 has no topic, R7 is listed but not yet taught', () => {
    const html = render('maths')
    expect(html).toContain('96 of 97 points have a topic')
    const a8 = html.slice(html.indexOf('id="point-A8"'), html.indexOf('id="point-A9"'))
    expect(a8).toContain('No topic.')
    expect(a8).toContain('used throughout the pack')
    const r7 = html.slice(html.indexOf('id="point-R7"'), html.indexOf('id="point-R8"'))
    expect(r7).toContain('listed, not yet taught')
  })

  it('names the one Physics point nothing teaches yet, and counts a section a topic cites', () => {
    const html = render('physics')
    expect(html).toContain('90 of 91 points have a topic')
    const gap = html.slice(html.indexOf('id="point-4.2.4.2"'), html.indexOf('id="point-4.2.4.3"'))
    expect(gap).toContain('Not yet taught')
    // Electromagnetic devices cites 4.7.2, the motor effect, which holds 4.7.2.1 to 4.7.2.4.
    const motor = html.slice(html.indexOf('id="point-4.7.2.3"'), html.indexOf('id="point-4.7.2.4"'))
    expect(motor).toContain('Electromagnetic devices')
  })

  it('says so for a subject with no numbered points', () => {
    expect(render('french')).toContain('has no numbered points to check off here yet')
  })
})
