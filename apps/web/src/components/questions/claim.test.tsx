import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { claimAnswer, type Question } from '@study/shared'
import { Feedback } from './Feedback.tsx'
import { TopicBreakdown } from '../../routes/parent/TopicBreakdown.tsx'
import { emptyState } from '../../progress/store.ts'

const base = { id: 'q1', prompt: 'How is the rate measured?', marks: 1, gradeBand: '6-7', skill: 's', calculator: 'either', tags: [], solution: 'Time how long the cross takes to disappear.', markScheme: [], discriminators: [] } as const
const typed: Question = { ...base, type: 'short-text', accepted: ['time for the cross to disappear'] }
const choice: Question = { ...base, type: 'multiple-choice', options: ['a', 'b'], correct: [0] }
const wrong = { correct: false, marksScored: 0, marksAvailable: 1 }
const html = (q: Question, result = wrong, onClaim?: () => void) => renderToStaticMarkup(<Feedback question={q} result={result} onClaim={onClaim} />)

/**
 * A typed answer is matched against a few wordings, so a right answer in other words is
 * marked wrong. The student can say it means the same, and that is recorded as their mark.
 */
describe('claiming a typed answer', () => {
  it('is offered for a typed answer the marker rejected', () => {
    expect(html(typed, wrong, () => {})).toContain('My answer means the same')
  })

  it('is not offered for a choice, for a right answer, or where no one handles it', () => {
    expect(html(choice, wrong, () => {})).not.toContain('My answer means the same')
    expect(html(typed, { correct: true, marksScored: 1, marksAvailable: 1 }, () => {})).not.toContain('My answer means the same')
    expect(html(typed, wrong)).not.toContain('My answer means the same')
  })

  it('says a claimed answer was counted by the student, not by the marker', () => {
    const out = html(typed, claimAnswer(wrong), () => {})
    expect(out).toContain('Counted as right')
    expect(out).toContain('You said your answer means the same as')
    expect(out).not.toContain('>Correct<')
    expect(out).not.toContain('My answer means the same')
  })

  it('shows a parent which marks were claimed', () => {
    const state = {
      ...emptyState(),
      attempts: [{
        id: 'a', topicId: 'measuring-rates-of-reaction', kind: 'quiz' as const, marksScored: 1, marksAvailable: 1, markedHow: 'mixed' as const,
        completedAt: '2026-09-23T10:00:00.000Z',
        questions: [{ id: 'q8', skill: 's', gradeBand: '6-7' as const, marksScored: 1, marksAvailable: 1, correct: true, answer: 'how long till the X goes', claimed: true }],
      }],
    }
    const out = renderToStaticMarkup(<MemoryRouter><TopicBreakdown topicId="measuring-rates-of-reaction" state={state} /></MemoryRouter>)
    expect(out).toContain('they said it means the same and counted it')
    expect(out).toContain('how long till the X goes')
  })
})
