import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate, sheetQuestions } from '../index.ts'
import type { Generated } from '../types.ts'
import { LEN_PHRASES, LEN_WORDS, LINE_NAMES, POSITION_WORDS, stringGenerators } from './strings.ts'

/**
 * Structural tests for the string-handling generators (AQA 8525 3.2.8). Each reads the printed
 * string or program back out of the prompt and works the answer again here, without the
 * interpreter (characters counted, the first match found by a loop, the line split at its comma),
 * checks the printed trace row by row and some lines literally, that the named slips never (or
 * rarely) score, the spread over builds, and that slots sharing a sheet never print the same word.
 */
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/computer-science')
const TOPIC = 'strings-and-file-handling'
const data = JSON.parse(readFileSync(join(ROOT, `${TOPIC}.json`), 'utf8')) as { questions: unknown[]; worksheets: Record<string, { questionIds: string[] }> }
const bank = Question.array().parse(data.questions)
const written = (id: string) => bank.find((q) => q.id === id)!
const sheet = (level: string) => data.worksheets[level]!.questionIds.map(written)
const g = GENERATORS.find((x) => x.id === 'cs-strings')!

const build = (id: string, count = 300, prefix = 'structure') => Array.from({ length: count }, (_, i) => generate(g, written(id), `${prefix}-${i}`))
const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const code = (b: Generated) => /```\n([\s\S]*?)\n```/.exec(b.question.prompt)![1]!
function share<T>(items: T[], key: (x: T) => unknown) {
  const counts = new Map<unknown, number>()
  for (const x of items) counts.set(key(x), (counts.get(key(x)) ?? 0) + 1)
  return { worst: Math.max(...counts.values()) / items.length, distinct: counts.size }
}
const pays = (built: Generated[], route: (b: Generated) => number) => built.filter((b) => route(b) === answer(b)).length / built.length

function marksTyped(b: Generated) {
  const a = answer(b)
  for (const t of [String(a), ` ${a} `, a.toLocaleString('en-GB')]) expect(mark(b.question, t).correct, `${b.seed}: ${t}`).toBe(true)
  expect(mark(b.question, String(a + 1)).correct).toBe(false)
}

/** The first match of a letter, found by walking the word. */
function firstAt(word: string, c: string): number {
  for (let i = 0; i < word.length; i++) if (word.charAt(i) === c) return i
  return -1
}

describe('cs-strings', () => {
  it('covers every numeric written slot', () => {
    expect([...g.replaces].sort()).toEqual(['q1', 'q17', 'q19', 'q6', 'q9'])
    expect(bank.filter((q) => q.type === 'numeric').map((q) => q.id).sort()).toEqual(['q1', 'q17', 'q19', 'q6', 'q9'])
    expect(stringGenerators).toEqual([g])
  })

  it("keeps each slot's marks, units and exact tolerance, agrees with the interpreter, and never fails to draw over 3000 seeds", () => {
    for (const id of g.replaces) {
      const slot = written(id)
      for (let i = 0; i < 3000; i++) {
        const b = generate(g, slot, `throw-${i}`)
        expect(b.check.agrees, `${id} ${b.seed}: ${b.check.detail}`).toBe(true)
        if (i >= 300) continue
        const q = b.question
        if (q.type !== 'numeric' || slot.type !== 'numeric') throw new Error('not numeric')
        expect(q.units).toBe(slot.units)
        expect(q.tolerance).toBe(0)
        expect(q.markScheme.reduce((s, l) => s + l.marks, 0)).toBe(slot.marks)
        if (i < 60) marksTyped(b)
      }
    }
  })

  it('repeats no prompt in a twentieth of 1000 builds, and the written one in at most a twentieth', () => {
    for (const id of g.replaces) {
      const built = build(id, 1000, 'share')
      expect(share(built, (b) => b.question.prompt).worst, id).toBeLessThanOrEqual(0.05)
      expect(built.filter((b) => b.question.prompt === written(id).prompt).length, id).toBeLessThanOrEqual(50)
    }
  })

  it('q1: LEN counts every character, the space too; the last index and the letters alone never score', () => {
    const built = build('q1')
    let phrases = 0
    for (const b of built) {
      const s = /LEN\('([^']+)'\)/.exec(b.question.prompt)![1]!
      let n = 0
      for (const _ of s) n++
      expect(answer(b), b.seed).toBe(n)
      expect(n - 1).not.toBe(answer(b))
      if (s.includes(' ')) {
        phrases++
        expect(s.replace(/ /g, '').length).not.toBe(answer(b))
        expect(b.question.solution).toContain('the space')
      }
      expect(b.question.solution).toContain(`**${n}**`)
      expect(b.question.solution).toContain(`the last index, ${n - 1}.`)
    }
    expect(phrases / built.length).toBeGreaterThan(0.15)
    expect(share(build('q1', 1000, 'text'), (b) => b.values.text).worst).toBeLessThanOrEqual(0.03)
    expect(phrases / built.length).toBeLessThan(0.45)
    const answers = share(built, answer)
    expect(answers.worst).toBeLessThanOrEqual(0.4)
    expect(answers.distinct).toBeGreaterThanOrEqual(9)
    const seen = Array.from({ length: 5000 }, (_, i) => generate(g, written('q1'), `lit-${i}`))
    const pie = seen.find((b) => b.question.prompt.includes("'apple pie'"))!
    expect(pie.question.solution).toBe('Count every character, the space too: a-p-p-l-e, the space, then p-i-e, so 5 + 1 + 3 = **9**. LEN counts characters, so it is one more than the last index, 8.')
    const kb = seen.find((b) => b.question.prompt.includes("'keyboard'"))!
    expect(kb.question.solution).toBe('Count the characters, k-e-y-b-o-a-r-d: there are **8**. LEN counts characters, so it is one more than the last index, 7.')
  })

  it('q17: POSITION is the first match from 0; counting from 1 and the last match never score', () => {
    const built = build('q17')
    let repeated = 0
    for (const b of built) {
      const [, w, c] = /POSITION\('([a-z]+)', '([a-z])'\)/.exec(b.question.prompt)!
      const at = firstAt(w!, c!)
      expect(at, b.seed).toBeGreaterThanOrEqual(1)
      expect(answer(b), b.seed).toBe(at)
      expect(at + 1).not.toBe(answer(b))
      if (w!.lastIndexOf(c!) !== at) {
        repeated++
        expect(b.question.solution).toContain('comes later and does not count')
      }
      // The walk names each character from index 0 to the match.
      const walk = [...b.question.solution.matchAll(/'([a-z])' (?:is at index |at )(?:\*\*)?(\d+)/g)].map((m) => [m[1], Number(m[2])])
      expect(walk.slice(0, at + 1), b.seed).toEqual([...w!.slice(0, at + 1)].map((ch, i) => [ch, i]))
      expect(b.question.prompt).toContain('from 0')
    }
    expect(repeated / built.length).toBeGreaterThan(0.25)
    expect(pays(built, (b) => (b.values.last as number))).toBeLessThan(0.75)
    const answers = share(built, answer)
    expect(answers.worst).toBeLessThanOrEqual(0.4)
    expect(answers.distinct).toBe(10)
  })

  it('q6: the joined string counts its spaces and commas; the names alone, or a comma and space as one, never score', () => {
    const built = build('q6')
    const shapes = new Set<string>()
    for (const b of built) {
      const src = code(b)
      const vals = new Map([...src.matchAll(/^(\w+) ← '([^']*)'$/gm)].map((m) => [m[1]!, m[2]!]))
      const join = /^(\w+) ← ((?:\w+|'[^']*')(?: \+ (?:\w+|'[^']*'))+)$/m.exec(src)!
      const parts = join[2]!.split(' + ').map((p) => (p.startsWith("'") ? p.slice(1, -1) : vals.get(p)!))
      const whole = parts.join('')
      expect(answer(b), b.seed).toBe(whole.length)
      const names = parts.filter((p) => /^[A-Z]/.test(p))
      expect(names.reduce((s, p) => s + p.length, 0)).not.toBe(answer(b))
      expect(names.reduce((s, p) => s + p.length, 0) + names.length - 1 === answer(b)).toBe(!whole.includes(','))
      expect(b.question.solution).toContain(`\`${whole}\``)
      expect(src.split('\n').at(-1)).toBe(`OUTPUT LEN(${join[1]})`)
      expect(src).not.toMatch(/midname/)
      shapes.add(String(b.values.shape))
    }
    expect(shapes).toEqual(new Set(['space', 'comma', 'middle']))
    expect(share(built, answer).worst).toBeLessThanOrEqual(0.4)
    expect(share(built, answer).distinct).toBeGreaterThanOrEqual(10)
  })

  it('q9: the loop compares each character in turn; the trace is right row by row, and stopping one early rarely scores', () => {
    const built = build('q9')
    const shapes = new Map<string, number>()
    for (const b of built) {
      const src = code(b)
      const text = /^\w+ ← '([a-z]+)'$/m.exec(src)![1]!
      const from = Number(/FOR i ← (\d) TO/.exec(src)![1])
      const letters = [...src.matchAll(/= '([a-z])'/g)].map((m) => m[1]!)
      let count = 0
      let early = 0
      let all = 0
      for (let i = 0; i < text.length; i++) {
        const hit = letters.includes(text.charAt(i))
        if (hit) all++
        if (i < from) continue
        if (hit) count++
        if (hit && i < text.length - 1) early++
      }
      expect(answer(b), b.seed).toBe(count)
      expect(count).toBeGreaterThanOrEqual(from === 1 ? 1 : 2)
      expect(text.length - from).toBeLessThanOrEqual(8)
      if (from === 1) expect(all).not.toBe(answer(b))
      if (letters.length === 2) for (const l of letters) expect([...text].filter((c) => c === l).length).not.toBe(answer(b))
      ;(b.values as Record<string, unknown>).early = early
      // The trace: one row per character from the loop's start, a running count.
      const rows = b.question.solution.split('\n').filter((l) => /^\| \d/.test(l)).map((l) => l.split('|').map((c) => c.trim()).slice(1, -1))
      let c = 0
      expect(rows.length).toBe(text.length - from)
      rows.forEach((row, k) => {
        const i = k + from
        const hit = letters.includes(text.charAt(i))
        if (hit) c++
        expect(row, b.seed).toEqual([String(i), text.charAt(i), hit ? 'yes' : 'no', String(c)])
      })
      expect(b.question.solution).toContain(`The output is **${count}**.`)
      expect(text).not.toBe('level')
      shapes.set(String(b.values.shape), (shapes.get(String(b.values.shape)) ?? 0) + 1)
    }
    expect(pays(built, (b) => b.values.early as number)).toBeLessThanOrEqual(0.3)
    expect([...shapes.keys()].sort()).toEqual(['either', 'from-one', 'one'])
    const answers = share(built, answer)
    expect(answers.worst).toBeLessThanOrEqual(0.4)
    expect(answers.distinct).toBeGreaterThanOrEqual(4)
    const from1 = built.find((b) => b.values.shape === 'from-one')!
    const ones = built.filter((b) => b.values.shape === 'from-one')
    expect(share(ones, answer).distinct).toBe(3)
    expect(share(ones, answer).worst).toBeLessThanOrEqual(0.5)
    expect(from1.question.solution).toMatch(/the loop starts at i = 1, so it runs from 1 to \d: the '[a-z]' at index 0 is never checked\./)
  })

  it('q19: the line is split at its comma and the score converted; an exclusive end and POSITION from 1 never score', () => {
    const built = build('q19')
    let first = 0
    for (const b of built) {
      const src = code(b)
      const line = /^line ← '([^']+)'$/m.exec(src)![1]!
      const [left, right] = line.split(',') as [string, string]
      const scoreFirst = /^\d+$/.test(left)
      if (scoreFirst) first++
      const score = Number(scoreFirst ? left : right)
      const [, op, k] = /^OUTPUT score ([*+-]) (\d+)$/m.exec(src)!
      const value = op === '*' ? score * Number(k) : op === '+' ? score + Number(k) : score - Number(k)
      expect(answer(b), b.seed).toBe(value)
      const digits = String(score)
      const apply = (x: number) => (op === '*' ? x * Number(k) : op === '+' ? x + Number(k) : x - Number(k))
      expect(apply(Number(digits.slice(0, -1)))).not.toBe(answer(b)) // SUBSTRING with an exclusive end
      if (!scoreFirst) expect(apply(Number(digits.slice(1)))).not.toBe(answer(b)) // POSITION from 1 cuts from one place later
      expect(score).not.toBe(answer(b))
      const p = line.indexOf(',')
      const [a, z] = scoreFirst ? [0, p - 1] : [p + 1, line.length - 1]
      expect(b.question.markScheme[0]!.description).toBe(`SUBSTRING(${a}, ${z}, line) is '${digits}'`)
      expect(b.question.solution).toContain(`\`POSITION(line, ',')\` is ${p}:`)
      if (op === '*') expect(answer(b)).toBeLessThanOrEqual(200)
    }
    expect(first / built.length).toBeGreaterThan(0.2)
    expect(share(built, answer).worst).toBeLessThanOrEqual(0.1)
    expect(share(built, (b) => b.values.line).distinct).toBeGreaterThan(200)
  })

  it('sheets: q1 and q17 never print the same word; q9 never prints a name q19 uses', () => {
    expect(LEN_WORDS.filter((w) => (POSITION_WORDS as readonly string[]).includes(w))).toEqual([])
    for (const w of ['sun', 'set', 'sunset']) expect([...LEN_WORDS, ...LEN_PHRASES, ...POSITION_WORDS] as string[]).not.toContain(w)
    for (let i = 0; i < 200; i++) {
      const core = sheetQuestions('computer-science', TOPIC, sheet('core'), `core-${i}`)
      const get = (s: typeof core, id: string) => s.find((x) => x.question.id === id)!.question.prompt
      const w1 = /LEN\('([^']+)'\)/.exec(get(core, 'q1'))![1]!
      const w17 = /POSITION\('([^']+)'/.exec(get(core, 'q17'))![1]!
      expect(w1).not.toBe(w17)
      const adv = sheetQuestions('computer-science', TOPIC, sheet('advanced'), `adv-${i}`)
      const text = /← '([a-z]+)'/.exec(get(adv, 'q9'))![1]!
      expect(LINE_NAMES.map((n) => n.toLowerCase())).not.toContain(text)
    }
  })
})
