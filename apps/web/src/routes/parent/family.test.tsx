import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ChildReport } from './Family.tsx'
import { emptyState, type ProgressState } from '../../progress/store.ts'
import { parentSummary } from '../../progress/summary.ts'

const render = (state: ProgressState, syncedAt?: string) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <ChildReport child={{ email: 'kid@example.com', name: 'Ana', state, syncedAt }} summary={parentSummary(state, '2026-09-18')} />
    </MemoryRouter>,
  )

const quiz = (topicId: string, pct: number, day: string) => ({
  id: `${topicId}-${day}`, topicId, kind: 'quiz' as const, marksScored: pct, marksAvailable: 100, markedHow: 'auto' as const,
  completedAt: `${day}T10:00:00.000Z`, questions: [{ id: 'a', skill: 'rationalising denominators', gradeBand: '6-7' as const, correct: pct >= 50, marksScored: pct >= 50 ? 2 : 0, marksAvailable: 2 }],
})

describe('the parent report', () => {
  it('leads with how long it has been, the week, and the quiz average', () => {
    const state = {
      ...emptyState(),
      attempts: [quiz('surds', 30, '2026-09-15'), quiz('laws-of-indices', 90, '2026-09-16')],
      minutes: { '2026-09-15': 25, '2026-09-16': 35 },
      goalMinutes: 180,
    }
    const html = render(state, '2026-09-16T10:00:00.000Z')
    expect(html).toContain('Ana')
    expect(html).toContain('2 days ago')
    expect(html).toContain('60 min')
    expect(html).toContain('33% of the 180 minute goal')
    // Mean of 30 and 90.
    expect(html).toContain('60%')
    expect(html).toContain('Across all 2')
  })

  it('names the topic that is going badly, as a control that opens its breakdown', () => {
    // Two attempts, because a skill needs more than one data point to be called weak.
    const state = { ...emptyState(), attempts: [quiz('surds', 30, '2026-09-14'), quiz('surds', 40, '2026-09-15')] }
    const html = render(state)
    // A button rather than a link: the answer to "how did that go" opens in place, and a
    // link would have sent the parent to the student's own topic page instead.
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('Surds')
    expect(html).toContain('40%')
    expect(html).toContain('Weakest skills')
    expect(html).toContain('rationalising denominators')
  })

  it('says plainly when there is nothing to worry about, rather than showing an empty list', () => {
    const state = { ...emptyState(), attempts: [quiz('surds', 95, '2026-09-15')] }
    const html = render(state)
    expect(html).toContain('Nothing is stuck')
  })

  /** An account with no activity must still render, and must not claim work was done. */
  it('survives an empty account', () => {
    const html = render(emptyState())
    expect(html).toContain('has not finished anything yet')
    expect(html).toContain('Nothing finished yet')
    expect(html).not.toContain('NaN')
  })

  it('tells the parent what the page cannot see, and that it is read only', () => {
    const html = render(emptyState())
    expect(html).toContain('does not appear here until they sign in')
    expect(html).toContain('read it but not write it')
  })
})
