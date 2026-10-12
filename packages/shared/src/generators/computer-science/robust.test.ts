import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import { nearMisses, robustGenerators } from './robust.ts'

/**
 * Structural tests for the robust-programming generators (AQA 8525 3.2.11). Each reads the
 * printed loop and the typed values back out of the prompt and works the count again here by
 * stepping the loop by hand (no interpreter), checks the printed steps, that the named slips
 * never or rarely score (forgetting the ask before the loop, one pass too many, the number in the
 * condition, the list's length, < read as ≤), and the spread over builds.
 */
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/computer-science')
const TOPIC = 'robust-and-secure-programming'
const bank = Question.array().parse(JSON.parse(readFileSync(join(ROOT, `${TOPIC}.json`), 'utf8')).questions)
const written = (id: string) => bank.find((q) => q.id === id)!
const g = GENERATORS.find((x) => x.id === 'cs-robust')!

const build = (id: string, count = 300, prefix = 'structure') => Array.from({ length: count }, (_, i) => generate(g, written(id), `${prefix}-${i}`))
const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const code = (b: Generated) => /```\n([\s\S]*?)\n```/.exec(b.question.prompt)![1]!
function share<T>(items: T[], key: (x: T) => unknown) {
  const counts = new Map<unknown, number>()
  for (const x of items) counts.set(key(x), (counts.get(key(x)) ?? 0) + 1)
  return { worst: Math.max(...counts.values()) / items.length, distinct: counts.size }
}
const pays = (built: Generated[], route: (b: Generated) => number) => built.filter((b) => route(b) === answer(b)).length / built.length
/** The typed values a prompt lists, in order: `x`, or nothing (just Enter) for ''. */
const typedIn = (prompt: string) => {
  const head = prompt.split('```')[0]!
  const m = /types? (`.+?|nothing.+?)(?:, one at a time| into this program)/.exec(head)
  if (!m) return null
  return m[1]!.split(', then ').map((t) => (t === 'nothing (just Enter)' ? '' : t.slice(1, -1)))
}

function marksTyped(b: Generated) {
  const a = answer(b)
  for (const t of [String(a), ` ${a} `, a.toLocaleString('en-GB')]) expect(mark(b.question, t).correct, `${b.seed}: ${t}`).toBe(true)
  expect(mark(b.question, String(a + 1)).correct).toBe(false)
}

/** Steps the printed password loop by hand: how many asks and wrong messages when every attempt fails before `stored` is typed. */
function stepLock(src: string, typed: string[] | null, stored: string | null) {
  const wrong = (n: number) => (typed ? typed[n - 1] !== stored : true)
  let asks = 0
  let messages = 0
  if (/^REPEAT$/m.test(src)) {
    const L = Number(/attempts = (\d+)$/m.exec(src)![1])
    let attempts = 0
    do {
      asks++
      attempts++
      if (wrong(asks)) messages++
    } while (!(!wrong(asks) || attempts === L))
    return { asks, messages, L }
  }
  const init = /^(\w+) ← (\d+)$/m.exec(src)!
  const cond = /AND (\w+) (<|≤|>) (\d+)$/m.exec(src)!
  let v = Number(init[2])
  const L = Number(cond[3])
  const down = /- 1$/m.test(src)
  const test = () => (cond[2] === '<' ? v < L : cond[2] === '≤' ? v <= L : v > L)
  asks = 1
  while (wrong(asks) && test()) {
    v += down ? -1 : 1
    messages++
    asks++
  }
  return { asks, messages, L }
}

describe('cs-robust', () => {
  it('covers every numeric written slot', () => {
    expect([...g.replaces].sort()).toEqual(['q11', 'q18'])
    expect(bank.filter((q) => q.type === 'numeric').map((q) => q.id).sort()).toEqual(['q11', 'q18'])
    expect(robustGenerators).toEqual([g])
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

  it('near misses are realistic and never the password', () => {
    expect(nearMisses('maple7')).toEqual(['maple', 'Maple7', 'mpale7', 'maple7!', 'maple77', 'maple8'])
    for (const pw of ['tiger42', 'blue88', 'comet9']) expect(nearMisses(pw)).not.toContain(pw)
  })

  it('q11: the asks and messages stepped by hand; one too few, one too many and the list never score, the loop limit in about a quarter', () => {
    const built = build('q11', 600)
    const forms = new Set<string>()
    let listed = 0
    for (const b of built) {
      const src = code(b)
      const typed = typedIn(b.question.prompt)
      const stored = /holds the correct password, `([^`]+)`/.exec(b.question.prompt)?.[1] ?? null
      const s = stepLock(src, typed, stored)
      const asksFor = /how many times in total is the user asked/i.test(b.question.prompt)
      const msg = asksFor ? null : /how many times is `([^`]+)` output/i.exec(b.question.prompt)![1]!
      expect(answer(b), b.seed).toBe(asksFor ? s.asks : s.messages)
      if (msg) expect(src).toContain(`OUTPUT '${msg}'`)
      if (/^REPEAT$/m.test(src)) expect(src).not.toMatch(/try again/)
      // Forgetting the ask before the loop (the passes alone), or counting the asks where the messages are asked for.
      if (!/^REPEAT$/m.test(src)) expect(asksFor ? s.messages : s.asks).not.toBe(answer(b))
      expect(answer(b)).toBeGreaterThanOrEqual(2)
      expect(answer(b)).toBeLessThanOrEqual(8)
      if (typed) {
        listed++
        // The right password comes after the lock-out: the count is the loop's, not the list's.
        expect(typed.at(-1)).toBe(stored)
        expect(typed.indexOf(stored!)).toBeGreaterThan(s.asks)
        expect(typed.indexOf(stored!)).not.toBe(answer(b))
        expect(typed.length).not.toBe(answer(b))
        for (const t of typed) expect(t.length, b.seed).toBeGreaterThanOrEqual(4)
        expect(b.question.solution).toContain('so the correct password is never read')
      }
      ;(b.values as Record<string, unknown>).limit = s.L
      forms.add(String(b.values.form))
      expect(b.question.solution).toMatch(/so the loop stops/)
    }
    expect(forms).toEqual(new Set(['up', 'up-le', 'up-one', 'down', 'repeat']))
    expect(listed / built.length).toBeGreaterThan(0.25)
    expect(pays(built, (b) => b.values.limit as number)).toBeLessThanOrEqual(0.3)
    const answers = share(built, answer)
    expect(answers.worst).toBeLessThanOrEqual(0.4)
    expect(answers.distinct).toBeGreaterThanOrEqual(6)
  })

  it('q11: the written form traces as the written solution does', () => {
    const seen = Array.from({ length: 3000 }, (_, i) => generate(g, written('q11'), `lit-${i}`))
    const b = seen.find((x) => x.values.form === 'up' && x.values.L === 2 && x.values.ask === 'asks' && x.values.listed === 'no')!
    expect(b.question.solution.split('\n').slice(0, 4)).toEqual([
      '- Before the loop: asked once (1).',
      expect.stringMatching(/^- Pass 1: attempts becomes 1, `[^`]+`, asked again \(2\)\.$/),
      expect.stringMatching(/^- Pass 2: attempts becomes 2, `[^`]+`, asked again \(3\)\.$/),
      '- Now attempts is 2 and 2 < 2 is False, so the loop stops.',
    ])
    expect(b.question.markScheme[0]!.description).toBe('One input before the loop and the loop runs twice')
    expect(answer(b)).toBe(3)
  })

  it('q18: the rejected inputs counted until the first accepted one; the list, every failing value and < read as ≤ rarely or never score', () => {
    const built = build('q18', 600)
    const checks = new Map<string, number>()
    let past = 0
    let edge = 0
    for (const b of built) {
      const src = code(b)
      const typed = typedIn(b.question.prompt)!
      let ok: (t: string) => boolean
      let okLe: (t: string) => boolean
      const len = /WHILE LEN\(\w+\) < (\d+)$/m.exec(src)
      const user = /WHILE name = '' OR LEN\(name\) < (\d+)$/m.exec(src)
      const range = /WHILE \w+ < (\d+) OR \w+ > (\d+)$/m.exec(src)
      if (user) {
        const L = Number(user[1])
        ok = (t) => t !== '' && t.length >= L
        okLe = (t) => t !== '' && t.length > L
      } else if (len) {
        const L = Number(len[1])
        ok = (t) => t.length >= L
        okLe = (t) => t.length > L
      } else {
        const [lo, hi] = [Number(range![1]), Number(range![2])]
        ok = (t) => Number(t) >= lo && Number(t) <= hi
        okLe = (t) => Number(t) > lo && Number(t) < hi
      }
      const first = typed.findIndex(ok)
      expect(first, b.seed).toBeGreaterThanOrEqual(1)
      const asksMessages = /How many times is `/.test(b.question.prompt)
      expect(answer(b), b.seed).toBe(asksMessages ? first : first + 1)
      if (typed.length > first + 1) {
        past++
        expect(b.question.solution).toContain('never read')
      }
      // Every failing value in the list, including those after the loop has ended.
      ;(b.values as Record<string, unknown>).failing = asksMessages ? typed.filter((t) => !ok(t)).length : typed.length
      const firstLe = typed.findIndex(okLe)
      if (firstLe !== first) edge++
      // All but the last value typed (messages), or every value typed (inputs read).
      ;(b.values as Record<string, unknown>).listLess = asksMessages ? typed.length - 1 : typed.length
      ;(b.values as Record<string, unknown>).le = asksMessages ? (firstLe < 0 ? typed.length : firstLe) : firstLe < 0 ? typed.length + 1 : firstLe + 1
      // One line of working per value read.
      expect(b.question.solution.split('\n').filter((l) => l.startsWith('- ')).length).toBe(first + 1)
      checks.set(String(b.values.check), (checks.get(String(b.values.check)) ?? 0) + 1)
    }
    expect([...checks.keys()].sort()).toEqual(['length', 'range', 'username'])
    expect(past / built.length).toBeGreaterThan(0.8)
    expect(edge / built.length).toBeGreaterThan(0.75)
    expect(pays(built, (b) => b.values.listLess as number)).toBeLessThanOrEqual(0.15)
    expect(pays(built, (b) => b.values.failing as number)).toBeLessThanOrEqual(0.15)
    expect(pays(built, (b) => b.values.le as number)).toBeLessThanOrEqual(0.2)
    const answers = share(built, answer)
    expect(answers.worst).toBeLessThanOrEqual(0.4)
    expect(answers.distinct).toBeGreaterThanOrEqual(5)
    const written18 = built.find((b) => b.values.check === 'length')!
    expect(written18.question.prompt).toMatch(/^The user is ready to type `\w+`(?:, then `\w+`)+, one at a time as this program asks\. How many times is `Too short` output\?/)
    expect(written18.question.solution).toMatch(/^- \w+ has \d+ characters and \d+ < \d+ is True, so `Too short` is output\.$/m)
  })
})
