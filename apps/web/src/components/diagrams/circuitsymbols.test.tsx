import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CircuitSymbols, SYMBOLS, TILE_W, W, widthFor } from './CircuitSymbols.tsx'

const render = (props: Record<string, unknown> = {}) => renderToStaticMarkup(<CircuitSymbols props={props} alt="The standard circuit symbols" />)

describe('circuit symbols', () => {
  /** AQA 8463 4.2.1.1 lists fourteen, and the card is the specification's list, no more. */
  it('draws the fourteen symbols in AQA 4.2.1.1', () => {
    expect(Object.keys(SYMBOLS)).toHaveLength(14)
    const html = render()
    expect(html.match(/data-symbol=/g)).toHaveLength(14)
    for (const s of Object.values(SYMBOLS)) expect(html).toContain(s.name.replace(/[()]/g, (c) => c))
  })

  it('fits the 298 units a phone card leaves', () => {
    expect(W).toBeLessThanOrEqual(298)
    expect(render()).toContain(`viewBox="0 0 ${W} `)
  })

  it('wraps every description inside its tile', () => {
    // 0.6 of the font size per character, as the phone-fit check assumes.
    const html = render()
    const lines = [...html.matchAll(/font-size="12" fill="#5a6070">([^<]+)</g)].map((m) => m[1]!)
    expect(lines.length).toBeGreaterThan(14)
    for (const l of lines) expect(l.length * 12 * 0.6, l).toBeLessThanOrEqual(TILE_W - 20)
  })

  /**
   * The family's name was printed on every tile, and "Switch and protect" was wider than
   * the tile: it ran into the next one. The tag is the part's own, and must fit.
   */
  it('tags each tile with what the part is for, inside the tile', () => {
    const html = render()
    const tags = [...html.matchAll(/letter-spacing="0.06em"[^>]*>([^<]+)</g)].map((m) => m[1]!)
    expect(tags).toHaveLength(14)
    // Capitals at 11px run to about 0.7 of the size each, plus the letter spacing.
    for (const t of tags) expect(t.length * 11 * (0.7 + 0.06), t).toBeLessThanOrEqual(TILE_W - 20)
    expect(tags).toContain('PROTECT')
    expect(tags).not.toContain('SWITCH AND PROTECT')
  })

  /** A laptop's card is three times a phone's: two tiles a row left the drawing phone-sized in the middle of it. */
  it('draws five a row when asked, every tile the same width as on a phone', () => {
    const html = render({ columns: 5 })
    expect(html).toContain(`viewBox="0 0 ${widthFor(5)} `)
    expect(html.match(/data-symbol=/g)).toHaveLength(14)
    const lefts = new Set([...html.matchAll(/<rect x="([\d.]+)"[^>]*rx="12" fill="#fff"/g)].map((m) => Number(m[1])))
    expect([...lefts].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4].map((c) => c * (TILE_W + 12) + 1))
    const lines = [...html.matchAll(/font-size="12" fill="#5a6070">([^<]+)</g)].map((m) => m[1]!)
    for (const l of lines) expect(l.length * 12 * 0.6, l).toBeLessThanOrEqual(TILE_W - 20)
  })

  it('keeps to two a row for anything that is not a sensible number of columns', () => {
    for (const columns of [undefined, 0, 1, 'five', -3]) expect(render({ columns })).toContain(`viewBox="0 0 ${W} `)
    expect(render({ columns: 40 })).toContain(`viewBox="0 0 ${widthFor(6)} `)
  })

  it('shows a subset in the order asked', () => {
    const html = render({ symbols: ['ldr', 'thermistor'] })
    expect(html.match(/data-symbol=/g)).toHaveLength(2)
    expect(html.indexOf('data-symbol="ldr"')).toBeLessThan(html.indexOf('data-symbol="thermistor"'))
  })
})
