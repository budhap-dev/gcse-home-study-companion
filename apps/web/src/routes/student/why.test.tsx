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

/**
 * The Subjects table carries a column counting how many of each subject's written topics
 * have the section, so the gap is visible on the page rather than only in a commit
 * message. The design asked for exactly this ("a test reports coverage per subject ... so
 * gaps are visible rather than silent") and it had never been built.
 *
 * The risk with a coverage figure is that it quietly stops counting — a wrong field, a
 * filter that matches nothing — and then reports a comfortable number forever. So these
 * check the rendered page against the pack rather than against a constant.
 */
describe('the subjects table reports how far the section has got', () => {
  const render = () =>
    renderToStaticMarkup(
      <MemoryRouter initialEntries={['/subjects']}>
        <Routes>
          <Route path="/subjects" element={<Subjects />} />
        </Routes>
      </MemoryRouter>,
    )

  it('counts each subject against the topics that exist, not the whole syllabus', () => {
    const html = render()
    for (const subject of SUBJECTS) {
      const topics = TOPICS.filter((t) => t.subjectId === subject.id)
      if (topics.length === 0) continue
      const done = topics.filter((t) => t.why).length
      // The cell renders the two numbers in their own spans, so match that shape rather
      // than a formatted string the markup never contains.
      expect(html, `${subject.id} should show ${done} of ${topics.length}`).toContain(
        `<span class="tabular-nums">${done}</span><span class="text-ink-3"> / ${topics.length}</span>`,
      )
    }
  })

  it('shows a whole-pack total that matches the pack, in the table and in the sentence', () => {
    const html = render()
    const done = TOPICS.filter((t) => t.why).length
    expect(html).toContain(`<span class="tabular-nums">${done}</span><span class="text-ink-3"> / ${TOPICS.length}</span>`)
    // The sentence above the table repeats the figure, because on a phone the table
    // scrolls sideways and that column is the last one reached.
    expect(html).toContain(`${done} of ${TOPICS.length}`)
  })

  /**
   * The sentence names the subjects that are finished and the ones part-way, so it has to
   * agree with the column rather than drift from it.
   */
  it('names the finished subjects and the part-finished ones correctly', () => {
    const html = render()
    for (const s of SUBJECTS) {
      const topics = TOPICS.filter((t) => t.subjectId === s.id)
      const done = topics.filter((t) => t.why).length
      if (topics.length > 0 && done === topics.length) expect(html, `${s.name} is complete`).toContain(s.name)
      if (done > 0 && done < topics.length) expect(html, `${s.name} is part-way`).toContain(`a start on`)
    }
  })

  /**
   * A count of "topics with the section" is only interesting while some topics lack it.
   * When that stops being true this test fails, which is the moment to decide whether the
   * column has done its job and should go.
   */
  it('still has something left to report', () => {
    const done = TOPICS.filter((t) => t.why).length
    expect(done).toBeGreaterThan(0)
    expect(done, 'every topic now has the section — retire the column or change what it counts').toBeLessThan(TOPICS.length)
  })

  it('names the column and says which fraction it is', () => {
    const html = render()
    expect(html).toContain('Why it exists')          // the column heading
    expect(html).toContain('why this exists')        // both halves named in the sentence
    expect(html).toContain('where you meet it')
    expect(html).toContain('rather than the whole syllabus')
  })
})
