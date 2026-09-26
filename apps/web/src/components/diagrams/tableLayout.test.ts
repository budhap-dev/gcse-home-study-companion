import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { everyVisual } from '@study/shared'
import { describe, expect, it } from 'vitest'
import { CHAR_WIDTH, FULL_ROW, TIGHT_PADDING, MAX_TABLE_WIDTH, MIN_TEXT_PX, TEXT_PX, charBudget, columnWidths, fitColumns, forceColumns, hardBreak, isAtomic, naturalWidth, rowHeight, wrapCell, wrapCellForced } from './tableLayout.ts'

const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content')
const CONTENT = ROOT

function jsonFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? jsonFiles(full) : name.endsWith('.json') ? [full] : []
  })
}

describe('wrapCell', () => {
  it('keeps every word, in order, and no line over the budget', () => {
    const text = 'one loud chord from the whole orchestra, then brass fanfare'
    const lines = wrapCell(text, 31)
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.join(' ')).toBe(text)
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(31)
  })

  it('returns a cell that already fits exactly as written, spacing included', () => {
    expect(wrapCell('x = 3', 31)).toEqual(['x = 3'])
    expect(wrapCell("'a  b'", 31)).toEqual(["'a  b'"])
    expect(wrapCell('', 31)).toEqual([''])
  })

  it('gives a one-line row the original 26px height', () => {
    expect(rowHeight(1)).toBe(26)
    expect(rowHeight(3)).toBeGreaterThan(rowHeight(1))
  })
})

/**
 * The browser walk cannot see clipped text: nothing errors, the words are simply cut off
 * at the edge of the drawing. Before wrapping, 60 cells across 10 topics were clipped this
 * way. This holds every table in the pack to the layout rules, so it cannot recur.
 */
describe('every table in the content pack fits its columns', () => {
  const overflow: string[] = []
  let tables = 0
  const check = (visual: { type: string; component?: string; props?: Record<string, unknown> }, where: string) => {
    if (visual.type !== 'diagram' || visual.component !== 'trace-table') return
    tables++
    const columns = (visual.props?.columns as string[] | undefined) ?? []
    const rows = (visual.props?.rows as string[][] | undefined) ?? []
    const budgets = columnWidths(columns, rows).map(charBudget)
    const cells = [columns, ...rows]
    for (const row of cells) {
      row.forEach((text, i) => {
        const lines = wrapCell(text ?? '', budgets[i]!)
        // Only a single word longer than the column can still overflow; flag that.
        for (const line of lines) if (line.length > budgets[i]! && line.includes(' ')) overflow.push(`${where}: "${line}"`)
        for (const line of lines) if (line.length > budgets[i]! && !line.includes(' ')) overflow.push(`${where}: a single word too long for its column: "${line}"`)
        expect(lines.join(' ').split(/\s+/).filter(Boolean)).toEqual((text ?? '').split(/\s+/).filter(Boolean))
      })
    }
  }
  for (const file of jsonFiles(ROOT)) {
    const topic = JSON.parse(readFileSync(file, 'utf8'))
    const at = file.split('/content/')[1]
    for (const { visual, where } of everyVisual(topic)) check(visual, `${at} ${where}`)
  }

  it('finds the tables to check', () => {
    expect(tables).toBeGreaterThan(50)
  })

  it('wraps every cell so that no line runs past its column', () => {
    expect(overflow).toEqual([])
  })
})

/**
 * A step with two visuals lays them side by side, giving each half the lesson column.
 * The table SVG is drawn at width:100% and scales its whole viewBox to fit, so a table
 * wider than that box shrinks its 12px text along with everything else. This went
 * unnoticed for a long time: the browser walk only reports errors and the clipped-text
 * scan only reports text running outside its box, and shrunken text does neither. The
 * five-column colour table in Shopping for clothes rendered at about half size.
 *
 * needsFullRow decides which tables take the whole row instead. These tests hold every
 * table in the content pack to the guarantee that follows from it: no table renders
 * below READABLE of its natural size, and so none renders text under about 10px.
 */
describe('every table in the content pack', () => {
  const tables: { file: string; step: string; columns: string[]; rows: string[][] }[] = []
  for (const file of jsonFiles(CONTENT)) {
    const topic = JSON.parse(readFileSync(file, 'utf8'))
    for (const { visual, where } of everyVisual(topic)) {
      if (visual.type !== 'diagram' || visual.component !== 'trace-table') continue
      const props = visual.props as { columns?: string[]; rows?: string[][] }
      tables.push({ file: file.split('/').pop()!, step: where, columns: props?.columns ?? [], rows: props?.rows ?? [] })
    }
  }

  it('finds tables to check', () => {
    expect(tables.length).toBeGreaterThan(100)
  })

  /**
   * A table takes the whole row, so it is drawn into a 742px box. Anything wider than
   * MAX_TABLE_WIDTH scales below MIN_TEXT_PX and stops being readable — the comparison
   * table in Making marketing decisions was 1036 units and rendered its text at 8.6px.
   * Split a table that trips this, or shorten its headings.
   */
  it('is narrow enough to render its text above the readable floor', () => {
    const tooWide = tables
      .filter((t) => naturalWidth(t.columns, t.rows) > MAX_TABLE_WIDTH)
      .map((t) => {
        const w = naturalWidth(t.columns, t.rows)
        return `${t.file} ${t.step}: ${w} wide, text ${((TEXT_PX * FULL_ROW) / w).toFixed(1)}px (max ${MAX_TABLE_WIDTH})`
      })
    expect(tooWide).toEqual([])
  })

  it('has a readable floor above 12px only when it fits', () => {
    expect(MIN_TEXT_PX).toBeLessThan(TEXT_PX)
    expect(MAX_TABLE_WIDTH).toBe(Math.floor((FULL_ROW * TEXT_PX) / MIN_TEXT_PX))
  })
})

describe('fitColumns', () => {
  const columns = ['Step', 'What happens there', 'Why it matters']
  const rows = [
    ['1', 'blood at high pressure forces small molecules out into the capsule', 'this is filtration'],
    ['2', 'the last of the water the body needs is taken back', 'ADH controls how much'],
  ]
  const sum = (w: number[]) => w.reduce((a, b) => a + b, 0)

  it('leaves a table that already fits exactly as it was', () => {
    expect(fitColumns(columns, rows, 5000)).toEqual(columnWidths(columns, rows))
    expect(fitColumns(columns, rows, Infinity)).toEqual(columnWidths(columns, rows))
  })

  it('fits a phone card by wrapping the wide columns, not the narrow one', () => {
    const natural = columnWidths(columns, rows)
    const fitted = fitColumns(columns, rows, 330)
    expect(sum(natural) + 2).toBeGreaterThan(330)
    expect(sum(fitted) + 2).toBeLessThanOrEqual(330)
    expect(fitted[0]).toBe(natural[0])
    expect(fitted[1]).toBeLessThan(natural[1]!)
  })

  it('never makes a column narrower than its longest word', () => {
    const fitted = fitColumns(['Word', 'Text'], [['photosynthesising', 'a b c d e f g h i j k l m n o p q r s t u v w x y z']], 120)
    expect(fitted[0]).toBeGreaterThanOrEqual(CHAR_WIDTH * 'photosynthesising'.length + TIGHT_PADDING)
    for (const [i, w] of fitted.entries()) {
      const budget = charBudget(w)
      for (const line of wrapCell([['Word', 'Text'][i]!, ['photosynthesising', 'a b c d e f g h i j k l m n o p q r s t u v w x y z'][i]!].join(' '), budget)) {
        if (line.includes(' ')) expect(line.length).toBeLessThanOrEqual(budget)
      }
    }
  })

  it('closes up the padding when many short columns cannot fit at their word floors', () => {
    const places = ['', '128', '64', '32', '16', '8', '4', '2', '1']
    const byte = [['58', '0', '0', '1', '1', '1', '0', '1', '0'], ['Sum', '0', '1', '0', '1', '0', '0', '0', '0']]
    expect(fitColumns(places, byte, 1000)).toEqual(columnWidths(places, byte))
    const fitted = fitColumns(places, byte, 330)
    expect(sum(fitted) + 2).toBeLessThanOrEqual(330)
    // Loose enough still to keep a gap round each value, not packed to the glyphs.
    expect(sum(fitted) + 2).toBeGreaterThan(300)
    for (const [i, w] of fitted.entries()) {
      const longest = Math.max(places[i]!.length, ...byte.map((r) => r[i]!.length))
      expect(w).toBeGreaterThanOrEqual(CHAR_WIDTH * longest + TIGHT_PADDING)
    }
  })

  it('stops closing up at the tight floor and lets the rest scroll', () => {
    const cols = Array.from({ length: 20 }, (_, i) => `c${i}`)
    const fitted = fitColumns(cols, [cols.map(() => 'word')], 330)
    for (const w of fitted) expect(w).toBe(CHAR_WIDTH * 4 + TIGHT_PADDING)
  })
})

describe('isAtomic', () => {
  it('protects numbers and very short tokens, but not ordinary prose', () => {
    for (const w of ['-0.25', '2', 'a', 'of', '→']) expect(isAtomic(w)).toBe(true)
    for (const w of ['hypothalamus', 'concentration', 'opposes']) expect(isAtomic(w)).toBe(false)
  })
})

describe('hardBreak', () => {
  it('keeps every character, in order, joined by the hyphens it adds', () => {
    const lines = hardBreak('hypothalamus', 5)
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.join('').replaceAll('-', '')).toBe('hypothalamus')
    for (const l of lines.slice(0, -1)) expect(l.length).toBeLessThanOrEqual(5)
  })

  it('leaves a word that already fits untouched', () => {
    expect(hardBreak('cell', 10)).toEqual(['cell'])
  })

  /**
   * The first phone layout cut wherever the line ran out: "hydroge-n", "chlori-ne",
   * "Questi-on". A break goes at a hyphen the word already has, else at a syllable-like
   * boundary, and leaves at least three letters on each side.
   */
  it('breaks at a syllable-like point, never leaving a lone letter', () => {
    expect(hardBreak('chlorine', 6)).toEqual(['chlo-', 'rine'])
    expect(hardBreak('Question', 7)).toEqual(['Ques-', 'tion'])
    expect(hardBreak('potassium', 7)).toEqual(['potas-', 'sium'])
    expect(hardBreak('Distance', 6)).toEqual(['Dis-', 'tance'])
    for (const [w, b] of [['hydrogen', 7], ['Delivered?', 7], ['Sustainability', 6], ['electroplating', 8]] as const) {
      for (const piece of hardBreak(w, b)) expect(piece.replace('-', '').length, `${w}: ${piece}`).toBeGreaterThanOrEqual(3)
    }
  })

  it('uses a hyphen the word already has, and never splits a digraph', () => {
    expect(hardBreak('orange-brown', 7)).toEqual(['orange-', 'brown'])
    expect(hardBreak('hypothalamus', 8)[0]).not.toMatch(/(t|p|c|s)-$/)
  })
})

describe('wrapCellForced', () => {
  it('hyphenates a single long prose word instead of overflowing its column', () => {
    const lines = wrapCellForced('hypothalamus', 5)
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.join('').replaceAll('-', '')).toBe('hypothalamus')
  })

  /**
   * A number split across two lines reads as a different value: "-0-" over ".25" is not
   * obviously -0.25. wrapCellForced must never do this, however small the budget.
   */
  it('never hyphenates a number, however small the budget', () => {
    expect(wrapCellForced('-0.25', 2)).toEqual(['-0.25'])
    expect(wrapCellForced('12.5', 1)).toEqual(['12.5'])
  })

  it('matches wrapCell exactly whenever nothing needs forcing', () => {
    expect(wrapCellForced('x = 3', 31)).toEqual(wrapCell('x = 3', 31))
  })
})

describe('forceColumns', () => {
  /**
   * A value table for a reciprocal graph: nine columns, every cell a bare number. Even
   * fitColumns' own tight fallback is 300 + 2 wide — a phone gets 298. forceColumns must
   * close the gap without ever asking a number to give up room it needs.
   */
  it('never closes a column of numbers below the room its longest number needs', () => {
    const columns = ['x', '-4', '-2', '-1', '-0.5', '0.5', '1', '2', '4']
    const rows = [['1/x', '-0.25', '-0.5', '-1', '-2', '2', '1', '0.5', '0.25']]
    const natural = columnWidths(columns, rows)
    expect(fitColumns(columns, rows, 298).reduce((a, b) => a + b, 0) + 2).toBeGreaterThan(298)
    const forced = forceColumns(columns, rows, natural, 298)
    for (const [i, w] of forced.entries()) {
      const longest = Math.max(columns[i]!.length, ...rows.map((r) => r[i]!.length))
      expect(w).toBeGreaterThanOrEqual(CHAR_WIDTH * longest)
    }
  })

  /**
   * Five columns of prose (Hormones and the endocrine system), each repeating a word like
   * "hypothalamus": fitColumns' own tight layout is still 449 + 2 wide. forceColumns has
   * to close the rest of the gap, which only wrapCellForced's hyphenation makes possible.
   */
  it('closes prose columns past their word floor when fitColumns alone still overflows', () => {
    const columns = ['', 'Thyroxine', 'Blood glucose', 'Temperature', 'Water']
    const rows = [
      ['What is detected', 'thyroxine level', 'glucose level', 'body temperature', 'blood concentration'],
      ['Coordination', 'hypothalamus and pituitary', 'pancreas', 'hypothalamus', 'hypothalamus → pituitary'],
      ['Effector', 'thyroid gland', 'liver and cells', 'skin and muscles', 'kidneys'],
      ['What the response does', 'opposes the change', 'opposes the change', 'opposes the change', 'opposes the change'],
    ]
    const natural = columnWidths(columns, rows)
    expect(fitColumns(columns, rows, 298).reduce((a, b) => a + b, 0) + 2).toBeGreaterThan(298)
    const forced = forceColumns(columns, rows, natural, 298)
    expect(forced.reduce((a, b) => a + b, 0) + 2).toBeLessThanOrEqual(298)
  })

  it('leaves an already-fitting table untouched', () => {
    const columns = ['A', 'B']
    const rows = [['1', '2']]
    const natural = columnWidths(columns, rows)
    expect(forceColumns(columns, rows, natural, 1000)).toEqual(natural)
  })
})

/**
 * The whole point of forceColumns and wrapCellForced together: every trace-table in the
 * pack, laid out exactly as TraceTable lays it out for a 298-wide phone card (fitColumns,
 * then forceColumns on the rare table that still overflows), keeps its viewBox at or under
 * 296 and every wrapped line's estimated extent (x ± 0.6 × fontSize × characters, by its
 * text-anchor — cells are centred) inside that viewBox. Before forceColumns existed, 90 of
 * the pack's trace-tables reached fitColumns' own documented "scrolls the rest" fallback,
 * and did: from 4px over on a two-column table to 155px over on the nine-column one.
 */
describe('every trace-table fits a phone even past fitColumns own limit', () => {
  const AVAILABLE = 298
  const tables: { where: string; columns: string[]; rows: string[][] }[] = []
  for (const file of jsonFiles(CONTENT)) {
    const topic = JSON.parse(readFileSync(file, 'utf8'))
    const at = file.split('/content/')[1]
    for (const { visual, where } of everyVisual(topic)) {
      if (visual.type !== 'diagram' || visual.component !== 'trace-table') continue
      const props = visual.props as { columns?: string[]; rows?: string[][] }
      tables.push({ where: `${at} ${where}`, columns: props?.columns ?? [], rows: props?.rows ?? [] })
    }
  }

  it('finds tables to check', () => {
    expect(tables.length).toBeGreaterThan(100)
  })

  // TraceTable itself asks fitColumns for 2 less than the box it measures, so a table
  // fits with a little to spare rather than exactly filling a 298-wide phone card.
  function layout(columns: string[], rows: string[][]) {
    const budget = AVAILABLE - 2
    let widths = fitColumns(columns, rows, budget)
    if (widths.reduce((a, b) => a + b, 0) + 2 > budget) widths = forceColumns(columns, rows, columnWidths(columns, rows), budget)
    return widths
  }

  it('keeps the whole table at or under 296 wide', () => {
    const bad: string[] = []
    for (const { where, columns, rows } of tables) {
      const W = layout(columns, rows).reduce((a, b) => a + b, 0) + 2
      if (W > 296) bad.push(`${where}: ${W} wide`)
    }
    expect(bad).toEqual([])
  })

  it('keeps every wrapped line inside the viewBox it renders into', () => {
    const bad: string[] = []
    for (const { where, columns, rows } of tables) {
      const widths = layout(columns, rows)
      const W = widths.reduce((a, b) => a + b, 0) + 2
      const budgets = widths.map(charBudget)
      const xs = widths.reduce<number[]>((acc, w) => [...acc, (acc[acc.length - 1] ?? 1) + w], [1])
      for (const row of [columns, ...rows]) {
        row.forEach((text, i) => {
          const cx = xs[i]! + widths[i]! / 2
          for (const line of wrapCellForced(text ?? '', budgets[i]!)) {
            const half = (0.6 * 12 * line.length) / 2
            if (cx - half < -0.5 || cx + half > W + 0.5) bad.push(`${where}: "${line}" (cx=${cx.toFixed(1)}, W=${W})`)
          }
        })
      }
    }
    expect(bad).toEqual([])
  })
})
