import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { charBudget, columnWidths, rowHeight, wrapCell } from './tableLayout.ts'

const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content')

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
