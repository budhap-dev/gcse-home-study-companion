import type { Question } from './content/questions.ts'

export interface MarkResult {
  correct: boolean
  marksScored: number
  marksAvailable: number
  /**
   * The marker said no and the student said their answer meant the same as the model
   * answer. Counted as right, and recorded as self-marked so a parent can see it was.
   */
  claimed?: boolean
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
  return out
    .replace(/\s+/g, '')
    .replace(/[−–—]/g, '-')
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
    .replace(/√\(([^)]+)\)/g, 'sqrt$1')
    .replace(/√/g, 'sqrt')
    .replace(/root/g, 'sqrt')
    .replace(/sqrt\(([^)]+)\)/g, 'sqrt$1')
    // A times sign is dropped, so 3*x is 3x. In SQL the star is the whole column list:
    // dropping it would pass SELECT FROM Student for SELECT * FROM Student.
    .replace(/\*/g, (star, _at: number, whole: string) => (/^(select|insert|update|delete)/.test(whole) ? star : ''))
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
  // A magnification is written ×400 or x400, and sometimes 400×: the sign says "times"
  // and is not part of the number. Only a sign against the digits at either end counts,
  // so 1.8 × 10^5 in the middle is still standard form.
  s = s.replace(/^[x×]\s*(?=\d)/, '').replace(/(?<=\d)\s*×$/, '')
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
/**
 * The letters of an answer word by word, case kept: what `matchCase` compares. A
 * `matchCase` answer is exact program output, where "Hi Amy!" and "HiAmy!" differ as
 * much as T and t do, so the breaks between words count too. Normalising drops every
 * space, which is right for "3 x" and "3x" but passed "Fail Pass" for "FailPass".
 */
function lettersByWord(s: string): string {
  return s.trim().split(/\s+/).map((w) => w.replace(/[^\p{L}]/gu, '')).filter(Boolean).join(' ')
}

function matchesAccepted(given: string, accepted: string): boolean {
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
        if (!genotypesMatch(raw, a, question.prompt)) return false
        if (question.matchCase && lettersByWord(raw) !== lettersByWord(a)) return false
        const accepted = normaliseText(a)
        if (matchesAccepted(given, accepted)) return true
        const bare = withoutArticle(raw, a)
        if (bare !== null && matchesAccepted(normaliseText(bare[0]), normaliseText(bare[1]))) return true
        return sameListAnyOrder(raw, a, question.prompt)
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
export function expectedAnswer(question: Question): string | undefined {
  switch (question.type) {
    case 'multiple-choice':
      return question.correct.map((i) => question.options[i]).filter((o): o is string => typeof o === 'string').join(', ') || undefined
    case 'ordering':
      return question.items.join(' → ')
    case 'numeric':
      return question.units ? `${question.answer} ${question.units}` : String(question.answer)
    case 'short-text':
      return question.accepted[0]
    case 'labelling':
      return question.labels.map((l) => l.text).join(', ')
    default:
      // An extended answer is judged against criteria, so there is no single right answer.
      return undefined
  }
}
