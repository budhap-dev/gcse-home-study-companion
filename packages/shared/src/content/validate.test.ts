import { describe, expect, it } from 'vitest'
import { canPublish, validateTopicForPublish } from './validate.ts'
import type { Question, Topic } from './index.ts'
import { Topic as TopicSchema } from './topic.ts'

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

describe('listening questions', () => {
  const said = 'Je vais au cinéma samedi.'
  const dictation = (over: Partial<Extract<Question, { type: 'short-text' }>> = {}): Question => ({
    id: 'l1', type: 'short-text', prompt: 'Write down the sentence you hear, in French.', marks: 2, gradeBand: '6-7', skill: 'dictation',
    calculator: 'either', tags: [], solution: 'x', markScheme: [{ code: 'B1', marks: 2, description: 'each word' }], discriminators: [],
    accepted: [said], listen: { text: said, dictation: true }, ...over,
  })
  const errorsFor = (q: Question, sheet?: 'core') => {
    const t = topic()
    t.questions.push(q)
    if (sheet) t.worksheets.core.questionIds.push(q.id)
    return validateTopicForPublish(t).filter((i) => i.severity === 'error').map((i) => i.message)
  }

  it('accepts a dictation whose answer is what is read out', () => {
    expect(errorsFor(dictation())).toEqual([])
  })

  it('refuses one whose prompt prints what is heard', () => {
    expect(errorsFor(dictation({ prompt: `Write down: ${said}` }))).toContainEqual(expect.stringMatching(/must not print what is heard/))
  })

  it('refuses one whose answer is not what is read out', () => {
    expect(errorsFor(dictation({ accepted: ['Je vais au cinéma dimanche.'] }))).toContainEqual(expect.stringMatching(/first accepted answer/))
  })

  it('keeps listening off a worksheet, which prints', () => {
    expect(errorsFor(dictation(), 'core')).toContainEqual(expect.stringMatching(/cannot be printed/))
  })
})

describe('multi-part questions', () => {
  const stem = { id: 'trolley', body: 'A 2 kg trolley is pushed along a level bench with a resultant force of 6 N.' }
  // q1 to q3 become parts (a) to (c) of one stem, ramping from 4–5 to 8–9 as a paper's question does.
  const parted = (overrides: Partial<Topic> = {}) => {
    const t = topic(overrides)
    t.questions = t.questions.map((q, i) => (i < 3 ? { ...q, context: 'trolley' } : q))
    return { contexts: [stem], ...t }
  }
  const errors = (input: unknown) => validateTopicForPublish(input).filter((i) => i.severity === 'error')

  it('attach the stem to each part, lettered in bank order', () => {
    const parsed = TopicSchema.parse(parted())
    expect(parsed.questions.slice(0, 4).map((q) => q.stem && `${q.stem.part}/${q.stem.parts}`)).toEqual(['a/3', 'b/3', 'c/3', undefined])
    expect(parsed.questions[1]!.stem!.body).toBe(stem.body)
    // Parsing the parsed topic again changes nothing, so a cached topic reads back the same.
    expect(TopicSchema.parse(parsed)).toEqual(parsed)
  })

  it('refuse a part naming a missing stem, a stem with one part, parts apart, and a lesson check as a part', () => {
    const missing = parted(); missing.questions[0] = { ...missing.questions[0]!, context: 'nothing' }
    expect(errors(missing).some((i) => i.message.includes('not in contexts'))).toBe(true)

    const single = topic(); single.questions[0] = { ...single.questions[0]!, context: 'trolley' }
    expect(errors({ contexts: [stem], ...single }).some((i) => i.message.includes('1 part(s)'))).toBe(true)

    const apart = topic(); apart.questions[0] = { ...apart.questions[0]!, context: 'trolley' }; apart.questions[2] = { ...apart.questions[2]!, context: 'trolley' }
    expect(errors({ contexts: [stem], ...apart }).some((i) => i.message.includes('next to each other'))).toBe(true)

    const step = topic(); step.questions[0] = { ...step.questions[0]!, step: 's9' }
    expect(errors(step).some((i) => i.message.includes('lesson step s9'))).toBe(true)
    step.questions[0] = { ...step.questions[0]!, step: 's2' }
    expect(errors(step)).toEqual([])

    const check = parted(); check.lesson.steps[0]!.check = { ...check.lesson.steps[0]!.check!, context: 'trolley' }
    expect(errors(check).some((i) => i.message.includes('lesson check'))).toBe(true)
  })

  it('let the earlier parts sit on the Advanced sheet when a later part is grade 8 to 9', () => {
    const t = parted()
    t.worksheets.core.questionIds = ['q5']
    t.worksheets.higher.questionIds = ['q7']
    t.worksheets.advanced.questionIds = ['q1', 'q2', 'q3', 'q4']
    expect(errors(t)).toEqual([])
    const lone = topic()
    lone.worksheets.advanced.questionIds = ['q1', 'q3']
    expect(errors(lone).some((i) => i.path === 'worksheets.advanced')).toBe(true)
  })

  it('ask every part on a sheet, together and in order', () => {
    for (const ids of [['q1', 'q3'], ['q1', 'q4', 'q2', 'q3'], ['q2', 'q1', 'q3']]) {
      const t = parted()
      t.worksheets.core.questionIds = ['q5']
      t.worksheets.higher.questionIds = ['q7']
      t.worksheets.advanced.questionIds = [...ids, 'q4'].filter((x, i, a) => a.indexOf(x) === i)
      expect(errors(t).some((i) => i.message.includes('together and in order')), ids.join(',')).toBe(true)
    }
  })

  it('count a multi-part question once, at its top part, towards the grade 8 to 9 share', () => {
    // Twelve questions: q1 to q3 are one problem whose top part is 8–9, so there are ten
    // problems. With two more 8–9 questions that is 3 of 12 questions (25%) and 3 of 10
    // problems (30%), under 40% either way. With three more it is 4 of 12 questions (33%),
    // which would fail, but 4 of 10 problems (40%), which passes.
    const banded = (top: number) => {
      const t = parted()
      t.questions = t.questions.map((q, i) => {
        const band = i === 0 ? '4-5' : i === 1 ? '6-7' : i === 2 || (i >= 3 && i < 3 + top) ? '8-9' : '6-7'
        return { ...q, gradeBand: band, discriminators: band === '8-9' ? ['unfamiliar-context' as const] : [] }
      })
      t.worksheets = { core: { level: 'core', questionIds: ['q11'], suggestedMinutes: 5 }, higher: { level: 'higher', questionIds: ['q12'], suggestedMinutes: 5 }, advanced: { level: 'advanced', questionIds: ['q1', 'q2', 'q3'], suggestedMinutes: 5 } }
      return t
    }
    const share = (x: unknown) => errors(x).filter((i) => i.message.includes('grade 8 to 9'))
    expect(share(banded(2))).toHaveLength(1)
    expect(share(banded(3))).toEqual([])
  })


})
