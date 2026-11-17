import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { HAND_ANY, HAND_TAG, parkMaths, stripHands, strikeParts } from './handMarks.ts'

/**
 * Hand-drawn marks in lesson text (section 15, Part C). A mark means "this one", so a step
 * holds at most two; only the five kinds exist; a mark never wraps display maths, which sits
 * on a line of its own and cannot be underlined or circled inline. The two Notebook marks of
 * section 16 have rules of their own: a strike is a mistake and its correction, never in a
 * table row (its | would split the cell), a heading or code; a caret is four words at most.
 */
const ROOT = join(import.meta.dirname, '../../../supabase/seed/content')
const steps = readdirSync(ROOT).filter((d) => statSync(join(ROOT, d)).isDirectory()).flatMap((d) =>
  readdirSync(join(ROOT, d)).filter((f) => f.endsWith('.json')).flatMap((f) => {
    const t = JSON.parse(readFileSync(join(ROOT, d, f), 'utf8')) as { id: string; lesson: { steps: { id: string; body: string }[] } }
    // Read as RichText reads it: maths parked first, so its braces never split a tag.
    return t.lesson.steps.map((s) => ({ where: `${d}/${t.id} ${s.id}`, body: parkMaths(s.body).text, raw: s.body }))
  }))

describe('hand-drawn marks in lessons', () => {
  const marked = steps.filter((s) => s.body.includes('{{'))

  it('are used somewhere', () => {
    expect(marked.length).toBeGreaterThan(0)
  })

  it('are one of the five kinds, written in full', () => {
    for (const s of marked) {
      const any = [...s.body.matchAll(HAND_ANY)].length
      const good = [...s.body.matchAll(HAND_TAG)].length
      expect(good, s.where).toBe(any)
      expect(s.body.replace(HAND_TAG, '').includes('{{'), `${s.where}: a stray {{`).toBe(false)
    }
  })

  it('are at most two in a step', () => {
    for (const s of marked) expect([...s.body.matchAll(HAND_TAG)].length, s.where).toBeLessThanOrEqual(2)
  })

  it('never wrap display maths', () => {
    for (const s of marked) for (const m of s.raw.matchAll(/\{\{(?:circle|underline|highlight|strike|caret)\|([\s\S]*?)\}\}/g)) expect(m[1]!.includes('$$'), s.where).toBe(false)
  })

  it('strike a mistake with its correction, and caret no more than four words, outside tables, headings and code', () => {
    for (const s of marked) {
      const lines = s.body.split('\n')
      let fenced = false
      for (const line of lines) {
        if (line.trim().startsWith('```')) fenced = !fenced
        for (const m of line.matchAll(/\{\{(strike|caret)\|([^{}]*?)\}\}/g)) {
          const where = `${s.where}: ${m[0]}`
          expect(fenced || /^\s*(\||#)/.test(line), `${where} sits in code, a table or a heading`).toBe(false)
          expect(line.replace(/`[^`]*`/g, '').includes(m[0]), `${where} sits in inline code`).toBe(true)
          if (m[1] === 'strike') expect(strikeParts(m[2]!), `${where} needs the mistake and its correction`).not.toBeNull()
          else expect(m[2]!.trim().split(/\s+/).length, `${where} is more than four words`).toBeLessThanOrEqual(4)
        }
      }
    }
  })
})

describe('the Notebook marks read as plain text', () => {
  it('keep only a strike\'s correction, and a caret\'s words', () => {
    expect(stripHands('{{strike|$x^2$|$2x$}} then {{caret|units}}')).toBe('$2x$ then units')
    expect(strikeParts('a|b')).toEqual(['a', 'b'])
    expect(strikeParts('a')).toBeNull()
    expect(strikeParts('a| ')).toBeNull()
  })
})
