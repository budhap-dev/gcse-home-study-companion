import { describe, expect, it } from 'vitest'
import { emptyState, type ProgressState } from './store.ts'
import { weekOnWeek } from './weekOnWeek.ts'

// Monday 21 to Sunday 27 September 2026 is "this week"; 14 to 20 is last week.
const TODAY = '2026-09-27'
let n = 0
const attempt = (topicId: string, at: string, scored: number, of: number, kind: 'quiz' | 'worksheet' | 'review' = 'quiz', level?: 'core' | 'higher' | 'advanced') =>
  ({ id: `a${n++}`, topicId, kind, level, marksScored: scored, marksAvailable: of, markedHow: 'auto', completedAt: `${at}T10:00:00Z` }) as ProgressState['attempts'][number]

describe('this week against last', () => {
  const state: ProgressState = {
    ...emptyState(),
    time: { '2026-09-16|maths|quadratic-curves|quiz': 20, '2026-09-22|maths|quadratic-curves|worksheet': 35, '2026-09-23|physics|describing-motion|lesson': 15 },
    attempts: [
      attempt('quadratic-curves', '2026-09-16', 6, 10),
      attempt('quadratic-curves', '2026-09-22', 9, 10),
      attempt('quadratic-curves', '2026-09-23', 8, 10, 'worksheet', 'higher'),
      attempt('quadratic-curves', '2026-09-24', 0, 3, 'review'),
    ],
  }
  const { rows, total } = weekOnWeek(state, TODAY)

  it('compares minutes per subject, busiest first', () => {
    expect(rows.map((r) => r.subjectId)).toEqual(['maths', 'physics'])
    expect(rows[0]!.last.minutes).toBe(20)
    expect(rows[0]!.this.minutes).toBe(35)
    expect(rows[1]!.this.minutes).toBe(15)
    expect(total.this.minutes).toBe(50)
  })

  it('averages quizzes and worksheets, leaving redo sessions out', () => {
    expect(rows[0]!.last.avgPct).toBe(60)
    expect(rows[0]!.this).toMatchObject({ marked: 2, avgPct: 85 })
  })

  it('counts a topic as moved up only when its status crossed a line this week', () => {
    // Developing (quiz 60%) at the start of the week; Secure now (quiz 90%, Higher 80%).
    expect(rows[0]!.up).toBe(1)
    expect(rows[0]!.down).toBe(0)
    expect(total.up).toBe(1)
  })

  it('says nothing for a quiet fortnight', () => {
    expect(weekOnWeek(emptyState(), TODAY).rows).toEqual([])
  })
})
