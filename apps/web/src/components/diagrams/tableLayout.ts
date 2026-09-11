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
