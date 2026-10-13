import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { generate, sheetQuestions } from '../index.ts'
import type { Generated } from '../types.ts'
import { arrayGenerator } from './arrays.ts'

/**
 * Structural tests for the array generators (AQA 8525 3.2.6). Each reads the printed array and
 * program back with regular expressions and works the answer out again here, sharing no code with
 * the generator or the interpreter: indexOf on the parsed list, the total, the count with the
 * printed operator, the search walked in its own direction, the loop bounds multiplied, the grid
 * changed and summed. Then the printed working, the named slips (counting from 1, LEN as the last
 * index, one item short, ≥ for >, the counter one off, rows × columns where part is skipped, the
 * cell read [column][row]) and the spread over builds.
 */
const TOPIC = 'arrays-and-records'
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/computer-science')
const topic = JSON.parse(readFileSync(join(ROOT, `${TOPIC}.json`), 'utf8'))
const bank = Question.array().parse(topic.questions)
const written = (id: string) => bank.find((q) => q.id === id)!
const g = arrayGenerator

const build = (slotId: string, count = 300, prefix = 'structure'): Generated[] =>
  Array.from({ length: count }, (_, i) => generate(g, written(slotId), `${prefix}-${i}`))
const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const code = (b: Generated) => /```\n([\s\S]*?)\n```/.exec(b.question.prompt)![1]!
const lines = (b: Generated) => code(b).split('\n')
/** The first 1D list literal in a text: [12, 7, 9, 15] or ['pen', 'ink']. */
const list = (text: string) => /\[([^[\]]+)\]/.exec(text)![1]!.split(', ').map((x) => (/^'/.test(x) ? x.slice(1, -1) : Number(x)))

const differs = (built: Generated[], route: (b: Generated) => number) => built.filter((b) => route(b) !== answer(b)).length / built.length

function share<T>(items: T[], key: (x: T) => unknown) {
  const counts = new Map<unknown, number>()
  for (const x of items) counts.set(key(x), (counts.get(key(x)) ?? 0) + 1)
  return { worst: Math.max(...counts.values()) / items.length, distinct: counts.size }
}

function marksTyped(b: Generated) {
  const a = answer(b)
  for (const t of [String(a), ` ${a} `, a.toLocaleString('en-GB')]) expect(mark(b.question, t).correct, `${b.seed}: ${t}`).toBe(true)
  expect(mark(b.question, String(a + 1)).correct).toBe(false)
  expect(mark(b.question, String(a - 1)).correct).toBe(false)
}

describe('routing', () => {
  it('stands in for q1, q5, q9, q11, q14 and q17', () => {
    expect(g.replaces).toEqual(['q1', 'q5', 'q9', 'q11', 'q14', 'q17'])
    expect(build('q1', 20).every((b) => /index/.test(b.question.prompt))).toBe(true)
    expect(build('q5', 20).every((b) => /total ← total \+ \w+\[i\]/.test(code(b)))).toBe(true)
    expect(build('q9', 20).every((b) => /count ← count \+ 1/.test(code(b)))).toBe(true)
    expect(build('q11', 20).every((b) => /found ← False/.test(code(b)))).toBe(true)
    expect(build('q14', 20).every((b) => /2D array/.test(b.question.prompt) && /How many values/.test(b.question.prompt))).toBe(true)
    expect(build('q17', 20).every((b) => /total ← total \+ \w+\[(\d\]\[c|r\]\[\d)\]/.test(code(b)))).toBe(true)
  })

  it('builds on every one of 3000 seeds', () => {
    for (const id of g.replaces) expect(() => build(id, 3000, 'many')).not.toThrow()
  })
})

describe('q1: the index of an item', () => {
  const built = build('q1')
  const read = (b: Generated) => {
    const words = list(b.question.prompt) as string[]
    const word = /`'(\w+)'`/.exec(b.question.prompt)![1]!
    return { words, word, at: words.indexOf(word) }
  }

  it('gives the index from 0, with the items before it listed', () => {
    for (const b of built) {
      const v = read(b)
      expect(new Set(v.words).size).toBe(v.words.length)
      expect(v.words.length).toBeGreaterThanOrEqual(3)
      expect(v.words.length).toBeLessThanOrEqual(7)
      expect(answer(b), b.seed).toBe(v.at)
      for (const [i, w] of v.words.slice(0, v.at).entries()) expect(b.question.solution, b.seed).toContain(`${w} is ${i}`)
      if (v.at === v.words.length - 1) expect(b.question.solution).toContain(`LEN(`)
      marksTyped(b)
    }
    const b = built.find((x) => read(x).at === 2)!
    expect(b.question.solution).toMatch(/^Indexes start at 0: \w+ is 0 and \w+ is 1, so \w+ is 2\./)
  })

  it('never pays counting from 1, and LEN as the last index only where the item is not last', () => {
    expect(differs(built, (b) => read(b).at + 1)).toBe(1)
    expect(differs(built, (b) => read(b).words.length)).toBe(1)
  })

  it('spreads the index (the first item less often) and the lists', () => {
    const s = share(built, answer)
    expect(s.distinct).toBe(6)
    expect(s.worst).toBeLessThan(0.25)
    expect(built.filter((b) => answer(b) === 0).length / built.length).toBeLessThan(0.15)
    expect(share(built, (b) => read(b).words.join()).worst).toBeLessThan(0.02)
  })
})

describe('q5: a running total', () => {
  const built = build('q5')
  const read = (b: Generated) => {
    const xs = list(code(b)) as number[]
    return { xs, total: xs.reduce((s, x) => s + x, 0) }
  }

  it('adds every item, printing the running total', () => {
    for (const b of built) {
      const { xs, total } = read(b)
      expect(answer(b), b.seed).toBe(total)
      expect(xs.length).toBeGreaterThanOrEqual(3)
      expect(xs.length).toBeLessThanOrEqual(7)
      expect(b.question.solution).toContain(`for i from 0 to ${xs.length - 1}`)
      const running = xs.map((_, i) => xs.slice(0, i + 1).reduce((s, x) => s + x, 0))
      expect(b.question.solution).toContain(`total goes ${[0, ...running].join(' → ')}`)
      expect(b.question.solution).toContain(`${xs.join(' + ')} = **${total}**`)
      expect(total).toBeLessThanOrEqual(120)
      marksTyped(b)
    }
  })

  it('never pays stopping one short, starting at 1, the last item or LEN', () => {
    expect(differs(built, (b) => read(b).total - read(b).xs.at(-1)!)).toBe(1)
    expect(differs(built, (b) => read(b).total - read(b).xs[0]!)).toBe(1)
    expect(differs(built, (b) => read(b).xs.at(-1)!)).toBe(1)
    expect(differs(built, (b) => read(b).xs.length)).toBe(1)
  })

  it('spreads the totals and keeps the written lines', () => {
    expect(share(built, answer).worst).toBeLessThan(0.05)
    expect(share(built, answer).distinct).toBeGreaterThan(50)
    const b = built.find((x) => /^scores/.test(code(x)))!
    expect(lines(b).slice(1)).toEqual(['total ← 0', 'FOR i ← 0 TO LEN(scores) - 1', '   total ← total + scores[i]', 'ENDFOR', 'OUTPUT total'])
  })
})

describe('q9: counting with a condition', () => {
  const built = build('q9', 400)
  const test = (op: string, x: number, t: number) => ({ '>': x > t, '≥': x >= t, '<': x < t, '≤': x <= t })[op]!
  const flip: Record<string, string> = { '>': '≥', '≥': '>', '<': '≤', '≤': '<' }
  const read = (b: Generated) => {
    const xs = list(code(b)) as number[]
    const [, op, t] = /IF \w+\[i\] ([><≥≤]) (\d+) THEN/.exec(code(b))!
    const T = Number(t)
    const count = (o: string) => xs.filter((x) => test(o, x, T)).length
    return { xs, op: op!, t: T, count: count(op!), other: count(flip[op!]!), equal: xs.filter((x) => x === T).length }
  }

  it('counts the items that pass the printed test, item by item', () => {
    for (const b of built) {
      const v = read(b)
      expect(answer(b), b.seed).toBe(v.count)
      expect(v.equal, b.seed).toBeGreaterThanOrEqual(1)
      let n = 0
      const rows = v.xs.map((x) => (test(v.op, x, v.t) ? `${x} yes, count ${++n}` : `${x} no`))
      expect(b.question.solution, b.seed).toContain(`Each item in turn: ${rows.join('; ')}.`)
      expect(b.question.solution, b.seed).toContain(`so the output is **${v.count}**`)
      expect(b.question.markScheme[0]!.description).toBe(`Compares each value with ${v.t} using ${v.op}`)
      marksTyped(b)
    }
  })

  it('never pays the other strictness, the other side, both slips together, or LEN', () => {
    expect(differs(built, (b) => read(b).other)).toBe(1)
    expect(differs(built, (b) => read(b).xs.length - read(b).count)).toBe(1)
    // Both slips: the other side counted with the other strictness.
    expect(differs(built, (b) => read(b).xs.length - read(b).other)).toBeGreaterThan(0.95)
    expect(differs(built, (b) => read(b).xs.length)).toBe(1)
  })

  it('spreads the counts, the operators and the boundary', () => {
    expect(share(built, answer).worst).toBeLessThan(0.3)
    expect(share(built, answer).distinct).toBe(5)
    expect(share(built, (b) => read(b).op).distinct).toBe(4)
    expect(share(built, (b) => read(b).op).worst).toBeLessThan(0.35)
    expect(built.filter((b) => read(b).equal === 2).length / built.length).toBeGreaterThan(0.15)
  })

  it('prints the written loop literally', () => {
    const b = built.find((x) => /^temps/.test(code(x)) && /> \d+ THEN/.test(code(x)))!
    expect(lines(b).slice(1, 4)).toEqual(['count ← 0', 'FOR i ← 0 TO LEN(temps) - 1', expect.stringMatching(/^ {3}IF temps\[i\] > \d+ THEN$/)])
  })
})

describe('q11: a linear search with a found flag', () => {
  const built = build('q11', 400)
  /** Walks the printed loop here, in its own direction, with the increment where it is printed. */
  const read = (b: Generated) => {
    const c = code(b)
    const xs = list(c) as number[]
    const target = Number(/\[i\] = (\d+) THEN/.exec(c)![1])
    const back = /i ← LEN\(\w+\) - 1/.test(c)
    const inElse = /ELSE\n {6}i ← i \+ 1/.test(c)
    let i = back ? xs.length - 1 : 0
    let found = false
    let at: number | null = null
    while ((back ? i >= 0 : i < xs.length) && !found) {
      if (xs[i] === target) {
        found = true
        at = i
        if (!inElse) i += back ? -1 : 1
      } else i += back ? -1 : 1
    }
    return { xs, target, back, inElse, i, at, form: back ? 'back' : inElse ? 'else' : 'after' }
  }

  it('leaves i where the printed loop leaves it, and says why', () => {
    for (const b of built) {
      const v = read(b)
      expect(answer(b), b.seed).toBe(v.i)
      expect(v.xs, b.seed).not.toContain(v.i)
      if (v.at === null) {
        expect(b.question.solution).toContain(`No item is ${v.target}, so found stays False`)
        expect(v.i).toBe(v.xs.length)
      } else {
        expect(b.question.solution).toContain(`i = ${v.at}: ${v.target} matches, so found ← True`)
        expect(b.question.markScheme[0]!.description).toBe(`found becomes True when i = ${v.at}`)
        if (v.form === 'after') expect(b.question.solution).toContain(`i is still incremented to ${v.i} before the WHILE condition is checked again`)
        if (v.form === 'else') expect(b.question.solution).toContain(`the ELSE does not run, so i stays ${v.i}`)
        if (v.xs.filter((x) => x === v.target).length > 1) expect(b.question.solution).toContain('is never reached')
      }
      marksTyped(b)
    }
  })

  it('pays no one lazy reading in more than a third of builds', () => {
    const found = built.filter((b) => read(b).at !== null)
    // The match's index, one past it, LEN: each the answer in one form only.
    expect(1 - differs(found, (b) => read(b).at!)).toBeLessThan(0.35)
    expect(1 - differs(found, (b) => read(b).at! + 1)).toBeLessThan(0.45)
    expect(1 - differs(built, (b) => read(b).xs.length)).toBeLessThan(0.3)
    expect(1 - differs(built, (b) => read(b).xs.length - 1)).toBeLessThan(0.05)
    // The last match instead of the first, where the target is repeated.
    const twice = found.filter((b) => read(b).xs.filter((x) => x === read(b).target).length > 1)
    expect(twice.length / found.length).toBeGreaterThan(0.15)
    const lastMatch = (b: Generated) => {
      const v = read(b)
      const j = v.back ? v.xs.indexOf(v.target) : v.xs.lastIndexOf(v.target)
      return v.inElse ? j : v.back ? j - 1 : j + 1
    }
    expect(differs(twice, lastMatch)).toBe(1)
    // The other copy's own index.
    expect(differs(twice, (b) => (read(b).back ? read(b).xs.indexOf(read(b).target) : read(b).xs.lastIndexOf(read(b).target)))).toBe(1)
  })

  it('mixes the forms, the written one about three builds in ten', () => {
    const forms = share(built, (b) => (read(b).at === null ? 'absent' : read(b).form))
    expect(forms.distinct).toBe(4)
    const after = built.filter((b) => read(b).at !== null && read(b).form === 'after').length / built.length
    expect(after).toBeGreaterThan(0.2)
    expect(after).toBeLessThan(0.4)
    expect(share(built, answer).worst).toBeLessThan(0.3)
    expect(share(built, answer).distinct).toBeGreaterThanOrEqual(7)
  })

  it('prints the written loop literally', () => {
    const b = built.find((x) => read(x).form === 'after' && /^nums/.test(code(x)))!
    expect(lines(b).slice(1, 4)).toEqual(['found ← False', 'i ← 0', 'WHILE i < LEN(nums) AND NOT found'])
    expect(lines(b).slice(-4)).toEqual(['   ENDIF', '   i ← i + 1', 'ENDWHILE', 'OUTPUT i'])
  })
})

describe('q14: how many values nested loops output', () => {
  const built = build('q14', 400)
  const read = (b: Generated) => {
    const p = b.question.prompt
    const [, R] = /with (\d+) rows/.exec(p)!
    const C = /and (\d+) columns/.exec(p)?.[1] ?? /rows of (\d+) seats/.exec(p)![1]
    const [, r0, r1] = /FOR r ← (\d+) TO (\d+)/.exec(p)!
    const [, c0, c1] = /FOR c ← (\d+) TO (\d+)/.exec(p)!
    const [a, z, x, y] = [r0, r1, c0, c1].map(Number) as [number, number, number, number]
    return { R: Number(R), C: Number(C), a, z, x, y, count: (z - a + 1) * (y - x + 1) }
  }

  it('multiplies the loop counts, both ends included', () => {
    for (const b of built) {
      const v = read(b)
      expect(answer(b), b.seed).toBe(v.count)
      expect(v.z).toBe(v.R - 1)
      expect(v.y).toBe(v.C - 1)
      expect(b.question.solution).toContain(`${v.z - v.a + 1} × ${v.y - v.x + 1} = **${v.count}**`)
      expect(v.count).toBeLessThanOrEqual(60)
      marksTyped(b)
    }
  })

  it('never pays the bounds read as counts, adding, or the whole grid where part is skipped', () => {
    expect(differs(built, (b) => read(b).z * read(b).y)).toBe(1)
    expect(differs(built, (b) => (read(b).z - read(b).a) * (read(b).y - read(b).x))).toBe(1)
    expect(differs(built, (b) => read(b).z - read(b).a + 1 + read(b).y - read(b).x + 1)).toBe(1)
    const skipped = built.filter((b) => read(b).a + read(b).x > 0)
    expect(skipped.length / built.length).toBeGreaterThan(0.3)
    expect(differs(skipped, (b) => read(b).R * read(b).C)).toBe(1)
    for (const b of built) expect([read(b).R, read(b).C], b.seed).not.toContain(answer(b))
  })

  it('spreads the sizes and prints the written sentence', () => {
    expect(share(built, answer).worst).toBeLessThan(0.15)
    expect(share(built, answer).distinct).toBeGreaterThan(15)
    expect(share(built, (b) => /```/.test(b.question.prompt)).distinct).toBe(2)
    const b = built.find((x) => /^`grid`/.test(x.question.prompt) && !/```/.test(x.question.prompt))!
    expect(b.question.prompt).toMatch(/^`grid` is a 2D array with \d rows and \d columns\. A program uses nested loops `FOR r ← \d TO \d` and `FOR c ← \d TO \d` and outputs `grid\[r\]\[c\]` each time\. How many values are output\?$/)
  })
})

describe('q17: a 2D array changed, then one row or column totalled', () => {
  const built = build('q17', 400)

  it('puts the change and the new row or column in two sentences', () => {
    for (const b of built) expect(b.question.solution, b.seed).toMatch(/\. (Row|Column) \d is now /)
  })
  /** Reads the grid, the change line and the one loop back, and works each total out here. */
  const read = (b: Generated) => {
    const c = code(b)
    const name = /^(\w+) ←/.exec(c)![1]!
    const grid = [...c.matchAll(/\[([\d, ]+)\]/g)].map((m) => m[1]!.split(', ').map(Number)).filter((row) => row.length > 1)
    const [, ti, tj, rhs] = new RegExp(`^${name}\\[(\\d)\\]\\[(\\d)\\] ← (.+)$`, 'm').exec(c)!
    const t = [Number(ti), Number(tj)] as const
    const src = /\[(\d)\]\[(\d)\]/.exec(rhs!)
    const s = src ? ([Number(src[1]), Number(src[2])] as const) : null
    const tail = /\* 2$/.test(rhs!) ? (v: number) => v * 2 : /\+ (\d)$/.test(rhs!) ? (v: number) => v + Number(/\+ (\d)$/.exec(rhs!)![1]) : (v: number) => v
    const rowAt = /total ← total \+ \w+\[(\d)\]\[c\]/.exec(c)
    const colAt = /total ← total \+ \w+\[r\]\[(\d)\]/.exec(c)
    const along = rowAt ? 'row' : 'column'
    const at = Number((rowAt ?? colAt)![1])
    const line = (g: number[][], al: string, k: number) => (al === 'row' ? g[k] ?? [] : g.every((row) => row[k] !== undefined) ? g.map((row) => row[k]!) : [])
    const sum = (xs: number[]) => (xs.length ? xs.reduce((a, x) => a + x, 0) : NaN)
    const change = (tc: readonly number[], sc: readonly number[] | null) => {
      if (grid[tc[0]!]?.[tc[1]!] === undefined) return null
      const sv = sc ? grid[sc[0]!]?.[sc[1]!] : 0
      if (sv === undefined) return null
      const g2 = grid.map((row) => [...row])
      g2[tc[0]!]![tc[1]!] = sc ? tail(sv) : 0
      return g2
    }
    const lineTotal = (g: number[][] | null) => (g ? sum(line(g, along, at)) : NaN)
    const flip = (x: readonly number[]) => [x[1]!, x[0]!]
    const after = change(t, s)!
    const count = along === 'row' ? grid.length : grid[0]!.length
    return {
      name, grid, t, s, along, at, after,
      newValue: after[t[0]]![t[1]]!,
      answer: lineTotal(after),
      ignored: sum(line(grid, along, at)),
      others: Array.from({ length: count }, (_, i) => i).filter((i) => i !== at).map((i) => sum(line(after, along, i))),
      crossed: sum(line(after, along === 'row' ? 'column' : 'row', at)),
      whole: after.flat().reduce((a, x) => a + x, 0),
      flipTarget: lineTotal(change(flip(t), s ?? flip(t))),
      flipSource: s ? lineTotal(change(t, flip(s))) : NaN,
      fromOne: lineTotal(change([t[0] - 1, t[1] - 1], s ? [s[0] - 1, s[1] - 1] : null)),
      onTop: sum(line(grid, along, at)) + after[t[0]]![t[1]]!,
    }
  }

  it('changes the cell before the loop, then adds the one row or column', () => {
    for (const b of built) {
      const v = read(b)
      expect(answer(b), b.seed).toBe(v.answer)
      expect(v.grid.length * v.grid[0]!.length).toBeLessThanOrEqual(12)
      // One FOR loop, never the whole grid with nested loops (q21's answer on the same sheet).
      expect(code(b).match(/\bFOR\b/g), b.seed).toHaveLength(1)
      expect(v.along === 'row' ? v.t[0] : v.t[1], b.seed).toBe(v.at)
      expect(b.question.markScheme[0]!.description).toBe(`${v.name}[${v.t[0]}][${v.t[1]}] becomes ${v.newValue} before the loop runs`)
      const cellsAdded = v.along === 'row' ? v.after[v.at]! : v.after.map((row) => row[v.at]!)
      expect(b.question.solution).toContain(`${cellsAdded.join(' + ')} = **${v.answer}**.`)
      expect(b.question.solution).toContain('and the change counts because it happens before the loop.')
      marksTyped(b)
    }
    const row = built.find((b) => read(b).along === 'row' && read(b).grid.length === 2)!
    expect(row.question.solution).toMatch(/ is now \[\d(, \d+)+\]\. `LEN\(\w+\[0\]\)` is \d columns, so the loop adds the (two|three|four) cells of row [01]: .* Row [01] is never added, and the change counts because it happens before the loop\.$/)
  })

  it('never pays the change ignored, another row or column, the same number read the other way, the whole grid, misread cells or the value added on top', () => {
    expect(differs(built, (b) => read(b).ignored)).toBe(1)
    for (const b of built) expect(read(b).others, b.seed).not.toContain(answer(b))
    expect(differs(built, (b) => read(b).crossed)).toBe(1)
    expect(differs(built, (b) => read(b).whole)).toBe(1)
    expect(differs(built, (b) => read(b).flipTarget)).toBe(1)
    expect(differs(built, (b) => read(b).flipSource)).toBe(1)
    expect(differs(built, (b) => read(b).fromOne)).toBe(1)
    expect(differs(built, (b) => read(b).onTop)).toBe(1)
  })

  it('totals rows about six times in ten, and spreads the totals, sizes and changes', () => {
    const rows = built.filter((b) => read(b).along === 'row').length / built.length
    expect(rows).toBeGreaterThan(0.5)
    expect(rows).toBeLessThan(0.7)
    expect(share(built, answer).worst).toBeLessThan(0.1)
    expect(share(built, answer).distinct).toBeGreaterThan(15)
    expect(share(built, (b) => `${read(b).grid.length}x${read(b).grid[0]!.length}`).distinct).toBe(5)
    const changeLine = (b: Generated) => lines(b).find((l) => /^\w+\[\d\]\[\d\] ←/.test(l))!
    const kind = (b: Generated) => (/← 0$/.test(changeLine(b)) ? 'zero' : /\* 2$/.test(changeLine(b)) ? 'double' : /\+ \d$/.test(changeLine(b)) ? 'plus' : 'copy')
    expect(share(built, kind).distinct).toBe(4)
    expect(share(built, kind).worst).toBeLessThan(0.5)
  })

  it('prints the written layout and loop', () => {
    const b = built.find((x) => /^grid ← \[\[/.test(code(x)) && read(x).grid.length === 2 && read(x).along === 'row')!
    expect(lines(b)[0]).toMatch(/^grid ← \[\[\d(, \d)+\],$/)
    expect(lines(b)[1]).toMatch(/^ {8}\[\d(, \d)+\]\]$/)
    expect(lines(b).slice(3)).toEqual(['total ← 0', 'FOR c ← 0 TO LEN(grid[0]) - 1', expect.stringMatching(/^ {3}total ← total \+ grid\[[01]\]\[c\]$/), 'ENDFOR', 'OUTPUT total'])
  })
})

describe('on a worksheet', () => {
  it('never prints the same list for q9 and q11 on the advanced sheet', () => {
    const ids = topic.worksheets.advanced.questionIds as string[]
    for (let i = 0; i < 200; i++) {
      const sheet = sheetQuestions('computer-science', TOPIC, ids.map(written), `sheet-${i}`)
      const mine = sheet.filter((s) => s.generated)
      expect(mine.map((s) => s.question.id)).toEqual(['q9', 'q11', 'q14', 'q17'])
      const lists = mine.slice(0, 2).map((s) => list(/```\n([\s\S]*?)\n```/.exec(s.question.prompt)![1]!).join())
      expect(lists[0]).not.toBe(lists[1])
      // q13 traces biggest over [12, 7, 9, 15]; none of these prints that list.
      for (const s of mine) expect(s.question.prompt).not.toContain('[12, 7, 9, 15]')
    }
  })
})
