import type { Question } from '../../content/questions.ts'
import { draw, int, pick, shuffle, weighted, type Rng } from '../random.ts'
import type { Draft, Generator } from '../types.ts'
import { andList, csBySlot, fence, numericDraft } from './build.ts'
import { run, type Value } from './pseudo.ts'

/**
 * Computer Science (AQA 8525) generators for 3.2.6, data structures: "use arrays (or equivalent)
 * in the design of solutions to simple problems", one- and two-dimensional arrays only, traced as
 * 3.1.1 asks ("use trace tables … to determine how simple algorithms work"), with the iteration of
 * 3.2.2 and the relational operators of 3.2.4.
 *
 * The lesson's conventions: indexes from 0, LEN gives the number of items so the last index is
 * LEN − 1, a 2D array is grid[row][column] with LEN(grid) rows and LEN(grid[0]) columns. Every
 * program is run by the interpreter (pseudo.ts) exactly as printed, its answer checked against the
 * working printed here.
 *
 * - q1: the index of a named item in a list of 3 to 7 words. Counting from 1 never pays; one build
 *   in six asks for the last item, where LEN is the slip.
 * - q5: a running total over FOR i ← 0 TO LEN(a) − 1 (lesson s2). Stopping one item early, starting
 *   at index 1 and giving the last item never pay.
 * - q9: counting the items that pass a test with >, ≥, < or ≤ (s6); the boundary value is always in
 *   the list, so reading > as ≥ (or the reverse) never pays, nor does counting the other side.
 * - q11: the linear search with a found flag (s7). As written, i is incremented after the match
 *   (three builds in ten); otherwise the increment sits in an ELSE so i stops at the match, the
 *   search runs from the end, or the item is absent and i runs to LEN. A repeated target in a
 *   quarter of the builds makes "the first match stops the loop" decide the answer.
 * - q14: how many values nested loops output, from their bounds (s4, s7): four builds in ten skip
 *   row 0 or column 0, so rows × columns is not always right. Reading the bounds as counts, adding
 *   instead of multiplying and the full grid where part is visited never pay.
 * - q17: a 2D array with one cell changed (copied from another cell, with 1 to 5 added or doubled,
 *   or set to 0), then one row or one column totalled by a single FOR loop (s4), as the written now
 *   does: the whole-grid nested loop is q21's answer on the same sheet. The total without the
 *   change, another row or column, the row read as the column of that number, the whole grid,
 *   either cell read as [column][row], indexes from 1 and the new value added on top never pay.
 */

const TOPIC = 'arrays-and-records'

const IN = '   '
/** An array literal as the pack prints one: [12, 7, 9, 15] or ['pen', 'ink']. */
const literal = (xs: readonly (number | string)[]) => `[${xs.map((x) => (typeof x === 'string' ? `'${x}'` : String(x))).join(', ')}]`
const WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven'] as const

const OUTPUT_LEADS = ['What is output by this program?', 'What does this program output?', 'What value does this program output?'] as const

/** Distinct whole numbers from lo to hi, `n` of them, in random order. */
function distinct(r: Rng, n: number, lo: number, hi: number, not: readonly number[] = []): number[] {
  const pool = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).filter((x) => !not.includes(x))
  if (pool.length < n) throw new Error(`no ${n} distinct values from ${lo} to ${hi}`)
  return shuffle(r, pool).slice(0, n)
}

// ---------------------------------------------------------------------------------------------
// q1: the index of an item
// ---------------------------------------------------------------------------------------------

export const WORD_LISTS: { name: string; words: string[] }[] = [
  { name: 'items', words: ['pen', 'ink', 'pad', 'cap', 'ruler', 'glue', 'tape', 'clip'] },
  { name: 'fruit', words: ['apple', 'pear', 'plum', 'lime', 'kiwi', 'fig', 'grape', 'mango'] },
  { name: 'pets', words: ['cat', 'dog', 'fish', 'rabbit', 'hamster', 'parrot', 'horse'] },
  { name: 'colours', words: ['red', 'blue', 'green', 'pink', 'grey', 'gold', 'white'] },
  { name: 'names', words: ['Amy', 'Ben', 'Cara', 'Dev', 'Eli', 'Finn', 'Gita', 'Hal'] },
  { name: 'sports', words: ['football', 'tennis', 'golf', 'rugby', 'hockey', 'netball', 'cricket'] },
]

const INDEX_PROMPTS = [
  (decl: string, w: string) => `\`${decl}\`. What index does \`'${w}'\` have?`,
  (decl: string, w: string) => `A program sets \`${decl}\`. What is the index of \`'${w}'\`?`,
  (decl: string, w: string) => `After \`${decl}\`, at what index is \`'${w}'\` stored?`,
]

/**
 * q1: 1 mark. Written: items ← ['pen', 'ink', 'pad', 'cap'], 'pad' is at index 2. The index is
 * drawn first, from 1 to 5 evenly and 0 half as often (the first item is the easy case).
 */
function indexOf(r: Rng, slot: Question): Draft {
  const at = weighted(r, [[0, 1], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2]] as const)
  const len = int(r, Math.max(3, at + 1), 7)
  const ctx = pick(r, WORD_LISTS.filter((c) => c.words.length >= len))
  const words = shuffle(r, ctx.words).slice(0, len)
  const word = words[at]!
  const decl = `${ctx.name} ← ${literal(words)}`
  const before = words.slice(0, at).map((w, i) => `${w} is ${i}`)
  const solution =
    at === 0
      ? `Indexes start at 0, so the first item, ${word}, is at index **0**.`
      : `Indexes start at 0: ${andList(before)}, so ${word} is ${at}.${at === len - 1 ? ` It is the last item, at LEN(${ctx.name}) − 1 = ${len} − 1.` : ''}`
  // Second route: run a search over the printed declaration.
  const code = [decl, 'i ← 0', `WHILE ${ctx.name}[i] ≠ '${word}'`, `${IN}i ← i + 1`, 'ENDWHILE', 'OUTPUT i']
  const ran = run(code.join('\n'))
  return numericDraft(
    slot,
    { prompt: pick(r, INDEX_PROMPTS)(decl, word), solution, method: [], answer: at },
    { agrees: ran.outputs[0] === at && words.indexOf(word) === at, detail: `searched the printed array: ${String(ran.outputs[0])}` },
    { list: words.join(','), word, answer: at },
  )
}

// ---------------------------------------------------------------------------------------------
// q5: a running total
// ---------------------------------------------------------------------------------------------

export const TOTAL_LISTS = [
  { name: 'scores', lo: 2, hi: 20 },
  { name: 'marks', lo: 5, hi: 20 },
  { name: 'temps', lo: 10, hi: 25 },
  { name: 'points', lo: 1, hi: 12 },
  { name: 'nums', lo: 2, hi: 30 },
] as const

/** q5: 2 marks. Written: scores ← [12, 7, 9, 15] totals 43. Three to seven distinct items, four most often. */
function arrayTotal(r: Rng, slot: Question): Draft {
  const ctx = pick(r, TOTAL_LISTS)
  const len = weighted(r, [[3, 1], [4, 2], [5, 2], [6, 1], [7, 1]] as const)
  const list = draw(r, (r) => distinct(r, len, ctx.lo, ctx.hi), (l) => l.reduce((s, x) => s + x, 0) <= 120 && !l.includes(l.reduce((s, x) => s + x, 0)))
  const sums: number[] = []
  let total = 0
  for (const x of list) sums.push((total += x))
  const code = [`${ctx.name} ← ${literal(list)}`, 'total ← 0', `FOR i ← 0 TO LEN(${ctx.name}) - 1`, `${IN}total ← total + ${ctx.name}[i]`, 'ENDFOR', 'OUTPUT total']
  const ran = run(code.join('\n'))
  const solution = `LEN(${ctx.name}) is ${len}, so the loop runs for i from 0 to ${len - 1}, adding each item: total goes ${[0, ...sums].join(' → ')}. That is ${list.join(' + ')} = **${total}**.`
  return numericDraft(
    slot,
    { prompt: `${pick(r, OUTPUT_LEADS)}\n\n${fence(code)}`, solution, method: [`Loop adds each of the ${WORDS[len - 1]} items`], answer: total },
    { agrees: ran.outputs.length === 1 && ran.outputs[0] === total && [...list].reverse().reduce((s, x) => s + x, 0) === total, detail: `ran the printed code: ${String(ran.outputs[0])}` },
    { name: ctx.name, list: list.join(','), answer: total },
  )
}

// ---------------------------------------------------------------------------------------------
// q9: counting with a condition
// ---------------------------------------------------------------------------------------------

export type Cmp = '>' | '≥' | '<' | '≤'

export const COUNT_CONTEXTS = [
  { name: 'temps', lo: 10, hi: 28, tLo: 15, tHi: 22 },
  { name: 'scores', lo: 20, hi: 95, tLo: 40, tHi: 70 },
  { name: 'ages', lo: 10, hi: 19, tLo: 12, tHi: 17 },
  { name: 'times', lo: 11, hi: 19, tLo: 13, tHi: 16 },
] as const

export const passes = (cmp: Cmp, x: number, t: number) => (cmp === '>' ? x > t : cmp === '≥' ? x >= t : cmp === '<' ? x < t : x <= t)
const CMP_WORDS: Record<Cmp, (t: number) => string> = {
  '>': (t) => `above ${t}`,
  '≥': (t) => `of ${t} or more`,
  '<': (t) => `below ${t}`,
  '≤': (t) => `of ${t} or less`,
}
const OTHER: Record<Cmp, Cmp> = { '>': '≥', '≥': '>', '<': '≤', '≤': '<' }

/** q9: 2 marks. Written: temps above 19 in 18, 21, 19, 23, 20 counts 3. The count is drawn first, evenly from 1 to 5. */
function countIf(r: Rng, slot: Question): Draft {
  const ctx = pick(r, COUNT_CONTEXTS)
  const cmp = pick(r, ['>', '≥', '<', '≤'] as const)
  const answer = int(r, 1, 5)
  const strict = cmp === '>' || cmp === '<'
  const up = cmp === '>' || cmp === '≥'
  const v = draw(
    r,
    (r) => {
      const equal = r() < 0.7 ? 1 : 2
      const pass = strict ? answer : answer - equal
      const len = int(r, Math.max(4, pass + equal + 1), 7)
      const fail = len - pass - equal
      const t = int(r, ctx.tLo, ctx.tHi)
      const [pLo, pHi, fLo, fHi] = up ? [t + 1, ctx.hi, ctx.lo, t - 1] : [ctx.lo, t - 1, t + 1, ctx.hi]
      if (pass < 0 || fail < 1 || pHi - pLo + 1 < pass || fHi - fLo + 1 < fail) return null
      const list = shuffle(r, [...distinct(r, pass, pLo, pHi), ...Array<number>(equal).fill(t), ...distinct(r, fail, fLo, fHi)])
      return { t, list, equal }
    },
    // Neither the other side, nor the other side with the other strictness (both slips), is the count.
    (x) => x !== null && x.list.length - answer !== answer && x.list.length - (strict ? answer + x.equal : answer - x.equal) !== answer,
  )!
  const { t, list, equal } = v
  let count = 0
  const rows = list.map((x) => (passes(cmp, x, t) ? `${x} yes, count ${++count}` : `${x} no`))
  const yes = list.filter((x) => passes(cmp, x, t))
  const code = [
    `${ctx.name} ← ${literal(list)}`,
    'count ← 0',
    `FOR i ← 0 TO LEN(${ctx.name}) - 1`,
    `${IN}IF ${ctx.name}[i] ${cmp} ${t} THEN`,
    `${IN}${IN}count ← count + 1`,
    `${IN}ENDIF`,
    'ENDFOR',
    'OUTPUT count',
  ]
  const ran = run(code.join('\n'))
  const boundary = equal === 2 ? `The two ${t}s are` : `${t} itself is`
  const note = strict ? `${boundary} not counted, because the test is ${cmp} not ${OTHER[cmp]}.` : `${boundary} counted, because the test is ${cmp} not ${OTHER[cmp]}.`
  const solution = `Each item in turn: ${rows.join('; ')}. Values ${CMP_WORDS[cmp](t)}: ${andList(yes)}, so the output is **${answer}**. ${note}`
  return numericDraft(
    slot,
    { prompt: `${pick(r, OUTPUT_LEADS)}\n\n${fence(code)}`, solution, method: [`Compares each value with ${t} using ${cmp}`], answer },
    { agrees: ran.outputs.length === 1 && ran.outputs[0] === answer && yes.length === answer && count === answer, detail: `ran the printed code: ${String(ran.outputs[0])}` },
    { name: ctx.name, cmp, t, list: list.join(','), answer },
  )
}

// ---------------------------------------------------------------------------------------------
// q11: a linear search with a found flag
// ---------------------------------------------------------------------------------------------

/** after: i ← i + 1 after the IF (the written); else: in an ELSE, so i stops at the match; back: from the end, i ← i − 1 after the IF. */
export type SearchForm = 'after' | 'else' | 'back'

/** What the printed loop leaves in i, worked here by hand: the first match from the search's end, then the form's last step. */
export function searchResult(form: SearchForm, list: readonly number[], target: number): { i: number; at: number | null } {
  if (form === 'back') {
    const at = list.lastIndexOf(target)
    return { i: at < 0 ? -1 : at - 1, at: at < 0 ? null : at }
  }
  const at = list.indexOf(target)
  if (at < 0) return { i: list.length, at: null }
  return { i: form === 'after' ? at + 1 : at, at }
}

export const SEARCH_NAMES = ['nums', 'codes', 'ids'] as const

/** q11: 2 marks. Written: nums ← [4, 9, 2, 7], searching for 2 leaves i = 3. */
function foundFlag(r: Rng, slot: Question): Draft {
  const kind = weighted(r, [['after', 3], ['else', 2.5], ['back', 2], ['absent', 2.5]] as const)
  const form: SearchForm = kind === 'absent' ? pick(r, ['after', 'else'] as const) : kind
  const name = pick(r, SEARCH_NAMES)
  const twice = kind !== 'absent' && r() < 0.25
  const v = draw(
    r,
    (r) => {
      const len = int(r, 4, 7)
      const target = int(r, 2, 30)
      const others = distinct(r, len, 1, 30, [target])
      if (kind === 'absent') return { list: others, target }
      // The match: never where i would end at the loop's natural end (LEN, or −1) or at the last
      // index, LEN − 1, so "i runs to the end" and "i is the last index" do not pay.
      const at = form === 'back' ? int(r, 1, len - 1) : int(r, 0, len - (form === 'after' ? 3 : 2))
      const list = [...others]
      list[at] = target
      if (twice) {
        // A second copy further along the search, which the loop never reaches.
        // Never right next to the match: there "the other copy's index" would equal i after the step.
        const later = form === 'back' ? (at >= 2 ? int(r, 0, at - 2) : -1) : at + 2 <= len - 1 ? int(r, at + 2, len - 1) : -1
        if (later < 0) return null
        list[later] = target
      }
      return { list, target }
    },
    (x) => {
      if (!x) return false
      const { i } = searchResult(form, x.list, x.target)
      return i >= 0 && i !== x.target && !x.list.includes(i)
    },
  )!
  const { list, target } = v
  const res = searchResult(form, list, target)
  const answer = res.i
  const len = list.length
  const head =
    form === 'back'
      ? [`i ← LEN(${name}) - 1`, `WHILE i ≥ 0 AND NOT found`]
      : ['i ← 0', `WHILE i < LEN(${name}) AND NOT found`]
  const body =
    form === 'else'
      ? [`${IN}IF ${name}[i] = ${target} THEN`, `${IN}${IN}found ← True`, `${IN}ELSE`, `${IN}${IN}i ← i + 1`, `${IN}ENDIF`]
      : [`${IN}IF ${name}[i] = ${target} THEN`, `${IN}${IN}found ← True`, `${IN}ENDIF`, `${IN}i ← i ${form === 'back' ? '-' : '+'} 1`]
  const code = [`${name} ← ${literal(list)}`, 'found ← False', head[0]!, head[1]!, ...body, 'ENDWHILE', 'OUTPUT i']

  // The trace, a step per item looked at.
  const order = form === 'back' ? list.map((_, i) => len - 1 - i) : list.map((_, i) => i)
  const looked = res.at === null ? order : order.slice(0, order.indexOf(res.at) + 1)
  const steps = looked.map((i) => (list[i] === target ? `i = ${i}: ${target} matches, so found ← True` : `i = ${i}: ${list[i]} is not ${target}`))
  let solution: string
  let method: string
  if (res.at === null) {
    solution = `${steps.join('; ')}. No item is ${target}, so found stays False and i goes up to ${len}, which is LEN(${name}); the test i < LEN(${name}) then fails. Output **${answer}**.`
    method = `no item is ${target}, so found stays False to the end of the list`
  } else {
    const end =
      form === 'after'
        ? `found is True, but i is still incremented to ${answer} before the WHILE condition is checked again`
        : form === 'else'
          ? `found is True and the ELSE does not run, so i stays ${answer}`
          : `found is True, but i is still decreased to ${answer} before the WHILE condition is checked again`
    const start = form === 'back' ? `i starts at LEN(${name}) − 1 = ${len - 1} and counts down. ` : ''
    const second = twice ? ` The other ${target} is never reached, because the loop stops once found is True.` : ''
    solution = `${start}${steps.join('; ')}. Now ${end}. Output **${answer}**.${second}`
    method = `found becomes True when i = ${res.at}`
  }
  const ran = run(code.join('\n'))
  return numericDraft(
    slot,
    { prompt: `${pick(r, OUTPUT_LEADS)}\n\n${fence(code)}`, solution, method: [method], answer },
    { agrees: ran.outputs.length === 1 && ran.outputs[0] === answer, detail: `ran the printed code: ${String(ran.outputs[0])}` },
    { kind, form, twice: twice ? 'yes' : 'no', list: list.join(','), target, answer },
  )
}

// ---------------------------------------------------------------------------------------------
// q14: how many values nested loops output
// ---------------------------------------------------------------------------------------------

export type Skip = 'none' | 'row' | 'column'

export const GRID_CONTEXTS = [
  { name: 'grid', rows: [3, 7], cols: [3, 9], text: (R: number, C: number) => `\`grid\` is a 2D array with ${R} rows and ${C} columns.` },
  { name: 'seats', rows: [4, 7], cols: [6, 10], text: (R: number, C: number) => `\`seats\` is a 2D array for a small cinema with ${R} rows of ${C} seats, one row of the array for each row of seats.` },
  { name: 'board', rows: [3, 8], cols: [3, 8], text: (R: number, C: number) => `\`board\` is a 2D array for a game board with ${R} rows and ${C} columns.` },
  { name: 'marks', rows: [3, 8], cols: [3, 6], text: (R: number, C: number) => `\`marks\` is a 2D array of test marks with ${R} rows, one for each student, and ${C} columns, one for each test.` },
] as const

/** Rows × columns visited by FOR r ← r0 TO r1 and FOR c ← c0 TO c1, both ends inclusive. */
export const visited = (r0: number, r1: number, c0: number, c1: number) => (r1 - r0 + 1) * (c1 - c0 + 1)

/** q14: 1 mark. Written: 4 rows and 6 columns, FOR r ← 0 TO 3 and FOR c ← 0 TO 5, 24 values. */
function gridCount(r: Rng, slot: Question): Draft {
  const ctx = pick(r, GRID_CONTEXTS)
  const skip = weighted(r, [['none', 6], ['row', 2], ['column', 2]] as const satisfies readonly (readonly [Skip, number])[])
  const asCode = r() < 0.5
  const { R, C } = draw(
    r,
    (r) => ({ R: int(r, ctx.rows[0], ctx.rows[1]), C: int(r, ctx.cols[0], ctx.cols[1]) }),
    ({ R, C }) => {
      const [r0, c0] = [skip === 'row' ? 1 : 0, skip === 'column' ? 1 : 0]
      const answer = visited(r0, R - 1, c0, C - 1)
      const printed = [R, C, R - 1, C - 1]
      // The bounds read as counts, the bounds subtracted without the + 1, the counts added, and
      // (where part is skipped) the whole grid.
      const slips = [(R - 1) * (C - 1), (R - 1 - r0) * (C - 1 - c0), R - r0 + C - c0, ...(skip === 'none' ? [] : [R * C])]
      return R !== C && answer >= 12 && answer <= 60 && !printed.includes(answer) && !slips.includes(answer)
    },
  )
  const r0 = skip === 'row' ? 1 : 0
  const c0 = skip === 'column' ? 1 : 0
  const answer = visited(r0, R - 1, c0, C - 1)
  const outer = `FOR r ← ${r0} TO ${R - 1}`
  const inner = `FOR c ← ${c0} TO ${C - 1}`
  const code = [outer, `${IN}${inner}`, `${IN}${IN}OUTPUT ${ctx.name}[r][c]`, `${IN}ENDFOR`, 'ENDFOR']
  const prompt = asCode
    ? `${ctx.text(R, C)} How many values does this code output?\n\n${fence(code)}`
    : `${ctx.text(R, C)} A program uses nested loops \`${outer}\` and \`${inner}\` and outputs \`${ctx.name}[r][c]\` each time. How many values are output?`
  const nr = R - r0
  const nc = C - c0
  const rowsText = r0 === 0 ? `${nr} rows` : `${nr} rows (1 to ${R - 1}: row 0 is skipped)`
  const colsText = c0 === 0 ? `${nc} columns` : `${nc} columns (1 to ${C - 1}: column 0 is skipped)`
  const solution = `Both ends of a FOR loop are included, so the outer loop visits ${rowsText} and the inner loop ${colsText}. The inner loop runs ${nc} times for each of the ${nr} outer passes: ${nr} × ${nc} = **${answer}**.`
  const grid: Value = Array.from({ length: R }, (_, i) => Array.from({ length: C }, (_, j) => i * C + j))
  const ran = run(code.join('\n'), { vars: { [ctx.name]: grid } })
  return numericDraft(
    slot,
    { prompt, solution, method: [], answer },
    { agrees: ran.outputs.length === answer && nr * nc === answer, detail: `ran the printed loops over a ${R} × ${C} array: ${ran.outputs.length} outputs` },
    { name: ctx.name, R, C, skip, form: asCode ? 'code' : 'text', answer },
  )
}

// ---------------------------------------------------------------------------------------------
// q17: a 2D array changed, then one row or one column totalled
// ---------------------------------------------------------------------------------------------

export type Change = 'copy-plus' | 'double' | 'copy' | 'zero'
export type Cell = [number, number]
/** The row or column one FOR loop totals. */
export type Line = { along: 'row' | 'column'; at: number }

/** The value the change line puts into its cell, reading `src` from `grid` (0 reads nothing). */
export function changed(kind: Change, grid: readonly (readonly number[])[], src: Cell, n: number): number {
  const s = grid[src[0]]?.[src[1]]
  if (kind === 'zero') return 0
  if (s === undefined) return NaN
  return kind === 'double' ? s * 2 : kind === 'copy' ? s : s + n
}

/** The grid after the change line, or null when a misread cell is outside it. */
export function applyChange(kind: Change, grid: readonly (readonly number[])[], target: Cell, src: Cell, n: number): number[][] | null {
  if (grid[target[0]]?.[target[1]] === undefined) return null
  const v = changed(kind, grid, src, n)
  if (Number.isNaN(v)) return null
  const out = grid.map((row) => [...row])
  out[target[0]]![target[1]] = v
  return out
}

/** The cells of a row or a column, top to bottom or left to right (empty when it is not in the grid). */
export const cells = (g: readonly (readonly number[])[], line: Line) => (line.along === 'row' ? [...(g[line.at] ?? [])] : g.every((row) => row[line.at] !== undefined) ? g.map((row) => row[line.at]!) : [])
const total = (xs: readonly number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) : NaN)
export const sumGrid = (g: readonly (readonly number[])[]) => g.flat().reduce((s, x) => s + x, 0)

const changeCode = (kind: Change, name: string, t: Cell, s: Cell, n: number) =>
  `${name}[${t[0]}][${t[1]}] ← ${kind === 'zero' ? '0' : kind === 'copy' ? `${name}[${s[0]}][${s[1]}]` : kind === 'double' ? `${name}[${s[0]}][${s[1]}] * 2` : `${name}[${s[0]}][${s[1]}] + ${n}`}`

/**
 * Every misreading the slot names, as a total (NaN where it cannot happen): the change ignored,
 * every other row or column, the same number read the other way (row 1 as column 1), the whole
 * grid, either cell read [column][row], indexes from 1, and the new value added on top of the old.
 */
export function lineSlips(kind: Change, grid: number[][], t: Cell, s: Cell, n: number, line: Line): number[] {
  const flip = (c: Cell): Cell => [c[1], c[0]]
  const less = (c: Cell): Cell => [c[0] - 1, c[1] - 1]
  const after = applyChange(kind, grid, t, s, n)!
  const lines = line.along === 'row' ? grid.length : grid[0]!.length
  const lineAfter = (g: number[][] | null) => (g ? total(cells(g, line)) : NaN)
  // Setting a cell to 0 reads no other cell, so it has no source to misread.
  const reads = kind !== 'zero'
  return [
    total(cells(grid, line)),
    ...Array.from({ length: lines }, (_, i) => i).filter((i) => i !== line.at).map((i) => total(cells(after, { along: line.along, at: i }))),
    total(cells(after, { along: line.along === 'row' ? 'column' : 'row', at: line.at })),
    sumGrid(after),
    lineAfter(applyChange(kind, grid, flip(t), reads ? s : flip(t), n)),
    ...(reads ? [lineAfter(applyChange(kind, grid, t, flip(s), n))] : []),
    lineAfter(applyChange(kind, grid, less(t), reads ? less(s) : less(t), n)),
    total(cells(grid, line)) + changed(kind, grid, s, n),
  ]
}

/**
 * q17: 2 marks. Written: [[4, 1, 6], [2, 5, 3]], grid[1][0] ← grid[0][2] + 1, then one FOR loop
 * totals row 1: 15. The generated program totals one row (six builds in ten) or one column, and
 * the changed cell is always in it; never the whole grid with nested loops, which is q21's answer
 * on the same sheet.
 */
function gridSum(r: Rng, slot: Question): Draft {
  const [R, C] = weighted(r, [[[2, 3], 3], [[3, 2], 1], [[2, 4], 2], [[3, 3], 2], [[3, 4], 1]] as const)
  const kind = weighted(r, [['copy-plus', 4], ['double', 2], ['copy', 2], ['zero', 2]] as const satisfies readonly (readonly [Change, number])[])
  const along = r() < 0.6 ? 'row' : 'column'
  const name = pick(r, ['grid', 'board', 'cells'])
  const v = draw(
    r,
    (r) => {
      const grid = Array.from({ length: R }, () => Array.from({ length: C }, () => int(r, 1, 9)))
      const line: Line = { along, at: along === 'row' ? int(r, 0, R - 1) : int(r, 0, C - 1) }
      // The changed cell is in the line totalled.
      const t: Cell = along === 'row' ? [line.at, int(r, 0, C - 1)] : [int(r, 0, R - 1), line.at]
      const s: Cell = kind === 'zero' ? t : [int(r, 0, R - 1), int(r, 0, C - 1)]
      return { grid, line, t, s, n: int(r, 1, 5) }
    },
    ({ grid, line, t, s, n }) => {
      if (kind !== 'zero' && t[0] === s[0] && t[1] === s[1]) return false
      // The cell changes: never to its own value.
      if (changed(kind, grid, s, n) === grid[t[0]]![t[1]]) return false
      const answer = total(cells(applyChange(kind, grid, t, s, n)!, line))
      return answer > 0 && lineSlips(kind, grid, t, s, n, line).every((x) => x !== answer)
    },
  )
  const { grid, line, t, s, n } = v
  const after = applyChange(kind, grid, t, s, n)!
  const summed = cells(after, line)
  const answer = total(summed)
  const decl = grid.map((row, i) => `${i === 0 ? `${name} ← [` : ' '.repeat(name.length + 4)}[${row.join(', ')}]${i === grid.length - 1 ? ']' : ','}`)
  const change = changeCode(kind, name, t, s, n)
  const loop =
    along === 'row'
      ? [`FOR c ← 0 TO LEN(${name}[0]) - 1`, `${IN}total ← total + ${name}[${line.at}][c]`]
      : [`FOR r ← 0 TO LEN(${name}) - 1`, `${IN}total ← total + ${name}[r][${line.at}]`]
  const code = [...decl, change, 'total ← 0', ...loop, 'ENDFOR', 'OUTPUT total']
  const old = grid[t[0]]![t[1]]!
  const newValue = after[t[0]]![t[1]]!
  const tName = `\`${name}[${t[0]}][${t[1]}]\``
  const changeText =
    kind === 'zero'
      ? `${tName} was ${old} and becomes 0`
      : kind === 'copy'
        ? `\`${name}[${s[0]}][${s[1]}]\` is ${newValue}, so ${tName} changes from ${old} to ${newValue}`
        : `\`${name}[${s[0]}][${s[1]}]\` is ${grid[s[0]]![s[1]]}, so ${tName} becomes ${grid[s[0]]![s[1]]} ${kind === 'double' ? '× 2' : `+ ${n}`} = ${newValue}`
  const others = Array.from({ length: along === 'row' ? R : C }, (_, i) => i).filter((i) => i !== line.at)
  const what = along === 'row' ? 'Row' : 'Column'
  const otherText = others.length === 1 ? `${what} ${others[0]} is never added` : `${what}s ${andList(others)} are never added`
  const solution =
    along === 'row'
      ? `${changeText} and row ${line.at} is now [${summed.join(', ')}]. \`LEN(${name}[0])\` is ${C} columns, so the loop adds the ${WORDS[C - 1]} cells of row ${line.at}: ${summed.join(' + ')} = **${answer}**. ${otherText}, and the change counts because it happens before the loop.`
      : `${changeText} and column ${line.at} is now ${andList(summed)}, top to bottom. \`LEN(${name})\` is ${R} rows, so the loop adds the ${WORDS[R - 1]} cells of column ${line.at}: ${summed.join(' + ')} = **${answer}**. ${otherText}, and the change counts because it happens before the loop.`
  const ran = run(code.join('\n'))
  return numericDraft(
    slot,
    { prompt: `${pick(r, OUTPUT_LEADS)}\n\n${fence(code)}`, solution, method: [`${name}[${t[0]}][${t[1]}] becomes ${newValue} before the loop runs`], answer },
    { agrees: ran.outputs.length === 1 && ran.outputs[0] === answer && answer === total(cells(grid, line)) - old + newValue, detail: `ran the printed code: ${String(ran.outputs[0])}` },
    { R, C, kind, line: `${along} ${line.at}`, grid: JSON.stringify(grid), change, answer },
  )
}

export const arrayGenerator = csBySlot('cs-arrays', TOPIC, {
  q1: indexOf,
  q5: arrayTotal,
  q9: countIf,
  q11: foundFlag,
  q14: gridCount,
  q17: gridSum,
})

export const arrayGenerators: Generator[] = [arrayGenerator]
