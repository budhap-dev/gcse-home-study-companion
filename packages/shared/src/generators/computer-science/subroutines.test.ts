import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { generate, sheetQuestions } from '../index.ts'
import type { Generated } from '../types.ts'
import { POWERS, subroutineGenerator } from './subroutines.ts'

/**
 * Structural tests for the subroutine generators (AQA 8525 3.2.10). Each reads the printed program
 * back with regular expressions and works it out again in JavaScript, sharing no code with the
 * generator or the interpreter: values matched to the parameters by position, the body evaluated
 * with JavaScript's own precedence, the loop run here, and the program's variable kept apart from
 * the subroutine's. Then the printed working, the named slips (the value output, one pass too few,
 * x × n, the swapped call, the scope slip, the outer call first, matching by name, left to right)
 * and the spread over builds.
 */
const TOPIC = 'subroutines-procedures-and-functions'
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/computer-science')
const topic = JSON.parse(readFileSync(join(ROOT, `${TOPIC}.json`), 'utf8'))
const bank = Question.array().parse(topic.questions)
const written = (id: string) => bank.find((q) => q.id === id)!
const g = subroutineGenerator

const build = (slotId: string, count = 300, prefix = 'structure'): Generated[] =>
  Array.from({ length: count }, (_, i) => generate(g, written(slotId), `${prefix}-${i}`))
const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const code = (b: Generated) => /```\n([\s\S]*?)\n```/.exec(b.question.prompt)![1]!
const lines = (b: Generated) => code(b).split('\n')

/** Share of builds where a slip gives something other than the answer. */
const differs = (built: Generated[], route: (b: Generated) => number) => built.filter((b) => route(b) !== answer(b)).length / built.length

function share<T>(items: T[], key: (x: T) => unknown) {
  const counts = new Map<unknown, number>()
  for (const x of items) counts.set(key(x), (counts.get(key(x)) ?? 0) + 1)
  return { worst: Math.max(...counts.values()) / items.length, distinct: counts.size }
}

/** An expression in the printed names, evaluated in JavaScript with the given values. */
function evaluate(expr: string, env: Record<string, number>): number {
  const names = Object.keys(env)
  return Function(...names, `return (${expr.replace(/\bDIV\b/g, '/')})`)(...names.map((n) => env[n]))
}

function marksTyped(b: Generated) {
  const a = answer(b)
  for (const t of [String(a), ` ${a} `, a.toLocaleString('en-GB'), String(a).replace('-', '−')]) expect(mark(b.question, t).correct, `${b.seed}: ${t}`).toBe(true)
  expect(mark(b.question, String(a + 1)).correct).toBe(false)
  expect(mark(b.question, String(a - 1)).correct).toBe(false)
}

describe('routing', () => {
  it('stands in for q5, q9, q11, q14 and q17, each keeping its own skill', () => {
    expect(g.replaces).toEqual(['q5', 'q9', 'q11', 'q14', 'q17'])
    expect(build('q5', 20).every((b) => /what value (is stored in|does|is assigned to)/i.test(b.question.prompt) && /← \w+\(\d+, \d+\)/.test(code(b)))).toBe(true)
    expect(build('q9', 20).every((b) => /FOR i ←/.test(code(b)) && /RETURN t/.test(code(b)))).toBe(true)
    expect(build('q11', 20).every((b) => /value output by this program/.test(b.question.prompt) && /OUTPUT \w+$/.test(code(b)))).toBe(true)
    expect(build('q14', 20).every((b) => /OUTPUT [fg]\([fg]\(\d+\)\)/.test(code(b)))).toBe(true)
    expect(build('q17', 20).every((b) => /OUTPUT \w+\((y, x|n, m)\)/.test(code(b)))).toBe(true)
  })

  it('builds on every one of 3000 seeds', () => {
    for (const id of g.replaces) expect(() => build(id, 3000, 'many')).not.toThrow()
  })

  it('prints the written questions as the lesson writes them (literal lines)', () => {
    const b = generate(g, written('q9'), 'structure-1')
    expect(b.question.prompt).toMatch(/^What (is output by this program|does this program output|value does this program output)\?\n\n```\nSUBROUTINE /)
    expect(lines(b)).toContain('ENDSUBROUTINE')
    expect(lines(b).filter((l) => l.startsWith('   ')).every((l) => /^( {3})+\S/.test(l))).toBe(true)
  })
})

describe('q5: the value a function call stores', () => {
  const built = build('q5')
  const read = (b: Generated) => {
    const [, p1, p2, body] = /SUBROUTINE \w+\((\w+), (\w+)\)\n {3}RETURN (.+)/.exec(code(b))!
    const [, store, x, y] = /(\w+) ← \w+\((\d+), (\d+)\)/.exec(code(b))!
    const [, op, k] = /OUTPUT \w+ ([*+-]) (\d+)/.exec(code(b))!
    const value = evaluate(body!, { [p1!]: Number(x), [p2!]: Number(y) })
    const swapped = evaluate(body!, { [p1!]: Number(y), [p2!]: Number(x) })
    const out = evaluate(`${value} ${op} ${k}`, {})
    return { store: store!, x: Number(x), y: Number(y), k: Number(k), value, swapped, out }
  }

  it('stores what the printed function returns, and the solution says so', () => {
    for (const b of built) {
      const v = read(b)
      expect(answer(b), b.seed).toBe(v.value)
      expect(b.question.prompt).toContain(`\`${v.store}\``)
      expect(b.question.solution, b.seed).toContain(`returns `)
      expect(b.question.solution, b.seed).toContain(`= ${v.value}, which is assigned to \`${v.store}\``)
      expect(b.question.solution, b.seed).toContain(`The line after that outputs ${v.out}, but the question asks for \`${v.store}\`.`)
      marksTyped(b)
    }
  })

  it('never pays the value output, a printed figure or the swapped call', () => {
    expect(differs(built, (b) => read(b).out)).toBe(1)
    for (const b of built) expect([read(b).x, read(b).y, read(b).k], b.seed).not.toContain(answer(b))
    const asymmetric = built.filter((b) => !/area|perimeter|cost/.test(code(b)))
    expect(asymmetric.length).toBeGreaterThan(80)
    expect(differs(asymmetric, (b) => read(b).swapped)).toBe(1)
  })

  it('spreads the answers and the functions', () => {
    expect(share(built, answer).worst).toBeLessThan(0.1)
    expect(share(built, answer).distinct).toBeGreaterThan(40)
    expect(share(built, (b) => /SUBROUTINE (\w+)/.exec(code(b))![1]).distinct).toBe(6)
  })

  it('keeps the written literal form', () => {
    const area = built.find((b) => /area\(/.test(code(b)))!
    expect(lines(area).slice(0, 3)).toEqual(['SUBROUTINE area(width, height)', '   RETURN width * height', 'ENDSUBROUTINE'])
  })
})

describe('q9: a function with a loop', () => {
  const built = build('q9')
  /** Runs the printed loop here: the start of t, the bounds, the body, one pass at a time. */
  const read = (b: Generated) => {
    const c = code(b)
    const params = /SUBROUTINE \w+\(([^)]*)\)/.exec(c)![1]!.split(', ')
    const args = /OUTPUT \w+\(([^)]*)\)/.exec(c)![1]!.split(', ').map(Number)
    const env: Record<string, number> = Object.fromEntries(params.map((p, i) => [p, args[i]!]))
    const start = Number(/t ← (\d+)/.exec(c)![1])
    const [, from, to] = /FOR i ← (\w+) TO (\w+)/.exec(c)!
    const body = /t ← (t .+)/.exec(c)![1]!
    const lo = evaluate(from!, env)
    const hi = evaluate(to!, env)
    const run = (a: number, z: number) => {
      let t = start
      const ts: number[] = []
      for (let i = a; i <= z; i++) ts.push((t = evaluate(body, { ...env, t, i })))
      return { t, ts }
    }
    return { env, lo, hi, start, body, ...run(lo, hi), fewer: run(lo, hi - 1).t, later: run(lo + 1, hi).t }
  }

  it('returns what the loop gives when traced here, and prints that trace', () => {
    for (const b of built) {
      const v = read(b)
      expect(answer(b), b.seed).toBe(v.t)
      expect(b.question.solution, b.seed).toContain([v.start, ...v.ts].join(' → '))
      expect(b.question.solution, b.seed).toContain(`The function returns ${v.t}.`)
      expect(b.question.markScheme[0]!.description, b.seed).toMatch(new RegExp(`^Loop traced: t takes ${v.ts.slice(0, -1).join(', ')}${v.ts.length > 1 ? ' and ' : ''}${v.ts.at(-1)}$`))
      expect(v.ts.length, b.seed).toBeGreaterThanOrEqual(2)
      expect(v.ts.length, b.seed).toBeLessThanOrEqual(8)
      expect(v.t, b.seed).toBeLessThanOrEqual(100)
      marksTyped(b)
    }
  })

  it('never pays one pass too few, a pass skipped at the start, or the loop end value', () => {
    expect(differs(built, (b) => read(b).fewer)).toBe(1)
    expect(differs(built, (b) => read(b).later)).toBe(1)
    expect(differs(built, (b) => read(b).hi)).toBe(1)
  })

  it('never pays x × n or the parameters swapped for a power', () => {
    const powers = built.filter((b) => /power/.test(code(b)))
    expect(powers.length).toBeGreaterThan(40)
    expect(differs(powers, (b) => read(b).env.x! * read(b).env.n!)).toBe(1)
    expect(differs(powers, (b) => read(b).env.n! ** read(b).env.x!)).toBe(1)
    expect(POWERS).not.toContainEqual([2, 4])
    expect(POWERS).not.toContainEqual([4, 2])
    expect(POWERS).not.toContainEqual([2, 2])
    // Squares are seven of the thirteen pairs; loops of 3 to 6 passes are drawn more often.
    expect(powers.filter((b) => read(b).env.n === 2).length / powers.length).toBeLessThan(0.45)
  })

  it('spreads the answers and the shapes', () => {
    expect(share(built, answer).worst).toBeLessThan(0.15)
    expect(share(built, answer).distinct).toBeGreaterThanOrEqual(20)
    const shapes = share(built, (b) => /SUBROUTINE (\w+)/.exec(code(b))![1]!.replace('add_to', 'sum_to'))
    expect(shapes.distinct).toBe(4)
    expect(shapes.worst).toBeLessThan(0.4)
  })

  it('keeps the written loop literally', () => {
    const b = built.find((x) => /sum_to\(/.test(code(x)))!
    expect(lines(b).slice(0, 7)).toEqual(['SUBROUTINE sum_to(n)', '   t ← 0', '   FOR i ← 1 TO n', '      t ← t + i', '   ENDFOR', '   RETURN t', 'ENDSUBROUTINE'])
  })
})

describe('q11: local and global variables', () => {
  const built = build('q11', 400)
  /**
   * Runs the program here, statement by statement after the subroutine: the program's variable
   * changed only by the main program's own lines (the scope rule), or, for the slips, taken as the
   * subroutine's last value or changed by every call.
   */
  const read = (b: Generated) => {
    const ls = lines(b)
    const [, g, g0] = /^(\w+) ← (\d+)$/.exec(ls[0]!)!
    const [, sub, param] = /SUBROUTINE (\w+)\((\w+)\)/.exec(code(b))!
    const [, local, expr] = /^ {3}(\w+) ← (.+)$/m.exec(code(b))!
    const main = ls.slice(ls.indexOf('ENDSUBROUTINE') + 1).filter(Boolean)
    const value = (gv: number, x: number) => Math.floor(evaluate(expr!, { [g!]: gv, [param!]: x }))
    let G = Number(g0)
    let slip = G
    let chained = G
    let atCall = G
    const outs: number[] = []
    const calls: number[] = []
    let before = false
    let after = false
    for (const l of main) {
      if (l.startsWith(`${g} ←`)) {
        const step = (v: number) => evaluate(l.split('← ')[1]!, { [g!]: v })
        ;[G, slip, chained] = [step(G), step(slip), step(chained)]
        if (calls.length) after = true
        else before = true
      } else if (l.startsWith(`${sub}(`)) {
        const x = Number(/\((\d+)\)/.exec(l)![1])
        calls.push(x)
        atCall = G
        outs.push(value(G, x))
        slip = value(G, x)
        chained = value(chained, x)
      }
    }
    return { g: g!, g0: Number(g0), sub: sub!, local: local!, calls, outs, final: G, atCall, slip, chained, before, after, shadow: local === g }
  }

  it('outputs the program variable, which the subroutine never changed', () => {
    for (const b of built) {
      const v = read(b)
      expect(answer(b), b.seed).toBe(v.final)
      const asked = /What is the (\w+) value output/.exec(b.question.prompt)![1]
      expect(['last', ['first', 'second', 'third'][v.calls.length]]).toContain(asked)
      expect(b.question.solution, b.seed).toContain(`is still ${v.atCall}.`)
      expect(b.question.solution, b.seed).toContain(`output is **${v.final}**.`)
      for (const x of v.calls) expect(b.question.solution, b.seed).toContain(`(${x})\` outputs `)
      for (const o of v.outs) expect(b.question.solution, b.seed).toContain(` = ${o}`)
      if (v.before) expect(b.question.solution, b.seed).toMatch(new RegExp(`^The program first sets \`${v.g}\` to ${v.g0} . \\d+ = ${v.atCall}\\. `))
      if (v.after) expect(b.question.solution, b.seed).toContain(`The main program then sets \`${v.g}\` to ${v.atCall} `)
      // The rule is stated whenever the subroutine assigns a local of the program variable's name.
      expect(/is local to that subroutine/.test(b.question.prompt), b.seed).toBe(v.shadow)
      // The M1 is the trace, not the rule restated.
      const outsText = v.outs.length === 1 ? String(v.outs[0]) : `${v.outs[0]} and ${v.outs[1]}`
      expect(b.question.markScheme[0]!.description, b.seed).toMatch(new RegExp(`^${v.sub} outputs ${outsText}, its local ${v.local}; the program's ${v.g} is still ${v.atCall}${v.after ? ` \\(then ${v.atCall} . \\d+ = ${v.final}\\)` : ''}$`))
      marksTyped(b)
    }
  })

  it('never pays the first output, the scope slip, or each call changing the program variable', () => {
    expect(differs(built, (b) => read(b).outs[0]!)).toBe(1)
    expect(differs(built, (b) => read(b).slip)).toBe(1)
    expect(differs(built, (b) => read(b).chained)).toBe(1)
  })

  it('changes the program variable in about three builds in four, so the first line alone pays in under 0.3', () => {
    const changed = built.filter((b) => read(b).before || read(b).after).length / built.length
    const shadow = built.filter((b) => read(b).shadow).length / built.length
    const two = built.filter((b) => read(b).calls.length === 2).length / built.length
    expect(changed).toBeGreaterThan(0.65)
    expect(changed).toBeLessThan(0.85)
    expect(built.filter((b) => read(b).before).length / built.length).toBeGreaterThan(0.25)
    expect(built.filter((b) => read(b).after).length / built.length).toBeGreaterThan(0.25)
    expect(shadow).toBeGreaterThan(0.2)
    expect(shadow).toBeLessThan(0.4)
    expect(two).toBeGreaterThan(0.25)
    expect(two).toBeLessThan(0.45)
    expect(built.filter((b) => answer(b) === read(b).g0).length / built.length).toBeLessThan(0.3)
  })

  it('reads sensibly in each context: no doubling of money, stock or temperature, no shadow where it makes no sense', () => {
    for (const b of built) {
      const c = code(b)
      if (/← \w+ \* 2$/m.test(c.split('ENDSUBROUTINE')[1]!)) expect(read(b).g, b.seed).toBe('score')
      expect(c, b.seed).not.toMatch(/^ {3}(balance|stock|temp) ←/m)
      expect(c, b.seed).not.toMatch(/^ {3}\w+ ← (cash|degrees) \*/m)
    }
    expect(share(built, (b) => /^ {3}(\w+) ←/m.exec(code(b))![1]).distinct).toBeGreaterThanOrEqual(10)
  })

  it('spreads the answers', () => {
    expect(share(built, answer).worst).toBeLessThan(0.05)
    expect(share(built, answer).distinct).toBeGreaterThan(40)
  })

  it('prints the written form literally', () => {
    const b = built.find((x) => /^ {3}left ←/m.test(code(x)))!
    expect(lines(b)).toContain('SUBROUTINE spend(amount)')
    expect(lines(b)).toContain('   left ← total - amount')
    expect(lines(b)).toContain('   OUTPUT left')
  })
})

describe('q14: nested calls', () => {
  const built = build('q14')
  const read = (b: Generated) => {
    const c = code(b)
    const body = (name: string) => /RETURN (.+)/.exec(c.slice(c.indexOf(`SUBROUTINE ${name}(n)`)))![1]!
    const [, outer, inner, x] = /OUTPUT (\w)\((\w)\((\d+)\)\)/.exec(c)!
    const fn = (name: string) => (n: number) => evaluate(body(name), { n })
    const X = Number(x)
    return { outer: outer!, inner: inner!, x: X, mid: fn(inner!)(X), value: fn(outer!)(fn(inner!)(X)), wrongOrder: fn(inner!)(fn(outer!)(X)), outerOfX: fn(outer!)(X), ks: (c.match(/\d+/g) ?? []).map(Number) }
  }

  it('works from the inside out, as printed', () => {
    for (const b of built) {
      const v = read(b)
      expect(answer(b), b.seed).toBe(v.value)
      expect(b.question.solution, b.seed).toMatch(new RegExp(`^Work from the inside out\\. \`${v.inner}\\(${v.x}\\)\` returns .* = ${v.mid}\\. Then \`${v.outer}\\(${v.mid}\\)\` returns .* = ${v.value}\\.$`))
      expect(b.question.markScheme[0]!.description).toBe(`${v.inner}(${v.x}) = ${v.mid} evaluated first`)
      expect(v.value).toBeLessThanOrEqual(100)
      marksTyped(b)
    }
  })

  it('never pays the outer call first, the inner value, the outer function of x, or a printed figure', () => {
    expect(differs(built, (b) => read(b).wrongOrder)).toBe(1)
    expect(differs(built, (b) => read(b).mid)).toBe(1)
    expect(differs(built, (b) => read(b).outerOfX)).toBe(1)
    for (const b of built) expect(read(b).ks, b.seed).not.toContain(answer(b))
  })

  it('varies the order of definitions and which function is outer', () => {
    expect(share(built, (b) => `${read(b).outer}${code(b).indexOf('SUBROUTINE g') < code(b).indexOf('SUBROUTINE f')}`).distinct).toBe(4)
    expect(share(built, answer).worst).toBeLessThan(0.1)
    expect(share(built, answer).distinct).toBeGreaterThan(30)
  })
})

describe('q17: values matched in order, multiplication first', () => {
  const built = build('q17')
  const read = (b: Generated) => {
    const c = code(b)
    const [, p1, p2] = /SUBROUTINE \w+\((\w), (\w)\)/.exec(c)!
    const body = /RETURN (.+)/.exec(c)![1]!
    const vals: Record<string, number> = {}
    for (const m of c.matchAll(/^(\w) ← (\d+)$/gm)) vals[m[1]!] = Number(m[2])
    const [, a1, a2] = /OUTPUT \w+\((\w), (\w)\)/.exec(c)!
    const byPosition = evaluate(body, { [p1!]: vals[a1!]!, [p2!]: vals[a2!]! })
    // Matched by name (or in the order the program sets its variables).
    const declared = Object.values(vals)
    const byName = evaluate(body, { [p1!]: declared[0]!, [p2!]: declared[1]! })
    const ltr = (env: Record<string, number>) => {
      const [, a, op, b2, k] = /(\w) ([+-]) (\w) \* (\d)/.exec(body)!
      return (op === '+' ? env[a!]! + env[b2!]! : env[a!]! - env[b2!]!) * Number(k)
    }
    return {
      p1: p1!, p2: p2!, vals, sameNames: p1 === a2 || p1 === Object.keys(vals)[0],
      byPosition, byName,
      leftToRight: ltr({ [p1!]: vals[a1!]!, [p2!]: vals[a2!]! }),
      both: ltr({ [p1!]: declared[0]!, [p2!]: declared[1]! }),
    }
  }

  it('matches by position and multiplies first, as printed', () => {
    for (const b of built) {
      const v = read(b)
      expect(answer(b), b.seed).toBe(v.byPosition)
      const shown = answer(b) < 0 ? `**$${answer(b)}$**` : `**${answer(b)}**`
      expect(b.question.solution, b.seed).toContain(`, and the program outputs ${shown}.`)
      expect(b.question.solution, b.seed).toContain('Values are matched to the parameters in order, not by name')
      expect(b.question.markScheme.at(-1)!.description).toBe(answer(b) < 0 ? `−${-answer(b)}` : String(answer(b)))
      expect(b.question.solution, b.seed).not.toMatch(/argument/)
      marksTyped(b)
    }
  })

  it('never pays matching by name, reading left to right, or both', () => {
    expect(differs(built, (b) => read(b).byName)).toBe(1)
    expect(differs(built, (b) => read(b).leftToRight)).toBe(1)
    expect(differs(built, (b) => read(b).both)).toBe(1)
    for (const b of built) expect(Object.values(read(b).vals), b.seed).not.toContain(Math.abs(answer(b)))
  })

  it('names the parameters after the program variables about half the time, and mixes signs', () => {
    const same = built.filter((b) => read(b).sameNames).length / built.length
    expect(same).toBeGreaterThan(0.35)
    expect(same).toBeLessThan(0.65)
    const negative = built.filter((b) => answer(b) < 0).length / built.length
    expect(negative).toBeGreaterThan(0.2)
    expect(negative).toBeLessThan(0.8)
    expect(share(built, answer).worst).toBeLessThan(0.05)
  })

  it('prints the written line form', () => {
    const b = built.find((x) => /calc\(a, b\)/.test(code(x)) && /a - b \*/.test(code(x)))!
    expect(lines(b)[1]).toMatch(/^ {3}RETURN a - b \* [2-4]$/)
    expect(lines(b).slice(-3)).toEqual([expect.stringMatching(/^x ← \d+$/), expect.stringMatching(/^y ← \d+$/), 'OUTPUT calc(y, x)'])
  })
})

describe('on a worksheet', () => {
  it('fills the advanced sheet with four different programs', () => {
    const ids = topic.worksheets.advanced.questionIds as string[]
    for (let i = 0; i < 100; i++) {
      const sheet = sheetQuestions('computer-science', TOPIC, ids.map(written), `sheet-${i}`)
      const mine = sheet.filter((s) => s.generated)
      expect(mine.map((s) => s.question.id)).toEqual(['q9', 'q11', 'q14', 'q17'])
      // q10 asks for a function `larger`; q13 traces b ← b * a; q18 calls grade(49): none is printed here.
      for (const s of mine) expect(s.question.prompt).not.toMatch(/larger|grade\(|b ← b \* a/)
    }
  })
})
