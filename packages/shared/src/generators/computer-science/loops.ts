import type { Question } from '../../content/questions.ts'
import { ordinal } from '../format.ts'
import { draw, int, pick, weighted, type Rng } from '../random.ts'
import type { Draft, Generator } from '../types.ts'
import { csBySlot, fence, lastOutput, limits, numericDraft, printedCode } from './build.ts'
import { run } from './pseudo.ts'

/**
 * Computer Science (AQA 8525) generators for selection-iteration-and-tracing: 3.2.2 programming
 * concepts, "definite (count controlled) and indefinite (condition controlled) iteration,
 * including indefinite iteration with the condition(s) at the start or the end", "nested
 * selection and nested iteration", and selection inside iteration, traced as the lesson does
 * (s2 FOR with both limits included, s3 WHILE tests before and REPEAT … UNTIL after, s4 trace
 * tables, s5 nested loops whose inner loop restarts).
 *
 * - q1: total ← total + i over FOR i ← s TO e, three to seven passes; the start is 1 one time in
 *   five (where "add from 1" gives the same total) and total sometimes starts above 0.
 * - q5: WHILE n < L (or ≤ L) multiplying by 2 or 3, or adding 3 to 9; the loop overshoots the
 *   limit. Some ≤ loops hit the limit exactly and so run once more.
 * - q6: REPEAT … UNTIL counting up, down or doubling. One build in four starts with the condition
 *   already True, so the body runs once (REPEAT always runs at least once); in about a fifth the
 *   limit is a value the trace reaches under a strict test, so reading < as ≤ stops a pass early.
 * - q7: how many times a line inside nested FOR loops runs, the starts not always 1, so passes
 *   are b − a + 1 each; some builds have a second line after the inner ENDFOR, asked about half
 *   the time, which runs once per outer pass.
 * - q10: count ← count + 1 when an IF inside a FOR is True: i above a threshold (six builds in ten),
 *   odd, even or a multiple of 3. The test is True at the last i, so a FOR read as one short never
 *   pays, and the count is never the printed start.
 * - q11: WHILE x > L (or ≥ L) taking k away, or halving with DIV 2; x steps past the limit, and
 *   in most builds ends at least 2 below it, so "the limit minus 1" seldom pays. Nine subtracting
 *   builds in ten end at or above k, so "start MOD k" seldom gives the answer.
 * - q15: total ← total + an expression in i (i * i, i * k, i * k + c); reading the line left to
 *   right ((total + i) * …) never gives the answer.
 * - q18: nested FOR loops that output i * j, i + j or i * 10 + j, at most 3 × 4; the k-th output
 *   after the inner loop has restarted (two builds in three), or the last, which needs no trace.
 *   The answer is never the number of outputs.
 *
 * Every program is AQA pseudo-code printed in a fenced block and run by the interpreter
 * (pseudo.ts); the answer is the interpreter's (the last output, or a line's hit count) and must
 * equal the generator's own working.
 */

const TOPIC = 'selection-iteration-and-tracing'

const WORDS = ['two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'] as const
/** 2 is "two", up to 12. */
const word = (n: number) => WORDS[n - 2]!
/** "twice", "3 times": never "1 times". */
const times = (n: number) => (n === 2 ? 'twice' : `${n} times`)
/** s, s + 1, …, e. */
const span = (s: number, e: number) => Array.from({ length: e - s + 1 }, (_, i) => s + i)
const sum = (xs: readonly number[]) => xs.reduce((t, x) => t + x, 0)

// ---------------------------------------------------------------------------------------------
// q1: a FOR loop adding i
// ---------------------------------------------------------------------------------------------

/**
 * q1: 2 marks. Written: FOR i ← 1 TO 5 adding i gives 15. Three to seven passes, the start 1 one
 * time in five and otherwise 2 to 6; total starts at 0 seven times in ten, else at 5 to 20. Never
 * FOR i ← 3 TO 7, the loop the core sheet's q2 asks about.
 */
function forSum(r: Rng, slot: Question): Draft {
  const s = r() < 0.2 ? 1 : int(r, 2, 6)
  const n = draw(r, (r) => int(r, 3, 7), (n) => !(s === 3 && n === 5))
  const e = s + n - 1
  // A starting total is never one of the values added, so the sum line reads unambiguously.
  const t0 = r() < 0.7 ? 0 : draw(r, (r) => int(r, 5, 20), (t) => t < s || t > e)
  const v = pick(r, ['i', 'i', 'i', 'n', 'x'])
  const code = `total ← ${t0}\nFOR ${v} ← ${s} TO ${e}\n   total ← total + ${v}\nENDFOR\nOUTPUT total`
  const prompt = `What is output?\n\n${fence(code)}`
  const values = span(s, e)
  const answer = t0 + sum(values)
  const running = values.reduce<number[]>((acc, x) => [...acc, acc.at(-1)! + x], [t0])
  const terms = [...(t0 ? [t0] : []), ...values].join(' + ')
  const ran = lastOutput(printedCode(prompt))
  return numericDraft(
    slot,
    {
      prompt,
      solution: `${t0 ? `total starts at ${t0}. ` : ''}The loop runs for ${v} = ${values.join(', ')} (both limits included) and adds each, so total goes ${running.join(', ')}: $${terms} = $ **${answer}**.`,
      method: [`${word(n)} iterations, ${v} from ${s} to ${e}`],
      answer,
    },
    { agrees: ran === answer && answer === t0 + ((s + e) * n) / 2, detail: `interpreter ${ran}; ${t0} + (${s} + ${e}) × ${n} ÷ 2` },
    { s, e, t0, answer },
  )
}

// ---------------------------------------------------------------------------------------------
// q5: WHILE, growing past a limit
// ---------------------------------------------------------------------------------------------

/** The values n takes under WHILE n cmp L, from the start; the last fails the test. */
export function whileValues(start: number, step: (x: number) => number, test: (x: number) => boolean): number[] {
  const out = [start]
  while (test(out.at(-1)!)) {
    out.push(step(out.at(-1)!))
    if (out.length > 50) throw new Error('runaway')
  }
  return out
}

/** Whether a trace prints 2, 6 and 10, the higher sheet's q8 (FOR i ← 2 TO 10 STEP 4). */
const echoesStep = (values: readonly number[]) => [2, 6, 10].every((x) => values.includes(x))

/**
 * q5: 2 marks. Written: n ← 1, WHILE n < 20, n ← n * 3 gives 27. Multiplying (by 2 or 3, start 1
 * to 9, 2 to 6 passes, output 12 to 150) two builds in three, else adding 3 to 9 (start 0 to 15,
 * 3 to 7 passes, output at most 100). The test is < six times in ten, else ≤, and six ≤ loops in
 * ten have the limit equal to the last value that passes. The answer is never the start, the step
 * or the limit.
 */
function whileGrow(r: Rng, slot: Question): Draft {
  const kind = r() < 0.65 ? 'times' : 'plus'
  const cmp = r() < 0.6 ? '<' : '≤'
  const hit = cmp === '≤' && r() < 0.6
  const g = draw(
    r,
    (r) => {
      const by = kind === 'times' ? (r() < 0.6 ? 2 : 3) : int(r, 3, 9)
      const start = kind === 'times' ? int(r, 1, 9) : int(r, 0, 15)
      const runs = kind === 'times' ? int(r, 2, 6) : int(r, 3, 7)
      const answer = kind === 'times' ? start * by ** runs : start + by * runs
      const below = kind === 'times' ? answer / by : answer - by
      const between = limits(below, answer)
      const limit = hit ? below : between.length ? pick(r, between) : NaN
      return { by, start, runs, answer, below, limit }
    },
    ({ by, start, runs, answer, limit }) =>
      Number.isFinite(limit) &&
      answer <= (kind === 'times' ? 150 : 100) &&
      answer >= 12 &&
      ![start, by, limit].includes(answer) &&
      start !== by &&
      !echoesStep(Array.from({ length: runs + 1 }, (_, i) => (kind === 'times' ? start * by ** i : start + by * i))),
  )
  const v = pick(r, ['n', 'n', 'x'])
  const op = kind === 'times' ? '*' : '+'
  const code = `${v} ← ${g.start}\nWHILE ${v} ${cmp} ${g.limit}\n   ${v} ← ${v} ${op} ${g.by}\nENDWHILE\nOUTPUT ${v}`
  const prompt = `What is output?\n\n${fence(code)}`
  const pass = (x: number) => (cmp === '<' ? x < g.limit : x <= g.limit)
  const values = whileValues(g.start, (x) => (kind === 'times' ? x * g.by : x + g.by), pass)
  const answer = values.at(-1)!
  const cond = `\`${v} ${cmp} ${g.limit}\``
  const again = hit ? ` At ${g.below} the condition ${cond} is still True, because ${g.below} is equal to ${g.limit}, so the loop runs once more.` : ''
  const ran = lastOutput(printedCode(prompt))
  return numericDraft(
    slot,
    {
      prompt,
      solution: `${v} goes ${values.join(' → ')}.${again} At ${answer} the condition ${cond} is False, so the loop stops and **${answer}** is output. The loop overshoots the limit: that is normal, and a trace table shows it.`,
      method: [`${values.slice(1).join(', ')} in the trace`],
      answer,
    },
    { agrees: ran === answer && answer === g.answer && values.length - 1 === g.runs && !echoesStep(values), detail: `interpreter ${ran}; drawn ${g.answer} after ${g.runs} passes` },
    { kind, cmp, start: g.start, by: g.by, limit: g.limit, answer },
  )
}

// ---------------------------------------------------------------------------------------------
// q6: REPEAT … UNTIL
// ---------------------------------------------------------------------------------------------

export type RepeatKind = 'plus' | 'minus' | 'times'

/** Runs REPEAT body UNTIL done: the body first, then the test. */
export function repeatValues(start: number, step: (x: number) => number, done: (x: number) => boolean): number[] {
  const out = [start]
  do {
    out.push(step(out.at(-1)!))
    if (out.length > 50) throw new Error('runaway')
  } while (!done(out.at(-1)!))
  return out
}

/**
 * q6: 2 marks. Written: count ← 0, REPEAT count ← count + 2 UNTIL count ≥ 7 gives 8. Counting up
 * (count, + 2 to 9, UNTIL ≥ or >), down (n, − 2 to 9, UNTIL ≤ or <) or doubling or tripling (x,
 * UNTIL > or ≥), 2 to 6 passes. One build in four starts with the condition already True: the body
 * still runs once. In about a quarter of the rest the test is strict and its limit is the value
 * before the last, which does not yet pass; otherwise the limit lies strictly between the last two
 * values. The answer is never the start, the step, the limit or the pass count, nor above 100.
 */
function repeatUntil(r: Rng, slot: Question): Draft {
  const kind = weighted<RepeatKind>(r, [['plus', 45], ['minus', 30], ['times', 25]])
  const already = r() < 0.25
  // A strict test whose limit the trace reaches: the only case where < and ≤ (> and ≥) differ.
  const hit = !already && r() < 0.27
  const strict = hit || r() < 0.45
  const g = draw(
    r,
    (r) => {
      const by = kind === 'times' ? (r() < 0.7 ? 2 : 3) : int(r, 2, 9)
      const step = (x: number) => (kind === 'plus' ? x + by : kind === 'minus' ? x - by : x * by)
      const runs = already ? 1 : int(r, 2, kind === 'times' ? 5 : 6)
      let start: number
      if (already) start = kind === 'minus' ? int(r, 4, 30) : kind === 'times' ? int(r, 3, 12) : int(r, 10, 40)
      else start = kind === 'minus' ? int(r, 20, 60) : kind === 'times' ? int(r, 1, 5) : int(r, 0, 10)
      let answer = start
      for (let i = 0; i < runs; i++) answer = step(answer)
      const below = kind === 'plus' ? answer - by : kind === 'minus' ? answer + by : answer / by
      // The limit: already True at the start, or passed only by the answer.
      let limit: number
      if (already) limit = kind === 'minus' ? int(r, start + 1, start + 15) : int(r, Math.max(1, start - 15), start - 1)
      else if (hit) limit = below
      else limit = kind === 'minus' ? int(r, answer + 1, below - 1) : int(r, below + 1, answer - 1)
      return { by, start, runs, answer, below, limit, step }
    },
    ({ by, start, runs, answer, below, limit, step }) => {
      if (answer < 1 || answer > 100 || [start, by, limit, runs].includes(answer) || limit === start) return false
      if (!already && !hit && (kind === 'minus' ? limit <= answer || limit >= below : limit <= below || limit >= answer)) return false
      const done = testOf(kind, strict, limit)
      if (!already && done(start)) return false
      if (already && !done(start)) return false
      return !echoesStep(repeatValues(start, step, done))
    },
  )
  const v = { plus: 'count', minus: 'n', times: 'x' }[kind]
  const op = { plus: '+', minus: '-', times: '*' }[kind]
  const sym = kind === 'minus' ? (strict ? '<' : '≤') : strict ? '>' : '≥'
  const code = `${v} ← ${g.start}\nREPEAT\n   ${v} ← ${v} ${op} ${g.by}\nUNTIL ${v} ${sym} ${g.limit}\nOUTPUT ${v}`
  const prompt = `What is output?\n\n${fence(code)}`
  const values = repeatValues(g.start, g.step, testOf(kind, strict, g.limit))
  const answer = values.at(-1)!
  const after = values.slice(1)
  const cond = `\`${v} ${sym} ${g.limit}\``
  const before = values.at(-2)!
  const notYet = !already && before === g.limit ? ` After ${before} the condition ${cond} is still False, because ${before} is equal to ${g.limit}, so the body runs again.` : ''
  const solution = already
    ? `The body runs before the condition is tested, so ${v} becomes ${answer} first. Then ${cond} is True, so the loop ends: **${answer}**. A REPEAT loop always runs at least once, even when the condition is already True at the start.`
    : `${v} starts at ${g.start}, then takes ${after.join(', ')}.${notYet} After ${answer} the condition ${cond} is True, so the loop ends: **${answer}**. UNTIL stops when the condition becomes True.`
  const ran = lastOutput(printedCode(prompt))
  return numericDraft(
    slot,
    { prompt, solution, method: [already ? `${v} becomes ${answer} before the first test` : after.join(', ')], answer },
    { agrees: ran === answer && answer === g.answer && after.length === g.runs, detail: `interpreter ${ran}; drawn ${g.answer} after ${g.runs} passes` },
    { kind, start: g.start, by: g.by, limit: g.limit, test: sym, already: already ? 'yes' : 'no', answer },
  )
}

/** The UNTIL test for each kind: up and doubling stop above the limit, down below it. */
function testOf(kind: RepeatKind, strict: boolean, limit: number) {
  if (kind === 'minus') return (x: number) => (strict ? x < limit : x <= limit)
  return (x: number) => (strict ? x > limit : x >= limit)
}

// ---------------------------------------------------------------------------------------------
// q7: how often a line in nested loops runs
// ---------------------------------------------------------------------------------------------

/**
 * q7: 2 marks. Written: FOR i ← 1 TO 3, FOR j ← 1 TO 2 runs total ← total + 1 six times. Outer
 * passes 2 to 5, inner 2 to 6, never equal, at most 24 in all. Both loops start at 1 one time in
 * five (where multiplying the printed end values gives the count); otherwise the starts are 0 to
 * 3. Two builds in three print one line in the inner loop; the rest add rows ← rows + 1 after the
 * inner ENDFOR and ask about either line.
 */
function nestedCount(r: Rng, slot: Question): Draft {
  const twoLines = r() < 0.35
  const asked: 'inner' | 'outer' = twoLines && r() < 0.5 ? 'outer' : 'inner'
  // Asked about the outer line, the loop never starts at 1, where its end value is the count.
  const both1 = asked === 'inner' && r() < 0.22
  const g = draw(
    r,
    (r) => {
      const o = int(r, 2, 5)
      const n = int(r, 2, 6)
      const a = both1 ? 1 : int(r, 0, 3)
      const c = both1 ? 1 : int(r, 0, 3)
      return { o, n, a, c, b: a + o - 1, d: c + n - 1 }
    },
    ({ o, n, a, c, b, d }) => {
      if (o === n || o * n > 24) return false
      if (!both1 && a === 1 && c === 1) return false
      const answer = asked === 'inner' ? o * n : o
      if (asked === 'outer') return a !== 1 && ![b, o * n, n, b * d].includes(answer)
      return !both1 ? ![b * d, o + n, b, d].includes(answer) : true
    },
  )
  const lines = ['total ← 0', ...(twoLines ? ['rows ← 0'] : []), `FOR i ← ${g.a} TO ${g.b}`, `   FOR j ← ${g.c} TO ${g.d}`, '      total ← total + 1', '   ENDFOR', ...(twoLines ? ['   rows ← rows + 1'] : []), 'ENDFOR']
  const target = asked === 'inner' ? 'total ← total + 1' : 'rows ← rows + 1'
  const lineNo = lines.findIndex((l) => l.trim() === target) + 1
  const code = lines.join('\n')
  const prompt = `How many times is \`${target}\` executed?\n\n${fence(code)}`
  const answer = asked === 'inner' ? g.o * g.n : g.o
  const is = span(g.a, g.b).join(', ')
  const js = span(g.c, g.d).join(', ')
  const solution =
    asked === 'inner'
      ? `The outer loop runs ${times(g.o)} (i = ${is}) and the inner loop runs ${times(g.n)} (j = ${js}) for **each** outer pass: $${g.o} \\times ${g.n} = $ **${answer}**.`
      : `\`rows ← rows + 1\` is inside the outer loop but after the inner loop's ENDFOR, so it runs once for each outer pass, not once for each inner pass. i takes ${is}: **${answer}** times.`
  const hits = run(printedCode(prompt)).hits.get(lineNo) ?? 0
  return numericDraft(
    slot,
    { prompt, solution, method: [asked === 'inner' ? `${g.o} × ${g.n}` : `once for each outer pass, i from ${g.a} to ${g.b}`], answer },
    { agrees: hits === answer, detail: `interpreter ran line ${lineNo} ${hits} times; working ${answer}` },
    { a: g.a, b: g.b, c: g.c, d: g.d, asked, answer },
  )
}

// ---------------------------------------------------------------------------------------------
// q10: selection inside iteration
// ---------------------------------------------------------------------------------------------

export type SelectKind = 'odd' | 'even' | 'mult3' | 'gt' | 'ge'

/** Whether i passes each IF test. */
export function passes(kind: SelectKind, i: number, k: number): boolean {
  return kind === 'odd' ? i % 2 === 1 : kind === 'even' ? i % 2 === 0 : kind === 'mult3' ? i % 3 === 0 : kind === 'gt' ? i > k : i >= k
}

/**
 * q10: 2 marks. Written: FOR i ← 1 TO 9 counting i MOD 2 = 1 gives 5. A threshold (> or ≥) six
 * builds in ten, else odd, even or a multiple of 3: parity alone crowded the answers onto 3. Five to
 * nine passes from 1 (a fifth of odd builds, three in ten of the rest) or 2 to 5, odd for odd
 * numbers and even for even. The test is True at the last i; the count is at least 2 and is never
 * every pass, half of them, a threshold printed in the code, or the printed start.
 */
function selectCount(r: Rng, slot: Question): Draft {
  const kind = weighted<SelectKind>(r, [['odd', 15], ['even', 12], ['mult3', 13], ['gt', 32], ['ge', 28]])
  const { s, n, k } = draw(
    r,
    (r) => {
      // A parity test is True at the last i and never at exactly half the passes only when the
      // start has the parity counted (an odd number of passes from an odd start, for odd).
      const s = kind === 'even' ? pick(r, [2, 4]) : kind === 'odd' ? (r() < 0.2 ? 1 : pick(r, [3, 5])) : r() < 0.3 ? 1 : int(r, 2, 5)
      const n = int(r, 5, 9)
      const e = s + n - 1
      const k = kind === 'gt' ? int(r, s, e - 1) : kind === 'ge' ? int(r, s + 1, e) : 0
      return { s, n, k }
    },
    ({ s, n, k }) => {
      const e = s + n - 1
      const count = span(s, e).filter((i) => passes(kind, i, k)).length
      return passes(kind, e, k) && count >= 2 && count !== n && 2 * count !== n && count !== s && (kind === 'gt' || kind === 'ge' ? count !== k : true)
    },
  )
  const e = s + n - 1
  const cond = { odd: 'i MOD 2 = 1', even: 'i MOD 2 = 0', mult3: 'i MOD 3 = 0', gt: `i > ${k}`, ge: `i ≥ ${k}` }[kind]
  const code = `count ← 0\nFOR i ← ${s} TO ${e}\n   IF ${cond} THEN\n      count ← count + 1\n   ENDIF\nENDFOR\nOUTPUT count`
  const prompt = `What is output?\n\n${fence(code)}`
  const yes = span(s, e).filter((i) => passes(kind, i, k))
  const answer = yes.length
  const desc = { odd: 'for the odd numbers', even: 'for the even numbers', mult3: 'for the multiples of 3, which are', gt: 'for i =', ge: 'for i =' }[kind]
  const method = { odd: 'odd values of i', even: 'even values of i', mult3: 'multiples of 3', gt: `i from ${yes[0]} to ${e}`, ge: `i from ${yes[0]} to ${e}` }[kind]
  const ran = lastOutput(printedCode(prompt))
  return numericDraft(
    slot,
    {
      prompt,
      solution: `i runs from ${s} to ${e}. \`${cond}\` is True ${desc} ${yes.join(', ')}: **${answer}** of them.`,
      method: [method],
      answer,
    },
    { agrees: ran === answer, detail: `interpreter ${ran}; counted ${answer}` },
    { kind, s, e, k, answer },
  )
}

// ---------------------------------------------------------------------------------------------
// q11: WHILE, falling past a limit
// ---------------------------------------------------------------------------------------------

/**
 * q11: 2 marks. Written: x ← 40, WHILE x > 17, x ← x − 7 gives 12. Taking k (2 to 9) away seven
 * builds in ten, from a start of at most 60, 2 to 6 passes; else halving with DIV 2 from 20 to
 * 100, 2 to 5 passes. The test is > six times in ten, else ≥, and half the ≥ loops have the limit
 * equal to the value before the last, which still passes. The limit is at least 2 above the answer
 * in about 19 builds in 20, so "the limit minus 1" seldom pays. The answer is never the limit, the
 * start, k or the pass count; nine subtracting builds in ten end at k or above.
 */
function whileDown(r: Rng, slot: Question): Draft {
  const kind = r() < 0.7 ? 'minus' : 'halve'
  const cmp = r() < 0.6 ? '>' : '≥'
  const hit = cmp === '≥' && r() < 0.5
  const small = r() < 0.1
  const tight = !hit && r() < 0.06
  const g = draw(
    r,
    (r) => {
      const k = kind === 'minus' ? int(r, 2, 9) : 2
      let start: number
      let runs: number
      if (kind === 'minus') {
        runs = int(r, 2, 6)
        const end = small ? int(r, 1, k - 1) : int(r, k, k + 12)
        start = end + runs * k
      } else {
        runs = int(r, 2, 5)
        start = int(r, 20, 100)
      }
      let x = start
      const seq = [x]
      for (let i = 0; i < runs; i++) seq.push((x = kind === 'minus' ? x - k : Math.floor(x / 2)))
      const answer = seq.at(-1)!
      const prev = seq.at(-2)!
      const limit = hit ? prev : tight ? answer + 1 : int(r, answer + 2, prev - 1)
      return { k, start, runs, answer, prev, limit }
    },
    ({ k, start, runs, answer, prev, limit }) =>
      start >= 10 &&
      start <= (kind === 'minus' ? 60 : 100) &&
      answer >= 1 &&
      limit > answer &&
      limit <= prev &&
      (cmp === '≥' || limit < prev) &&
      (tight || limit >= answer + 2) &&
      ![start, k, limit, runs].includes(answer),
  )
  const v = pick(r, ['x', 'x', 'n'])
  const body = kind === 'minus' ? `${v} ← ${v} - ${g.k}` : `${v} ← ${v} DIV 2`
  const code = `${v} ← ${g.start}\nWHILE ${v} ${cmp} ${g.limit}\n${'   '}${body}\nENDWHILE\nOUTPUT ${v}`
  const prompt = `What is output?\n\n${fence(code)}`
  const values = whileValues(g.start, (x) => (kind === 'minus' ? x - g.k : Math.floor(x / 2)), (x) => (cmp === '>' ? x > g.limit : x >= g.limit))
  const answer = values.at(-1)!
  const cond = `\`${v} ${cmp} ${g.limit}\``
  const after = values.slice(1)
  const again = hit ? ` At ${g.prev} the condition ${cond} is still True, because ${g.prev} is equal to ${g.limit}, so the loop runs once more.` : ''
  const ran = lastOutput(printedCode(prompt))
  return numericDraft(
    slot,
    {
      prompt,
      solution: `${v}: ${values.join(' → ')}.${again} When ${v} is ${answer} the condition ${cond} is False: **${answer}**. The loop runs ${after.length === 2 ? 'twice' : `${word(after.length)} times`} and steps past ${g.limit}: it stops at the first value that fails the test${tight ? '' : `, not at ${g.limit} or just below it`}.`,
      method: [`${after.slice(0, -1).join(', ')} then ${answer}`],
      answer,
    },
    { agrees: ran === answer && answer === g.answer && after.length === g.runs, detail: `interpreter ${ran}; drawn ${g.answer} after ${g.runs} passes` },
    { kind, cmp, start: g.start, k: g.k, limit: g.limit, answer },
  )
}

// ---------------------------------------------------------------------------------------------
// q15: a FOR loop adding an expression
// ---------------------------------------------------------------------------------------------

export type ExprKind = 'square' | 'times' | 'linear'

/**
 * q15: 2 marks. Written: total ← total + i * i for i from 1 to 4 gives 30. i * i, i * k (k 2 to 5)
 * or i * k + c (k 2 to 4, c 1 to 3), with i as written half the time, else n or x; three to five
 * passes from 1 (one time in five) or 2 to 5,
 * total at most 150.
 */
function forExpr(r: Rng, slot: Question): Draft {
  const kind = weighted<ExprKind>(r, [['square', 40], ['times', 25], ['linear', 35]])
  const g = draw(
    r,
    (r) => {
      const s = r() < 0.2 ? 1 : int(r, 2, 5)
      const n = int(r, 3, 5)
      const k = kind === 'times' ? int(r, 2, 5) : kind === 'linear' ? int(r, 2, 4) : 0
      const c = kind === 'linear' ? int(r, 1, 3) : 0
      return { s, e: s + n - 1, n, k, c }
    },
    ({ s, e, k, c }) => {
      const f = term(kind, k, c)
      const answer = sum(span(s, e).map(f))
      return answer <= 150 && k !== s && answer !== sum(span(s, e)) && answer !== leftToRight(kind, k, c, s, e) && answer !== f(e) && (kind !== 'linear' || c !== k)
    },
  )
  const f = term(kind, g.k, g.c)
  const v = weighted(r, [['i', 2], ['n', 1], ['x', 1]] as const)
  const expr = kind === 'square' ? `${v} * ${v}` : kind === 'times' ? `${v} * ${g.k}` : `${v} * ${g.k} + ${g.c}`
  const code = `total ← 0\nFOR ${v} ← ${g.s} TO ${g.e}\n   total ← total + ${expr}\nENDFOR\nOUTPUT total`
  const prompt = `What is output?\n\n${fence(code)}`
  const is = span(g.s, g.e)
  const terms = is.map(f)
  const answer = sum(terms)
  const running = terms.reduce<number[]>((acc, x) => [...acc, acc.at(-1)! + x], [0])
  const ran = lastOutput(printedCode(prompt))
  return numericDraft(
    slot,
    {
      prompt,
      solution: `${v} = ${is.join(', ')} give \`${expr}\` = ${terms.join(', ')}, so total is $${terms.join(' + ')} = $ **${answer}**. A trace table with columns ${v}, \`${expr}\` and total keeps it straight: total goes ${running.join(', ')}.`,
      method: [terms.join(', ')],
      answer,
    },
    { agrees: ran === answer, detail: `interpreter ${ran}; working ${answer}` },
    { kind, v, s: g.s, e: g.e, k: g.k, c: g.c, answer },
  )
}

/** The value added on each pass. */
export function term(kind: ExprKind, k: number, c: number) {
  return (i: number) => (kind === 'square' ? i * i : kind === 'times' ? i * k : i * k + c)
}

/** total ← total + i * … read left to right: (total + i) * … on every pass. */
export function leftToRight(kind: ExprKind, k: number, c: number, s: number, e: number): number {
  let t = 0
  for (let i = s; i <= e; i++) t = kind === 'square' ? (t + i) * i : kind === 'times' ? (t + i) * k : (t + i) * k + c
  return t
}

// ---------------------------------------------------------------------------------------------
// q18: the last (or k-th) output of nested loops
// ---------------------------------------------------------------------------------------------

export type PairKind = 'product' | 'sum' | 'tens'

/** Every output of the nested loops, in order: the inner loop runs in full for each outer pass. */
export function nestedOutputs(a: number, b: number, c: number, d: number, f: (i: number, j: number) => number): { i: number; j: number; v: number }[] {
  const out: { i: number; j: number; v: number }[] = []
  for (let i = a; i <= b; i++) for (let j = c; j <= d; j++) out.push({ i, j, v: f(i, j) })
  return out
}

export const pairOf = (kind: PairKind) => (i: number, j: number) => (kind === 'product' ? i * j : kind === 'sum' ? i + j : i * 10 + j)

/**
 * q18: 2 marks. Written: FOR i ← 1 TO 2, FOR j ← 1 TO 3, OUTPUT i * j; the last output is 6.
 * Outer passes 2 or 3, inner 2 to 4, never equal (at most 3 × 4); starts 1 to 3. The k-th value two
 * builds in three, taken after the inner loop has restarted and before the last; otherwise the
 * last, which is the expression at the two printed end values and needs no trace.
 * The answer is never the number of outputs, either pass count, the position asked, the output
 * before or after it, or the k-th with the loops' order swapped.
 */
function nestedOutput(r: Rng, slot: Question): Draft {
  const kind = weighted<PairKind>(r, [['product', 40], ['sum', 30], ['tens', 30]])
  const last = r() < 0.35
  const f = pairOf(kind)
  const g = draw(
    r,
    (r) => {
      const o = int(r, 2, 3)
      const n = int(r, 2, 4)
      const a = int(r, 1, 3)
      const c = int(r, 1, 3)
      const k = last ? o * n : int(r, n + 1, o * n - 1)
      return { o, n, a, c, b: a + o - 1, d: c + n - 1, k }
    },
    ({ o, n, a, b, c, d, k }) => {
      if (o === n) return false
      const outs = nestedOutputs(a, b, c, d, f).map((x) => x.v)
      const answer = outs[k - 1]!
      const swapped = nestedOutputs(c, d, a, b, (j, i) => f(i, j)).map((x) => x.v)
      // The printed position too: "the 4th value" must not be 4.
      const wrong = [o * n, o, n, k, outs[k - 2], outs[k], outs[0], last ? f(a, d) : swapped[k - 1]]
      return !wrong.includes(answer)
    },
  )
  const expr = { product: 'i * j', sum: 'i + j', tens: 'i * 10 + j' }[kind]
  const code = `FOR i ← ${g.a} TO ${g.b}\n   FOR j ← ${g.c} TO ${g.d}\n      OUTPUT ${expr}\n   ENDFOR\nENDFOR`
  const ask = last ? '**last**' : `**${ordinal(g.k)}**`
  const prompt = `Trace the nested loops. What is the ${ask} value output?\n\n${fence(code)}`
  const outs = nestedOutputs(g.a, g.b, g.c, g.d, f)
  const at = outs[g.k - 1]!
  const answer = at.v
  const tex = { product: `${at.i} \\times ${at.j}`, sum: `${at.i} + ${at.j}`, tens: `${at.i} \\times 10 + ${at.j}` }[kind]
  const groups = span(g.a, g.b).map((i) => outs.filter((x) => x.i === i).map((x) => x.v).join(', ')).join(', then ')
  const which = last
    ? `The last comes when i = ${at.i} and j = ${at.j}: $${tex} = $ **${answer}**.`
    : `The ${ordinal(g.k)} comes when i = ${at.i} and j = ${at.j}, because the inner counter restarts at ${g.c} for each outer pass: $${tex} = $ **${answer}**.`
  const ran = run(printedCode(prompt)).outputs
  return numericDraft(
    slot,
    {
      prompt,
      solution: `$${g.o} \\times ${g.n} = ${g.o * g.n}$ outputs: ${groups}. ${which}`,
      method: [`${g.o * g.n} outputs: ${outs.map((x) => x.v).join(', ')}`],
      answer,
    },
    { agrees: ran[g.k - 1] === answer && ran.length === g.o * g.n, detail: `interpreter output ${ran.join(', ')}; the ${ordinal(g.k)} is ${answer}` },
    { kind, a: g.a, b: g.b, c: g.c, d: g.d, k: g.k, answer },
  )
}

export const loopGenerators: Generator[] = [
  csBySlot('cs-loops-for-sum', TOPIC, { q1: forSum }),
  csBySlot('cs-loops-while-grow', TOPIC, { q5: whileGrow }),
  csBySlot('cs-loops-repeat', TOPIC, { q6: repeatUntil }),
  csBySlot('cs-loops-nested-count', TOPIC, { q7: nestedCount }),
  csBySlot('cs-loops-select-count', TOPIC, { q10: selectCount }),
  csBySlot('cs-loops-while-down', TOPIC, { q11: whileDown }),
  csBySlot('cs-loops-for-expression', TOPIC, { q15: forExpr }),
  csBySlot('cs-loops-nested-output', TOPIC, { q18: nestedOutput }),
]
