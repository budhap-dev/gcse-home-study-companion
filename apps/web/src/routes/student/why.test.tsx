import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { SUBJECTS } from '@study/shared'
import { TOPICS, getTopic } from '../../content/index.ts'
import { Subjects } from './Subjects.tsx'
import { WhyItExists } from './WhyItExists.tsx'

const render = (subjectId: string, topicId: string) =>
  renderToStaticMarkup(
    <MemoryRouter initialEntries={[`/subjects/${subjectId}/topics/${topicId}/why`]}>
      <Routes>
        <Route path="/subjects/:subjectId/topics/:topicId/why" element={<WhyItExists />} />
      </Routes>
    </MemoryRouter>,
  )

describe('where you meet it', () => {
  it('shows every example and its picture, and not the paragraph the topic page already has', () => {
    const topic = getTopic('physics', 'moments-levers-and-gears')!
    const html = render('physics', topic.id)
    expect(topic.why).toBeDefined()
    for (const ex of topic.why!.examples) expect(html).toContain(ex.title)
    // Three diagrams, one per example.
    expect(html.match(/role="img"/g)).toHaveLength(topic.why!.examples.length)
    // "Why this exists" used to be repeated at the top of this page. It is the same text
    // as the card on the topic page, one tap back, and showing it twice read as padding.
    expect(html).not.toContain('a force on its own says nothing about turning')
    expect(html).toContain('Start the lesson')
  })

  /*
   * The page is reachable for any topic, and WhyItExists still says so for one without
   * the section rather than rendering an empty shell. Every topic in the pack has the
   * section since 25 September 2026, so that branch can no longer be reached from the
   * content and is not exercised here; the pack test below is what keeps it unreachable.
   */

  /** getTopic takes a subject and a topic; passing one argument found nothing. */
  it('needs both the subject and the topic to find it', () => {
    expect(getTopic('physics', 'moments-levers-and-gears')).toBeDefined()
    expect(getTopic('chemistry', 'moments-levers-and-gears')).toBeUndefined()
  })
})

describe('the tile', () => {
  /**
   * The grid reads as a sequence: lesson, worksheets, quiz. A tile for orientation
   * belongs at the front of it — placed beside Exam technique it implied you read it
   * last, which is the reverse of what it is for.
   */
  it('comes before the lesson, and only where there are examples', () => {
    const source = readFileSync(new URL('./Topic.tsx', import.meta.url), 'utf8')
    const why = source.indexOf('title="Where you meet it"')
    const lesson = source.indexOf('title="Lesson"')
    expect(why).toBeGreaterThan(-1)
    expect(why).toBeLessThan(lesson)
    expect(source).toContain('topic.why && topic.why.examples.length > 0')
  })
})

describe('the why field across the pack', () => {
  it('is well formed wherever it is present', () => {
    const withWhy = TOPICS.filter((t) => t.why)
    // Every topic carries the section now, Further Maths last, so a new topic without one
    // is a regression rather than a rollout gap.
    expect(TOPICS.filter((t) => !t.why).map((t) => t.id)).toEqual([])
    for (const t of withWhy) {
      expect(t.why!.matters.length, t.id).toBeGreaterThan(80)
      expect(t.why!.examples.length, t.id).toBeLessThanOrEqual(3)
      for (const ex of t.why!.examples) {
        // The heading is the concrete noun, never "Application 1" or "Real-world example".
        expect(ex.title, t.id).not.toMatch(/^(application|example|real[- ]world)/i)
        if (ex.visual?.type === 'diagram') expect(ex.visual.alt.length, `${t.id} ${ex.title}`).toBeGreaterThanOrEqual(40)
      }
    }
  })
})

/**
 * The Subjects table carried a column counting how many of each subject's written topics
 * had the section while the rollout was under way, with a test that failed the day the
 * count reached the whole pack. That day came with Further Maths on 25 September 2026 and
 * the column was retired: n / n on every row said nothing. The page still names the
 * section, so a reader knows to look for it, and the pack check above keeps it on every
 * topic.
 */
describe('the subjects table, now every topic has the section', () => {
  it('has retired the coverage column but still names the section', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/subjects']}>
        <Routes>
          <Route path="/subjects" element={<Subjects />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(html).not.toContain('Why it exists')
    expect(html).toContain('why this exists')
    expect(html).toContain('where you meet it')
    for (const subject of SUBJECTS) {
      const missing = TOPICS.filter((t) => t.subjectId === subject.id && !t.why).map((t) => t.id)
      expect(missing, `${subject.name} topics without the section`).toEqual([])
    }
  })
})
