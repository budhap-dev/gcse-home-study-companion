import { describe, expect, it } from 'vitest'
import { canPublish, validateTopicForPublish } from './validate.ts'
import type { Question, Topic } from './index.ts'

function numeric(id: string, gradeBand: '4-5' | '6-7' | '8-9'): Question {
  return {
    id,
    type: 'numeric',
    prompt: 'A 2 kg trolley is pushed with a resultant force of 6 N. Find its acceleration in m/s².',
    marks: 2,
    gradeBand,
    skill: 'rearranging F = ma',
    calculator: 'either',
    tags: [],
    solution: 'a = F / m = 6 / 2 = 3 m/s²',
    markScheme: [
      { code: 'M1', marks: 1, description: 'Rearranges F = ma' },
      { code: 'A1', marks: 1, description: '3 m/s²' },
    ],
    discriminators: gradeBand === '8-9' ? ['unfamiliar-context'] : [],
    answer: 3,
    tolerance: 0,
    unitsRequired: false,
  }
}

function topic(overrides: Partial<Topic> = {}): Topic {
  const questions: Question[] = [
    numeric('q1', '4-5'),
    numeric('q2', '6-7'),
    numeric('q3', '8-9'),
    numeric('q4', '8-9'),
    ...Array.from({ length: 8 }, (_, i) => numeric(`q${i + 5}`, i % 2 ? '8-9' : '6-7')),
  ]
  const ids = questions.map((q) => q.id)
  return {
    id: 'newtons-second-law',
    subjectId: 'physics',
    unitId: 'forces',
    year: 10,
    title: "Newton's second law",
    specPoints: ['4.5.6.2.2'],
    lesson: {
      steps: [
        { id: 's1', kind: 'explain', title: 'Force, mass, acceleration', body: 'Resultant force = mass × acceleration.', visuals: [{ type: 'diagram', component: 'trolley-force', props: {}, alt: 'A trolley pushed by a force' }], check: numeric('c1', '6-7') },
        { id: 's2', kind: 'worked-example', title: 'A worked example', body: 'Find a.', visuals: [{ type: 'worked-example', problem: 'F = 6 N, m = 2 kg', steps: [{ text: 'a = F / m' }, { text: 'a = 3 m/s²' }] }] },
        { id: 's3', kind: 'grade-9', title: 'Inertial mass', body: 'Mass as resistance to acceleration.', visuals: [{ type: 'diagram', component: 'trolley-force', props: { mass: 4 }, alt: 'A heavier trolley' }] },
      ],
    },
    questions,
    worksheets: {
      core: { level: 'core', questionIds: ['q1'], suggestedMinutes: 10 },
      higher: { level: 'higher', questionIds: ['q2', 'q5'], suggestedMinutes: 20 },
      advanced: { level: 'advanced', questionIds: ['q3', 'q4'], suggestedMinutes: 25 },
    },
    examTechnique: { body: 'Always give units.', examinerErrors: ['Omitting units.'], grade9Looks: 'Uses the resultant force, not one of the forces.' },
    quiz: { questionIds: ids, sampleSize: 10 },
    provenance: { draftedBy: { kind: 'person', name: 'Editor' } },
    ...overrides,
  }
}

describe('validateTopicForPublish', () => {
  it('accepts a complete topic', () => {
    const issues = validateTopicForPublish(topic())
    expect(issues.filter((i) => i.severity === 'error')).toEqual([])
    expect(canPublish(issues)).toBe(true)
  })

  it('rejects a lesson without a grade 9 step', () => {
    const t = topic()
    t.lesson.steps[2]!.kind = 'summary'
    expect(validateTopicForPublish(t)).toContainEqual(expect.objectContaining({ path: 'lesson', severity: 'error' }))
  })

  it('rejects a text-only step at the schema level', () => {
    const t = topic()
    t.lesson.steps[0]!.visuals = []
    expect(validateTopicForPublish(t).some((i) => i.path.startsWith('lesson.steps.0.visuals'))).toBe(true)
  })

  it('rejects a bank with too few grade 8 to 9 questions', () => {
    const t = topic()
    t.questions = t.questions.map((q) => ({ ...q, gradeBand: '6-7' as const, discriminators: [] }))
    t.worksheets.advanced.questionIds = ['q2']
    const issues = validateTopicForPublish(t)
    expect(issues).toContainEqual(expect.objectContaining({ path: 'questions', severity: 'error' }))
    expect(issues).toContainEqual(expect.objectContaining({ path: 'worksheets.advanced', severity: 'error' }))
  })

  it('rejects a mark scheme that does not add up', () => {
    const t = topic()
    t.questions[0]!.markScheme = [{ code: 'M1', marks: 1, description: 'Method' }]
    expect(validateTopicForPublish(t)).toContainEqual(expect.objectContaining({ path: 'questions.q1', severity: 'error' }))
  })

  it('rejects an AI draft with no reviewer', () => {
    const t = topic({ provenance: { draftedBy: { kind: 'model', model: 'claude-opus-5', promptVersion: '1' } } })
    expect(validateTopicForPublish(t)).toContainEqual(expect.objectContaining({ path: 'provenance', severity: 'error' }))
    t.provenance.reviewedBy = 'Editor'
    expect(canPublish(validateTopicForPublish(t))).toBe(true)
  })

  it('rejects an Advanced worksheet containing lower-band questions', () => {
    const t = topic()
    t.worksheets.advanced.questionIds = ['q1']
    expect(validateTopicForPublish(t)).toContainEqual(expect.objectContaining({ path: 'worksheets.advanced', severity: 'error' }))
  })
})
