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
