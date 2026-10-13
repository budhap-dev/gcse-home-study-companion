import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate, sheetQuestions } from '../index.ts'
import type { Generated } from '../types.ts'
import { loopGenerators } from './loops.ts'

/**
 * Structural tests for selection-iteration-and-tracing (AQA 8525 3.2.2). Each reads the printed
 * program back with regular expressions written here and runs it with JavaScript loops written
 * here (no interpreter, no generator helper), checks the printed trace, literal builds, the named
 * wrong routes (a FOR loop one short or from 0, a WHILE one pass more or less, a REPEAT body
 * skipped, nested passes added, the first output for the last, precedence left to right) and the
 * spread of answers and inputs.
 */
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/computer-science')
const TOPIC = 'selection-iteration-and-tracing'
const topic = JSON.parse(readFileSync(join(ROOT, `${TOPIC}.json`), 'utf8'))
const BANK = Question.array().parse(topic.questions)
const slotOf = (id: string) => BANK.find((q) => q.id === id)!
const SLOTS: Record<string, string> = {
  q1: 'cs-loops-for-sum',
  q5: 'cs-loops-while-grow',
  q6: 'cs-loops-repeat',
  q7: 'cs-loops-nested-count',
  q10: 'cs-loops-select-count',
  q11: 'cs-loops-while-down',
  q15: 'cs-loops-for-expression',
  q18: 'cs-loops-nested-output',
}
const gen = (id: string) => GENERATORS.find((x) => x.id === id)!
const build = (slotId: string, n = 300, prefix = 'structure') => Array.from({ length: n }, (_, i) => generate(gen(SLOTS[slotId]!), slotOf(slotId), `${prefix}-${i}`))
const at = (slotId: string, seed: string) => generate(gen(SLOTS[slotId]!), slotOf(slotId), seed)
const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const lines = (b: Generated) => b.question.markScheme.map((l) => `${l.code} ${l.description}`)
const code = (b: Generated) => /```\n([\s\S]*?)\n```/.exec(b.question.prompt)?.[1] ?? ''
const range = (s: number, e: number) => Array.from({ length: Math.max(0, e - s + 1) }, (_, i) => s + i)

function share<T>(built: Generated[], key: (b: Generated) => T) {
  const counts = new Map<T, number>()
  for (const b of built) counts.set(key(b), (counts.get(key(b)) ?? 0) + 1)
  return { worst: Math.max(...counts.values()) / built.length, distinct: counts.size }
}
const pays = (built: Generated[], route: (b: Generated) => number | number[]) =>
  built.filter((b) => [route(b)].flat().includes(answer(b))).length / built.length
const compare = (x: number, op: string, y: number) => ({ '<': x < y, '>': x > y, '≤': x <= y, '≥': x >= y, '=': x === y, '≠': x !== y })[op]!

describe('selection-iteration-and-tracing builds', () => {
  it('stand in for every numeric question in the topic', () => {
    expect(loopGenerators.flatMap((g) => g.replaces).sort()).toEqual(Object.keys(SLOTS).sort())
    expect(BANK.filter((q) => q.type === 'numeric').map((q) => q.id).sort()).toEqual(Object.keys(SLOTS).sort())
  })

  for (const slotId of Object.keys(SLOTS)) {
    const slot = slotOf(slotId)
    it(`${slotId}: keeps the written codes, no units and exact tolerance, is marked right typed plain or grouped, and never fails to draw over 3000 seeds`, () => {
      for (let i = 0; i < 3000; i++) {
        const b = generate(gen(SLOTS[slotId]!), slot, `throw-${i}`)
        if (i >= 300) continue
        const q = b.question
        if (q.type !== 'numeric') throw new Error('not numeric')
        expect(q.units).toBeUndefined()
        expect(q.tolerance).toBe(0)
        expect(q.markScheme.map((l) => l.code)).toEqual(slot.markScheme.map((l) => l.code))
        expect(b.check.agrees, b.seed).toBe(true)
        for (const t of [String(q.answer), ` ${q.answer} `, q.answer.toLocaleString('en-GB')]) expect(mark(q, t).correct, `${b.seed}: ${t}`).toBe(true)
        expect(mark(q, String(q.answer + 1)).correct).toBe(false)
        expect(mark(q, String(q.answer - 1)).correct).toBe(false)
      }
    })

    it(`${slotId}: repeats no prompt in a twentieth of 1000 builds, and the written one in at most a fiftieth`, () => {
      const counts = new Map<string, number>()
      for (const b of build(slotId, 1000, 'release')) counts.set(b.question.prompt, (counts.get(b.question.prompt) ?? 0) + 1)
      expect(counts.size).toBeGreaterThan(100)
      expect(Math.max(...counts.values())).toBeLessThanOrEqual(50)
      expect(counts.get(slot.prompt) ?? 0).toBeLessThanOrEqual(20)
    })
  }

  it('never answers another question on its sheet: no FOR 3 TO 7 beside the core q2, no 2, 6, 10 trace beside the higher q8', () => {
    for (let i = 0; i < 300; i++) {
      for (const level of ['core', 'higher']) {
        const sheet = sheetQuestions('computer-science', TOPIC, topic.worksheets[level].questionIds.map(slotOf), `sheet-${i}`)
        for (const s of sheet) {
          if (!s.generated) continue
          if (level === 'core') expect(s.question.prompt).not.toMatch(/FOR \w ← 3 TO 7\n/)
          expect(s.question.prompt).not.toMatch(/STEP/)
          // The values the variable takes, as the trace prints them ("goes 1 → 3 → 9", "starts at 0, then takes 2, 4, 6").
          const trace = /goes ([\d →]+)\.|starts at (\d+), then takes ([\d, ]+)\./.exec(s.question.solution)
          if (trace) {
            const values = trace.slice(1).filter(Boolean).join(' ').match(/\d+/g)!.map(Number)
            expect([2, 6, 10].every((x) => values.includes(x)), s.question.solution).toBe(false)
          }
        }
      }
    }
  })
})

// ---------------------------------------------------------------------------------------------

describe('q1: a FOR loop adding i', () => {
  const built = build('q1')
  const read = (b: Generated) => {
    const c = code(b)
    const t0 = Number(/^total ← (\d+)$/m.exec(c)![1])
    const m = /^FOR (\w) ← (\d+) TO (\d+)$/m.exec(c)!
    return { t0, v: m[1]!, s: Number(m[2]), e: Number(m[3]) }
  }
  const add = (t: number, s: number, e: number) => range(s, e).reduce((x, i) => x + i, t)

  it('outputs the starting total plus s + … + e, and prints each pass', () => {
    for (const b of built) {
      const { t0, v, s, e } = read(b)
      expect(answer(b), b.seed).toBe(add(t0, s, e))
      expect(e - s + 1 >= 3 && e - s + 1 <= 7).toBe(true)
      expect(b.question.solution).toContain(`The loop runs for ${v} = ${range(s, e).join(', ')} (both limits included)`)
      expect(lines(b)[1]).toBe(`A1 ${add(t0, s, e)}`)
      expect(lines(b)[0]).toMatch(new RegExp(`^M1 \\w+ iterations, ${v} from ${s} to ${e}$`))
      if (t0) expect(t0 < s || t0 > e).toBe(true)
    }
  })

  it('prints literal builds', () => {
    const b = at('q1', 'lit-d')
    expect(b.question.prompt).toBe('What is output?\n\n```\ntotal ← 0\nFOR i ← 6 TO 10\n   total ← total + i\nENDFOR\nOUTPUT total\n```')
    expect(b.question.solution).toBe('The loop runs for i = 6, 7, 8, 9, 10 (both limits included) and adds each, so total goes 0, 6, 13, 21, 30, 40: $6 + 7 + 8 + 9 + 10 = $ **40**.')
    expect(lines(b)).toEqual(['M1 five iterations, i from 6 to 10', 'A1 40'])
    expect(at('q1', 'lit-b').question.solution).toBe('total starts at 13. The loop runs for i = 1, 2, 3 (both limits included) and adds each, so total goes 13, 14, 16, 19: $13 + 1 + 2 + 3 = $ **19**.')
  })

  it('never pays one pass short or long, the pass count, the last i, or a forgotten starting total', () => {
    expect(pays(built, (b) => { const { t0, s, e } = read(b); return [add(t0, s, e - 1), add(t0, s, e + 1), e - s + 1, e, t0 ? add(0, s, e) : -1] })).toBe(0)
  })

  it('pays adding from 1 (or from 0) in under a quarter of builds', () => {
    expect(pays(built, (b) => add(read(b).t0, 1, read(b).e))).toBeLessThan(0.25)
  })

  it('spreads answers, starts and lengths', () => {
    expect(share(built, answer).worst).toBeLessThan(0.1)
    expect(share(built, answer).distinct).toBeGreaterThan(30)
    expect(share(built, (b) => read(b).s).distinct).toBe(6)
    expect(share(built, (b) => read(b).e - read(b).s).distinct).toBe(5)
  })
})

// ---------------------------------------------------------------------------------------------

describe('q5: WHILE, growing past a limit', () => {
  const built = build('q5')
  const read = (b: Generated) => {
    const c = code(b)
    const start = Number(/^\w ← (\d+)$/m.exec(c)![1])
    const w = /^WHILE \w (<|≤) (\d+)$/m.exec(c)!
    const body = /^ {3}\w ← \w ([*+]) (\d+)$/m.exec(c)!
    return { start, cmp: w[1]!, limit: Number(w[2]), op: body[1]!, by: Number(body[2]) }
  }
  const trace = (b: Generated) => {
    const { start, cmp, limit, op, by } = read(b)
    const seen = [start]
    while (compare(seen.at(-1)!, cmp, limit)) seen.push(op === '*' ? seen.at(-1)! * by : seen.at(-1)! + by)
    return seen
  }

  it('outputs the first value that fails the test, after two or more passes, and prints the trace', () => {
    for (const b of built) {
      const seen = trace(b)
      expect(answer(b), b.seed).toBe(seen.at(-1))
      expect(seen.length - 1).toBeGreaterThanOrEqual(2)
      expect(answer(b)).toBeLessThanOrEqual(150)
      expect(b.question.solution).toContain(`goes ${seen.join(' → ')}.`)
      expect(lines(b)).toEqual([`M1 ${seen.slice(1).join(', ')} in the trace`, `A1 ${answer(b)}`])
    }
  })

  it('prints literal builds', () => {
    const b = at('q5', 'lit-a')
    expect(b.question.prompt).toBe('What is output?\n\n```\nn ← 4\nWHILE n ≤ 8\n   n ← n * 2\nENDWHILE\nOUTPUT n\n```')
    expect(b.question.solution).toBe('n goes 4 → 8 → 16. At 8 the condition `n ≤ 8` is still True, because 8 is equal to 8, so the loop runs once more. At 16 the condition `n ≤ 8` is False, so the loop stops and **16** is output. The loop overshoots the limit: that is normal, and a trace table shows it.')
    expect(at('q5', 'lit-c').question.solution).toBe('x goes 4 → 12 → 36 → 108. At 108 the condition `x < 70` is False, so the loop stops and **108** is output. The loop overshoots the limit: that is normal, and a trace table shows it.')
  })

  it('never pays stopping one pass early, one pass too many, the limit, the pass count or the start', () => {
    expect(pays(built, (b) => { const seen = trace(b); const { op, by, limit, start } = read(b); return [seen.at(-2)!, op === '*' ? answer(b) * by : answer(b) + by, limit, seen.length - 1, start, by] })).toBe(0)
  })

  it('has ≤ loops that hit the limit exactly, where reading ≤ as < stops a pass early', () => {
    const hits = built.filter((b) => read(b).cmp === '≤' && trace(b).includes(read(b).limit)).length / built.length
    expect(hits > 0.15 && hits < 0.35).toBe(true)
  })

  it('spreads answers, starts, limits and both kinds', () => {
    expect(share(built, answer).worst).toBeLessThan(0.1)
    expect(share(built, answer).distinct).toBeGreaterThan(30)
    expect(share(built, (b) => read(b).limit).distinct).toBeGreaterThan(30)
    const plus = built.filter((b) => read(b).op === '+').length / built.length
    expect(plus > 0.25 && plus < 0.45).toBe(true)
  })
})

// ---------------------------------------------------------------------------------------------

describe('q6: REPEAT … UNTIL', () => {
  const built = build('q6')
  const read = (b: Generated) => {
    const c = code(b)
    const start = Number(/^\w+ ← (\d+)$/m.exec(c)![1])
    const body = /^ {3}\w+ ← \w+ ([*+-]) (\d+)$/m.exec(c)!
    const u = /^UNTIL \w+ (\S) (\d+)$/m.exec(c)!
    return { start, op: body[1]!, by: Number(body[2]), cmp: u[1]!, limit: Number(u[2]) }
  }
  const step = (x: number, op: string, by: number) => (op === '+' ? x + by : op === '-' ? x - by : x * by)
  /** The body first, then the test. */
  const trace = (b: Generated) => {
    const { start, op, by, cmp, limit } = read(b)
    const seen = [start]
    do seen.push(step(seen.at(-1)!, op, by))
    while (!compare(seen.at(-1)!, cmp, limit))
    return seen
  }

  it('runs the body before each test and outputs the first value that passes', () => {
    for (const b of built) {
      const seen = trace(b)
      expect(answer(b), b.seed).toBe(seen.at(-1))
      expect(answer(b) >= 1 && answer(b) <= 100).toBe(true)
      const already = compare(read(b).start, read(b).cmp, read(b).limit)
      const v = /^(\w+) ← \d+$/m.exec(code(b))![1]
      expect(lines(b)[0]).toBe(already ? `M1 ${v} becomes ${answer(b)} before the first test` : `M1 ${seen.slice(1).join(', ')}`)
      if (already) expect(seen.length).toBe(2)
      else expect(seen.length - 1).toBeGreaterThanOrEqual(2)
    }
  })

  it('prints literal builds', () => {
    const b = at('q6', 'lit-y')
    expect(b.question.prompt).toBe('What is output?\n\n```\ncount ← 16\nREPEAT\n   count ← count + 9\nUNTIL count > 12\nOUTPUT count\n```')
    expect(b.question.solution).toBe('The body runs before the condition is tested, so count becomes 25 first. Then `count > 12` is True, so the loop ends: **25**. A REPEAT loop always runs at least once, even when the condition is already True at the start.')
    expect(lines(b)).toEqual(['M1 count becomes 25 before the first test', 'A1 25'])
    expect(at('q6', 'lit-c').question.prompt).toBe('What is output?\n\n```\nn ← 45\nREPEAT\n   n ← n - 2\nUNTIL n < 39\nOUTPUT n\n```')
    expect(at('q6', 'lit-c').question.solution).toBe('n starts at 45, then takes 43, 41, 39, 37. After 39 the condition `n < 39` is still False, because 39 is equal to 39, so the body runs again. After 37 the condition `n < 39` is True, so the loop ends: **37**. UNTIL stops when the condition becomes True.')
    expect(at('q6', 'lit-e').question.solution).toBe('x starts at 3, then takes 6, 12, 24. After 24 the condition `x ≥ 20` is True, so the loop ends: **24**. UNTIL stops when the condition becomes True.')
  })

  it('never pays the body skipped, one pass short or long, the limit, the pass count or the first pass alone', () => {
    expect(
      pays(built, (b) => {
        const seen = trace(b)
        const { op, by, limit } = read(b)
        return [seen.at(-2)!, step(answer(b), op, by), limit, seen.length - 1, ...(seen.length > 2 ? [seen[1]!] : [])]
      }),
    ).toBe(0)
  })

  it('makes < and ≤ (or > and ≥) differ in about a fifth of builds: a strict limit the trace reaches', () => {
    const FLIP: Record<string, string> = { '<': '≤', '≤': '<', '>': '≥', '≥': '>' }
    const flipped = (b: Generated) => {
      const { start, op, by, cmp, limit } = read(b)
      const seen = [start]
      do seen.push(step(seen.at(-1)!, op, by))
      while (!compare(seen.at(-1)!, FLIP[cmp]!, limit))
      return seen.at(-1)!
    }
    const differs = built.filter((b) => flipped(b) !== answer(b)).length / built.length
    expect(differs > 0.13 && differs < 0.3).toBe(true)
  })

  it('starts with the condition already True in about a tenth of builds, the limit within 6 of the start', () => {
    const already = built.filter((b) => compare(read(b).start, read(b).cmp, read(b).limit))
    expect(already.length / built.length > 0.05 && already.length / built.length < 0.15).toBe(true)
    for (const b of already) expect(Math.abs(read(b).limit - read(b).start)).toBeLessThanOrEqual(6)
  })

  it('spreads answers, kinds and tests', () => {
    expect(share(built, answer).worst).toBeLessThan(0.1)
    expect(share(built, answer).distinct).toBeGreaterThan(30)
    expect(share(built, (b) => read(b).op).distinct).toBe(3)
    expect(share(built, (b) => read(b).cmp).distinct).toBe(4)
  })
})

// ---------------------------------------------------------------------------------------------

describe('q7: how often a line in nested loops runs', () => {
  const built = build('q7')
  const read = (b: Generated) => {
    const c = code(b)
    const i = /FOR i ← (\d+) TO (\d+)/.exec(c)!
    const j = /FOR j ← (\d+) TO (\d+)/.exec(c)!
    const asked = /`(\w+) ← \w+ \+ 1` executed/.exec(b.question.prompt)![1]!
    const [a, bb, cc, d] = [i[1], i[2], j[1], j[2]].map(Number) as [number, number, number, number]
    return { a, b: bb, c: cc, d, o: bb - a + 1, n: d - cc + 1, asked, twoLines: /rows ← rows \+ 1/.test(c) }
  }
  /** Runs the loops by hand, counting each line. */
  const count = (b: Generated) => {
    const { a, b: bb, c, d } = read(b)
    let total = 0
    let rows = 0
    for (let i = a; i <= bb; i++) {
      for (let j = c; j <= d; j++) total++
      rows++
    }
    return read(b).asked === 'total' ? total : rows
  }

  it('counts the asked line: inner passes × outer passes, or the outer passes alone', () => {
    for (const b of built) {
      const { o, n, asked } = read(b)
      expect(answer(b), b.seed).toBe(count(b))
      expect(o >= 2 && o <= 5 && n >= 2 && n <= 6 && o !== n && o * n <= 24).toBe(true)
      expect(lines(b)[0]).toBe(asked === 'total' ? `M1 ${o} × ${n}` : `M1 once for each outer pass, i from ${read(b).a} to ${read(b).b}`)
    }
  })

  it('prints literal builds', () => {
    const b = at('q7', 'lit-a')
    expect(b.question.prompt).toBe('How many times is `total ← total + 1` executed?\n\n```\ntotal ← 0\nFOR i ← 2 TO 6\n   FOR j ← 0 TO 1\n      total ← total + 1\n   ENDFOR\nENDFOR\n```')
    expect(b.question.solution).toBe('The outer loop runs 5 times (i = 2, 3, 4, 5, 6) and the inner loop runs twice (j = 0, 1) for **each** outer pass: $5 \\times 2 = $ **10**.')
    expect(lines(b)).toEqual(['M1 5 × 2', 'A1 10'])
  })

  it('never pays the passes added, both loops one short, or (for the outer line) the passes multiplied', () => {
    expect(pays(built, (b) => { const { o, n } = read(b); return read(b).asked === 'total' ? [o + n, (o - 1) * (n - 1), o, n] : [o * n, n] })).toBe(0)
  })

  it('pays multiplying the printed end values only where both loops start at 1, in under a quarter of builds', () => {
    expect(pays(built, (b) => read(b).b * read(b).d)).toBeLessThan(0.25)
    expect(pays(built.filter((b) => !(read(b).a === 1 && read(b).c === 1)), (b) => read(b).b * read(b).d)).toBe(0)
  })

  it('spreads answers, starts and both lines', () => {
    expect(share(built, answer).worst).toBeLessThan(0.2)
    expect(share(built, answer).distinct).toBeGreaterThanOrEqual(10)
    expect(share(built, (b) => read(b).a).distinct).toBe(4)
    const outer = built.filter((b) => read(b).asked === 'rows').length / built.length
    expect(outer > 0.1 && outer < 0.3).toBe(true)
  })
})

// ---------------------------------------------------------------------------------------------

describe('q10: selection inside iteration', () => {
  const built = build('q10')
  const read = (b: Generated) => {
    const c = code(b)
    const f = /FOR i ← (\d+) TO (\d+)/.exec(c)!
    const cond = /IF (.+) THEN/.exec(c)![1]!
    return { s: Number(f[1]), e: Number(f[2]), cond }
  }
  const test = (cond: string, i: number) => {
    const m = /^i MOD (\d) = (\d)$/.exec(cond)
    if (m) return i % Number(m[1]) === Number(m[2])
    const t = /^i (>|≥) (\d+)$/.exec(cond)!
    return compare(i, t[1]!, Number(t[2]))
  }
  const counted = (cond: string, s: number, e: number) => range(s, e).filter((i) => test(cond, i)).length

  it('counts the passes where the IF is True, True at the last i', () => {
    for (const b of built) {
      const { s, e, cond } = read(b)
      expect(answer(b), b.seed).toBe(counted(cond, s, e))
      expect(test(cond, e)).toBe(true)
      expect(answer(b)).not.toBe(s)
      expect(e - s + 1 >= 5 && e - s + 1 <= 9).toBe(true)
      expect(b.question.solution).toContain(`\`${cond}\` is True `)
      expect(b.question.solution).toContain(`${range(s, e).filter((i) => test(cond, i)).join(', ')}: **${answer(b)}** of them.`)
    }
  })

  it('prints literal builds', () => {
    const b = at('q10', 'lit-d')
    expect(b.question.prompt).toBe('What is output?\n\n```\ncount ← 0\nFOR i ← 4 TO 12\n   IF i ≥ 8 THEN\n      count ← count + 1\n   ENDIF\nENDFOR\nOUTPUT count\n```')
    expect(b.question.solution).toBe('i runs from 4 to 12. `i ≥ 8` is True for i = 8, 9, 10, 11, 12: **5** of them.')
    expect(lines(b)).toEqual(['M1 i from 8 to 12', 'A1 5'])
    expect(at('q10', 'lit-b').question.solution).toBe('i runs from 3 to 9. `i MOD 2 = 1` is True for the odd numbers 3, 5, 7, 9: **4** of them.')
  })

  it('never pays a FOR loop one short, every pass, the complement, or > and ≥ swapped', () => {
    expect(pays(built, (b) => { const { s, e, cond } = read(b); return [counted(cond, s, e - 1), e - s + 1, e - s + 1 - answer(b)] })).toBe(0)
    const thresholds = built.filter((b) => /[>≥]/.test(read(b).cond))
    expect(pays(thresholds, (b) => { const { s, e, cond } = read(b); return counted(cond.includes('>') ? cond.replace('>', '≥') : cond.replace('≥', '>'), s, e) })).toBe(0)
  })

  // A loop from 1 read as from 0 adds i = 0, which passes an even or multiple-of-3 test.
  it('pays a loop from 1 read as from 0 in under a quarter of builds', () => {
    expect(pays(built, (b) => (read(b).s === 1 ? counted(read(b).cond, 0, read(b).e) : -1))).toBeLessThan(0.25)
  })

  it('spreads tests, answers and starts', () => {
    expect(share(built, (b) => read(b).cond.replace(/([>≥]) \d+$/, '$1 k')).distinct).toBe(5)
    const thresholds = built.filter((b) => /[>≥]/.test(read(b).cond)).length / built.length
    expect(thresholds > 0.5 && thresholds < 0.7).toBe(true)
    expect(share(built, answer).worst).toBeLessThan(0.3)
    expect(share(built, answer).distinct).toBeGreaterThanOrEqual(6)
    expect(share(built, (b) => read(b).s).distinct).toBe(5)
  })
})

// ---------------------------------------------------------------------------------------------

describe('q11: WHILE, falling past a limit', () => {
  const built = build('q11')
  const read = (b: Generated) => {
    const c = code(b)
    const start = Number(/^\w ← (\d+)$/m.exec(c)![1])
    const w = /^WHILE \w (>|≥) (\d+)$/m.exec(c)!
    const minus = /^ {3}\w ← \w - (\d+)$/m.exec(c)
    return { start, cmp: w[1]!, limit: Number(w[2]), k: minus ? Number(minus[1]) : 0, halve: !minus }
  }
  const trace = (b: Generated) => {
    const { start, cmp, limit, k, halve } = read(b)
    const seen = [start]
    while (compare(seen.at(-1)!, cmp, limit)) seen.push(halve ? Math.floor(seen.at(-1)! / 2) : seen.at(-1)! - k)
    return seen
  }

  it('outputs the first value that fails the test, below the limit, and prints the trace', () => {
    for (const b of built) {
      const seen = trace(b)
      expect(answer(b), b.seed).toBe(seen.at(-1))
      expect(answer(b)).toBeGreaterThanOrEqual(1)
      expect(answer(b)).toBeLessThan(read(b).limit)
      expect(seen.length - 1 >= 2 && seen.length - 1 <= 6).toBe(true)
      expect(b.question.solution).toContain(`${seen.join(' → ')}.`)
      expect(lines(b)).toEqual([`M1 ${seen.slice(1, -1).join(', ')} then ${answer(b)}`, `A1 ${answer(b)}`])
    }
  })

  it('prints literal builds', () => {
    const b = at('q11', 'lit-b')
    expect(b.question.prompt).toBe('What is output?\n\n```\nx ← 35\nWHILE x > 19\n   x ← x - 6\nENDWHILE\nOUTPUT x\n```')
    expect(b.question.solution).toBe('x: 35 → 29 → 23 → 17. When x is 17 the condition `x > 19` is False: **17**. The loop runs three times and steps past 19: it stops at the first value that fails the test, not at 19 or just below it.')
    expect(lines(b)).toEqual(['M1 29, 23 then 17', 'A1 17'])
    expect(at('q11', 'lit-c').question.solution).toBe('x: 76 → 38 → 19 → 9. When x is 9 the condition `x > 17` is False: **9**. The loop runs three times and steps past 17: it stops at the first value that fails the test, not at 17 or just below it.')
  })

  it('never pays the limit, one pass short or long, the pass count, the start or k', () => {
    expect(pays(built, (b) => { const seen = trace(b); const { limit, k, halve, start } = read(b); return [limit, seen.at(-2)!, halve ? Math.floor(answer(b) / 2) : answer(b) - k, seen.length - 1, start, ...(k ? [k] : [])] })).toBe(0)
  })

  it('pays "start MOD k" in under a sixth of the subtracting builds, and "the limit minus 1" in under a tenth', () => {
    const minus = built.filter((b) => !read(b).halve)
    expect(pays(minus, (b) => read(b).start % read(b).k)).toBeLessThan(0.16)
    expect(pays(built, (b) => read(b).limit - 1)).toBeLessThan(0.1)
  })

  it('has ≥ loops whose limit is a value x takes, which still passes', () => {
    const hits = built.filter((b) => read(b).cmp === '≥' && trace(b).includes(read(b).limit)).length / built.length
    expect(hits > 0.1 && hits < 0.3).toBe(true)
  })

  it('spreads answers, limits and both kinds', () => {
    expect(share(built, answer).worst).toBeLessThan(0.12)
    expect(share(built, answer).distinct).toBeGreaterThan(15)
    expect(share(built, (b) => read(b).limit).distinct).toBeGreaterThan(20)
    const halve = built.filter((b) => read(b).halve).length / built.length
    expect(halve > 0.2 && halve < 0.4).toBe(true)
  })
})

// ---------------------------------------------------------------------------------------------

describe('q15: a FOR loop adding an expression', () => {
  const built = build('q15')
  const read = (b: Generated) => {
    const c = code(b)
    const f = /FOR (\w) ← (\d+) TO (\d+)/.exec(c)!
    const v = f[1]!
    const expr = /total ← total \+ (.+)$/m.exec(c)![1]!
    const m = new RegExp(`^${v} \\* (${v}|\\d+)(?: \\+ (\\d+))?$`).exec(expr)!
    return { v, s: Number(f[2]), e: Number(f[3]), expr, k: m[1] === v ? 0 : Number(m[1]), c: Number(m[2] ?? 0) }
  }
  const value = (b: Generated, i: number) => { const { k, c } = read(b); return (k ? i * k : i * i) + c }
  const total = (b: Generated, s: number, e: number) => range(s, e).reduce((t, i) => t + value(b, i), 0)

  it('adds the expression for each i, and prints each value', () => {
    for (const b of built) {
      const { s, e, expr } = read(b)
      expect(answer(b), b.seed).toBe(total(b, s, e))
      expect(answer(b)).toBeLessThanOrEqual(150)
      expect(e - s + 1 >= 3 && e - s + 1 <= 5).toBe(true)
      const terms = range(s, e).map((i) => value(b, i))
      expect(b.question.solution).toContain(`give \`${expr}\` = ${terms.join(', ')}, so total is $${terms.join(' + ')} = $ **${answer(b)}**.`)
      expect(lines(b)).toEqual([`M1 ${terms.join(', ')}`, `A1 ${answer(b)}`])
    }
  })

  it('prints literal builds', () => {
    const b = at('q15', 'lit-d')
    expect(b.question.prompt).toBe('What is output?\n\n```\ntotal ← 0\nFOR x ← 3 TO 7\n   total ← total + x * x\nENDFOR\nOUTPUT total\n```')
    expect(b.question.solution).toBe('x = 3, 4, 5, 6, 7 give `x * x` = 9, 16, 25, 36, 49, so total is $9 + 16 + 25 + 36 + 49 = $ **135**. A trace table with columns x, `x * x` and total keeps it straight: total goes 0, 9, 25, 50, 86, 135.')
    expect(at('q15', 'lit-a').question.prompt).toBe('What is output?\n\n```\ntotal ← 0\nFOR i ← 5 TO 7\n   total ← total + i * 4 + 3\nENDFOR\nOUTPUT total\n```')
    expect(lines(at('q15', 'lit-a'))).toEqual(['M1 23, 27, 31', 'A1 81'])
  })

  it('never pays the line read left to right, the sum of i, the last term, or a loop one short', () => {
    expect(
      pays(built, (b) => {
        const { s, e, k, c } = read(b)
        let ltr = 0
        for (let i = s; i <= e; i++) ltr = (ltr + i) * (k || i) + c
        return [ltr, range(s, e).reduce((t, i) => t + i, 0), value(b, e), total(b, s, e - 1)]
      }),
    ).toBe(0)
  })

  it('pays counting from 0 in under a quarter of builds', () => {
    expect(pays(built, (b) => total(b, 0, read(b).e))).toBeLessThan(0.25)
  })

  it('spreads answers, expressions and starts', () => {
    expect(share(built, answer).worst).toBeLessThan(0.1)
    expect(share(built, answer).distinct).toBeGreaterThan(30)
    expect(share(built, (b) => (read(b).k === 0 ? 'square' : read(b).c ? 'linear' : 'times')).distinct).toBe(3)
    expect(share(built, (b) => read(b).s).distinct).toBe(5)
  })
})

// ---------------------------------------------------------------------------------------------

describe('q18: the last or k-th output of nested loops', () => {
  const built = build('q18')
  const read = (b: Generated) => {
    const c = code(b)
    const i = /FOR i ← (\d+) TO (\d+)/.exec(c)!
    const j = /FOR j ← (\d+) TO (\d+)/.exec(c)!
    const expr = /OUTPUT (.+)$/m.exec(c)![1]!
    const which = /What is the \*\*(last|\d+)(?:st|nd|rd|th)?\*\* value output/.exec(b.question.prompt)![1]!
    return { a: Number(i[1]), b: Number(i[2]), c: Number(j[1]), d: Number(j[2]), expr, which }
  }
  const f = (expr: string, i: number, j: number) => (expr === 'i * j' ? i * j : expr === 'i + j' ? i + j : i * 10 + j)
  /** Every output, the outer loop slowest. */
  const outputs = (b: Generated, swap = false) => {
    const { a, b: bb, c, d, expr } = read(b)
    const out: number[] = []
    if (!swap) for (let i = a; i <= bb; i++) for (let j = c; j <= d; j++) out.push(f(expr, i, j))
    else for (let j = c; j <= d; j++) for (let i = a; i <= bb; i++) out.push(f(expr, i, j))
    return out
  }
  const kth = (b: Generated) => (read(b).which === 'last' ? outputs(b).length : Number(read(b).which))

  it('outputs the asked value, after the inner loop has restarted, at most 3 × 4 outputs', () => {
    for (const b of built) {
      const out = outputs(b)
      const k = kth(b)
      expect(answer(b), b.seed).toBe(out[k - 1])
      expect(out.length).toBeLessThanOrEqual(12)
      const n = read(b).d - read(b).c + 1
      expect(k).toBeGreaterThan(n)
      expect(lines(b)).toEqual([`M1 ${out.length} outputs: ${out.join(', ')}`, `A1 ${answer(b)}`])
    }
  })

  it('prints literal builds', () => {
    const b = at('q18', 'lit-m')
    expect(b.question.prompt).toBe('Trace the nested loops. What is the **9th** value output?\n\n```\nFOR i ← 2 TO 4\n   FOR j ← 1 TO 4\n      OUTPUT i + j\n   ENDFOR\nENDFOR\n```')
    expect(b.question.solution).toBe('$3 \\times 4 = 12$ outputs: 3, 4, 5, 6, then 4, 5, 6, 7, then 5, 6, 7, 8. The 9th comes when i = 4 and j = 1, because the inner counter restarts at 1 for each outer pass: $4 + 1 = $ **5**.')
    expect(at('q18', 'lit-a').question.solution).toBe('$2 \\times 3 = 6$ outputs: 2, 4, 6, then 3, 6, 9. The last comes when i = 3 and j = 3: $3 \\times 3 = $ **9**.')
  })

  it('never pays the number of outputs, the position asked, the first output, the one before or after, the inner loop run once, or the loops swapped', () => {
    expect(
      pays(built, (b) => {
        const out = outputs(b)
        const k = kth(b)
        const { a, b: bb, c, d, expr } = read(b)
        const once = range(c, d).map((j) => f(expr, a, j))
        return [out.length, bb - a + 1, d - c + 1, k, out[0]!, out[k - 2]!, ...(k < out.length ? [out[k]!] : []), ...(k === out.length ? [once.at(-1)!] : [outputs(b, true)[k - 1]!])]
      }),
    ).toBe(0)
  })

  it('spreads answers, expressions and both questions', () => {
    expect(share(built, answer).worst).toBeLessThan(0.15)
    expect(share(built, answer).distinct).toBeGreaterThan(25)
    expect(share(built, (b) => read(b).expr).distinct).toBe(3)
    // The last output is the expression at the printed end values, which needs no trace: a minority.
    const last = built.filter((b) => read(b).which === 'last').length / built.length
    expect(last > 0.25 && last < 0.45).toBe(true)
  })
})
