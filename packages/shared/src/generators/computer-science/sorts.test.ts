import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate, sheetQuestions } from '../index.ts'
import type { Generated } from '../types.ts'
import { bubbleSort, merge, sortGenerators } from './sorts.ts'

/**
 * Structural tests for the sorting generators (AQA 8525 3.1.4). Each reads the list, the lists
 * or the length back out of the prompt and works the answer again with code written here (a
 * bubble sort on its own repeat-until loop, pairs out of order counted, a merge of the fronts,
 * halvings counted by hand), checks the printed trace row by row and some lines literally, that
 * the named slips never score, the spread over builds, and that slots sharing a sheet never
 * print the length another works with.
 */
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/computer-science')
const load = (t: string) => JSON.parse(readFileSync(join(ROOT, `${t}.json`), 'utf8'))
const topics = { 'bubble-sort': load('bubble-sort'), 'merge-sort': load('merge-sort') } as Record<string, { questions: unknown[]; worksheets: Record<string, { questionIds: string[] }> }>
const bank = (t: string) => Question.array().parse(topics[t]!.questions)
const written = (t: string, id: string) => bank(t).find((q) => q.id === id)!
const sheet = (t: string, level: string) => topics[t]!.worksheets[level]!.questionIds.map((id) => written(t, id))
const bubbleGen = GENERATORS.find((x) => x.id === 'cs-bubble-sort')!
const mergeGen = GENERATORS.find((x) => x.id === 'cs-merge-sort')!

const buildB = (id: string, count = 300, prefix = 'structure') => Array.from({ length: count }, (_, i) => generate(bubbleGen, written('bubble-sort', id), `${prefix}-${i}`))
const buildM = (id: string, count = 300, prefix = 'structure') => Array.from({ length: count }, (_, i) => generate(mergeGen, written('merge-sort', id), `${prefix}-${i}`))
const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)

function share<T>(items: T[], key: (x: T) => unknown) {
  const counts = new Map<unknown, number>()
  for (const x of items) counts.set(key(x), (counts.get(key(x)) ?? 0) + 1)
  return { worst: Math.max(...counts.values()) / items.length, distinct: counts.size }
}
const differs = (built: Generated[], route: (b: Generated) => number) => built.filter((b) => route(b) !== answer(b)).length / built.length

/** The first comma-separated list of whole numbers in a text. */
const readList = (s: string) => /(\d+(?:, \d+)+)/.exec(s)![1]!.split(', ').map(Number)
/** Both lists of a merge prompt: "the sorted lists 1, 4 and 2, 3". */
function readLists(prompt: string): [number[], number[]] {
  const m = /lists ((?:\d+, )*\d+) and ((?:\d+, )*\d+)/.exec(prompt)!
  return [m[1]!.split(', ').map(Number), m[2]!.split(', ').map(Number)]
}
const firstNumber = (s: string) => Number(/(\d+)/.exec(s.replace(/\$n\$/g, ''))![1])

/** Bubble sort written here: repeat passes over a shrinking end until one makes no swap. */
function bubble(list: number[]) {
  const a = [...list]
  let end = a.length - 1
  let comparisons = 0
  let swaps = 0
  const passes: { comparisons: number; swaps: number; after: string }[] = []
  let swapped: boolean
  do {
    swapped = false
    let c = 0
    let s = 0
    for (let i = 0; i < end; i++) {
      c++
      if (a[i]! > a[i + 1]!) {
        const t = a[i]!
        a[i] = a[i + 1]!
        a[i + 1] = t
        s++
        swapped = true
      }
    }
    passes.push({ comparisons: c, swaps: s, after: a.join(', ') })
    comparisons += c
    swaps += s
    end--
  } while (swapped && end >= 1)
  return { comparisons, swaps, passes }
}

/** Merge written here: count comparisons of the fronts until one list is used up. */
function mergeCount(a: number[], b: number[]) {
  let [i, j, c] = [0, 0, 0]
  while (i < a.length && j < b.length) {
    c++
    if (a[i]! < b[j]!) i++
    else j++
  }
  return c
}

function marksTyped(b: Generated) {
  const a = answer(b)
  for (const t of [String(a), ` ${a} `, `${a} comparisons`, a.toLocaleString('en-GB')]) expect(mark(b.question, t).correct, `${b.seed}: ${t}`).toBe(true)
  expect(mark(b.question, String(a + 1)).correct).toBe(false)
}

describe('the bubble sort and merge the pack teaches', () => {
  it('bubble sort matches the lesson on 5, 3, 8, 1, 9, 2: five passes, 15 comparisons, 8 swaps', () => {
    const passes = bubbleSort([5, 3, 8, 1, 9, 2])
    expect(passes.map((p) => p.after.join(', '))).toEqual(['3, 5, 1, 8, 2, 9', '3, 1, 5, 2, 8, 9', '1, 3, 2, 5, 8, 9', '1, 2, 3, 5, 8, 9', '1, 2, 3, 5, 8, 9'])
    expect(passes.map((p) => p.compared)).toEqual([5, 4, 3, 2, 1])
    expect(passes.map((p) => p.swaps.length)).toEqual([3, 2, 2, 1, 0])
  })

  it('bubble sort matches the written and lesson examples: one pass on a sorted list, 5 swaps over 3 passes on 4, 3, 1, 2', () => {
    expect(bubbleSort([1, 2, 3, 4, 5]).map((p) => [p.compared, p.swaps.length])).toEqual([[4, 0]])
    expect(bubbleSort([4, 3, 1, 2]).map((p) => p.swaps)).toEqual([[[4, 3], [4, 1], [4, 2]], [[3, 1], [3, 2]], []])
    expect(bubbleSort([4, 3, 1, 2]).map((p) => p.after.join(', '))).toEqual(['3, 1, 2, 4', '1, 2, 3, 4', '1, 2, 3, 4'])
    expect(bubbleSort([4, 1, 3, 2])[0]!.after).toEqual([1, 3, 2, 4])
    expect(bubbleSort([7, 2, 5, 1])[0]!.after).toEqual([2, 5, 1, 7])
    expect(bubbleSort([5, 4, 3, 2, 1]).reduce((s, p) => s + p.compared, 0)).toBe(10)
  })

  it('merge matches the lesson: [2, 6] and [4, 9] in 3 comparisons, [2, 3, 8] and [1, 6] in 4', () => {
    expect(merge([2, 6], [4, 9])).toMatchObject({ merged: [2, 4, 6, 9], rest: [9] })
    expect(merge([2, 6], [4, 9]).steps.map((s) => s.fronts)).toEqual([[2, 4], [6, 4], [6, 9]])
    expect(merge([2, 3, 8], [1, 6]).steps.length).toBe(4)
    expect(merge([1, 4], [2, 3]).steps.length).toBe(3)
  })
})

describe('bubble-sort and merge-sort generators', () => {
  it('cover every numeric written slot', () => {
    expect(bubbleGen.replaces.sort()).toEqual(['q11', 'q15', 'q17', 'q5', 'q8'])
    expect(bank('bubble-sort').filter((q) => q.type === 'numeric').map((q) => q.id).sort()).toEqual(['q11', 'q15', 'q17', 'q5', 'q8'])
    expect(mergeGen.replaces.sort()).toEqual(['q14', 'q18', 'q6'])
    expect(bank('merge-sort').filter((q) => q.type === 'numeric').map((q) => q.id).sort()).toEqual(['q14', 'q18', 'q6'])
    expect(sortGenerators).toEqual([bubbleGen, mergeGen])
  })

  it("keep each slot's marks, codes, units and exact tolerance, agree by a second route, and never fail to draw over 3000 seeds", () => {
    for (const g of sortGenerators) {
      for (const id of g.replaces) {
        const slot = written(g.topicId, id)
        for (let i = 0; i < 3000; i++) {
          const b = generate(g, slot, `throw-${i}`)
          expect(b.check.agrees, `${id} ${b.seed}: ${b.check.detail}`).toBe(true)
          if (i >= 300) continue
          const q = b.question
          if (q.type !== 'numeric' || slot.type !== 'numeric') throw new Error('not numeric')
          expect(q.units).toBe(slot.units)
          expect(q.tolerance).toBe(0)
          expect(Number.isInteger(q.answer) && q.answer > 0).toBe(true)
          expect(q.markScheme.map((l) => l.code)).toEqual(slot.markScheme.map((l) => l.code))
          marksTyped(b)
        }
      }
    }
  })

  it('repeat no prompt in a twentieth of 1000 builds, and the written one in at most a hundredth', () => {
    for (const [g, t] of [[bubbleGen, 'bubble-sort'], [mergeGen, 'merge-sort']] as const) {
      for (const id of g.replaces) {
        const built = Array.from({ length: 1000 }, (_, i) => generate(g, written(t, id), `release-${i}`))
        const s = share(built, (b) => b.question.prompt)
        expect(s.worst, id).toBeLessThanOrEqual(0.05)
        expect(s.distinct, id).toBeGreaterThan(100)
        expect(built.filter((b) => b.question.prompt === written(t, id).prompt).length, id).toBeLessThanOrEqual(10)
      }
    }
  })
})

describe('bubble sort slots', () => {
  const PASS = { first: 1, second: 2, third: 3 } as Record<string, number>

  it('q5: pass k of n items compares n − k pairs; n, and n − 1 after the first pass, never score', () => {
    const built = buildB('q5')
    for (const b of built) {
      const p = b.question.prompt
      const n = firstNumber(p)
      const k = PASS[/How many comparisons does the (\w+) pass make/.exec(p)![1]!]!
      expect(answer(b), b.seed).toBe(n - k)
      expect(n >= 6 && n <= 25).toBe(true)
      expect(answer(b)).not.toBe(n)
      if (k > 1) {
        expect(answer(b)).not.toBe(n - 1)
        expect(p).toContain(`so a ${['', 'first', 'second', 'third'][k]} pass runs`)
      }
      expect(b.question.markScheme[0]!.description).toBe(`$${n} - ${k}$`)
      expect(b.question.solution).toContain(`$${n} - ${k} = ${n - k}$`)
    }
    const s = share(built, answer)
    expect(s.worst).toBeLessThanOrEqual(0.4)
    expect(s.distinct).toBeGreaterThanOrEqual(10)
    const firsts = built.filter((b) => /first pass make/.test(b.question.prompt)).length / built.length
    expect(firsts).toBeGreaterThan(0.4)
    expect(firsts).toBeLessThan(0.6)
  })

  it('q8: the total comparisons traced pass by pass until the sort stops, and the named slips never score', () => {
    const built = buildB('q8')
    let early = 0
    for (const b of built) {
      const list = readList(b.question.prompt)
      const n = list.length
      const own = bubble(list)
      expect(answer(b), b.seed).toBe(own.comparisons)
      expect(n >= 4 && n <= 7).toBe(true)
      expect(own.passes.length).toBeGreaterThanOrEqual(2)
      // The flag is named, never explained (q7 on the sheet asks what it is for).
      expect(b.question.prompt).toMatch(/[Aa] bubble sort with a swapped flag/)
      expect(b.question.prompt).not.toMatch(/stop|early/)
      expect(list).not.toContain(answer(b))
      expect(['6, 3, 9, 1', '8, 5, 7, 3, 6']).not.toContain(list.join(', '))
      // Each table row read back.
      const rows = [...b.question.solution.matchAll(/^\| (\d+) \| (\d+) \| (\d+) \| ([\d, ]+) \|$/gm)]
      expect(rows.map((m) => [Number(m[2]), Number(m[3]), m[4]])).toEqual(own.passes.map((p) => [p.comparisons, p.swaps, p.after]))
      expect(b.question.solution).toContain(`Total comparisons: $${own.passes.map((p) => p.comparisons).join(' + ')} = ${own.comparisons}$, so **${own.comparisons}**.`)
      if (own.passes.length < n - 1) early++
      // At 4 items every pass running makes the total n(n − 1)/2: the swapped flag ignored would pay.
      if (n === 4) expect(own.passes.length, b.seed).toBeLessThan(3)
      // Slips: n per pass, n² or n(n + 1)/2 in all, n − 1 on every pass, swaps for comparisons.
      for (const wrong of [own.passes.length * n, n * n, (n * (n + 1)) / 2, own.passes.length * (n - 1), own.swaps]) expect(wrong, b.seed).not.toBe(own.comparisons)
    }
    // The early stop changes the answer in all but an eighth of builds (n(n − 1)/2 is then wrong).
    expect(early / built.length).toBeGreaterThan(7 / 8)
    expect(differs(built, (b) => { const n = readList(b.question.prompt).length; return (n * (n - 1)) / 2 })).toBeGreaterThan(0.4)
    const s = share(built, answer)
    expect(s.worst).toBeLessThanOrEqual(0.4)
    expect(s.distinct).toBeGreaterThanOrEqual(10)
  })

  it('q11: n(n − 1)/2 for 9 to 30 items; n², n(n + 1)/2 and the unhalved product never score', () => {
    const built = buildB('q11')
    for (const b of built) {
      const n = firstNumber(b.question.prompt)
      expect(answer(b), b.seed).toBe((n * (n - 1)) / 2)
      // Not 8: the advanced sheet's written q17 (28 comparisons, 8 items) asked the other way round.
      expect(n >= 9 && n <= 30).toBe(true)
      for (const wrong of [n * n, (n * (n + 1)) / 2, n * (n - 1), (n * n) / 2]) expect(wrong).not.toBe(answer(b))
      expect(b.question.solution.startsWith(`$\\frac{${n} \\times ${n - 1}}{2} = \\frac{${n * (n - 1)}}{2} = ${answer(b)}$`)).toBe(true)
      // The flag can stop the sort early, so every version says the formula is the worst case.
      expect(b.question.prompt).toMatch(/worst case|reverse order/)
    }
    const s = share(built, answer)
    expect(s.worst).toBeLessThanOrEqual(0.4)
    expect(s.distinct).toBeGreaterThanOrEqual(10)
  })

  it('q15: the swaps are the pairs out of order, traced pass by pass; comparisons, passes and pass 1 alone never score', () => {
    const built = buildB('q15')
    for (const b of built) {
      const list = readList(b.question.prompt)
      const own = bubble(list)
      let pairs = 0
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (list[i]! > list[j]!) pairs++
      expect(answer(b), b.seed).toBe(pairs)
      expect(own.swaps).toBe(pairs)
      expect(list.length >= 4 && list.length <= 6).toBe(true)
      expect(list).not.toContain(pairs)
      expect(pairs).not.toBe(list.length)
      for (const wrong of [own.comparisons, own.passes.length, own.passes[0]!.swaps]) expect(wrong, b.seed).not.toBe(pairs)
      const lines = b.question.solution.split('\n').filter((l) => l.startsWith('- Pass '))
      expect(lines.length).toBe(own.passes.length)
      for (const [i, p] of own.passes.entries()) {
        if (p.swaps) expect(lines[i]).toContain(`giving ${p.after}: ${p.swaps} swap${p.swaps === 1 ? '' : 's'}.`)
        else expect(lines[i]).toBe(`- Pass ${i + 1}: no swaps, so the sort stops.`)
      }
      expect(b.question.markScheme[0]!.description).toBe(`pass 1 makes ${own.passes[0]!.swaps} swap${own.passes[0]!.swaps === 1 ? '' : 's'}`)
    }
    const s = share(built, answer)
    expect(s.worst).toBeLessThanOrEqual(0.4)
    expect(s.distinct).toBeGreaterThanOrEqual(10)
  })

  it('q17: the length from n(n − 1) = 2T; solving n(n + 1)/2 = T, √(2T) and √T never score', () => {
    const built = buildB('q17')
    for (const b of built) {
      const T = firstNumber(b.question.prompt)
      let n = 1
      while ((n * (n - 1)) / 2 < T) n++
      expect((n * (n - 1)) / 2).toBe(T)
      expect(answer(b), b.seed).toBe(n)
      expect(n >= 5 && n <= 25).toBe(true)
      // Not 20: the written q11 (20 items, 190 comparisons) asked the other way round.
      expect(n).not.toBe(20)
      for (const wrong of [n - 1, Math.floor(Math.sqrt(2 * T)), Math.round(Math.sqrt(2 * T)), Math.round(Math.sqrt(T))]) expect(wrong).not.toBe(n)
      expect(b.question.solution).toMatch(new RegExp(`Since \\$${n} \\\\times ${n - 1} = ${2 * T}\\$, the list has \\*\\*${n}\\*\\* (items|numbers|names|test scores|prices|high scores)\\.$`))
    }
    const s = share(built, answer)
    expect(s.worst).toBeLessThanOrEqual(0.4)
    expect(s.distinct).toBeGreaterThanOrEqual(10)
  })

  it('sheets: q5 and q8 take lengths of opposite parity; q11 and q17 never share a length', () => {
    for (let i = 0; i < 300; i++) {
      const h = sheetQuestions('computer-science', 'bubble-sort', sheet('bubble-sort', 'higher'), `higher-${i}`)
      const get = (s: typeof h, id: string) => s.find((x) => x.question.id === id)!.question.prompt
      expect(firstNumber(get(h, 'q5')) % 2).not.toBe(readList(get(h, 'q8')).length % 2)
      const a = sheetQuestions('computer-science', 'bubble-sort', sheet('bubble-sort', 'advanced'), `advanced-${i}`)
      const n11 = firstNumber(get(a, 'q11'))
      const T17 = firstNumber(get(a, 'q17'))
      expect((n11 * (n11 - 1)) / 2).not.toBe(T17)
      expect(n11 % 3).not.toBe(a.find((x) => x.question.id === 'q17')!.generated!.values.n as number % 3)
    }
  })
})

describe('merge sort slots', () => {
  const readCount = (prompt: string) => Number(/(\d[\d ]*\d|\d)/.exec(prompt)![1]!.replace(/ /g, ''))

  it('q6: the rounds are the halvings of the longest list to 1; n/2, ⌊log₂ n⌋ and log₂ n + 1 never score', () => {
    const built = buildM('q6')
    let powers = 0
    for (const b of built) {
      const n = readCount(b.question.prompt)
      let size = n
      let k = 0
      while (size > 1) {
        size = Math.ceil(size / 2)
        k++
      }
      expect(answer(b), b.seed).toBe(k)
      const isPower = (n & (n - 1)) === 0
      if (isPower) powers++
      expect(n / 2).not.toBe(k)
      expect(Math.log2(n) + 1).not.toBe(k)
      if (!isPower) expect(Math.floor(Math.log2(n))).not.toBe(k)
      expect(n >= 5 && n <= 4096).toBe(true)
      if (isPower) expect(b.question.solution).toContain(`so **${k}** rounds, because $2^{${k}} = ${n}$.`)
      else expect(b.question.solution).toContain(`That is ${k} levels of splitting`)
    }
    expect(powers / built.length).toBeGreaterThan(0.2)
    expect(powers / built.length).toBeLessThan(0.4)
    const s = share(built, answer)
    expect(s.worst).toBeLessThanOrEqual(0.4)
    expect(s.distinct).toBeGreaterThanOrEqual(10)
  })

  it('q14: one merge counted from the fronts; the total, the shorter length and every-with-every never score', () => {
    const built = buildM('q14')
    for (const b of built) {
      const [A, B] = readLists(b.question.prompt)
      const c = mergeCount(A, B)
      expect(answer(b), b.seed).toBe(c)
      for (const l of [A, B]) {
        expect(l.length >= 2 && l.length <= 5).toBe(true)
        expect(l.every((v, i) => i === 0 || l[i - 1]! < v)).toBe(true)
        expect(l).not.toContain(c)
        for (const w of ['1, 3, 5, 8', '2, 4, 6, 7', '2, 5', '1, 8', '1, 2, 5, 8']) expect(l.join(', ')).not.toBe(w)
      }
      expect(new Set([...A, ...B]).size).toBe(A.length + B.length)
      expect(A.length + B.length).toBeGreaterThan(4)
      // "A merge sort merges…" only for lists a merge sort's halving makes: within one of each other.
      if (/^A merge sort merges/.test(b.question.prompt)) expect(Math.abs(A.length - B.length)).toBeLessThanOrEqual(1)
      for (const wrong of [A.length + B.length, Math.min(A.length, B.length), A.length * B.length]) expect(wrong, b.seed).not.toBe(c)
      // Each row of the table: the two fronts, and the smaller taken.
      const rows = [...b.question.solution.matchAll(/^\| (\d+) and (\d+) \| (\d+) \|/gm)].map((m) => [Number(m[1]), Number(m[2]), Number(m[3])])
      expect(rows.length).toBe(c)
      for (const [x, y, take] of rows) expect(take).toBe(Math.min(x!, y!))
      expect(b.question.solution).toMatch(new RegExp(`copied across without a comparison: \\*\\*${c}\\*\\* comparisons\\.$`))
    }
    const s = share(built, answer)
    expect(s.worst).toBeLessThanOrEqual(0.4)
    expect(s.distinct).toBeGreaterThanOrEqual(6)
    // The worst-case count (a + b − 1, q18's rule on the same sheet) is the answer in about a fifth of builds.
    expect(differs(built, (b) => { const [A, B] = readLists(b.question.prompt); return A.length + B.length - 1 })).toBeGreaterThan(0.72)
  })

  it('q18: the most comparisons is a + b − 1; the total, either length and the product never score', () => {
    const built = buildM('q18')
    for (const b of built) {
      const p = b.question.prompt
      const nums = [...p.matchAll(/(\d+) (?:items|names|numbers|test scores)/g)].map((m) => Number(m[1]))
      // "… merge sort on N items …" names N first; "… of a items each" names one length.
      const lengths = /merge sort on/.test(p) ? nums.slice(1) : nums
      const [a, bb] = /each/.test(p) ? [lengths[0]!, lengths[0]!] : [lengths[0]!, lengths[1]!]
      expect(lengths.length).toBe(/each/.test(p) ? 1 : 2)
      const N = a + bb
      expect(answer(b), b.seed).toBe(N - 1)
      expect(N >= 6 && N <= 14).toBe(true)
      expect(Math.abs(a - bb)).toBeLessThanOrEqual(2)
      if (/merge sort on (\d+)/.test(p)) {
        expect(Number(/merge sort on (\d+)/.exec(p)![1])).toBe(N)
        // The lesson's halving: the first half is the shorter.
        expect(bb - a === 0 || bb - a === 1).toBe(true)
      }
      for (const wrong of [N, Math.min(a, bb), Math.max(a, bb), a * bb]) expect(wrong).not.toBe(N - 1)
      expect(b.question.solution).toContain(`so the most needed is $${N} - 1 = ${N - 1}$`)
    }
    // Totals 6 to 14 give the nine answers 5 to 13.
    const s = share(built, answer)
    expect(s.worst).toBeLessThanOrEqual(0.4)
    expect(s.distinct).toBe(9)
  })

  it('advanced sheet: q18 never merges q14\'s total', () => {
    for (let i = 0; i < 300; i++) {
      const a = sheetQuestions('computer-science', 'merge-sort', sheet('merge-sort', 'advanced'), `advanced-${i}`)
      const q14 = a.find((x) => x.question.id === 'q14')!
      const q18 = a.find((x) => x.question.id === 'q18')!
      const [A, B] = readLists(q14.question.prompt)
      expect(q18.generated!.values.N).not.toBe(A.length + B.length)
    }
  })
})
