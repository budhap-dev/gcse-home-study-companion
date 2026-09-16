import type { Question } from './content/questions.ts'

export interface MarkResult {
  correct: boolean
  marksScored: number
  marksAvailable: number
}

const SUPERSCRIPTS: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', '⁺': '+' }

/**
 * Superscript digits and signs to caret form, so x⁸ and x^8 compare equal. Also:
 * Unicode minus and dashes to a hyphen, √ and "root" to sqrt, brackets around a root
 * argument dropped, multiplication signs dropped, and a leading "y=" dropped so
 * "y = 2x - 2" and "2x-2" compare equal.
 */
/**
 * Brackets a student added for clarity, round a single term: `(√3)/2` means the same as
 * `√3/2`. Only groups holding no `+`, `−`, `*`, `/` or `^` are dropped, because those are
 * exactly the brackets that change what an expression means — `(1+3)/4` is not `1+3/4`,
 * and `(2/3)^2` is not `2/3^2`. Runs repeatedly so `((3))` collapses too.
 */
function dropRedundantBrackets(s: string): string {
  let out = s
  for (let pass = 0; pass < 5; pass++) {
    const next = out.replace(/\(([^()+\-*/^]+)\)/g, '$1')
    if (next === out) break
    out = next
  }
  return out
}

export function normaliseText(s: string): string {
  let out = s.toLowerCase()
  out = out.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+/g, (run) => '^' + [...run].map((c) => SUPERSCRIPTS[c] ?? c).join(''))
  return out
    .replace(/\s+/g, '')
    .replace(/[−–—]/g, '-')
    // French answers are full of apostrophes, and phones type a curly one.
    .replace(/[\u2018\u2019\u02bc`´]/g, "'")
    // A student without a pi key types "pi", and the content writes "π". Folding the
    // symbol to the letters rather than the other way round is what makes this safe:
    // going the other way would rewrite "pitch" and "capital" in every word answer.
    .replace(/π/g, 'pi')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/√\(([^)]+)\)/g, 'sqrt$1')
    .replace(/√/g, 'sqrt')
    .replace(/root/g, 'sqrt')
    .replace(/sqrt\(([^)]+)\)/g, 'sqrt$1')
    .replace(/\*/g, '')
    .replace(/[{}]/g, '')
    .replace(/\^\(([^)]+)\)/g, '^$1')
    .replace(/^y=/, '')
    // Last, so the rules above have already turned √(3) and sqrt(3) into sqrt3.
    .replace(/^[\s\S]*$/, dropRedundantBrackets)
}

const SUPERSCRIPT_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹'

/**
 * Rewrites "1.8 x 10^5", "1.8 × 10⁵" and "10^-3" into the "1.8e5" form the number
 * check below understands. Physics answers run to 180 000 and 25 000, and a student
 * who has just been taught standard form writes them that way.
 */
function standardForm(s: string): string {
  const superscript = (run: string) => [...run].map((c) => (SUPERSCRIPT_DIGITS.includes(c) ? String(SUPERSCRIPT_DIGITS.indexOf(c)) : c === '⁻' ? '-' : c === '⁺' ? '' : c)).join('')
  return s
    .replace(/10\s*([⁻⁺]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (_, run: string) => `10^${superscript(run)}`)
    .replace(/^\s*([-+]?\d*\.?\d+)?\s*[x×*]?\s*10\s*\^\s*\(?([-+]?\d+)\)?\s*$/, (_whole, mantissa: string | undefined, exponent: string) => {
      const power = exponent.replace(/^\+/, '')
      return `${mantissa === undefined || mantissa === '' ? '1' : mantissa}e${power}`
    })
}

/**
 * Parses "0.25", "1/4", "-2", "3 m/s", "1,000", "25 000", and standard form written
 * any of the ways a student writes it: "1.8e5", "1.8 x 10^5", "1.8 × 10⁵".
 * Returns undefined when it is not a number.
 */
export function parseNumber(input: string, units?: string): number | undefined {
  // A phone keyboard or a pasted answer can carry a Unicode minus or dash; the
  // Business cash-flow answers are the first negatives in the pack.
  let s = input.trim().toLowerCase().replace(/,/g, '').replace(/[−–—]/g, '-')
  // A division sign is a key on every maths keyboard, so a student who presses it means
  // a fraction. normaliseText has always done this; parseNumber did not, so 3÷4 was read
  // as no number at all.
  s = s.replace(/÷/g, '/')
  // A student who has just solved for x writes "x = 5", and one copying a formula
  // writes "F = 20"; the name and the equals sign are not part of the number.
  s = s.replace(/^[a-z]\w*\s*=\s*/, '').replace(/^=\s*/, '')
  // Money answers are written with their symbol, and the Business solutions print
  // "£500" and "-£700" themselves, so a student copying that format must be accepted.
  // The sign may sit either side of the symbol.
  s = s.replace(/^([-+]?)\s*[£$€]\s*/, '$1').replace(/^[£$€]\s*([-+]?)\s*/, '$1')
  if (units) s = s.replace(units.toLowerCase(), '').trim()
  s = standardForm(s)
  s = s.replace(/[a-z°%/ ]+$/i, '').trim()
  // Brackets round the parts of a fraction: (3)/(4). Students write it, and it is what a
  // WYSIWYG maths editor produces, so it has to read as three quarters rather than as
  // nothing at all.
  s = s.replace(/\((-?\d+(?:\.\d+)?)\)/g, '$1')
  // A mixed number, before the rule below joins digits across a space. "1 1/2" is one and
  // a half; joining first turned it into 11/2 and marked the student as meaning 5.5 — a
  // wrong number returned silently, which is worse than refusing to read it.
  const mixed = s.match(/^(-?)(\d+)\s+(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/)
  if (mixed) {
    const denominator = Number(mixed[4])
    if (denominator === 0) return undefined
    const size = Number(mixed[2]) + Number(mixed[3]) / denominator
    return mixed[1] === '-' ? -size : size
  }
  // "25 000" and "180 000" are how the content itself prints large numbers.
  s = s.replace(/(\d)\s+(?=\d)/g, '$1')
  const frac = s.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/)
  if (frac) {
    const d = Number(frac[2])
    return d === 0 ? undefined : Number(frac[1]) / d
  }
  if (!/^-?\d*\.?\d+(e-?\d+)?$/.test(s)) return undefined
  return Number(s)
}

/** True when the comma at `at` separates two numbers, as in (3, 5) or (0, -2). Input has no spaces. */
function isNumberSeparator(whole: string, at: number): boolean {
  const before = whole[at - 1] ?? ''
  let after = whole[at + 1] ?? ''
  // A signed number follows the comma in a coordinate like (0, -2).
  if (after === '-' || after === '+') after = whole[at + 2] ?? ''
  return /\d/.test(before) && /\d/.test(after)
}

/** Removes commas that are prose punctuation, keeping one that separates two numbers. */
function stripProseCommas(s: string): string {
  return s.replace(/,/g, (comma: string, at: number, whole: string) => (isNumberSeparator(whole, at) ? comma : ''))
}

/**
 * The accepted answer decides which punctuation matters. Punctuation it leaves out is
 * forgiven in the typed answer — a closing full stop, the comma after "Avant" — so a
 * French sentence typed properly is not marked wrong. Punctuation it includes is
 * required: when a program prints "Hi Amy!", the exclamation mark is part of the output.
 * Both arguments are already normalised.
 */
function matchesAccepted(given: string, accepted: string): boolean {
  if (given === accepted) return true
  let lenient = given
  if (!/[.!?]$/.test(accepted)) lenient = lenient.replace(/[.!?]+$/, '')
  if (stripProseCommas(accepted) === accepted) lenient = stripProseCommas(lenient)
  return lenient === accepted
}

/**
 * "the stomata" for "stomata": a leading English article is forgiven when the
 * accepted answer is a plain word or phrase that does not start with one. Anything
 * with digits, quotes or symbols (program output, equations) and any accented word
 * (French, where the article carries gender) keeps the strict comparison. Works on
 * the raw strings because normaliseText removes the spaces the rule depends on.
 */
function withoutArticle(rawGiven: string, rawAccepted: string): [string, string] | null {
  // Only plain English prose: anything with digits, quotes, symbols or accents keeps the
  // strict comparison, so program output, equations and French (where the article carries
  // gender) are untouched.
  if (!/^[a-z][a-z -]*$/i.test(rawAccepted)) return null
  // "The" often identifies a particular thing, so an accepted answer that starts with it
  // keeps its article: "the sun" should not be matched by "sun". An indefinite "a" or
  // "an" in front of a definition is grammatical filler, so it is dropped from both
  // sides. Without that, "a tax on imports" rejected a student typing "tax on imports",
  // which is the phrasing the topic itself teaches.
  if (/^the\s/i.test(rawAccepted)) return null
  const strip = (s: string) => s.replace(/^\s*(the|an?)\s+/i, '')
  const given = strip(rawGiven)
  const accepted = rawAccepted.replace(/^\s*an?\s+/i, '')
  if (given === rawGiven && accepted === rawAccepted) return null
  return [given, accepted]
}

/**
 * Marks an auto-markable answer. Extended responses are self-assessed and return
 * whatever marks the student awarded themselves, capped at the marks available.
 * `answer` shapes: multiple-choice number[]; numeric string; short-text string;
 * ordering number[] (indexes into items in the student's order); labelling
 * Record<labelId, labelId placed>; extended number (self-awarded marks).
 */
export function mark(question: Question, answer: unknown): MarkResult {
  const available = question.marks
  const result = (correct: boolean): MarkResult => ({ correct, marksScored: correct ? available : 0, marksAvailable: available })
  switch (question.type) {
    case 'multiple-choice': {
      const chosen = Array.isArray(answer) ? [...(answer as number[])].sort() : []
      const correct = [...question.correct].sort()
      return result(chosen.length === correct.length && chosen.every((v, i) => v === correct[i]))
    }
    case 'numeric': {
      const value = typeof answer === 'string' ? parseNumber(answer, question.units) : typeof answer === 'number' ? answer : undefined
      if (value === undefined) return result(false)
      return result(Math.abs(value - question.answer) <= question.tolerance + 1e-9)
    }
    case 'short-text': {
      const raw = String(answer ?? '')
      const given = normaliseText(raw)
      return result(given.length > 0 && question.accepted.some((a) => {
        const accepted = normaliseText(a)
        if (matchesAccepted(given, accepted)) return true
        const bare = withoutArticle(raw, a)
        return bare !== null && matchesAccepted(normaliseText(bare[0]), normaliseText(bare[1]))
      }))
    }
    case 'ordering': {
      const order = Array.isArray(answer) ? (answer as number[]) : []
      return result(order.length === question.items.length && order.every((v, i) => v === i))
    }
    case 'labelling': {
      const placed = (answer ?? {}) as Record<string, string>
      return result(question.labels.every((l) => placed[l.id] === l.id))
    }
    case 'extended': {
      const self = typeof answer === 'number' ? Math.max(0, Math.min(available, Math.round(answer))) : 0
      return { correct: self === available, marksScored: self, marksAvailable: available }
    }
  }
}
