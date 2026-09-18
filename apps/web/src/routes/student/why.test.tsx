import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { TOPICS, getTopic } from '../../content/index.ts'
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
  it('shows every example, its picture and the framing', () => {
    const topic = getTopic('physics', 'moments-levers-and-gears')!
    const html = render('physics', topic.id)
    expect(topic.why).toBeDefined()
    for (const ex of topic.why!.examples) expect(html).toContain(ex.title)
    // Three diagrams, one per example, and the framing paragraph repeated for context.
    expect(html.match(/role="img"/g)).toHaveLength(topic.why!.examples.length)
    expect(html).toContain('a force on its own says nothing about turning')
    expect(html).toContain('Start the lesson')
  })

  /**
   * The page is reachable for any topic, so one without the section has to say so
   * rather than render an empty shell or crash.
   */
  it('says so for a topic that has no section yet', () => {
    const plain = TOPICS.find((t) => !t.why)!
    const html = render(plain.subjectId, plain.id)
    expect(html).toContain('does not have this section yet')
    expect(html).not.toContain('Unknown topic')
  })

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
    expect(withWhy.length).toBeGreaterThan(0)
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
