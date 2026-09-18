import { describe, expect, it } from 'vitest'
import { donutSlices, rankedSkills, statusTotals, weeklyMinutes } from './charts.ts'
import { emptyState, type AttemptRecord, type ProgressState } from './store.ts'

const state = (over: Partial<ProgressState>): ProgressState => ({ ...emptyState(), ...over })
const quiz = (topicId: string, pct: number, day: string): AttemptRecord => ({
  id: `${topicId}-${day}`, topicId, kind: 'quiz', marksScored: pct, marksAvailable: 100,
  markedHow: 'auto', completedAt: `${day}T10:00:00.000Z`,
})

describe('weeklyMinutes', () => {
  // 2026-09-18 is a Friday, so its week begins Monday the 14th.
  it('totals each week and ends with the one containing today', () => {
    const s = state({ minutes: { '2026-09-14': 30, '2026-09-16': 45, '2026-09-07': 60 } })
    const weeks = weeklyMinutes(s, 3, '2026-09-18')
    expect(weeks.map((w) => w.start)).toEqual(['2026-08-31', '2026-09-07', '2026-09-14'])
    expect(weeks.map((w) => w.minutes)).toEqual([0, 60, 75])
  })

  /** A gap is the most useful thing on this chart, so empty weeks are kept. */
  it('keeps empty weeks rather than skipping them', () => {
    const s = state({ minutes: { '2026-09-16': 45 } })
    const weeks = weeklyMinutes(s, 4, '2026-09-18')
    expect(weeks).toHaveLength(4)
    expect(weeks.slice(0, 3).every((w) => w.minutes === 0)).toBe(true)
  })

  it('labels each bar with the Monday it starts on', () => {
    expect(weeklyMinutes(emptyState(), 1, '2026-09-18')[0]!.label).toBe('14 Sept')
  })
})

describe('statusTotals', () => {
  it('counts only started topics by status, and the rest as not started', () => {
    const s = state({ attempts: [quiz('surds', 95, '2026-09-10')] })
    const t = statusTotals(s)
    expect(t.started).toBe(1)
    expect(t.notStarted).toBe(t.total - 1)
    expect(Object.values(t.counts).reduce((a, b) => a + b, 0)).toBe(1)
  })

  it('counts nothing at all for a fresh account', () => {
    const t = statusTotals(emptyState())
    expect(t.started).toBe(0)
    expect(t.notStarted).toBe(t.total)
    expect(t.total).toBeGreaterThan(200)
  })
})

describe('donutSlices', () => {
  const s = (key: string, value: number) => ({ key, label: key, value, colour: '#000' })

  it('turns values into arcs that run from 0 to 1 without a gap', () => {
    const arcs = donutSlices([s('a', 1), s('b', 3)])
    expect(arcs.map((x) => [x.from, x.to])).toEqual([[0, 0.25], [0.25, 1]])
    expect(arcs.at(-1)!.to).toBeCloseTo(1)
  })

  it('leaves out empty slices, so the legend and the ring agree', () => {
    expect(donutSlices([s('a', 2), s('b', 0), s('c', 2)]).map((x) => x.slice.key)).toEqual(['a', 'c'])
  })

  it('draws nothing at all when there is nothing to show', () => {
    expect(donutSlices([s('a', 0), s('b', 0)])).toEqual([])
    expect(donutSlices([])).toEqual([])
  })
})

describe('rankedSkills', () => {
  const stat = (skill: string, pct: number, attempts = 2) => ({ skill, subjectId: 'maths', pct, attempts })

  /** Weakest first: the chart is read to find what to work on. */
  it('orders weakest first and caps the list', () => {
    const ranked = rankedSkills([stat('a', 70), stat('b', 30), stat('c', 60)], 2)
    expect(ranked.map((r) => r.skill)).toEqual(['b', 'c'])
  })

  /**
   * A strength is not something to work on. Listing an 83% skill under "work on next"
   * is worse than listing nothing, because it sends a student at the wrong thing.
   */
  it('leaves out anything at or above the strength bar', () => {
    expect(rankedSkills([stat('strong', 83), stat('weak', 40)]).map((r) => r.skill)).toEqual(['weak'])
    expect(rankedSkills([stat('strong', 83), stat('borderline', 80)])).toEqual([])
  })

  it('breaks a tie on the amount of evidence, not alphabetically', () => {
    const ranked = rankedSkills([stat('thin', 50, 2), stat('thick', 50, 9)])
    expect(ranked.map((r) => r.skill)).toEqual(['thick', 'thin'])
  })

  it('does not disturb the list it was given', () => {
    const input = [stat('a', 70), stat('b', 30)]
    rankedSkills(input)
    expect(input.map((r) => r.skill)).toEqual(['a', 'b'])
  })
})
