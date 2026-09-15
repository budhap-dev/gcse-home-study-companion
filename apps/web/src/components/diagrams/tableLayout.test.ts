import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FULL_ROW, MAX_TABLE_WIDTH, MIN_TEXT_PX, TEXT_PX, charBudget, columnWidths, naturalWidth, rowHeight, wrapCell } from './tableLayout.ts'

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
    for (const step of topic.lesson.steps) for (const visual of step.visuals) check(visual, `${at} ${step.id}`)
    for (const q of topic.questions) if (q.visual) check(q.visual, `${at} ${q.id}`)
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
    for (const step of topic.lesson?.steps ?? []) {
      for (const v of step.visuals ?? []) {
        if (v.component !== 'trace-table') continue
        tables.push({ file: file.split('/').pop()!, step: step.id, columns: v.props?.columns ?? [], rows: v.props?.rows ?? [] })
      }
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
