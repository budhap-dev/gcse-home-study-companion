import type { Question } from './content/questions.ts'
import { sameAlgebra } from './algebra.ts'
import { dictationDiff, markDictation } from './dictation.ts'

export interface MarkResult {
  correct: boolean
  marksScored: number
  marksAvailable: number
  /**
   * The marker said no and the student said their answer meant the same as the model
   * answer. Counted as right, and recorded as self-marked so a parent can see it was.
   */
  claimed?: boolean
  /** A dictation: which of the words read out were missed, as indexes into `dictationWords`. */
  missed?: number[]
}

/**
 * The student's overrule of a typed answer the marker rejected. A typed answer is matched
 * against a short list of wordings, and a correct explanation in the student's own words
 * matches none of them; this is the same trust an extended answer already gets.
 */
export function claimAnswer(result: MarkResult): MarkResult {
  return { correct: true, marksScored: result.marksAvailable, marksAvailable: result.marksAvailable, claimed: true }
}

const SUPERSCRIPTS: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', '⁺': '+' }
const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉'

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
  // A run ending in a sign is an ionic charge, not a power: Fe³⁺ is typed Fe3+ on a phone,
  // and a caret between them would make the two differ. A power keeps its caret, so x² is
  // still x^2 and x⁻¹ is still x^-1.
  out = out.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+/g, (run) => (/[⁻⁺]$/.test(run) ? '' : '^') + [...run].map((c) => SUPERSCRIPTS[c] ?? c).join(''))
  // Subscripts are only ever counts in a formula: CO₂ and CO2 are the same answer.
  out = out.replace(/[₀-₉]/g, (c) => String(SUBSCRIPTS.indexOf(c)))
  // One arrow for a reaction, however it was typed: the content prints →, a keyboard gives
  // -> or -->, and some students write =>. Done while the spaces are still there, so the
  // charge in "2e- -> Cu" stays on the electron instead of running into the arrow. An
  // equals sign is left alone, because in maths it is not an arrow.
  out = out.replace(/\s*(?:[→⟶⇒]|-{1,2}>|=>)\s*/g, ' -> ')
  // A mixed number keeps a mark between its whole part and its fraction. Joined, "2 1/3"
  // became 21/3, so a student who typed twenty-one thirds was marked right for two and a
  // third. The maths field sends the same number as 2(1)/(3).
  out = out.replace(/(\d)\s*\((\d+)\)\s*\/\s*\((\d+)\)/g, '$1&$2/$3').replace(/(\d)\s+(?=\d+\s*\/\s*\d)/g, '$1&')
  return out
    .replace(/\s+/g, '')
    .replace(/[−–—]/g, '-')
    // The maths field sends ± as +-, and a keyboard gives +/- or \pm; the content prints ±.
    .replace(/\+\/?-|\\pm/g, '±')
    // French answers are full of apostrophes, and phones type a curly one.
    .replace(/[\u2018\u2019\u02bc`´]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    // "solid-state" and "solid state" are one answer, and so are "sub-problems" and
    // "subproblems". Only between words: a hyphen after a single letter or a digit is a
    // minus sign or part of a name, as in x-y or carbon-12.
    .replace(/(?<=\p{L}{2})-(?=\p{L}{2})/gu, '')
    // A student without a pi key types "pi", and the content writes "π". Folding the
    // symbol to the letters rather than the other way round is what makes this safe:
    // going the other way would rewrite "pitch" and "capital" in every word answer.
    .replace(/π/g, 'pi')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    // Brackets after a root go only when they hold one number or letter: √(130) is √130,
    // but √(a/π) is not √a/π. Dropping them whatever they held marked the root of part
    // of an expression right for the root of all of it.
    .replace(/√\(([\d.]+|[a-z])\)/g, 'sqrt$1')
    .replace(/√/g, 'sqrt')
    .replace(/root/g, 'sqrt')
    .replace(/sqrt\(([\d.]+|[a-z])\)/g, 'sqrt$1')
    // A times sign is dropped, so 3*x is 3x. In SQL the star is the whole column list:
    // dropping it would pass SELECT FROM Student for SELECT * FROM Student. Between two
    // numbers it stays too: dropped, 2^2 × 3 × 7 and the wrong 2^23 × 7 were one answer.
    .replace(/\*/g, (star, at: number, whole: string) =>
      /^(select|insert|update|delete)/.test(whole) || (/\d/.test(whole[at - 1] ?? '') && /\d/.test(whole[at + 1] ?? '')) ? star : '')
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
  // A keyboard has no ² or ³, so the unit arrives as m2 or m^2 as often as m². Every
  // spelling is tried, longest first, so kg/m^3 is taken whole rather than leaving a 3
  // behind to be read as part of the number.
  if (units) {
    const u = units.toLowerCase()
    const spellings = [u, u.replace(/²/g, '^2').replace(/³/g, '^3'), u.replace(/²/g, '2').replace(/³/g, '3')].sort((a, b) => b.length - a.length)
    const found = spellings.find((v) => s.includes(v))
    if (found) s = s.replace(found, '').trim()
  }
  // A magnification is written ×400 or x400, and sometimes 400×: the sign says "times"
  // and is not part of the number. Only a sign against the digits at either end counts,
  // so 1.8 × 10^5 in the middle is still standard form.
  s = s.replace(/^[x×]\s*(?=\d)/, '').replace(/(?<=\d)\s*×$/, '')
  s = standardForm(s)
  s = s.replace(/[a-z°%/ ]+$/i, '').trim()
  // Brackets round the parts of a fraction: (3)/(4). Students write it, and it is what a
  // WYSIWYG maths editor produces, so it has to read as three quarters rather than as
  // nothing at all.
  // The maths field sends two and a third as 2(1)/(3); stripping the brackets first made
  // it 21/3. Read as a mixed number, it is caught by the rule below.
  s = s.replace(/^(-?\d+)\s*\((\d+)\)\s*\/\s*\((\d+)\)$/, '$1 $2/$3')
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
 *
 * Commas, and a closing question mark or full stop, are the exception. A prose comma is forgiven whichever side has it, because
 * whether a sentence carries one is style, not the answer: "quand j'étais petit, je
 * jouais" typed without its comma is the same French. Requiring the author's commas
 * failed hundreds of French answers typed without them. `strictCommas` keeps them for
 * exact program output (`matchCase`) and SQL, where a comma is syntax. A comma between
 * two digits is never prose, so a list of numbers keeps its separators either way.
 * Both arguments are already normalised.
 */
/**
 * The letters of an answer word by word, case kept: what `matchCase` compares. A
 * `matchCase` answer is exact program output, where "Hi Amy!" and "HiAmy!" differ as
 * much as T and t do, so the breaks between words count too. Normalising drops every
 * space, which is right for "3 x" and "3x" but passed "Fail Pass" for "FailPass".
 */
function lettersByWord(s: string): string {
  return s.trim().split(/\s+/).map((w) => w.replace(/[^\p{L}]/gu, '')).filter(Boolean).join(' ')
}

function matchesAccepted(given: string, accepted: string, strictCommas = false): boolean {
  if (given === accepted) return true
  let lenient = given
  // A statement terminator counts as closing punctuation: SQL is often typed with one.
  if (!/[.!?;]$/.test(accepted)) lenient = lenient.replace(/[.!?;]+$/, '')
  // SQL takes a text value in either kind of quote. Only SQL: in pseudo-code and program
  // output the two quote marks are different things.
  if (/^(select|insert|update|delete)/.test(accepted)) lenient = lenient.replace(/"/g, "'")
  // Quotes round the whole answer mark it as a string; they are not part of it unless the
  // accepted answer has them too, as when a program prints the quote marks.
  if (!/^["']/.test(accepted)) lenient = lenient.replace(/^(["'])(.+)\1$/, '$2')
  if (strictCommas || /^(select|insert|update|delete)/.test(accepted)) {
    if (stripProseCommas(accepted) === accepted) lenient = stripProseCommas(lenient)
    return lenient === accepted
  }
  // A closing question mark or full stop is prose punctuation too: "vous pourriez me dire
  // où est la gare ?" typed without its question mark is the same answer. An exclamation
  // mark is kept, because in program output it is part of what is printed.
  const prose = (t: string) => stripProseCommas(t).replace(/[.?]+$/, '')
  return prose(lenient) === prose(accepted)
}

/** Letters without their accents: é to e, ç to c. */
function withoutAccents(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC')
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
 * The parts of a list answer: "nitrogen, phosphorus and potassium" is three parts. Split on
 * commas, semicolons, "and" and "&" between words, never inside a number such as 1,000.
 * Returns the normalised parts, or null when the text is not a list of two or more.
 */
function listParts(raw: string): string[] | null {
  const parts = raw
    .replace(/[.!]+\s*$/, '')
    .split(/\s*(?:,(?!\d)|;|&|\band\b)\s*/i)
    .map((p) => normaliseText(p.replace(/^\s*(the|an?)\s+/i, '')))
    .filter(Boolean)
  return parts.length >= 2 ? parts : null
}

/**
 * A list typed in a different order: "potassium, nitrogen, phosphorus" for the accepted
 * "nitrogen, phosphorus and potassium", or "Fe3+ and Fe2+". Only when the accepted answer
 * is itself a list of short items, at most three words each, and the two lists hold
 * exactly the same items. Four kinds of list keep their order, because in them the order
 * is the answer:
 *
 * - an equation, whose two sides must not swap (an arrow, = or an inequality);
 * - anything whose items start with a number: a sorted list, a vector, a coordinate, a
 *   ratio, or run-length pairs like "4a, 3b, 1c";
 * - a question that asks for the items in order, like the fetch-decode-execute cycle;
 * - a fill-in-the-blanks question, where each word belongs in its own gap.
 */
function sameListAnyOrder(rawGiven: string, rawAccepted: string, prompt: string): boolean {
  if (/->|→|=|[<>]/.test(rawAccepted)) return false
  if (/\bin order\b|_{3,}/i.test(prompt)) return false
  const accepted = listParts(rawAccepted)
  if (!accepted) return false
  const items = rawAccepted.replace(/[.!]+\s*$/, '').split(/\s*(?:,(?!\d)|;|&|\band\b)\s*/i).map((p) => p.trim()).filter(Boolean)
  if (items.some((p) => p.split(/\s+/).length > 3 || /^[-−(\[]?\d/.test(p))) return false
  const given = listParts(rawGiven)
  if (!given || given.length !== accepted.length) return false
  const a = [...accepted].sort(), g = [...given].sort()
  return a.every((x, i) => x === g[i])
}

/**
 * A genotype is the one place where capital and small letters are the answer: Bb is
 * heterozygous, BB and bb are the two homozygotes. Everything else here is compared with
 * case folded away, which marked "BB" right for "Bb". A genotype is recognised as a word
 * made of letter pairs, each pair one letter twice, at least one pair mixing the cases
 * (Bb, BbTt). Names, SQL and French sentences mix cases too, but never in that shape.
 * A homozygote (BB, bb) has the same shape as any doubled letter, so it only counts as a
 * genotype when the prompt says the answer is one.
 * Every genotype in the accepted answer must appear in the typed one with its case intact.
 */
function genotypes(s: string, prompt: string): string[] {
  const asked = /genotype|homozygous|heterozygous|allele/i.test(prompt)
  return s.split(/[^A-Za-z]+/).filter((w) => {
    if (w.length < 2 || w.length % 2 !== 0) return false
    const pairs = w.match(/../g)!
    if (!pairs.every((p) => p[0]!.toLowerCase() === p[1]!.toLowerCase())) return false
    return asked || pairs.some((p) => p[0] !== p[1])
  })
}

function genotypesMatch(rawGiven: string, rawAccepted: string, prompt: string): boolean {
  const words = new Set(rawGiven.split(/[^A-Za-z]+/))
  return genotypes(rawAccepted, prompt).every((g) => words.has(g))
}

/** Whether a typed answer matches any of `list`, with every allowance the marker makes. */
function matchesShortText(question: Extract<Question, { type: 'short-text' }>, raw: string, list: string[]): boolean {
  const given = normaliseText(raw)
  if (given.length === 0) return false
  const strict = question.matchCase === true
  // An accepted list that holds an answer and its accent-free twin says accents are
  // not being marked. Then a half-accented answer ("je suis née a londres") is as right
  // as either twin, so compare with the accents folded away on both sides.
  const accentFree = question.accepted.some((a, i) => withoutAccents(a) !== a && question.accepted.some((b, j) => j !== i && normaliseText(b) === normaliseText(withoutAccents(a))))
  return list.some((a) => {
    if (!genotypesMatch(raw, a, question.prompt)) return false
    if (strict && lettersByWord(raw) !== lettersByWord(a)) return false
    const accepted = normaliseText(a)
    if (matchesAccepted(given, accepted, strict)) return true
    if (accentFree && matchesAccepted(normaliseText(withoutAccents(raw)), normaliseText(withoutAccents(a)), strict)) return true
    const bare = withoutArticle(raw, a)
    if (bare !== null && matchesAccepted(normaliseText(bare[0]), normaliseText(bare[1]), strict)) return true
    // The same algebra in another order: (x - 2)(x + 1) for (x + 1)(x - 2), 3 <= x for x >= 3.
    if (!strict && sameAlgebra(given, accepted, a)) return true
    if (!strict && sameMathsAnswer(raw, a, question.prompt)) return true
    if (!strict && sameRearrangement(raw, a, question.prompt)) return true
    return sameListAnyOrder(raw, a, question.prompt)
  })
}

/** One side of an answer as the maths comparisons read it: no spaces, one minus, one way of writing ⩽ and √. */
function mathsText(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '').replace(/[−–—]/g, '-').replace(/[⩽≤]/g, '<=').replace(/[⩾≥]/g, '>=')
    .replace(/\+\/?-|\\pm/g, '±').replace(/sqrt/g, '√')
    // √(29) and √29 are one number: brackets round a plain number under a root say nothing.
    .replace(/√\((\d+)\)/g, '√$1')
}

/** A chain inequality turned to face one way: 3>x>2 is 2<x<3, and 3>=x>=1 is 1<=x<=3. */
function chainFacingUp(s: string): string {
  const m = s.match(/^([^<>=]+)(>=?)([a-z])(>=?)([^<>=]+)$/)
  return m ? `${m[5]}${m[4]!.replace('>', '<')}${m[3]}${m[2]!.replace('>', '<')}${m[1]}` : s
}

/**
 * The value of a plain numeric expression: digits, + − × ÷ ^, brackets and √. Undefined for
 * anything with a letter in it, so it never guesses at algebra.
 */
function numericValue(s: string): number | undefined {
  const src = s.replace(/×/g, '*').replace(/÷/g, '/')
  if (!/^[-+*/^().\d√]+$/.test(src)) return undefined
  let i = 0
  const peek = () => src[i]
  const expr = (): number => { let v = term(); while (peek() === '+' || peek() === '-') { const op = src[i++]; const t = term(); v = op === '+' ? v + t : v - t } return v }
  const term = (): number => { let v = power(); while (peek() === '*' || peek() === '/' || /[\d(√]/.test(peek() ?? '')) { const op = peek() === '*' || peek() === '/' ? src[i++] : '*'; const t = power(); v = op === '/' ? v / t : v * t } return v }
  const power = (): number => { const b = unary(); if (peek() === '^') { i++; return b ** power() } return b }
  const unary = (): number => { if (peek() === '-') { i++; return -unary() } if (peek() === '+') { i++; return unary() } return atom() }
  const atom = (): number => {
    if (peek() === '√') { i++; return Math.sqrt(atom()) }
    if (peek() === '(') { i++; const v = expr(); if (src[i++] !== ')') throw new Error('bracket'); return v }
    const m = src.slice(i).match(/^\d+(?:\.\d+)?/)
    if (!m) throw new Error('number')
    i += m[0].length
    return Number(m[0])
  }
  try {
    const v = expr()
    return i === src.length && Number.isFinite(v) ? v : undefined
  } catch {
    return undefined
  }
}

/** The values in a list of solutions: "x = 3 or x = -3", "3, -3", "x = ±3", "-4 and 2". */
function solutionItems(raw: string): string[] {
  return raw.split(/\s*(?:,(?!\d{3}\b)|;|\bor\b|\band\b)\s*/i).map(mathsText).filter(Boolean)
    .map((p) => p.replace(/^[a-z]=/, ''))
    .flatMap((p) => (p.startsWith('±') ? [p.slice(1), `-${p.slice(1)}`] : [p]))
}

/**
 * Maths answers written another correct way, where the accepted list cannot hold them all
 * (8 October 2026). Each was found marked wrong on a written question:
 * - a chain inequality turned round: 3 > x > 2 for 2 < x < 3;
 * - the solutions of an equation in any order and layout: "x = 2, x = -4", "-4 and 2",
 *   "x = ±3", and one solution with its "x =" in front;
 * - the same number written differently, (√29-3)/2 for (-3+√29)/2, but only where the
 *   question does not ask for a form. "Simplest form", "simplify" or "exact" mean the form is
 *   the answer, so 26/48 for 13/24 and √24 for 2√6 stay wrong.
 * Lists are compared as sets only for a question that asks to solve, or for roots, solutions
 * or values of a letter: elsewhere, such as a program's output, order is the answer.
 */
function sameMathsAnswer(raw: string, accepted: string, prompt: string): boolean {
  const a = mathsText(accepted)
  if (/[<>]/.test(a)) return chainFacingUp(mathsText(raw)) === chainFacingUp(a)
  if (!/\bsolve\b|\broots?\b|\bsolutions?\b|\bvalues? of [a-z]\b/i.test(prompt)) return false
  // "Surd form", "as a fraction" and "in terms of π" ask for a form as much as "simplest" does.
  const formAsked = /simplest|lowest terms|simplif|exact|in the form|surd|in terms of|as an? (?:fraction|decimal|mixed number|power|multiple)|standard form/i.test(prompt)
  const same = (g: string, x: string) => {
    if (g === x) return true
    if (formAsked) return false
    const gv = numericValue(g), xv = numericValue(x)
    return gv !== undefined && xv !== undefined && Math.abs(gv - xv) < 1e-9
  }
  const want = solutionItems(accepted)
  const got = solutionItems(raw)
  if (want.length === 0 || got.length !== want.length) return false
  const left = [...want]
  for (const g of got) {
    const k = left.findIndex((x) => same(g, x))
    if (k < 0) return false
    left.splice(k, 1)
  }
  return true
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
      if (question.listen?.dictation) {
        // Word by word against what was read out: see dictation.ts. The validator holds the
        // first accepted answer to the same words.
        // Other accepted answers are spellings the board also takes, or a wording that sounds
        // the same (plait for plaît): the best of them counts. Missed words are always shown
        // against the sentence that was read out.
        const said = question.listen.text
        const best = question.accepted.map((a) => markDictation(a, raw, available)).sort((x, y) => Number(y.correct) - Number(x.correct) || y.marksScored - x.marksScored)[0]!
        const missed = best.correct ? [] : dictationDiff(said, raw).flatMap((d, i) => (d.ok ? [] : [i]))
        return { ...best, marksAvailable: available, ...(missed.length ? { missed } : {}) }
      }
      if (matchesShortText(question, raw, question.accepted)) return result(true)
      const part = question.partial?.filter((p) => matchesShortText(question, raw, [p.answer])) ?? []
      const marksScored = Math.min(available - 1, Math.max(0, ...part.map((p) => p.marks)))
      return { correct: false, marksScored, marksAvailable: available }
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

/** The longest answer kept on a record. Enough for any GCSE answer, bounded for storage. */
const ANSWER_LIMIT = 200

/**
 * What the student gave, written out so a person can read it back later.
 *
 * Stored as **text** rather than as the raw answer. For a multiple choice question the
 * raw answer is an index into the options, and an index outlives the thing it points at:
 * if the question is ever re-generated with its options in a different order, a stored
 * index silently starts describing a different answer, while stored text still says what
 * was chosen. The same argument applies to an ordering question's items.
 *
 * Returns undefined when there is nothing meaningful to keep — an extended answer is
 * self-assessed against a mark scheme rather than typed in.
 */
export function describeAnswer(question: Question, answer: unknown): string | undefined {
  const clip = (s: string) => (s.length > ANSWER_LIMIT ? `${s.slice(0, ANSWER_LIMIT - 1)}…` : s)
  switch (question.type) {
    case 'multiple-choice': {
      if (!Array.isArray(answer)) return undefined
      const picked = (answer as number[]).map((i) => question.options[i]).filter((o): o is string => typeof o === 'string')
      return picked.length ? clip(picked.join(', ')) : undefined
    }
    case 'ordering': {
      if (!Array.isArray(answer)) return undefined
      const order = (answer as number[]).map((i) => question.items[i]).filter((o): o is string => typeof o === 'string')
      return order.length ? clip(order.join(' → ')) : undefined
    }
    case 'numeric':
    case 'short-text':
    case 'labelling': {
      const text = typeof answer === 'string' ? answer.trim()
        : Array.isArray(answer) ? answer.filter((x) => typeof x === 'string' || typeof x === 'number').join(', ')
        : ''
      return text ? clip(text) : undefined
    }
    default:
      return undefined
  }
}

/**
 * The answer a question was looking for, written out so it can be shown beside what the
 * student gave. Not the mark scheme and not the worked solution — just the answer, which
 * is what somebody comparing the two needs first.
 */
/** The letter a prompt asks to be made the subject: "make $m$ the subject of". */
function subjectLetter(prompt: string): string | undefined {
  return /make\s+\$?\\?\(?([a-z])\)?\$?\s+the\s+subject/i.exec(prompt)?.[1]?.toLowerCase()
}

/** The top-level terms of a sum, each with its sign: "-8n-1" is [["-", "8n"], ["-", "1"]]. */
function termsOf(s: string): [string, string][] {
  const out: [string, string][] = []
  let depth = 0, sign = '+', from = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!
    if (c === '(') depth++
    else if (c === ')') depth--
    else if ((c === '+' || c === '-') && depth === 0 && !/[(^*/+-]/.test(s[i - 1] ?? '(')) {
      if (i > from) out.push([sign, s.slice(from, i)])
      sign = c
      from = i + 1
    } else if ((c === '+' || c === '-') && depth === 0 && i === 0) {
      sign = c
      from = 1
    }
  }
  if (s.length > from) out.push([sign, s.slice(from)])
  return out
}

const wholeBracket = (s: string) => {
  if (!s.startsWith('(') || !s.endsWith(')')) return false
  let depth = 0
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++
    else if (s[i] === ')' && --depth === 0 && i < s.length - 1) return false
  }
  return true
}

/**
 * One side of a fraction with its sign pushed inside: -(8n+1) is (-8n-1). Null when the
 * side is a sum that is not bracketed, since 8n+1/3 is not a fraction with 8n+1 on top.
 */
function sideOf(s: string, negate: boolean): string | null {
  let t = s, neg = negate
  if (t.startsWith('-') && wholeBracket(t.slice(1))) { t = t.slice(1); neg = !neg }
  const inner = wholeBracket(t) ? t.slice(1, -1) : t
  const terms = termsOf(inner)
  if (terms.length === 0 || (terms.length > 1 && !wholeBracket(t))) return null
  const flipped = terms.map(([sign, body], i) => `${(sign === '-') !== neg ? '-' : i === 0 ? '' : '+'}${body}`).join('')
  return terms.length > 1 ? `(${flipped})` : flipped
}

/** A fraction and the same fraction with both its top and bottom negated: (8n+1)/(3-n) and (-8n-1)/(n-3). */
function fractionForms(s: string): string[] {
  let depth = 0, at = -1
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '(') depth++
    else if (c === ')') depth--
    else if (c === '/' && depth === 0) { if (at >= 0) return []; at = i }
  }
  if (at < 0) return []
  const num = s.slice(0, at), den = s.slice(at + 1)
  const forms: string[] = []
  for (const neg of [false, true]) {
    const n = sideOf(num, neg), d = sideOf(den, neg)
    if (n !== null && d !== null) forms.push(`${n}/${d}`)
  }
  return forms
}

/**
 * A rearranged formula in another right form. The accepted answer is written one way,
 * m = (-8n-1)/(n-3), and the student who took the other route to it, m = (8n+1)/(3-n), was
 * marked wrong, as was m = -(8n+1)/(n-3): a fraction is the same fraction with both its
 * top and bottom negated, or with the minus taken outside. The "m =" in front counts for
 * nothing where the prompt says what the subject is, so the marker stops caring whether
 * the student wrote it. Only fractions whose top and bottom are each one term or a bracket
 * are read this way: 8n+1/3 is not (8n+1)/3.
 */
function sameRearrangement(raw: string, accepted: string, prompt: string): boolean {
  const subject = subjectLetter(prompt)
  const strip = (t: string) => { const m = normaliseText(t); return subject && m.startsWith(`${subject}=`) ? m.slice(2) : m }
  const g = strip(raw), a = strip(accepted)
  if (/[=<>]/.test(g) || /[=<>]/.test(a)) return false
  const same = (x: string, y: string) => x === y || sameAlgebra(x, y, y)
  if (subject && same(g, a)) return true
  const gs = fractionForms(g), as = fractionForms(a)
  return gs.some((x) => as.some((y) => same(x, y)))
}

/**
 * A numeric answer as it is read: money as £3481.60, not "3481.6 £", a percentage as 25%, an
 * angle as 60°, and anything else with its unit after it. The unit a numeric question carries
 * is the one its answer box shows after the number, which is why "£" was printed there.
 */
export function numericText(answer: number, units?: string, places?: number): string {
  if (units === '£') return `£${Number.isInteger(answer * 100) ? answer.toFixed(2) : answer}`
  const n = places !== undefined && Number.isInteger(answer * 10 ** places) ? answer.toFixed(places) : String(answer)
  if (units === '%' || units === '°') return `${n}${units}`
  return units ? `${n} ${units}` : n
}

/** The decimal places a prompt asks for ("to 2 decimal places", "1 d.p."), so the answer is shown with them: 8.60, not 8.6. */
export function decimalPlacesAsked(prompt: string): number | undefined {
  const m = /\b(\d|one|two|three)\s+decimal\s+places?\b/i.exec(prompt) ?? /\b(\d)\s*d\.?\s*p\b/i.exec(prompt)
  if (!m) return undefined
  const words: Record<string, number> = { one: 1, two: 2, three: 3 }
  return words[m[1]!.toLowerCase()] ?? Number(m[1])
}

export function expectedAnswer(question: Question): string | undefined {
  switch (question.type) {
    case 'multiple-choice':
      return question.correct.map((i) => question.options[i]).filter((o): o is string => typeof o === 'string').join(', ') || undefined
    case 'ordering':
      return question.items.join(' → ')
    case 'numeric':
      return numericText(question.answer, question.units, decimalPlacesAsked(question.prompt))
    case 'short-text':
      return question.accepted[0]
    case 'labelling':
      return question.labels.map((l) => l.text).join(', ')
    default:
      // An extended answer is judged against criteria, so there is no single right answer.
      return undefined
  }
}
