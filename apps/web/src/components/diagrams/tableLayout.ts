/**
 * Layout rules for the table diagram, kept pure so a test can hold every table in the
 * content pack to them. Widths come from the longest text in each column, up to a cap;
 * anything longer than the cap allows wraps onto more lines and the row grows to fit.
 *
 * Before wrapping, a cell longer than about 31 characters simply ran past its column in
 * both directions and was cut off by the edge of the drawing, silently, in 60 cells.
 */
export const CHAR_WIDTH = 7
export const CELL_PADDING = 22
export const MIN_COLUMN = 56
export const MAX_COLUMN = 240
export const LINE_HEIGHT = 15
/** One line plus this padding gives the original 26px row, so short tables look unchanged. */
const ROW_PADDING = 11

/** Each column is as wide as its longest text needs, up to MAX_COLUMN. */
export function columnWidths(columns: string[], rows: string[][]): number[] {
  return columns.map((c, i) =>
    Math.max(MIN_COLUMN, Math.min(MAX_COLUMN, CHAR_WIDTH * Math.max(c.length, ...rows.map((r) => (r[i] ?? '').length)) + CELL_PADDING)),
  )
}

/** How many characters fit on one line of a column this wide. */
export function charBudget(width: number): number {
  return Math.max(1, Math.floor((width - CELL_PADDING) / CHAR_WIDTH))
}

/**
 * Greedy word wrap. A cell that already fits is returned exactly as written, so a trace
 * table showing a string value keeps its spacing. A single word longer than the budget
 * keeps a line of its own rather than being split mid-word.
 */
export function wrapCell(text: string, budget: number): string[] {
  if (text.length <= budget) return [text]
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ').filter(Boolean)) {
    if (!line) line = word
    else if (line.length + 1 + word.length <= budget) line += ' ' + word
    else {
      lines.push(line)
      line = word
    }
  }
  lines.push(line)
  return lines
}

/** A row tall enough for its tallest cell. */
export function rowHeight(lines: number): number {
  return Math.max(1, lines) * LINE_HEIGHT + ROW_PADDING
}

/**
 * The width a table wants, in viewBox units, from the column widths above. This is a
 * LOWER bound on what it actually renders at: useFitSvgText widens the viewBox when real
 * glyphs overflow, and the bold header font is wider than CHAR_WIDTH assumes — the colour
 * table in Shopping for clothes estimates 434 and renders 512. So never use it to decide
 * that a table is narrow enough for something; only to catch one that is far too wide.
 */
export function naturalWidth(columns: string[], rows: string[][]): number {
  return columnWidths(columns, rows).reduce((a, b) => a + b, 0) + 2
}

/** Measured in the browser: the SVG box a visual gets with the row to itself. */
export const FULL_ROW = 742
/** And the box it gets when two visuals share the row. */
export const HALF_ROW = 350
/** The table's text, which scales with the rest of the drawing. */
export const TEXT_PX = 12
/** Below this the text stops being legible. */
export const MIN_TEXT_PX = 10

/**
 * The widest a table may be and still render its text at MIN_TEXT_PX in a full row.
 * Because naturalWidth is a lower bound, a table close to this may still fall slightly
 * under; the browser measurement in the scratchpad is the final word.
 */
export const MAX_TABLE_WIDTH = Math.floor((FULL_ROW * TEXT_PX) / MIN_TEXT_PX)

/** The padding and the narrowest column a table closes up to when nothing else fits. */
export const TIGHT_PADDING = 10
export const TIGHT_COLUMN = 24

/** The width a column needs so its longest single word never has to break. */
function wordFloor(columns: string[], rows: string[][], i: number, padding = CELL_PADDING, least = MIN_COLUMN): number {
  const words = [columns[i] ?? '', ...rows.map((r) => r[i] ?? '')].flatMap((t) => t.split(' '))
  return Math.max(least, CHAR_WIDTH * Math.max(0, ...words.map((w) => w.length)) + padding)
}

/**
 * Column widths for a table that has `available` units to fill, as it has on a phone.
 *
 * Laid out from its content alone, a comparison table of three wordy columns wants 700
 * units, and a phone card has about 330: the drawing will not shrink below its natural
 * width (that would take its text under 10px), so it scrolled, and the last column sat
 * off to the right where a student reading down the table never saw it. In Biology alone
 * 155 tables did this by more than 150px.
 *
 * So the table reflows instead. The widest columns give way first, all of them down to a
 * common cap, so a narrow column of short values keeps its width and the long prose
 * columns wrap onto more lines. No column goes below its longest word, since a word is
 * never split. A table that already fits is returned exactly as before.
 *
 * A table of many short columns has no prose to wrap: a byte's place values are nine
 * columns of one to three characters, and at MIN_COLUMN each they wanted 504 units and
 * scrolled 175px on a phone with the low bits out of sight. So when the word floors
 * still do not fit, the padding round each word gives way too, down to TIGHT_PADDING
 * and TIGHT_COLUMN. Cell text is centred, so the gap shrinks evenly on both sides. Only
 * a table that cannot fit even then takes its tightest layout and scrolls the rest.
 */
export function fitColumns(columns: string[], rows: string[][], available: number): number[] {
  const natural = columnWidths(columns, rows)
  const target = available - 2
  if (natural.reduce((a, b) => a + b, 0) <= target) return natural
  const floors = natural.map((w, i) => Math.min(w, wordFloor(columns, rows, i)))
  const at = (cap: number) => natural.map((w, i) => Math.max(floors[i]!, Math.min(w, cap)))
  const total = (cap: number) => at(cap).reduce((a, b) => a + b, 0)
  if (total(0) >= target) {
    // Every column is at its longest word; close the padding up, all columns by the same
    // share of what each can give, until the table fits or nothing is left to give.
    const tight = floors.map((w, i) => Math.min(w, wordFloor(columns, rows, i, TIGHT_PADDING, TIGHT_COLUMN)))
    const give = total(0) - tight.reduce((a, b) => a + b, 0)
    const share = give > 0 ? Math.min(1, (total(0) - target) / give) : 0
    return floors.map((w, i) => Math.floor(w - share * (w - tight[i]!)))
  }
  let lo = 0
  let hi = Math.max(...natural)
  while (hi - lo > 0.5) {
    const mid = (lo + hi) / 2
    if (total(mid) > target) hi = mid
    else lo = mid
  }
  return at(lo).map(Math.floor)
}

/**
 * A token whose exact form matters and must never be hyphenated: a number (so a phone
 * never shows "-0-" over ".25" for -0.25, which reads as a different value), or anything
 * short enough that splitting it would not save room worth having. Letters-only prose is
 * the only thing forceColumns is ever allowed to break.
 */
export function isAtomic(word: string): boolean {
  return word.length <= 2 || /\d/.test(word)
}

/** Like wordFloor, but only over the tokens forceColumns may never shrink past. */
function atomicFloor(columns: string[], rows: string[][], i: number, padding: number, least: number): number {
  const words = [columns[i] ?? '', ...rows.map((r) => r[i] ?? '')].flatMap((t) => t.split(' '))
  const atoms = words.filter(isAtomic)
  // A compound's parts, each with its hyphen, are never broken either: "orange-brown" is
  // the exact colour a student has to write, and split as "oran-" "ge-" "brown" it reads
  // as three words. Compounds are rare, so this costs a column little.
  const parts = words.filter((w) => /\p{L}-\p{L}/u.test(w)).flatMap((w) => w.split(/(?<=-)/))
  return Math.max(least, CHAR_WIDTH * Math.max(0, ...[...atoms, ...parts].map((w) => w.length)) + padding)
}

/** The padding forceColumns closes right up to: it is only ever reached once TIGHT_PADDING has already failed to fit. */
export const FORCE_PADDING = 4

/**
 * Split a single word that still will not fit, breaking it with a hyphen rather than
 * running it past the edge of its column. A comparison across five columns (Hormones and
 * the endocrine system: thyroxine, blood glucose, temperature and water side by side) can
 * repeat a word like "hypothalamus" in several columns; five columns can never each show
 * that whole, so fitColumns' own tight floor still totals more than a phone allows and the
 * table would scroll past 296 with the word itself the reason. Never called on an atomic
 * token (wrapCellForced screens those out first), and never reached by an ordinary table.
 * The break goes at an existing hyphen, else at a syllable-like boundary, leaving at least
 * three letters each side: cutting wherever the line ran out gave "hydroge-n" and
 * "chlori-ne" on the first phone layout.
 */
export function hardBreak(word: string, budget: number): string[] {
  if (budget < 2 || word.length <= budget) return [word]
  // A hyphen the word already has is the best place of all, and adds nothing: break there
  // first, then break each part on its own, so "orange-brown" never becomes "e-b-".
  const parts = word.split(/(?<=-)(?=.)/)
  if (parts.length > 1) return parts.flatMap((part) => hardBreak(part, budget))
  const lines: string[] = []
  let rest = word
  while (rest.length > budget) {
    const most = Math.min(budget - 1, rest.length - MIN_PIECE)
    let cut = -1
    for (let k = most; k >= Math.max(MIN_PIECE, Math.ceil((budget - 1) / 2)); k--) {
      if (syllableCut(rest, k)) { cut = k; break }
    }
    if (cut < 0) cut = most >= MIN_PIECE ? most : budget - 1
    lines.push(rest.slice(0, cut) + '-')
    rest = rest.slice(cut)
  }
  lines.push(rest)
  return lines
}

/** Neither piece of a broken word is shorter than this, where the word allows it: no "hydroge-n". */
const MIN_PIECE = 3
const VOWEL = /[aeiouy]/i
/** Consonant pairs that sound as one, and so are never split. */
const DIGRAPHS = new Set(['th', 'ch', 'sh', 'ph', 'wh', 'ck', 'gh', 'qu', 'ng'])

/**
 * Whether a break between word[k - 1] and word[k] falls where a reader expects a syllable
 * to end: between two consonants that are not a digraph (Ques-tion, potas-sium), or after a
 * vowel before a consonant that starts the next syllable (hydro-gen, chlo-rine). Not
 * dictionary hyphenation, but it never leaves a lone letter or splits "th".
 */
function syllableCut(word: string, k: number): boolean {
  const a = word[k - 1] ?? '', b = word[k] ?? '', c = word[k + 1] ?? ''
  if (!/[a-z]/i.test(a) || !/[a-z]/i.test(b)) return false
  const va = VOWEL.test(a), vb = VOWEL.test(b)
  if (!va && !vb) return !DIGRAPHS.has((a + b).toLowerCase())
  if (va && !vb) return VOWEL.test(c) && !DIGRAPHS.has((b + c).toLowerCase())
  return false
}

/**
 * wrapCell, but a line that is still one word too long for the budget afterwards is
 * hyphenated instead of left to overflow — unless that word is atomic, which is left
 * whole and only ever overflows if forceColumns has not already made room for it (it
 * always has). Everything that already wrapped cleanly is returned exactly as wrapCell
 * would.
 */
export function wrapCellForced(text: string, budget: number): string[] {
  return wrapCell(text, budget).flatMap((line) => (line.length <= budget || line.includes(' ') || isAtomic(line) ? [line] : hardBreak(line, budget)))
}

/**
 * Squeezes every column to fit `available` even past fitColumns' own word floor, for the
 * rare table fitColumns itself says will still scroll (five columns of prose, or a value
 * table with nine narrow columns of numbers). A column never gives up the room its
 * numbers need — atomicFloor, not wordFloor — so a number is never the thing that gets
 * hyphenated; wrapCellForced then hyphenates whichever prose word no longer fits.
 *
 * If even every column at its numbers' floor is wider than a phone (nine columns each
 * needing at least a two-decimal reading), that is returned as the least-bad width and
 * the table is left to scroll: no prop here can make numbers narrower than their digits.
 */
export function forceColumns(columns: string[], rows: string[][], natural: number[], available: number): number[] {
  const target = available - 2
  const total = natural.reduce((a, b) => a + b, 0)
  if (total <= target) return natural
  const hardFloor = natural.map((w, i) => Math.min(w, atomicFloor(columns, rows, i, FORCE_PADDING, TIGHT_COLUMN)))
  const floorSum = hardFloor.reduce((a, b) => a + b, 0)
  if (floorSum >= target) return hardFloor
  // Every column keeps its floor, then whatever room is left over is shared out in
  // proportion to how much each column would still like beyond its floor — the DNA base
  // pairing table's nine one-letter columns want almost none of it, so "Original strand"
  // and "Complement" get most of what is left, rather than an equal ninth each.
  const excess = natural.map((w, i) => w - hardFloor[i]!)
  const excessSum = excess.reduce((a, b) => a + b, 0)
  const share = excessSum > 0 ? (target - floorSum) / excessSum : 0
  return hardFloor.map((f, i) => Math.floor(f + share * excess[i]!))
}

/** charBudget, but for a column forceColumns closed up to FORCE_PADDING rather than CELL_PADDING. */
export function forcedCharBudget(width: number): number {
  return Math.max(1, Math.floor((width - FORCE_PADDING) / CHAR_WIDTH))
}
