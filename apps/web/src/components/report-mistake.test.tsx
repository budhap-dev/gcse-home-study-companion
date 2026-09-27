import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// The link writes as the signed-in account, so it must not appear when nobody is.
let status = 'allowed'
vi.mock('../auth/useAuth.ts', () => ({ useAuth: () => ({ status }) }))
const { ReportMistake } = await import('./ReportMistake.tsx')
const item = { subjectId: 'maths', topicId: 'quadratic-curves', itemKind: 'question' as const, itemId: 'q4', seenIn: 'quiz' as const }

describe('Report a mistake', () => {
  it('shows the link to a signed-in family member', () => {
    status = 'allowed'
    expect(renderToStaticMarkup(<ReportMistake item={item} />)).toContain('Report a mistake')
  })
  it('shows nothing on a device-only build or when signed out', () => {
    for (const s of ['disabled', 'signed-out', 'loading']) {
      status = s
      expect(renderToStaticMarkup(<ReportMistake item={item} />)).toBe('')
    }
  })
})
