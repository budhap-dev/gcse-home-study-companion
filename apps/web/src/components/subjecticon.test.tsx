import { renderToStaticMarkup } from 'react-dom/server'
import { SUBJECTS } from '@study/shared'
import { describe, expect, it } from 'vitest'
import { SUBJECT_ICONS, SubjectIcon, subjectIconCount } from './SubjectIcon.tsx'

describe('SubjectIcon', () => {
  it('gives every subject at least three pictures to choose from', () => {
    for (const s of SUBJECTS) expect(subjectIconCount(s.id), s.id).toBeGreaterThanOrEqual(3)
  })

  it('draws a different picture for each option', () => {
    for (const s of SUBJECTS) {
      const drawn = SUBJECT_ICONS[s.id]!.map((_, v) => renderToStaticMarkup(<SubjectIcon subjectId={s.id} variant={v} />))
      expect(new Set(drawn).size, s.id).toBe(drawn.length)
    }
  })

  it('wraps any variant number round to a real picture', () => {
    const first = renderToStaticMarkup(<SubjectIcon subjectId="maths" variant={0} />)
    expect(renderToStaticMarkup(<SubjectIcon subjectId="maths" variant={subjectIconCount('maths')} />)).toBe(first)
    expect(renderToStaticMarkup(<SubjectIcon subjectId="maths" variant={-subjectIconCount('maths')} />)).toBe(first)
  })

  it('falls back to the book for a subject it does not know', () => {
    expect(renderToStaticMarkup(<SubjectIcon subjectId="latin" />)).toContain('<svg')
  })
})
