import type { ResourceBlock } from '@study/shared'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { RESOURCES } from '../../content/resources.ts'
import { Blocks, SMALLEST_FORMULA, nextSetting, rowsOf, wideVariant, type Row } from './ResourceParts.tsx'

const drawing = (component: string): ResourceBlock => ({ kind: 'visual', visual: { type: 'diagram', component, props: {}, alt: `a ${component}` } } as ResourceBlock)
const text: ResourceBlock = { kind: 'text', body: 'Words.' } as ResourceBlock
const table: ResourceBlock = { kind: 'table', columns: ['A', 'B'], rows: [['1', '2']] } as ResourceBlock

/** The blocks a list of rows holds, in the order a phone shows them. */
const flat = (rows: Row[]): ResourceBlock[] => rows.flatMap((r) => (r.kind === 'single' ? [r.block] : r.kind === 'figures' ? r.blocks : [r.figure, ...r.next]))

describe('how a resource lays out its blocks', () => {
  it('puts drawings that follow one another in rows together', () => {
    const rows = rowsOf([text, drawing('circle-theorem'), drawing('circle-theorem'), drawing('circle-theorem'), text])
    expect(rows.map((r) => r.kind)).toEqual(['single', 'figures', 'single'])
    expect(rows[1]!.kind === 'figures' && rows[1]!.blocks).toHaveLength(3)
  })

  it('sits a drawing on its own beside the table or the words after it', () => {
    expect(rowsOf([drawing('heart-diagram'), table]).map((r) => r.kind)).toEqual(['beside'])
    expect(rowsOf([drawing('heart-diagram'), text]).map((r) => r.kind)).toEqual(['beside'])
  })

  /** A short table beside a tall drawing left most of its column blank. */
  it('puts the words that follow a table under it, in the same column', () => {
    const rows = rowsOf([drawing('heart-diagram'), table, text, text])
    expect(rows.map((r) => r.kind)).toEqual(['beside', 'single'])
    expect(rows[0]!.kind === 'beside' && rows[0]!.next).toEqual([table, text])
    // Words first are the whole column: a table after them starts a row of its own.
    const wordsFirst = rowsOf([drawing('heart-diagram'), text, table])
    expect(wordsFirst.map((r) => r.kind)).toEqual(['beside', 'single'])
    expect(wordsFirst[0]!.kind === 'beside' && wordsFirst[0]!.next).toEqual([text])
  })

  it('leaves a drawing the full width when nothing follows it, or formulae do', () => {
    expect(rowsOf([text, drawing('heart-diagram')]).map((r) => r.kind)).toEqual(['single', 'single'])
    const formulae = { kind: 'formulae', groups: [] } as unknown as ResourceBlock
    expect(rowsOf([drawing('heart-diagram'), formulae]).map((r) => r.kind)).toEqual(['single', 'single'])
  })

  /** A drawing with a wide form of its own fills the card, so nothing is put beside it. */
  it('gives the full width to a drawing that has a wider form for a laptop', () => {
    expect(rowsOf([drawing('em-spectrum'), text]).map((r) => r.kind)).toEqual(['single', 'single'])
    expect(rowsOf([drawing('circuit-symbols'), table]).map((r) => r.kind)).toEqual(['single', 'single'])
  })

  it('asks the two drawings that have one for their wider form, and keeps their other props', () => {
    const symbols = wideVariant({ type: 'diagram', component: 'circuit-symbols', props: { symbols: ['cell', 'lamp'] }, alt: 'x' })
    expect(symbols).toMatchObject({ component: 'circuit-symbols', props: { symbols: ['cell', 'lamp'], columns: 5 } })
    expect(wideVariant({ type: 'diagram', component: 'em-spectrum', props: {}, alt: 'x' })).toMatchObject({ props: { layout: 'across' } })
    expect(wideVariant({ type: 'diagram', component: 'heart-diagram', props: {}, alt: 'x' })).toBeUndefined()
  })
})

describe('every resource in the pack', () => {
  const written = RESOURCES.filter((r) => r.blocks.length > 0)

  /** Grouping blocks into rows must never lose one, repeat one or change the order. */
  it('keeps every block, once, in the order written', () => {
    expect(written.length).toBeGreaterThan(30)
    let grouped = 0
    for (const r of written) {
      const rows = rowsOf(r.blocks)
      expect(flat(rows), `${r.subjectId}/${r.id}`).toEqual(r.blocks)
      grouped += rows.filter((row) => row.kind !== 'single').length
    }
    // A floor, so that a rule which grouped nothing could not pass as one that lost nothing.
    expect(grouped).toBeGreaterThan(5)
  })

  it('shows one drawing at a width where it has two, and both carry the same description', () => {
    let pairs = 0
    for (const r of written) {
      const html = renderToStaticMarkup(<Blocks blocks={r.blocks} />)
      const narrow = html.match(/class="lg:hidden print:block"/g)?.length ?? 0
      const wide = html.match(/class="hidden lg:block print:hidden"/g)?.length ?? 0
      expect(narrow, `${r.subjectId}/${r.id}`).toBe(wide)
      pairs += narrow
    }
    expect(pairs).toBeGreaterThanOrEqual(2)
  })
})

describe('a formula too wide for its card', () => {
  const tidy = { loose: false, scale: 1 }
  const loose = { loose: true, scale: 1 }

  it('is left as it is when it fits', () => {
    expect(nextSetting(tidy, 300, 320)).toBe(tidy)
    expect(nextSetting(tidy, 320, 320)).toBe(tidy)
    expect(nextSetting(loose, 320, 320)).toBe(loose)
  })

  /** "× 100" after a fraction: broken, the 100 sat alone on a second line. */
  it('is set a little smaller before it is ever broken at a times sign', () => {
    const next = nextSetting(tidy, 360, 320)
    expect(next.loose).toBe(false)
    expect(next.scale).toBeLessThan(1)
    expect(360 * next.scale).toBeLessThanOrEqual(320)
    expect(360 * (next.scale + 0.02)).toBeGreaterThan(320)
  })

  it('is broken at full size when shrinking would not be enough', () => {
    expect(nextSetting(tidy, 480, 320)).toEqual({ loose: true, scale: 1 })
  })

  it('is set smaller once broken, if a piece is still too wide', () => {
    const next = nextSetting(loose, 340, 320)
    expect(next.loose).toBe(true)
    expect(340 * next.scale).toBeLessThanOrEqual(320)
  })

  it('never goes below a size that reads, and scrolls from there', () => {
    expect(nextSetting(loose, 900, 320)).toEqual({ loose: true, scale: SMALLEST_FORMULA })
    expect(18 * SMALLEST_FORMULA).toBeGreaterThanOrEqual(14)
  })

  /** Each step is taken once: a setting already made smaller is never changed again, so it cannot loop. */
  it('settles: nothing is tried after a smaller size', () => {
    for (const wide of [330, 400, 520, 900, 5000]) {
      let setting = tidy, steps = 0
      for (; steps < 10; steps++) {
        // Smaller type is narrower in proportion; a broken formula is as wide as its widest piece, taken as 0.7 of the whole.
        const drawn = wide * setting.scale * (setting.loose ? 0.7 : 1)
        const next = nextSetting(setting, drawn, 320)
        if (next === setting) break
        setting = next
      }
      expect(steps, `${wide} wide`).toBeLessThanOrEqual(3)
    }
  })

  it('does nothing while the card has no width to measure', () => {
    expect(nextSetting(tidy, 300, 0)).toBe(tidy)
  })
})
