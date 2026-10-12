import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate, sheetQuestions } from '../index.ts'
import type { Generated } from '../types.ts'
import { binarySearch, searchGenerators } from './search.ts'

/**
 * Structural tests for the searching generators (AQA 8525 3.1.3). Each reads the list and the
 * target back out of the prompt, searches it again with code written here (a linear walk, and a
 * binary search on its own low/high loop), checks the printed trace row by row, that the named
 * slips (counting from 0, giving the list's length, the midpoint rounded up, counting only the
 * halvings, the empty range counted as an examination, log₂ n without the + 1) never score, and
 * the spread over builds.
 */
const TOPIC = 'linear-and-binary-search'
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/computer-science')
const topic = JSON.parse(readFileSync(join(ROOT, `${TOPIC}.json`), 'utf8'))
const bank = Question.array().parse(topic.questions)
const written = (id: string) => bank.find((q) => q.id === id)!
const sheet = (level: string) => (topic.worksheets[level].questionIds as string[]).map(written)
const g = GENERATORS.find((x) => x.id === 'cs-searching')!

const build = (slotId: string, count = 300, prefix = 'structure'): Generated[] =>
  Array.from({ length: count }, (_, i) => generate(g, written(slotId), `${prefix}-${i}`))
const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)

const differs = (built: Generated[], route: (b: Generated) => number) => built.filter((b) => route(b) !== answer(b)).length / built.length

function share<T>(items: T[], key: (x: T) => unknown) {
  const counts = new Map<unknown, number>()
  for (const x of items) counts.set(key(x), (counts.get(key(x)) ?? 0) + 1)
  return { worst: Math.max(...counts.values()) / items.length, distinct: counts.size }
}

/** The list and target as printed: "… on 2, 5, 8, …, how many … find 8?" or "… find 77 in the list 22, 25, …". */
function readSearch(prompt: string): { list: number[]; target: number } {
  const list = /(?:on|list) ((?:\d+, )+\d+)/.exec(prompt)![1]!.split(', ').map(Number)
  const target = Number(
    (/find (\d+)/.exec(prompt) ?? /look for (\d+)/.exec(prompt) ?? /that (\d+) is not/.exec(prompt) ?? /for (\d+) in/.exec(prompt))![1],
  )
  return { list, target }
}

/** Binary search written here, (low + high) DIV 2 or rounded up, returning the items compared. */
function examine(list: number[], target: number, up = false): number[] {
  const seen: number[] = []
  let [lo, hi] = [0, list.length - 1]
  for (;;) {
    if (lo > hi) return seen
    const m = up ? Math.ceil((lo + hi) / 2) : Math.floor((lo + hi) / 2)
    seen.push(list[m]!)
    if (list[m] === target) return seen
    if (list[m]! < target) lo = m + 1
    else hi = m - 1
  }
}

const ascending = (l: number[]) => l.every((v, i) => i === 0 || l[i - 1]! < v)
const WRITTEN_LIST = '2, 5, 8, 12, 16, 23, 38, 56, 72, 91'

function marksTyped(b: Generated) {
  const a = answer(b)
  for (const t of [String(a), ` ${a} `, `${a} items`, a.toLocaleString('en-GB')]) expect(mark(b.question, t).correct, `${b.seed}: ${t}`).toBe(true)
  expect(mark(b.question, String(a + 1)).correct).toBe(false)
  expect(mark(b.question, String(a - 1)).correct).toBe(false)
}

describe('the binary search the pack teaches', () => {
  const list = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]
  it('examines what the lesson and written questions say on the ten-item list', () => {
    expect(binarySearch(list, 23).map((p) => p.value)).toEqual([16, 56, 23])
    expect(binarySearch(list, 72).map((p) => p.value)).toEqual([16, 56, 72])
    expect(binarySearch(list, 91).map((p) => p.value)).toEqual([16, 56, 72, 91])
    expect(binarySearch(list, 40).map((p) => p.value)).toEqual([16, 56, 23, 38])
    expect(binarySearch(list, 40).map((p) => [p.low, p.high, p.mid])).toEqual([
      [0, 9, 4],
      [5, 9, 7],
      [5, 6, 5],
      [6, 6, 6],
    ])
  })
})

describe('linear-and-binary-search generators', () => {
  it('cover every numeric written slot', () => {
    expect(searchGenerators.flatMap((x) => x.replaces).sort()).toEqual(['q10', 'q14', 'q4', 'q5', 'q7'])
    expect(bank.filter((q) => q.type === 'numeric').map((q) => q.id).sort()).toEqual(['q10', 'q14', 'q4', 'q5', 'q7'])
  })

  it("keeps each slot's marks, codes, units and exact tolerance, agrees by a second route, and never fails to draw over 3000 seeds", () => {
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
        expect(Number.isInteger(q.answer) && q.answer > 0).toBe(true)
        // A 1-mark slot is a B1 by the pack's scheme (the written q4 calls it A1); more marks keep the written codes.
        expect(q.markScheme.map((l) => l.code)).toEqual(slot.marks === 1 ? ['B1'] : slot.markScheme.map((l) => l.code))
        expect(q.markScheme.reduce((s, l) => s + l.marks, 0)).toBe(slot.marks)
        expect(q.markScheme.at(-1)!.description).toBe(String(q.answer))
        marksTyped(b)
      }
    }
  })

  it('repeats no prompt in a twentieth of 1000 builds, and the written one in at most a hundredth', () => {
    for (const id of g.replaces) {
      const built = build(id, 1000, 'release')
      const s = share(built, (b) => b.question.prompt)
      expect(s.worst, id).toBeLessThanOrEqual(0.05)
      expect(s.distinct, id).toBeGreaterThan(100)
      expect(built.filter((b) => b.question.prompt === written(id).prompt).length, id).toBeLessThanOrEqual(10)
    }
  })

  it('q4: linear search counts the items up to and including the match, never the last item of the list', () => {
    const built = build('q4')
    for (const b of built) {
      const { list, target } = readSearch(b.question.prompt)
      const p = list.indexOf(target) + 1
      expect(p, b.seed).toBeGreaterThan(1)
      expect(answer(b)).toBe(p)
      expect(list.length).toBeGreaterThanOrEqual(6)
      expect(list.length).toBeLessThanOrEqual(16)
      expect(new Set(list).size).toBe(list.length)
      expect(list.join(', ')).not.toBe(WRITTEN_LIST)
      // Wrong routes: counting from 0 or stopping one early (p − 1), the length of the list.
      expect(list.length).not.toBe(p)
      // No printed number is the count.
      expect(list).not.toContain(p)
      expect(b.question.solution).toContain(`checks each item in turn from the start: ${list.slice(0, p).slice(0, -1).join(', ')} and ${target}.`)
      expect(b.question.solution).toContain(`so **${p}** items are examined`)
    }
    const s = share(built, answer)
    expect(s.worst).toBeLessThanOrEqual(0.4)
    expect(s.distinct).toBeGreaterThanOrEqual(10)
    const sorted = built.filter((b) => ascending(readSearch(b.question.prompt).list)).length / built.length
    expect(sorted).toBeGreaterThan(0.35)
    expect(sorted).toBeLessThan(0.65)
  })

  it('q7: linear search on an absent value examines the whole list, and stopping at the first bigger item never scores', () => {
    const built = build('q7')
    for (const b of built) {
      const { list, target } = readSearch(b.question.prompt)
      const n = list.length
      expect(list, b.seed).not.toContain(target)
      expect(answer(b)).toBe(n)
      expect(list).not.toContain(n)
      expect([n - 1, n, n + 1]).not.toContain(target)
      // The slip of stopping at the first item bigger than the target, on a sorted list.
      if (ascending(list)) expect(list.findIndex((v) => v > target) + 1).not.toBe(n)
      expect(b.question.solution).toContain(`it checks all **${n}** items before reporting that ${target} is not there`)
    }
    const s = share(built, answer)
    expect(s.worst).toBeLessThanOrEqual(0.4)
    expect(s.distinct).toBeGreaterThanOrEqual(10)
  })

  /** Every row of a printed trace, read back and checked against the list. */
  function checkTrace(b: Generated, list: number[], target: number) {
    const rows = [...b.question.solution.matchAll(/^\| (\d+) \| (\d+) \| \((\d+) \+ (\d+)\) DIV 2 = (\d+) \| (\d+) \| ([^|]+) \|$/gm)].map((m) => m.slice(1).map((x, i) => (i < 6 ? Number(x) : x.trim())))
    const seen = examine(list, target)
    expect(rows.length, b.seed).toBe(seen.length)
    let [lo, hi] = [0, list.length - 1]
    for (const [i, row] of rows.entries()) {
      const [low, high, l2, h2, mid, item, what] = row as [number, number, number, number, number, number, string]
      expect([low, high, l2, h2]).toEqual([lo, hi, lo, hi])
      expect(mid).toBe(Math.floor((lo + hi) / 2))
      expect(item).toBe(list[mid])
      expect(item).toBe(seen[i])
      if (item === target) expect(what).toBe('found')
      else if (item < target) {
        lo = mid + 1
        expect(what).toBe(`too small, low becomes ${lo}`)
      } else {
        hi = mid - 1
        expect(what).toBe(`too big, high becomes ${hi < 0 ? `−${-hi}` : hi}`)
      }
    }
    return { lo, hi }
  }

  it('q5: binary search traced from the prompt, with the midpoint rule stated, and no slip scoring', () => {
    const built = build('q5')
    for (const b of built) {
      const { list, target } = readSearch(b.question.prompt)
      expect(b.question.prompt).toContain('Take the midpoint as (low + high) DIV 2')
      expect(b.question.prompt).toMatch(/counting positions from 0|positions counted from 0/)
      expect(ascending(list), b.seed).toBe(true)
      expect(list.join(', ')).not.toBe(WRITTEN_LIST)
      const seen = examine(list, target)
      expect(seen.at(-1)).toBe(target)
      expect(answer(b)).toBe(seen.length)
      checkTrace(b, list, target)
      expect(b.question.solution).toContain(`The items examined are `)
      expect(b.question.solution).toContain(`: **${seen.length}** items. Linear search would have taken ${list.indexOf(target) + 1}.`)
      // Wrong routes: rounded up, linear, only the halvings, the first item alone.
      expect(examine(list, target, true).length).not.toBe(seen.length)
      expect(list.indexOf(target) + 1).not.toBe(seen.length)
      expect(seen.length).toBeGreaterThanOrEqual(2)
      expect(list).not.toContain(seen.length)
    }
    for (const b of built) expect([8, 11, 14]).toContain(readSearch(b.question.prompt).list.length)
    const s = share(built, answer)
    expect(s.worst).toBeLessThanOrEqual(0.4)
    expect(s.distinct).toBe(3)
    // The worst-case shortcut, ⌊log₂ n⌋ + 1, pays in under two builds in five.
    expect(differs(built, (b) => Math.floor(Math.log2(readSearch(b.question.prompt).list.length)) + 1)).toBeGreaterThan(0.6)
  })

  it('q10: binary search traced to an empty range, the target between two items (beyond an end only on 6), and no slip scoring', () => {
    const built = build('q10')
    for (const b of built) {
      const { list, target } = readSearch(b.question.prompt)
      expect(b.question.prompt).toContain('Take the midpoint as (low + high) DIV 2')
      expect(ascending(list), b.seed).toBe(true)
      expect(list).not.toContain(target)
      if (list.length !== 6) expect(target > list[0]! && target < list.at(-1)!).toBe(true)
      const seen = examine(list, target)
      expect(answer(b)).toBe(seen.length)
      const { lo, hi } = checkTrace(b, list, target)
      expect(lo).toBeGreaterThan(hi)
      expect(b.question.solution).toContain(`Now low is ${lo} and high is ${hi < 0 ? `−${-hi}` : hi}: the low position has passed the high position`)
      // Wrong routes: rounded up, the empty range counted, linear's whole list.
      expect(examine(list, target, true).length).not.toBe(seen.length)
      expect(list.length).not.toBe(seen.length)
      expect([target, ...list]).not.toContain(seen.length)
    }
    for (const b of built) expect([6, 9, 10, 12, 13, 16]).toContain(readSearch(b.question.prompt).list.length)
    // Absent searches examine 2 to 5 items: about 1/6, 1/3, 1/3, 1/6.
    const s = share(built, answer)
    expect(s.worst).toBeLessThanOrEqual(0.4)
    expect(s.distinct).toBe(4)
    for (const k of [2, 5]) {
      const f = built.filter((b) => answer(b) === k).length / built.length
      expect(f, String(k)).toBeGreaterThan(0.1)
      expect(f, String(k)).toBeLessThan(0.25)
    }
  })

  /** The size as printed: "1 000 000", "1200". */
  const readSize = (prompt: string) => Number(/(\d{1,3}(?: \d{3})+|\d+)/.exec(prompt)![1]!.replace(/ /g, ''))

  it('q14: the worst case is the halvings to empty the list, on a size that is no power of 2 and fits its context', () => {
    const built = build('q14')
    const ranges: [RegExp, number, number][] = [
      [/contacts list/, 40, 1500],
      [/ID numbers of its/, 300, 2500],
      [/stock list/, 500, 60_000],
      [/dictionary app/, 20_000, 500_000],
      [/usernames/, 10_000, 4_000_000],
      [/city council/, 50_000, 1_200_000],
      [/A sorted list holds/, 40, 4_000_000],
    ]
    for (const b of built) {
      const n = readSize(b.question.prompt)
      // Halve by hand: the items left after each examination are at most half of those before.
      let left = n
      let k = 0
      while (left >= 1) {
        left = Math.floor(left / 2)
        k++
      }
      expect(answer(b), b.seed).toBe(k)
      expect(n & (n - 1)).not.toBe(0)
      expect([1000, 2000, 5000]).not.toContain(n)
      const [, lo, hi] = ranges.find(([re]) => re.test(b.question.prompt))!
      expect(n >= lo && n <= hi, `${b.question.prompt}`).toBe(true)
      expect(b.question.prompt).toContain('Take the midpoint as (low + high) DIV 2.')
      expect(b.question.prompt).not.toMatch(/librar/i)
      // Wrong routes: log₂ n without the + 1, and half the list.
      expect(Math.floor(Math.log2(n))).not.toBe(k)
      expect(Math.round(n / 2)).not.toBe(k)
      // Near the written million: at most 22 examinations.
      expect(k).toBeLessThanOrEqual(22)
      const tex = (x: number) => (x >= 10000 ? String(x).replace(/\B(?=(\d{3})+(?!\d))/g, '\\,') : String(x))
      expect(b.question.solution).toContain(
        `a number between $2^{${k - 1}} = ${tex(2 ** (k - 1))}$ and $2^{${k}} = ${tex(2 ** k)}$, so ${k - 1} halvings leave one item, and examining that last item makes $${k - 1} + 1 = $ **${k}**.`,
      )
      expect(b.question.solution).not.toMatch(/just over/)
      expect(b.question.markScheme[1]!.description).toBe(`$2^{${k - 1}} < ${tex(n)} < 2^{${k}}$, so ${k - 1} halvings and the last item`)
    }
    const s = share(built, answer)
    expect(s.worst).toBeLessThanOrEqual(0.4)
    expect(s.distinct).toBeGreaterThanOrEqual(10)
    expect(share(built, (b) => readSize(b.question.prompt)).distinct).toBeGreaterThan(50)
  })

  it('higher sheet: q5, q7 and q10 never share a list or a length, and none prints the written list', () => {
    const higher = sheet('higher')
    for (let i = 0; i < 300; i++) {
      const s = sheetQuestions('computer-science', TOPIC, higher, `higher-${i}`)
      const lists = ['q5', 'q7', 'q10'].map((id) => readSearch(s.find((x) => x.question.id === id)!.question.prompt).list)
      expect(new Set(lists.map((l) => l.length)).size).toBe(3)
      for (const l of lists) expect(l.join(', ')).not.toBe(WRITTEN_LIST)
    }
  })
})
