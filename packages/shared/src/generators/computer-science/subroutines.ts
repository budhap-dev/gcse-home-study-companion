import type { Question } from '../../content/questions.ts'
import { draw, int, pick, weighted, type Rng } from '../random.ts'
import type { Draft, Generator } from '../types.ts'
import { andList, csBySlot, fence, numericDraft } from './build.ts'
import { run } from './pseudo.ts'

/**
 * Computer Science (AQA 8525) generators for 3.2.10, structured programming and subroutines:
 * "use subroutines that return values to the calling routine", "use subroutines that require more
 * than one parameter" and "describe how data is passed to a subroutine using parameters", and local
 * variables, which "only exist while the subroutine is executing" and "are only accessible within
 * the subroutine". Every fragment is traced as 3.1.1 asks ("use trace tables … to determine how
 * simple algorithms work"). The specification calls the values in a call parameters too, so the
 * text never says "arguments".
 *
 * Each slot keeps its written question's point, and every program is run by the interpreter
 * (pseudo.ts) exactly as printed, its answer checked against the working printed here:
 *
 * - q5: the value a function call stores in a variable (lesson s3), with a later line that outputs
 *   something else made from it, so "the value output" never pays.
 * - q9: a function with a FOR loop inside (s8): a sum from 1 to n, a sum over a range a to b, a
 *   power by repeated multiplication, or a sum of squares. One pass too few, the loop's end value,
 *   x × n for a power and the parameters swapped never pay.
 * - q11: local and global variables (s5). The subroutine works out a value in a local variable
 *   and outputs it; the program then outputs its own variable, which the subroutine never
 *   assigned. Three builds in four the main program changes its variable itself, before the call
 *   or after it, so the figure in the first line pays only in the quarter that leave it alone;
 *   three times in ten the subroutine assigns a local of the global's own name, and the prompt
 *   states the rule, as the lesson says an exam will (AQA's pseudo-code does not say on its own).
 *   Each context has its own bodies (the cost with a flat fee, the takings at a price an item, the
 *   number of £5 notes), and doubling only where it makes sense (a double-points round). Reading
 *   the local value as the program's (the scope slip) and giving the first output never pay.
 * - q14: nested calls traced from the inside out (s8). Applying the outer function first, giving
 *   the inner call's value, or the outer function of the original value never pay.
 * - q17: values matched to parameters by position, not by name (s2), and multiplication before
 *   addition and subtraction. Half the time the parameters carry the program's own variable names
 *   (calc(x, y) called as calc(y, x)), so matching by name is a real slip; it, reading the
 *   expression left to right, and both slips together never pay.
 */

const TOPIC = 'subroutines-procedures-and-functions'

const IN = '   '
/** −17 as the mark schemes print a negative. */
const signed = (x: number) => (x < 0 ? `−${-x}` : String(x))
const ORDINAL_WORDS = ['first', 'second', 'third', 'fourth', 'fifth'] as const

const OUTPUT_LEADS = ['What is output by this program?', 'What does this program output?', 'What value does this program output?'] as const

// ---------------------------------------------------------------------------------------------
// q5: the value a function returns, stored in a variable
// ---------------------------------------------------------------------------------------------

export interface StoredFunction {
  name: string
  params: [string, string]
  body: string
  store: string
  draw: (r: Rng) => [number, number]
  value: (a: number, b: number) => number
  working: (a: number, b: number) => string
  /** The swapped call gives the same value, so it is not a slip to test. */
  commutative?: boolean
}

const pair = (r: Rng, lo: number, hi: number): [number, number] => {
  const a = int(r, lo, hi)
  let b = int(r, lo, hi - 1)
  if (b >= a) b++
  return [a, b]
}

export const STORED: StoredFunction[] = [
  { name: 'area', params: ['width', 'height'], body: 'width * height', store: 'room', draw: (r) => pair(r, 2, 9), value: (a, b) => a * b, working: (a, b) => `${a} × ${b} = ${a * b}`, commutative: true },
  { name: 'perimeter', params: ['width', 'height'], body: '2 * (width + height)', store: 'fence', draw: (r) => pair(r, 2, 12), value: (a, b) => 2 * (a + b), working: (a, b) => `2 × (${a} + ${b}) = ${2 * (a + b)}`, commutative: true },
  { name: 'cost', params: ['price', 'quantity'], body: 'price * quantity', store: 'bill', draw: (r) => [int(r, 2, 12), int(r, 2, 8)], value: (a, b) => a * b, working: (a, b) => `${a} × ${b} = ${a * b}`, commutative: true },
  { name: 'points', params: ['wins', 'draws'], body: 'wins * 3 + draws', store: 'score', draw: (r) => pair(r, 1, 12), value: (a, b) => a * 3 + b, working: (a, b) => `${a} × 3 + ${b} = ${a * 3 + b}` },
  { name: 'change', params: ['paid', 'price'], body: 'paid - price', store: 'due', draw: (r) => { const paid = pick(r, [10, 20, 50]); return [paid, int(r, 2, Math.min(45, paid - 2))] }, value: (a, b) => a - b, working: (a, b) => `${a} − ${b} = ${a - b}` },
  { name: 'minutes', params: ['hours', 'mins'], body: 'hours * 60 + mins', store: 'wait', draw: (r) => [int(r, 1, 2), int(r, 5, 55)], value: (a, b) => a * 60 + b, working: (a, b) => `${a} × 60 + ${b} = ${a * 60 + b}` },
]

type Follow = '*' | '+' | '-'

const STORED_LEADS = [
  (v: string) => `What value is stored in \`${v}\` after this code runs?`,
  (v: string) => `When this code has run, what value does \`${v}\` hold?`,
  (v: string) => `What value is assigned to \`${v}\` when this code runs?`,
] as const

/** q5: 1 mark. Written: room ← area(4, 5), then OUTPUT room * 2; room is 20. */
function storedValue(r: Rng, slot: Question): Draft {
  const fn = pick(r, STORED)
  const follow = pick(r, ['*', '+', '-'] as const satisfies readonly Follow[])
  const { a, b, k } = draw(
    r,
    (r) => {
      const [a, b] = fn.draw(r)
      const v = fn.value(a, b)
      const k = follow === '*' ? int(r, 2, 3) : int(r, 1, follow === '-' ? Math.min(9, v - 1) : 10)
      return { a, b, k }
    },
    ({ a, b, k }) => {
      const v = fn.value(a, b)
      // The answer is never a figure printed in the code, nor the swapped call's value.
      return v > 1 && ![a, b, k].includes(v) && (fn.commutative || fn.value(b, a) !== v)
    },
  )
  const answer = fn.value(a, b)
  const out = follow === '*' ? answer * k : follow === '+' ? answer + k : answer - k
  const code = [
    `SUBROUTINE ${fn.name}(${fn.params.join(', ')})`,
    `${IN}RETURN ${fn.body}`,
    'ENDSUBROUTINE',
    '',
    `${fn.store} ← ${fn.name}(${a}, ${b})`,
    `OUTPUT ${fn.store} ${follow} ${k}`,
  ]
  const ran = run(code.join('\n'))
  return numericDraft(
    slot,
    {
      prompt: `${pick(r, STORED_LEADS)(fn.store)}\n\n${fence(code)}`,
      solution: `\`${fn.name}(${a}, ${b})\` returns ${fn.working(a, b)}, which is assigned to \`${fn.store}\`. The line after that outputs ${out}, but the question asks for \`${fn.store}\`.`,
      method: [],
      answer,
    },
    {
      agrees: ran.vars.get(fn.store) === answer && ran.outputs.length === 1 && ran.outputs[0] === out,
      detail: `ran the printed code: ${fn.store} = ${String(ran.vars.get(fn.store))}, output ${String(ran.outputs[0])}`,
    },
    { fn: fn.name, a, b, follow: `${follow}${k}`, output: out, answer },
  )
}

// ---------------------------------------------------------------------------------------------
// q9: a function with a loop inside
// ---------------------------------------------------------------------------------------------

export type LoopShape = 'sum-to' | 'sum-range' | 'power' | 'squares'

/** Powers x^n up to 100 with n from 2: never 2^2 (x × n pays), 2^4 or 4^2 (the swapped call pays). */
export const POWERS: [number, number][] = []
for (let x = 2; x <= 10; x++) for (let n = 2; n <= 6 && x ** n <= 100; n++) if (!(x === 2 && n === 2) && x ** n !== n ** x) POWERS.push([x, n])

/** The values t takes, one a pass, from its start. */
export function loopTrace(shape: LoopShape, a: number, b: number): { start: number; ts: number[]; passes: number[] } {
  const passes: number[] = []
  if (shape === 'sum-range') for (let i = a; i <= b; i++) passes.push(i)
  else for (let i = 1; i <= (shape === 'power' ? b : a); i++) passes.push(i)
  const start = shape === 'power' ? 1 : 0
  const ts: number[] = []
  let t = start
  for (const i of passes) {
    t = shape === 'power' ? t * a : shape === 'squares' ? t + i * i : t + i
    ts.push(t)
  }
  return { start, ts, passes }
}

/** q9: 2 marks. Written: sum_to(4) gives 10. */
function loopFunction(r: Rng, slot: Question): Draft {
  const shape = weighted(r, [['sum-to', 3], ['sum-range', 3], ['power', 2.5], ['squares', 1.5]] as const)
  let a: number
  let b: number
  let header: string
  let call: string
  let loop: string
  let body: string
  if (shape === 'sum-to') {
    a = int(r, 3, 8)
    b = 0
    const name = pick(r, ['sum_to', 'add_to'])
    header = `${name}(n)`
    call = `${name}(${a})`
    loop = 'FOR i ← 1 TO n'
    body = 't ← t + i'
  } else if (shape === 'sum-range') {
    a = int(r, 2, 9)
    b = a + int(r, 3, 6) - 1
    header = 'add_up(a, b)'
    call = `add_up(${a}, ${b})`
    loop = 'FOR i ← a TO b'
    body = 't ← t + i'
  } else if (shape === 'power') {
    // Squares (n = 2) are seven of the thirteen pairs; the longer loops are drawn more often.
    ;[a, b] = weighted(r, POWERS.map((p) => [p, p[1] === 2 ? 1 : 2.5] as const))
    header = 'power(x, n)'
    call = `power(${a}, ${b})`
    loop = 'FOR i ← 1 TO n'
    body = 't ← t * x'
  } else {
    a = int(r, 3, 5)
    b = 0
    header = 'sum_squares(n)'
    call = `sum_squares(${a})`
    loop = 'FOR i ← 1 TO n'
    body = 't ← t + i * i'
  }
  const t = loopTrace(shape, a, b)
  const answer = t.ts.at(-1)!
  const code = [
    `SUBROUTINE ${header}`,
    `${IN}t ← ${t.start}`,
    `${IN}${loop}`,
    `${IN}${IN}${body}`,
    `${IN}ENDFOR`,
    `${IN}RETURN t`,
    'ENDSUBROUTINE',
    '',
    `OUTPUT ${call}`,
  ]
  const chain = [t.start, ...t.ts].join(' → ')
  const solution =
    shape === 'sum-to'
      ? `The loop adds ${andList(t.passes)} to t in turn: ${chain}. The function returns ${answer}.`
      : shape === 'sum-range'
        ? `\`${call}\` sets a = ${a} and b = ${b}. The loop runs for i = ${andList(t.passes)}, both ends included, adding each to t: ${chain}. The function returns ${answer}.`
        : shape === 'power'
          ? `\`${call}\` sets x = ${a} and n = ${b}, so the loop runs ${b} times, multiplying t by ${a} each time: ${chain}. The function returns ${answer}.`
          : `The loop adds ${andList(t.passes.map((i) => `${i} × ${i}`))} to t in turn: ${chain}. The function returns ${answer}.`
  const ran = run(code.join('\n'))
  // Own working: the closed form of each loop.
  const closed = shape === 'sum-to' ? (a * (a + 1)) / 2 : shape === 'sum-range' ? ((a + b) * (b - a + 1)) / 2 : shape === 'power' ? a ** b : (a * (a + 1) * (2 * a + 1)) / 6
  return numericDraft(
    slot,
    {
      prompt: `${pick(r, OUTPUT_LEADS)}\n\n${fence(code)}`,
      solution,
      method: [`Loop traced: t takes ${andList(t.ts)}`],
      answer,
    },
    { agrees: ran.outputs.length === 1 && ran.outputs[0] === answer && closed === answer, detail: `ran the printed code: ${String(ran.outputs[0])}; closed form ${closed}` },
    { shape, a, b, answer },
  )
}

// ---------------------------------------------------------------------------------------------
// q11: local and global variables
// ---------------------------------------------------------------------------------------------

/** One way a subroutine works out its local value: the line printed, and its value from the program's variable g and the parameter x. */
export interface ScopeBody {
  local: string
  code: string
  value: (g: number, x: number) => number
  working: (g: number, x: number) => string
}

export type ScopeKind = 'reads' | 'made' | 'shadow'
export type MainOp = '+' | '-' | '*'

export interface ScopeContext {
  global: string
  sub: string
  param: string
  start: (r: Rng) => number
  arg: (r: Rng) => number
  /** The ways the main program changes its own variable (doubling only where that makes sense), and by how much. */
  changes: readonly MainOp[]
  step: (r: Rng) => number
  /** From the program's variable (left ← total − amount). */
  reads: ScopeBody
  /** From the parameter alone, as the written's spent ← amount * 2 (a constant drawn per build). */
  made?: (r: Rng) => ScopeBody
  /** From the parameter alone, into a local of the program variable's own name. */
  shadow?: (r: Rng) => ScopeBody
}

const fromGlobal = (local: string, g: string, op: '+' | '-', param: string): ScopeBody => ({
  local,
  code: `${local} ← ${g} ${op} ${param}`,
  value: (gv, x) => (op === '+' ? gv + x : gv - x),
  working: (gv, x) => `${gv} ${op === '+' ? '+' : '−'} ${x}`,
})
const plus = (local: string, param: string, k: number): ScopeBody => ({ local, code: `${local} ← ${param} + ${k}`, value: (_, x) => x + k, working: (_, x) => `${x} + ${k}` })
const times = (local: string, param: string, k: number): ScopeBody => ({ local, code: `${local} ← ${param} * ${k}`, value: (_, x) => x * k, working: (_, x) => `${x} × ${k}` })

export const SCOPES: ScopeContext[] = [
  // A purchase: what is left, or the cost with a flat fee of £1 to £3 added.
  {
    global: 'total', sub: 'spend', param: 'amount', start: (r) => 10 * int(r, 6, 15), arg: (r) => int(r, 5, 40), changes: ['+', '-'], step: (r) => int(r, 5, 20),
    reads: fromGlobal('left', 'total', '-', 'amount'),
    made: (r) => plus('cost', 'amount', int(r, 1, 3)),
    shadow: (r) => plus('total', 'amount', int(r, 1, 3)),
  },
  // A game: the new score, or the bonus doubled. A double-points round doubles the score itself.
  {
    global: 'score', sub: 'bonus', param: 'points', start: (r) => int(r, 20, 90), arg: (r) => int(r, 2, 15), changes: ['+', '-', '*'], step: (r) => int(r, 2, 9),
    reads: fromGlobal('new_score', 'score', '+', 'points'),
    made: () => times('extra', 'points', 2),
    shadow: () => times('score', 'points', 2),
  },
  // A shop: what remains, or the takings at £2 to £5 an item; a delivery adds stock.
  {
    global: 'stock', sub: 'sell', param: 'items', start: (r) => int(r, 30, 90), arg: (r) => int(r, 2, 20), changes: ['+', '-'], step: (r) => int(r, 2, 12),
    reads: fromGlobal('remaining', 'stock', '-', 'items'),
    made: (r) => times('takings', 'items', int(r, 2, 5)),
  },
  // A cash machine: the balance after, or how many £5 notes it pays out.
  {
    global: 'balance', sub: 'withdraw', param: 'cash', start: (r) => 10 * int(r, 5, 20), arg: (r) => 5 * int(r, 2, 9), changes: ['+', '-'], step: (r) => 10 * int(r, 1, 5),
    reads: fromGlobal('after', 'balance', '-', 'cash'),
    made: () => ({ local: 'notes', code: 'notes ← cash DIV 5', value: (_, x) => Math.floor(x / 5), working: (_, x) => `${x} DIV 5` }),
  },
  // A room: the temperature after warming.
  {
    global: 'temp', sub: 'warm', param: 'degrees', start: (r) => int(r, 8, 25), arg: (r) => int(r, 2, 9), changes: ['+', '-'], step: (r) => int(r, 2, 6),
    reads: fromGlobal('new_temp', 'temp', '+', 'degrees'),
  },
]

const SYMBOL: Record<MainOp, string> = { '+': '+', '-': '−', '*': '×' }

/**
 * q11: 2 marks. Written: total ← 100, spend(5) outputs 10, then OUTPUT total gives 100. Three
 * builds in four the main program changes its own variable, before the call or after it, so the
 * figure in the first line is the answer only in the quarter that leave it alone.
 */
function scope(r: Rng, slot: Question): Draft {
  const kind = weighted(r, [['reads', 4.5], ['made', 2.5], ['shadow', 3]] as const satisfies readonly (readonly [ScopeKind, number])[])
  const ctx = pick(r, SCOPES.filter((c) => kind === 'reads' || c[kind]))
  const body = kind === 'reads' ? ctx.reads : ctx[kind]!(r)
  const when = weighted(r, [['none', 1], ['before', 1.5], ['after', 1.5]] as const)
  const op = pick(r, ctx.changes)
  const calls = r() < 0.35 ? 2 : 1
  const asksLast = r() < 0.5
  const g = ctx.global
  const apply = (v: number, c: number) => (op === '+' ? v + c : op === '-' ? v - c : v * 2)

  const v = draw(
    r,
    (r) => ({ g0: ctx.start(r), xs: Array.from({ length: calls }, () => ctx.arg(r)), c: op === '*' ? 2 : ctx.step(r) }),
    ({ g0, xs, c }) => {
      if (calls === 2 && xs[0] === xs[1]) return false
      const atCall = when === 'before' ? apply(g0, c) : g0
      const locals = xs.map((x) => body.value(atCall, x))
      const answer = when === 'after' ? apply(atCall, c) : atCall
      // The scope slip: the program's variable taken as the last value the subroutine made; and
      // each call read as changing it, so the next call starts from there.
      const slip = when === 'after' ? apply(locals.at(-1)!, c) : locals.at(-1)!
      let chained = atCall
      for (const x of xs) chained = body.value(chained, x)
      if (when === 'after') chained = apply(chained, c)
      const printed = [...xs, ...(when === 'none' ? [] : [c])]
      return answer > 0 && answer <= 300 && locals.every((l) => l > 0 && l !== answer) && slip !== answer && chained !== answer && !printed.includes(answer) && (when === 'none' || answer !== g0)
    },
  )
  const { g0, xs, c } = v
  const atCall = when === 'before' ? apply(g0, c) : g0
  const locals = xs.map((x) => body.value(atCall, x))
  const answer = when === 'after' ? apply(atCall, c) : atCall
  const change = `${g} ← ${g} ${op} ${c}`
  const code = [
    `${g} ← ${g0}`,
    '',
    `SUBROUTINE ${ctx.sub}(${ctx.param})`,
    `${IN}${body.code}`,
    `${IN}OUTPUT ${body.local}`,
    'ENDSUBROUTINE',
    '',
    ...(when === 'before' ? [change] : []),
    ...xs.map((x) => `${ctx.sub}(${x})`),
    ...(when === 'after' ? [change] : []),
    `OUTPUT ${g}`,
  ]
  const position = asksLast ? 'last' : ORDINAL_WORDS[calls]!
  const rule = kind === 'shadow' ? 'In this program, a variable that is given a value inside a subroutine is local to that subroutine. ' : ''
  const prompt = `${rule}What is the ${position} value output by this program?\n\n${fence(code)}`

  const beforeText = when === 'before' ? `The program first sets \`${g}\` to ${g0} ${SYMBOL[op]} ${c} = ${atCall}. ` : ''
  const callText = xs.map((x, i) => `\`${ctx.sub}(${x})\` outputs ${body.working(atCall, x)} = ${locals[i]}`)
  const afterText = when === 'after' ? ` The main program then sets \`${g}\` to ${atCall} ${SYMBOL[op]} ${c} = ${answer}.` : ''
  const solution =
    beforeText +
    (kind === 'shadow'
      ? `The question says a variable given a value inside a subroutine is local, so the \`${g}\` inside \`${ctx.sub}\` is a new local variable, gone when the subroutine ends: ${andList(callText)}. The program's own \`${g}\` is never assigned by the subroutine, so it is still ${atCall}.`
      : `\`${body.local}\` is a local variable, created inside \`${ctx.sub}\` and gone when it ends: ${andList(callText)}. The subroutine never assigns to \`${g}\`, so the program's variable is untouched and is still ${atCall}.`) +
    `${afterText} The ${position} output is **${answer}**.`
  // The M1 is the trace, not the rule the prompt states.
  const method = `${ctx.sub} outputs ${andList(locals)}, its local ${body.local}; the program's ${g} is still ${atCall}${when === 'after' ? ` (then ${atCall} ${SYMBOL[op]} ${c} = ${answer})` : ''}`
  const ran = run(code.join('\n'))
  return numericDraft(
    slot,
    { prompt, solution, method: [method], answer },
    {
      agrees: ran.outputs.length === calls + 1 && ran.outputs.at(-1) === answer && ran.vars.get(g) === answer && locals.every((l, i) => ran.outputs[i] === l) && (body.local === g || !ran.vars.has(body.local)),
      detail: `ran the printed code: outputs ${ran.outputs.join(', ')}`,
    },
    { context: g, kind, when, change: when === 'none' ? 'none' : change, calls, start: g0, args: xs.join(','), answer },
  )
}

// ---------------------------------------------------------------------------------------------
// q14: nested function calls
// ---------------------------------------------------------------------------------------------

export type Step = { kind: 'add' | 'sub' | 'mul' | 'sq'; k: number }

export const applyStep = (s: Step, n: number) => (s.kind === 'add' ? n + s.k : s.kind === 'sub' ? n - s.k : s.kind === 'mul' ? n * s.k : n * n)
const stepCode = (s: Step) => (s.kind === 'add' ? `n + ${s.k}` : s.kind === 'sub' ? `n - ${s.k}` : s.kind === 'mul' ? `n * ${s.k}` : 'n * n')
const stepWorking = (s: Step, n: number) => `${s.kind === 'add' ? `${n} + ${s.k}` : s.kind === 'sub' ? `${n} − ${s.k}` : s.kind === 'mul' ? `${n} × ${s.k}` : `${n} × ${n}`} = ${applyStep(s, n)}`

function drawStep(r: Rng, kind: Step['kind']): Step {
  return { kind, k: kind === 'add' ? int(r, 1, 9) : kind === 'sub' ? int(r, 1, 5) : kind === 'mul' ? int(r, 2, 5) : 0 }
}

/** q14: 2 marks. Written: g(n) = n + 3, f(n) = n × n, OUTPUT f(g(2)) gives 25. */
function nested(r: Rng, slot: Question): Draft {
  const gFirst = r() < 0.5
  const fOuter = r() < 0.7
  const v = draw(
    r,
    (r) => {
      const kinds = ['add', 'sub', 'mul', 'sq'] as const
      const fk = pick(r, kinds)
      const gk = pick(r, kinds.filter((x) => x !== fk))
      return { f: drawStep(r, fk), g: drawStep(r, gk), x: int(r, 2, 9) }
    },
    ({ f, g, x }) => {
      const [outer, inner] = fOuter ? [f, g] : [g, f]
      const mid = applyStep(inner, x)
      const answer = applyStep(outer, mid)
      const wrongOrder = applyStep(inner, applyStep(outer, x))
      const printed = [x, f.k, g.k].filter((k) => k > 0)
      return mid >= 1 && answer >= 2 && answer <= 100 && mid !== answer && wrongOrder !== answer && applyStep(outer, x) !== answer && !printed.includes(answer) && applyStep(outer, x) >= 1
    },
  )
  const { f, g, x } = v
  const [outer, inner, oName, iName] = fOuter ? [f, g, 'f', 'g'] : [g, f, 'g', 'f']
  const mid = applyStep(inner, x)
  const answer = applyStep(outer, mid)
  const def = (name: string, s: Step) => [`SUBROUTINE ${name}(n)`, `${IN}RETURN ${stepCode(s)}`, 'ENDSUBROUTINE', '']
  const code = [...(gFirst ? [...def('g', g), ...def('f', f)] : [...def('f', f), ...def('g', g)]), `OUTPUT ${oName}(${iName}(${x}))`]
  const ran = run(code.join('\n'))
  return numericDraft(
    slot,
    {
      prompt: `${pick(r, OUTPUT_LEADS)}\n\n${fence(code)}`,
      solution: `Work from the inside out. \`${iName}(${x})\` returns ${stepWorking(inner, x)}. Then \`${oName}(${mid})\` returns ${stepWorking(outer, mid)}.`,
      method: [`${iName}(${x}) = ${mid} evaluated first`],
      answer,
    },
    { agrees: ran.outputs.length === 1 && ran.outputs[0] === answer, detail: `ran the printed code: ${String(ran.outputs[0])}` },
    { f: stepCode(f), g: stepCode(g), call: `${oName}(${iName}(${x}))`, answer },
  )
}

// ---------------------------------------------------------------------------------------------
// q17: values matched to parameters in order, and precedence
// ---------------------------------------------------------------------------------------------

/** The function body: the first parameter (or the second, `flip`) plus or minus the other times k. */
export interface CalcForm {
  op: '+' | '-'
  flip: boolean
  k: number
}

/** The body's value with the first parameter p and the second q, multiplication first. */
export const calcValue = (f: CalcForm, p: number, q: number) => {
  const [a, b] = f.flip ? [q, p] : [p, q]
  return f.op === '+' ? a + b * f.k : a - b * f.k
}
/** The same read left to right: (a ± b) × k. */
export const leftToRight = (f: CalcForm, p: number, q: number) => {
  const [a, b] = f.flip ? [q, p] : [p, q]
  return (f.op === '+' ? a + b : a - b) * f.k
}

const PARAM_NAMES = [['a', 'b'], ['p', 'q'], ['x', 'y'], ['m', 'n']] as const

/** q17: 2 marks. Written: calc(a, b) returns a − b × 2; x ← 10, y ← 3, calc(y, x) gives −17. */
function calcOrder(r: Rng, slot: Question): Draft {
  // Half the time the parameters carry the program's own names, so matching by name is a real slip.
  const sameNames = r() < 0.5
  const vars = pick(r, [['x', 'y'], ['m', 'n']] as const)
  const params = sameNames ? vars : pick(r, PARAM_NAMES.filter((p) => p[0] !== 'x' && p[0] !== 'm'))
  const name = pick(r, ['calc', 'compute', 'work_out'])
  const form: CalcForm = { op: r() < 0.6 ? '-' : '+', flip: r() < 0.3, k: int(r, 2, 4) }
  const { X, Y } = draw(
    r,
    (r) => ({ X: int(r, 2, 15), Y: int(r, 2, 15) }),
    ({ X, Y }) => {
      if (X === Y) return false
      // Called as name(Y-variable, X-variable): the first parameter takes Y.
      const answer = calcValue(form, Y, X)
      const wrong = [calcValue(form, X, Y), leftToRight(form, Y, X), leftToRight(form, X, Y)]
      const sizes = [X, Y, form.k]
      return Math.abs(answer) <= 60 && answer !== 0 && !wrong.includes(answer) && !sizes.includes(Math.abs(answer))
    },
  )
  const answer = calcValue(form, Y, X)
  const [p1, p2] = params
  const [a, b] = form.flip ? [p2, p1] : [p1, p2]
  const body = `${a} ${form.op} ${b} * ${form.k}`
  const code = [
    `SUBROUTINE ${name}(${p1}, ${p2})`,
    `${IN}RETURN ${body}`,
    'ENDSUBROUTINE',
    '',
    `${vars[0]} ← ${X}`,
    `${vars[1]} ← ${Y}`,
    `OUTPUT ${name}(${vars[1]}, ${vars[0]})`,
  ]
  const value = (p: string) => (p === p1 ? Y : X)
  const [av, bv] = [value(a), value(b)]
  const product = bv * form.k
  const opWord = form.op === '-' ? 'subtraction' : 'addition'
  const matched = sameNames
    ? `Values are matched to the parameters in order, not by name: \`${name}(${vars[1]}, ${vars[0]})\` passes the value of ${vars[1]} first, so inside \`${name}\` the parameter ${p1} is ${Y} and the parameter ${p2} is ${X}.`
    : `Values are matched to the parameters in order, not by name: \`${name}(${vars[1]}, ${vars[0]})\` makes ${p1} = ${Y} and ${p2} = ${X}.`
  const sum = `$${av} ${form.op} ${bv} \\times ${form.k} = ${av} ${form.op} ${product} = ${answer}$`
  const solution = `${matched} Multiplication comes before ${opWord}, so the function returns ${sum}, and the program outputs **${answer < 0 ? `$${answer}$` : answer}**.`
  const ran = run(code.join('\n'))
  return numericDraft(
    slot,
    { prompt: `${pick(r, OUTPUT_LEADS)}\n\n${fence(code)}`, solution, method: [`${p1} = ${Y} and ${p2} = ${X}, matched in order`], answer, line: signed(answer) },
    { agrees: ran.outputs.length === 1 && ran.outputs[0] === answer && (form.op === '+' ? av + product : av - product) === answer, detail: `ran the printed code: ${String(ran.outputs[0])}` },
    { form: body, names: sameNames ? 'same' : 'other', X, Y, answer },
  )
}

export const subroutineGenerator = csBySlot('cs-subroutines', TOPIC, {
  q5: storedValue,
  q9: loopFunction,
  q11: scope,
  q14: nested,
  q17: calcOrder,
})

export const subroutineGenerators: Generator[] = [subroutineGenerator]
