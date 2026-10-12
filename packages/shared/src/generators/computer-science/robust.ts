import type { Question } from '../../content/questions.ts'
import { int, pick, shuffle, weighted, type Rng } from '../random.ts'
import type { Draft, Generator } from '../types.ts'
import { andList, csBySlot, fence, numericDraft } from './build.ts'
import { run } from './pseudo.ts'

/**
 * Computer Science (AQA 8525) generators for 3.2.11, robust and secure programming: "be able to
 * write simple data validation routines" (the specification's examples: a minimum length, an
 * empty string, a value within a given range) and "simple authentication routines" with plain
 * text usernames and passwords. Both slots trace the lesson's loops, run through the interpreter
 * (pseudo.ts) with the inputs the prompt lists, and count what the run counts.
 *
 * - q11 (advanced): the lesson's attempt-limited password loop, the user wrong every time (or
 *   typing realistic near misses, the right password one or two places after the lock-out). Forms: attempts
 *   from 0 with < L (written) or ≤ L, from 1 with < L, retries counted down from L, and REPEAT …
 *   UNTIL. Asked how many times the user is asked, or how many times the wrong message is
 *   output. The count comes from the loop: the inputs passed outnumber what is read. Forgetting
 *   the ask before the loop (one too few) or one pass too many never pays; the number in the
 *   loop condition pays in about a quarter of builds, where the form makes it right.
 * - q18 (higher): the lesson's validation loops: a minimum length (written), presence and length
 *   together (the lesson's username loop, an empty input among the typed ones, never the 5
 *   characters q19 asks about on the same sheet), and a range (tickets, a mark, a level from 1 to
 *   10; not q5's age from 11 to 18, an option of that multiple-choice question). The prompt lists
 *   what the user is ready to type, as the written q18 now does; in nearly nine builds in ten the
 *   list runs one or two past the first accepted value, the first of them rejected, so the loop's
 *   stop decides the count, not the list. In most builds the first accepted value is the limit
 *   itself (exactly the length, or a range end), so reading < as ≤ changes the count.
 */

const TOPIC = 'robust-and-secure-programming'

const and = andList
/** "`cat`, then `letmein`, then `letmein1`", as the written prompt lists what is typed. */
const thens = (xs: string[]) => xs.join(', then ')
const NUMBER_WORDS = ['no', 'once', 'twice', 'three times', 'four times', 'five times', 'six times', 'seven times', 'eight times']

// ---------------------------------------------------------------------------------------------
// q11: attempt-limited password
// ---------------------------------------------------------------------------------------------

export type Lock = 'up' | 'up-le' | 'up-one' | 'down' | 'repeat'
export type LockAsk = 'asks' | 'messages'

/** Passwords people really try, none of them the stored one. */
const COMMON = ['password', '123456', 'qwerty', 'letmein', 'football', 'dragon', 'sunshine', 'monkey', 'abc123', 'welcome', 'princess', 'shadow', 'master', 'iloveyou']
export const STORED = ['tiger42', 'maple7', 'blue88', 'rover12', 'comet9', 'pixel55', 'mango3', 'otter21', 'storm64', 'lemon19', 'cactus5', 'falcon31']

/** Near misses of a password, as someone half remembering it types them. */
export function nearMisses(pw: string): string[] {
  const letters = pw.replace(/\d+$/, '')
  const digits = pw.slice(letters.length)
  const out = [
    letters,
    letters[0]!.toUpperCase() + pw.slice(1),
    pw.slice(0, 1) + pw[2] + pw[1] + pw.slice(3),
    pw + '!',
    letters + digits + digits.slice(-1),
    letters + (Number(digits) + 1),
  ]
  return [...new Set(out)].filter((x) => x !== pw)
}

/** How many times the user is asked, and how many wrong messages, when every attempt is wrong. */
export function lockCounts(form: Lock, L: number): { asks: number; messages: number } {
  switch (form) {
    case 'up': return { asks: L + 1, messages: L }
    case 'up-le': return { asks: L + 2, messages: L + 1 }
    case 'up-one': return { asks: L, messages: L - 1 }
    case 'down': return { asks: L + 1, messages: L }
    case 'repeat': return { asks: L, messages: L }
  }
}

export function lockCode(form: Lock, L: number, sv: string, ev: string, msg: string): string {
  const end = `IF ${ev} = ${sv} THEN\n   OUTPUT 'Welcome'\nELSE\n   OUTPUT 'Locked out'\nENDIF`
  if (form === 'repeat') {
    return `attempts ← 0\nREPEAT\n   OUTPUT 'Password?'\n   ${ev} ← USERINPUT\n   attempts ← attempts + 1\n   IF ${ev} ≠ ${sv} THEN\n      OUTPUT '${msg}'\n   ENDIF\nUNTIL ${ev} = ${sv} OR attempts = ${L}\n${end}`
  }
  const [init, cond, step] =
    form === 'down'
      ? [`retries ← ${L}`, `retries > 0`, `retries ← retries - 1`]
      : [`attempts ← ${form === 'up-one' ? 1 : 0}`, `attempts ${form === 'up-le' ? '≤' : '<'} ${L}`, `attempts ← attempts + 1`]
  return `${init}\nOUTPUT 'Password?'\n${ev} ← USERINPUT\nWHILE ${ev} ≠ ${sv} AND ${cond}\n   ${step}\n   OUTPUT '${msg}'\n   ${ev} ← USERINPUT\nENDWHILE\n${end}`
}

/** A line per pass, as the written solution counts them. */
function lockTrace(form: Lock, L: number, msg: string): string[] {
  const c = lockCounts(form, L)
  if (form === 'repeat') {
    const rows = Array.from({ length: L }, (_, i) => `Pass ${i + 1}: asked (${i + 1}), wrong, \`${msg}\`, attempts becomes ${i + 1}${i + 1 === L ? `, and attempts = ${L} is True, so the loop stops` : ''}.`)
    return ['REPEAT runs its body before it tests the condition, so the first ask is inside the loop.', ...rows]
  }
  const v = form === 'down' ? 'retries' : 'attempts'
  const start = form === 'down' ? L : form === 'up-one' ? 1 : 0
  const rows = ['Before the loop: asked once (1).']
  for (let i = 1; i <= c.messages; i++) {
    const now = form === 'down' ? start - i : start + i
    rows.push(`Pass ${i}: ${v} becomes ${now}, \`${msg}\`, asked again (${i + 1}).`)
  }
  const last = form === 'down' ? start - c.messages : start + c.messages
  const test = form === 'down' ? `${last} > 0` : form === 'up-le' ? `${last} ≤ ${L}` : `${last} < ${L}`
  rows.push(`Now ${v} is ${last} and ${test} is False, so the loop stops.`)
  return rows
}

function lockout(r: Rng, slot: Question): Draft {
  const [form, ask] = weighted<[Lock, LockAsk]>(r, [
    [['up', 'asks'], 34],
    [['up', 'messages'], 5],
    [['up-le', 'asks'], 14],
    [['up-le', 'messages'], 8],
    [['down', 'asks'], 18],
    [['down', 'messages'], 4],
    [['up-one', 'asks'], 5],
    [['repeat', 'asks'], 7],
    [['repeat', 'messages'], 3],
  ])
  const L = form === 'up-le' ? int(r, 1, 5) : form === 'up-one' || form === 'repeat' ? int(r, 3, 7) : int(r, 2, 6)
  const sv = pick(r, ['stored', 'storedPass', 'saved'])
  const ev = pick(r, ['entered', 'guess', 'typed'])
  // REPEAT outputs its message just before UNTIL, so a "try again" there would print straight before Locked out.
  const msg = form === 'repeat' ? 'Wrong password' : pick(r, ['Wrong, try again', 'Incorrect, try again', 'Wrong password'])
  const code = lockCode(form, L, sv, ev, msg)
  const c = lockCounts(form, L)
  const answer = c[ask]
  const pw = pick(r, STORED)
  // Listed near misses (a third of builds): the right password comes one or two places after the lock-out.
  const listed = r() < 0.35
  const typed = listed
    ? (() => {
        const misses = shuffle(r, [...nearMisses(pw), ...shuffle(r, COMMON).slice(0, 5)])
        // One or two wrong ones are still waiting at the lock-out, so the misses listed are never the count.
        const late = pick(r, [1, 2])
        return [...misses.slice(0, c.asks + late), pw]
      })()
    : shuffle(r, COMMON).slice(0, 12)
  const result = run(code, { inputs: typed, vars: { [sv]: pw } })
  const ran = ask === 'asks' ? result.inputsRead : result.outputs.filter((o) => o === msg).length
  const question = ask === 'asks' ? `how many times in total is the user asked to type ${listed ? 'a password' : 'it'}?` : `how many times is \`${msg}\` output?`
  const who = `In this program \`${sv}\` holds the correct password`
  const prompt = listed
    ? `${who}, \`${pw}\`. The user is ready to type ${thens(typed.map((t) => `\`${t}\``))}, one at a time as this program asks. ${question[0]!.toUpperCase()}${question.slice(1)}`
    : `${who}. If the user types the wrong password every time, ${question}`
  const trace = lockTrace(form, L, msg)
  const tail = listed ? ` The program locks out before \`${pw}\` is typed, so the correct password is never read.` : ''
  const total =
    ask === 'asks'
      ? `The user is asked **${answer}** times in total, then \`Locked out\`.${tail}`
      : `\`${msg}\` is output **${answer}** times, once a pass, then \`Locked out\`.${tail}`
  const solution = `${trace.map((t) => `- ${t}`).join('\n')}\n\n${total}`
  const method =
    form === 'repeat'
      ? [`The REPEAT body runs ${NUMBER_WORDS[L]}, asking each time`]
      : [`One input before the loop and the loop runs ${NUMBER_WORDS[c.messages]}`]
  return numericDraft(
    slot,
    { prompt: `${prompt}\n\n${fence(code)}`, solution, method, answer },
    { agrees: ran === answer && result.outputs.at(-1) === 'Locked out' && result.inputsRead < typed.length, detail: `interpreter: ${result.inputsRead} inputs read, ${ran} counted, last output ${String(result.outputs.at(-1))}` },
    { form, ask, L, listed: listed ? 'yes' : 'no', answer },
  )
}

// ---------------------------------------------------------------------------------------------
// q18: validation loops
// ---------------------------------------------------------------------------------------------

export type Check = 'length' | 'username' | 'range'
export interface Range {
  v: string
  lo: number
  hi: number
  msg: string
  /** "an age", "a number of tickets". */
  what: string
}
export const RANGES: Range[] = [
  { v: 'level', lo: 1, hi: 10, msg: 'Choose a level from 1 to 10', what: 'level' },
  { v: 'tickets', lo: 1, hi: 6, msg: 'Choose from 1 to 6', what: 'number of tickets' },
  { v: 'mark', lo: 0, hi: 100, msg: 'Enter a mark from 0 to 100', what: 'mark' },
  { v: 'month', lo: 1, hi: 12, msg: 'Enter a month from 1 to 12', what: 'month' },
  { v: 'players', lo: 2, hi: 4, msg: 'Choose 2 to 4 players', what: 'number of players' },
  { v: 'rating', lo: 1, hi: 5, msg: 'Give a rating from 1 to 5', what: 'rating' },
]

const PW_STEMS = ['cat', 'sun', 'dog', 'sky', 'owl', 'fox', 'jam', 'bee', 'pen', 'blue', 'star', 'moon', 'frog', 'kiwi', 'lion', 'rose', 'pizza', 'tiger', 'robin', 'mango', 'cloud', 'rocket', 'dragon', 'banana', 'letmein', 'monkey', 'pepper', 'summer', 'guitar', 'penguin', 'sunshine', 'football', 'raspberry', 'butterfly']
const USERS = ['al', 'jo', 'kim', 'sam', 'max', 'ella', 'theo', 'ruby', 'robin', 'alexa', 'jamie', 'priya', 'oscar', 'sasha', 'kofi', 'lena', 'mohammed', 'charlie', 'isabel', 'harriet']

/** A password-like string of exactly n characters, letters then digits. */
function ofLength(r: Rng, n: number, avoid: string[]): string {
  for (let t = 0; t < 200; t++) {
    const fits = PW_STEMS.filter((s) => s.length <= n && n - s.length <= 3)
    if (!fits.length) break
    const s = pick(r, fits)
    const digits = n - s.length ? String(int(r, 10 ** (n - s.length - 1), 10 ** (n - s.length) - 1)) : ''
    const out = s + digits
    if (!avoid.includes(out)) return out
  }
  throw new Error(`no password of length ${n}`)
}

export interface Validation {
  check: Check
  code: string
  /** What the user types, in order ('' for Enter with nothing typed). */
  typed: string[]
  msg: string
  limit: number
  range?: Range
  /** Whether each typed value would pass the check. */
  passes: boolean[]
}

function validationDraw(r: Rng, rejected: number): Validation {
  const check = weighted<Check>(r, [['length', 45], ['username', 25], ['range', 30]])
  // Nearly nine builds in ten, the list runs one or two past the first accepted value, the first of them a value the
  // check rejects, so counting every failing value, or all but the last, does not pay.
  const extra = r() < 0.88 ? pick(r, [1, 2]) : 0
  // In most builds the first accepted value is the limit itself, so reading < as ≤ changes the count.
  const boundary = r() < 0.85
  if (check === 'range') {
    const g = pick(r, RANGES)
    const ok = (x: number) => x >= g.lo && x <= g.hi
    const outside = () => (r() < 0.5 && g.lo > 0 ? int(r, Math.max(0, g.lo - 9), g.lo - 1) : int(r, g.hi + 1, g.hi + (g.hi >= 50 ? 150 : 12)))
    const inside = () => int(r, g.lo, g.hi)
    const bad: number[] = []
    for (let t = 0; bad.length < rejected && t < 200; t++) {
      const x = outside()
      if (!bad.includes(x)) bad.push(x)
    }
    while (bad.length < rejected) bad.push(outside())
    // On the limit: the accepted value is a range end, or a value one past an end is rejected.
    const good = boundary ? pick(r, [g.lo, g.hi]) : int(r, g.lo + 1, g.hi - 1)
    const after = Array.from({ length: extra }, (_, i) => (i === 0 ? outside() : r() < 0.5 ? outside() : inside()))
    const typed = [...shuffle(r, bad), good, ...after].map(String)
    const code = `${g.v} ← STRING_TO_INT(USERINPUT)\nWHILE ${g.v} < ${g.lo} OR ${g.v} > ${g.hi}\n   OUTPUT '${g.msg}'\n   ${g.v} ← STRING_TO_INT(USERINPUT)\nENDWHILE\nOUTPUT 'Thank you'`
    return { check, code, typed, msg: g.msg, limit: g.lo, range: g, passes: typed.map((t) => ok(Number(t))) }
  }
  if (check === 'length') {
    const L = int(r, 5, 10)
    const used: string[] = []
    const take = (n: number) => { const s = ofLength(r, n, used); used.push(s); return s }
    const bad = Array.from({ length: rejected }, () => take(int(r, 3, L - 1)))
    const good = take(boundary ? L : int(r, L + 1, Math.min(L + 3, 12)))
    const after = Array.from({ length: extra }, (_, i) => take(i === 0 ? int(r, 3, L - 1) : int(r, 3, L + 2)))
    const typed = [...bad, good, ...after]
    const v = pick(r, ['pwd', 'password'])
    const code = `${v} ← USERINPUT\nWHILE LEN(${v}) < ${L}\n   OUTPUT 'Too short'\n   ${v} ← USERINPUT\nENDWHILE\nOUTPUT 'Saved'`
    return { check, code, typed, msg: 'Too short', limit: L, passes: typed.map((t) => t.length >= L) }
  }
  // Not 5: q19 on the same sheet asks for boundary data for a username of at least 5 characters.
  const L = pick(r, [4, 6])
  const pool = shuffle(r, USERS)
  const short = pool.filter((u) => u.length < L)
  const long = pool.filter((u) => u.length >= L)
  const exact = pool.filter((u) => u.length === L)
  // The empty input is one of the rejected ones (the presence check), the rest are too short.
  const bad = shuffle(r, ['', ...short.slice(0, rejected - 1)])
  if (bad.length < rejected) throw new Error('not enough short usernames')
  const good = boundary ? exact[0]! : long.find((u) => u.length > L)!
  const rest = pool.filter((u) => !bad.includes(u) && u !== good)
  const after = Array.from({ length: extra }, (_, i) => (i === 0 ? (r() < 0.5 ? '' : rest.find((u) => u.length < L)!) : rest.find((u) => u.length >= L)!))
  const typed = [...bad, good, ...after]
  const msg = `Enter a username of at least ${L} characters`
  const code = `name ← USERINPUT\nWHILE name = '' OR LEN(name) < ${L}\n   OUTPUT '${msg}'\n   name ← USERINPUT\nENDWHILE\nOUTPUT 'Username saved'`
  return { check: 'username', code, typed, msg, limit: L, passes: typed.map((t) => t !== '' && t.length >= L) }
}

/** How a typed value reads in the prompt: Enter with nothing typed is said in words. */
const said = (t: string) => (t === '' ? 'nothing (just Enter)' : `\`${t}\``)

/** Why one typed value is rejected or accepted, as the written solution says it. */
function verdict(v: Validation, t: string): string {
  if (v.check === 'range') {
    const g = v.range!
    const x = Number(t)
    if (x < g.lo) return `${x} < ${g.lo} is True, so the message is output`
    if (x > g.hi) return `${x} > ${g.hi} is True, so the message is output`
    return `${x} < ${g.lo} and ${x} > ${g.hi} are both False, so the loop ends`
  }
  if (v.check === 'length') {
    return t.length < v.limit
      ? `${t} has ${t.length} characters and ${t.length} < ${v.limit} is True, so \`Too short\` is output`
      : `${t} has ${t.length} characters, ${t.length} < ${v.limit} is False, and the loop ends`
  }
  if (t === '') return `nothing typed: name = '' is True, so the message is output`
  return t.length < v.limit
    ? `${t}: not empty, but LEN is ${t.length} and ${t.length} < ${v.limit} is True, so the message is output`
    : `${t}: not empty, and LEN is ${t.length}, so ${t.length} < ${v.limit} is False and the loop ends`
}

function validation(r: Rng, slot: Question): Draft {
  const rejected = weighted(r, [[1, 15], [2, 30], [3, 28], [4, 17], [5, 10]] as const)
  const v = validationDraw(r, rejected)
  const ask = r() < 0.8 ? 'messages' : 'inputs'
  const result = run(v.code, { inputs: v.typed })
  const messages = result.outputs.filter((o) => o === v.msg).length
  const answer = ask === 'messages' ? messages : result.inputsRead
  const read = rejected + 1
  const intro = `The user is ready to type ${thens(v.typed.map(said))}, one at a time as this program asks.`
  const question = ask === 'messages' ? `How many times is \`${v.msg}\` output?` : 'How many times does the program read an input?'
  const steps = v.typed.slice(0, read).map((t) => `- ${verdict(v, t)}.`)
  const unread = v.typed.slice(read)
  const tail = unread.length ? ` The loop has ended, so ${and(unread.map(said))} ${unread.length === 1 ? 'is' : 'are'} never read.` : ''
  const total =
    ask === 'messages'
      ? `\`${v.msg}\` is output **${answer}** ${answer === 1 ? 'time' : 'times'}.${tail}`
      : `One input before the loop and one each time the message is output: ${rejected} + 1 = **${answer}** inputs.${tail}`
  const solution = `${steps.join('\n')}\n\n${total}`
  return numericDraft(
    slot,
    { prompt: `${intro} ${question}\n\n${fence(v.code)}`, solution, method: [], answer },
    {
      agrees: messages === rejected && result.inputsRead === read && v.passes.indexOf(true) === rejected,
      detail: `interpreter: ${messages} messages, ${result.inputsRead} inputs read; first passing input at ${v.passes.indexOf(true)}`,
    },
    { check: v.check, typed: v.typed.join('|'), ask, answer },
  )
}

export const robustGenerator: Generator = csBySlot('cs-robust', TOPIC, { q11: lockout, q18: validation })

export const robustGenerators: Generator[] = [robustGenerator]

