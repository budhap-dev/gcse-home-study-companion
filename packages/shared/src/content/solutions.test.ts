import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseNumber } from '../marking.ts'
import { Topic } from './topic.ts'
import type { Topic as TopicRecord } from './topic.ts'

const ROOT = join(import.meta.dirname, '../../../../supabase/seed/content')

function topics(): TopicRecord[] {
  const out: TopicRecord[] = []
  for (const dir of readdirSync(ROOT)) {
    if (!statSync(join(ROOT, dir)).isDirectory()) continue
    for (const file of readdirSync(join(ROOT, dir))) {
      if (file.endsWith('.json')) out.push(Topic.parse(JSON.parse(readFileSync(join(ROOT, dir, file), 'utf8'))))
    }
  }
  return out
}

const ALL = topics()
const questionsOf = (t: TopicRecord) => [...t.questions, ...t.lesson.steps.flatMap((s) => (s.check ? [s.check] : []))]

/**
 * Pulls every number a solution states, in the forms the content actually writes them:
 * plain, spaced thousands, LaTeX fractions, and with a currency symbol or a minus in
 * front. `parseNumber` then does the reading, so this agrees with the real marker
 * rather than approximating it.
 */
function numbersIn(solution: string): string[] {
  const text = solution
    // A minus sign sits outside the macro, as in `$-\tfrac{1}{2}$`, so it has to be carried in.
    .replace(/([-−–])?\s*\\[tdc]?frac\{\s*(-?\d+(?:\.\d+)?)\s*\}\{\s*(-?\d+(?:\.\d+)?)\s*\}/g, (_m, sign: string | undefined, a: string, b: string) => ` ${sign ? '-' : ''}${a}/${b} `)
    .replace(/\\,/g, '')
    .replace(/[{}]/g, ' ')
  const out: string[] = []
  for (const m of text.matchAll(/-?\s*[£$€]?\s*\d[\d ,]*(?:\.\d+)?(?:\s*\/\s*-?\d+(?:\.\d+)?)?/g)) out.push(m[0].trim())
  // A minus written as a Unicode dash, and negatives that sit inside a LaTeX span.
  for (const m of text.matchAll(/[−–]\s*[£$€]?\s*\d[\d ,]*(?:\.\d+)?/g)) out.push(m[0].trim())
  return out
}

describe('numeric solutions state their own answer', () => {
  /**
   * A numeric question's `answer` is what the marker compares against, while the
   * `solution` is what the student reads afterwards. Nothing keeps the two in step, and
   * a solution that works to a different number teaches the wrong thing however well the
   * marking behaves. Every stated answer must therefore appear in its own solution.
   */
  it('finds each answer somewhere in the solution it belongs to', () => {
    const bad: string[] = []
    for (const t of ALL) {
      for (const q of questionsOf(t)) {
        if (q.type !== 'numeric') continue
        const found = numbersIn(q.solution).some((raw) => {
          const v = parseNumber(raw, q.units)
          return v !== undefined && Math.abs(v - q.answer) <= Math.max(q.tolerance, Math.abs(q.answer) * 1e-9) + 1e-9
        })
        if (!found) bad.push(`${t.subjectId}/${t.id} ${q.id}: answer ${q.answer} is not in "${q.solution.slice(0, 90)}"`)
      }
    }
    expect(bad).toEqual([])
  })

  /**
   * A question that asks for a rounded answer has to accept the rounded value. Asking
   * for 2 significant figures and then demanding the unrounded number marked a correct
   * student wrong on one Physics check before this was noticed.
   */
  it('accepts the rounding it asks for', () => {
    const bad: string[] = []
    for (const t of ALL) {
      for (const q of questionsOf(t)) {
        if (q.type !== 'numeric') continue
        const sf = q.prompt.match(/(\d+)\s*significant figure/i)
        const dp = q.prompt.match(/(\d+)\s*decimal place/i)
        if (!sf && !dp) continue
        const rounded = sf
          ? Number(q.answer.toPrecision(Number(sf[1])))
          : Number(q.answer.toFixed(Number(dp![1])))
        if (Math.abs(rounded - q.answer) > q.tolerance + 1e-9) {
          bad.push(`${t.subjectId}/${t.id} ${q.id}: asks for ${sf ? `${sf[1]} s.f.` : `${dp![1]} d.p.`}, so ${rounded} must be accepted, but answer ${q.answer} with tolerance ${q.tolerance} rejects it`)
        }
      }
    }
    expect(bad).toEqual([])
  })
})
