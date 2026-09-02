import { Topic } from './topic.ts'
import { isAutoMarked } from './questions.ts'

export interface Issue {
  /** Where in the topic the problem is, as a dotted path. */
  path: string
  message: string
  /** Errors block publishing; warnings are shown to the editor. */
  severity: 'error' | 'warning'
}

export const GRADE_8_9_MINIMUM_SHARE = 0.4

/**
 * The publish rules from ADM-1, on top of the schema. A topic publishes only when
 * this returns no errors. The same function runs in the authoring tool, the importer,
 * and the database's publish function, so all three agree.
 */
export function validateTopicForPublish(input: unknown): Issue[] {
  const parsed = Topic.safeParse(input)
  if (!parsed.success) {
    return parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message, severity: 'error' }))
  }
  const topic = parsed.data
  const issues: Issue[] = []
  const error = (path: string, message: string) => issues.push({ path, message, severity: 'error' })
  const warn = (path: string, message: string) => issues.push({ path, message, severity: 'warning' })

  // Question bank integrity.
  const ids = new Map(topic.questions.map((q) => [q.id, q]))
  if (ids.size !== topic.questions.length) error('questions', 'question ids must be unique within a topic')
  const grade89 = topic.questions.filter((q) => q.gradeBand === '8-9')
  if (grade89.length / topic.questions.length < GRADE_8_9_MINIMUM_SHARE) {
    error('questions', `at least ${GRADE_8_9_MINIMUM_SHARE * 100}% of questions must be tagged grade 8 to 9`)
  }
  for (const q of grade89) {
    if (q.discriminators.length === 0) error(`questions.${q.id}`, 'grade 8 to 9 questions need at least one discriminator pattern')
  }
  for (const q of topic.questions) {
    const schemeTotal = q.markScheme.reduce((sum, line) => sum + line.marks, 0)
    if (schemeTotal !== q.marks) error(`questions.${q.id}`, `mark scheme adds to ${schemeTotal} but the question is worth ${q.marks}`)
    if (q.type === 'extended') {
      const criteriaTotal = q.criteria.reduce((sum, c) => sum + c.marks, 0)
      if (criteriaTotal !== q.marks) error(`questions.${q.id}`, `criteria add to ${criteriaTotal} but the question is worth ${q.marks}`)
    }
    if (q.type === 'multiple-choice' && q.correct.some((i) => i >= q.options.length)) {
      error(`questions.${q.id}`, 'a correct option index is out of range')
    }
  }

  // Lesson shape.
  const kinds = topic.lesson.steps.map((s) => s.kind)
  if (!kinds.includes('grade-9')) error('lesson', 'the lesson needs a grade 9 step')
  const last = kinds[kinds.length - 1]
  if (last !== 'summary' && last !== 'grade-9') warn('lesson', 'lessons usually end on a summary or the grade 9 step')
  if (!topic.lesson.steps.some((s) => s.check)) warn('lesson', 'no step has a check question')
  const stepIds = new Set<string>()
  for (const s of topic.lesson.steps) {
    if (stepIds.has(s.id)) error(`lesson.${s.id}`, 'step ids must be unique')
    stepIds.add(s.id)
    if (s.check && !isAutoMarked(s.check)) error(`lesson.${s.id}`, 'check questions must be auto-marked types')
  }

  // Worksheets and quiz reference real questions.
  for (const level of ['core', 'higher', 'advanced'] as const) {
    const sheet = topic.worksheets[level]
    for (const id of sheet.questionIds) {
      if (!ids.has(id)) error(`worksheets.${level}`, `unknown question ${id}`)
    }
    if (new Set(sheet.questionIds).size !== sheet.questionIds.length) error(`worksheets.${level}`, 'a question appears twice')
  }
  for (const id of topic.worksheets.advanced.questionIds) {
    const q = ids.get(id)
    if (q && q.gradeBand !== '8-9') error('worksheets.advanced', 'the Advanced worksheet is built only from grade 8 to 9 questions')
  }
  for (const id of topic.quiz.questionIds) {
    if (!ids.has(id)) error('quiz', `unknown question ${id}`)
  }
  if (topic.quiz.sampleSize > topic.quiz.questionIds.length) error('quiz', 'sample size is larger than the pool')
  if (!topic.quiz.questionIds.some((id) => ids.get(id)?.gradeBand === '8-9')) {
    error('quiz', 'the quiz pool needs grade 8 to 9 questions so Grade 9 ready can be measured')
  }

  // Provenance: model drafts publish only after a person reviews them.
  if (topic.provenance.draftedBy.kind === 'model' && !topic.provenance.reviewedBy) {
    error('provenance', 'an AI-drafted topic cannot publish until a person has reviewed it')
  }

  return issues
}

export function canPublish(issues: Issue[]): boolean {
  return issues.every((i) => i.severity !== 'error')
}
