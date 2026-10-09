import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { expectedAnswer, sheetQuestions } from '@study/shared'
import { getFullTopic } from '../../content/all.ts'
import { WorksheetPrint } from './WorksheetPrint.tsx'

const render = (path: string) =>
  renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="/subjects/:subjectId/topics/:topicId/worksheet/:level/print" element={<WorksheetPrint />} /></Routes>
    </MemoryRouter>,
  )
const sheet = '/subjects/maths/topics/surds/worksheet/higher/print'
const lines = (html: string) => (html.match(/border-dotted/g) ?? []).length

describe('the printable worksheet', () => {
  it('names the topic, the level and the board, and leaves somewhere to write a name', () => {
    const html = render(sheet)
    expect(html).toContain('Surds')
    expect(html).toContain('Higher worksheet')
    expect(html).toContain('Edexcel 1MA1')
    expect(html).toContain('Name')
  })

  /** WKS-2: working space proportional to the marks. */
  it('gives a question worth more marks more room to work in', () => {
    const html = render(sheet)
    const perQuestion = [...html.matchAll(/<li class="question[\s\S]*?<\/li>/g)].map((m) => lines(m[0]))
    expect(perQuestion.length).toBeGreaterThan(3)
    expect(Math.max(...perQuestion)).toBeGreaterThan(Math.min(...perQuestion))
  })

  /**
   * WKS-2 again: the answers are a separate document, not the same sheet folded over,
   * so the answers print carries no working space at all.
   */
  it('prints the answers as their own document, with no working space', () => {
    const html = render(`${sheet}?answers=1`)
    expect(html).toContain('answers')
    expect(lines(html)).toBe(0)
    expect(html).toContain('Answer:')
    expect(html).toContain('Working:')
  })

  it('carries the mark scheme codes on the answers sheet', () => {
    expect(render(`${sheet}?answers=1`)).toMatch(/[MAB]1/)
  })

  /**
   * Mark scheme descriptions are authored with LaTeX in them, so printing them as plain
   * text put "$3\sqrt{5}$ or $2\sqrt{5}$ seen" on the page. Every authored string on
   * this sheet goes through the renderer.
   */
  it('renders the maths in a mark scheme rather than printing the source', () => {
    const html = render(`${sheet}?answers=1`)
    expect(html).not.toMatch(/\$[^$<]*\\sqrt/)
    expect(html).toContain('katex')
  })

  /** The screen-only controls must not reach paper. */
  it('marks its controls as not printable', () => {
    expect(render(sheet)).toContain('no-print')
  })

  it('says so plainly rather than crashing on a worksheet that does not exist', () => {
    expect(render('/subjects/maths/topics/not-a-topic/worksheet/higher/print')).toContain('Unknown worksheet')
  })
})

describe('a printed sheet with new numbers', () => {
  const trig = '/subjects/maths/topics/trigonometric-ratios/worksheet/higher/print'
  const topic = getFullTopic('maths', 'trigonometric-ratios')!
  const written = topic.worksheets.higher.questionIds.map((id) => topic.questions.find((q) => q.id === id)!)
  const fresh = sheetQuestions('maths', topic.id, written, 'k7m2qp')
  // Rendered prompts pass through Markdown and KaTeX, so compare on a plain phrase of each.
  const phrase = (prompt: string) => prompt.replace(/\$[^$]*\$/g, '').split('.')[0]!.slice(0, 40)

  it('prints the questions its code draws, and the code itself', () => {
    const html = render(`${trig}?sheet=k7m2qp`)
    for (const s of fresh) expect(html).toContain(phrase(s.question.prompt))
    expect(html).toContain('k7m2qp')
    expect(html).toContain('The answers are on a separate sheet with the same code')
  })

  it('prints the answers to those questions, not the written ones', () => {
    const html = render(`${trig}?sheet=k7m2qp&answers=1`)
    for (const s of fresh.filter((x) => x.generated)) expect(html).toContain(expectedAnswer(s.question)!)
    expect(html).toContain('Answers for sheet k7m2qp only')
  })

  it('prints the written sheet without a code, and ignores a code that is not one', () => {
    for (const path of [trig, `${trig}?sheet=%3Cb%3E`]) {
      const html = render(path)
      expect(html).not.toContain('Sheet <strong')
      for (const q of written) expect(html).toContain(phrase(q.prompt))
    }
  })

  it('offers a version with new numbers only where a generator exists', () => {
    expect(render(trig)).toContain('A version with new numbers')
    // Business has no generators.
    const business = render('/subjects/business/topics/enterprise-and-entrepreneurship/worksheet/higher/print')
    expect(business).toContain('Higher worksheet')
    expect(business).not.toContain('new numbers')
  })
})
