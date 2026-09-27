import { describe, expect, it } from 'vitest'
import { TOPICS } from '../../content/index.ts'
import { describeItem } from './Reports.tsx'

// A report names its item by id; the review screen must turn that back into something a
// parent can read and find, or a report is a note about nothing in particular.
describe('describing a reported item', () => {
  const topic = TOPICS.find((t) => t.subjectId === 'maths' && t.lesson.steps.length > 2)!

  it('links a lesson step to its own place in the lesson', () => {
    const step = topic.lesson.steps[2]!
    const d = describeItem({ subject_id: 'maths', topic_id: topic.id, item_kind: 'step', item_id: step.id })
    expect(d.topicTitle).toBe(topic.title)
    expect(d.text).toBe(`Lesson step 3: ${step.title}`)
    expect(d.href).toBe(`/subjects/maths/topics/${topic.id}/lesson?step=3`)
  })

  it('shows a question by its prompt', () => {
    const q = topic.questions[0]!
    const d = describeItem({ subject_id: 'maths', topic_id: topic.id, item_kind: 'question', item_id: q.id })
    expect(d.text).toBe(q.prompt)
    expect(d.href).toBeUndefined()
  })

  it('still shows something for an item that has since gone', () => {
    const d = describeItem({ subject_id: 'maths', topic_id: 'no-such-topic', item_kind: 'question', item_id: 'q1' })
    expect(d.topicTitle).toBe('no-such-topic')
    expect(d.text).toBeUndefined()
  })
})
