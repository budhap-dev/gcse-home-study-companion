import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { cheatSheetOf } from '@study/shared'
import { TOPICS, getTopic } from '../../content/index.ts'
import { CheatSheet } from './CheatSheet.tsx'

const render = (subjectId: string, topicId: string) =>
  renderToStaticMarkup(
    <MemoryRouter initialEntries={[`/subjects/${subjectId}/topics/${topicId}/cheatsheet`]}>
      <Routes>
        <Route path="/subjects/:subjectId/topics/:topicId/cheatsheet" element={<CheatSheet />} />
      </Routes>
    </MemoryRouter>,
  )

describe('the cheat sheet page', () => {
  it('shows the memory hooks, the formulae, the key points and the traps of a topic', () => {
    const topic = getTopic('physics', 'kinetic-and-gravitational-potential-energy')!
    const sheet = cheatSheetOf(topic)
    const html = render('physics', topic.id)
    expect(sheet.memoryHooks.length).toBeGreaterThan(0)
    expect(sheet.formulae.length).toBeGreaterThan(0)
    for (const tip of [...sheet.memoryHooks, ...sheet.tactics]) expect(html).toContain(tip.title)
    for (const f of sheet.formulae) expect(html).toContain(f.equation.replace(/&/g, '&amp;'))
    expect(html).toContain('Remember it')
    expect(html).toContain('Formulae')
    expect(html).toContain('Key points')
    expect(html).toContain('Examiner traps')
    expect(html).toContain('grade 9')
  })

  /** The hooks are the reason the page exists, so they come before everything else. */
  it('leads with the memory hooks', () => {
    const html = render('physics', 'kinetic-and-gravitational-potential-energy')
    expect(html.indexOf('Remember it')).toBeLessThan(html.indexOf('Key points'))
    expect(html.indexOf('Key points')).toBeLessThan(html.indexOf('Examiner traps'))
  })

  it('leaves out the formulae section where a topic has no equation card', () => {
    const plain = TOPICS.find((t) => cheatSheetOf(t).formulae.length === 0)!
    const html = render(plain.subjectId, plain.id)
    expect(html).not.toContain('>Formulae<')
    expect(html).toContain('Key points')
  })

  /** Every topic in the pack has a sheet, so the page must render for every one. */
  it('renders for every topic in the pack without a raw delimiter showing', () => {
    for (const t of TOPICS) {
      const html = render(t.subjectId, t.id)
      expect(html, t.id).toContain('Cheat sheet')
      expect(html, t.id).not.toContain('Unknown topic')
      // A bold run that failed to close leaves its asterisks on the page.
      expect(html, t.id).not.toMatch(/\*\*[^<]*</)
    }
  })

  it('renders summary maths rather than printing the source', () => {
    const withMaths = TOPICS.find((t) => cheatSheetOf(t).keyPoints.some((p) => p.includes('$')))!
    const html = render(withMaths.subjectId, withMaths.id)
    expect(html).toContain('katex')
    expect(html).not.toMatch(/\$[^$<]*\\/)
  })

  it('carries a print button, a way to the flashcards, and marks its controls as not printable', () => {
    const html = render('physics', 'kinetic-and-gravitational-potential-energy')
    expect(html).toContain('Print this sheet')
    expect(html).toContain('/flashcards')
    expect(html).toContain('no-print')
    expect(html).toContain('print-sheet')
  })

  it('says so plainly for a topic that does not exist', () => {
    expect(render('physics', 'not-a-topic')).toContain('Unknown topic')
  })

  /**
   * The memory-hook card used to paint itself a fixed cream, `bg-[#fff8e6]`. Under a dark
   * theme that cream stayed cream while the text followed `--color-ink` to near-white, and
   * the card a student opens the night before a test was unreadable. Its warmth has to come
   * from a token mixed into `--color-surface`, so the themes carry it.
   *
   * The small warm chips elsewhere (the XP pill, the offline banner) pin their own text
   * colour alongside their background and are safe; a card of body text cannot.
   */
  it('takes the memory-hook card colour from a theme token, not a fixed light hex', () => {
    const source = readFileSync(new URL('./CheatSheet.tsx', import.meta.url), 'utf8')
    expect(source).not.toMatch(/bg-\[#[0-9a-fA-F]{3,8}\]/)
    expect(source).toContain('bg-[color:var(--hook-card)]')
    const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8')
    // Mixed into the surface, so every theme's own background carries through.
    expect(css).toMatch(/--hook-card:\s*color-mix\(in srgb,[^;]*var\(--color-surface\)\)/)
    expect(css).toMatch(/--hook-card-rule:\s*color-mix\(in srgb,[^;]*var\(--color-surface\)\)/)
  })
})

describe('the tile', () => {
  /** Revision comes after the practice: the tile sits with Flashcards, before Exam technique. */
  it('sits after Flashcards and before Exam technique on the topic page', () => {
    const source = readFileSync(new URL('./Topic.tsx', import.meta.url), 'utf8')
    const flashcards = source.indexOf('title="Flashcards"')
    const sheet = source.indexOf('title="Cheat sheet"')
    const exam = source.indexOf('title="Exam technique"')
    expect(sheet).toBeGreaterThan(flashcards)
    expect(sheet).toBeLessThan(exam)
    expect(source).toContain('to="cheatsheet"')
  })
})
