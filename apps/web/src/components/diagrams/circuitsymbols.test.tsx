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

  /** AQA's table (4.2.1.1) draws the open switch with its arm hanging below the gap; ours rose above it. */
  it('draws the open switch with its arm falling away below the second contact', () => {
    const arm = (id: string) => {
      const tile = render({ symbols: [id] })
      const contacts = [...tile.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="3"/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }))
      expect(contacts).toHaveLength(2)
      const lines = [...tile.matchAll(/<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/g)].map((m) => m.slice(1).map(Number))
      const found = lines.find(([x1, y1, , y2]) => Math.abs(x1! - contacts[0]!.x) < 4 && y1 !== y2)!
      return { end: { x: found[2]!, y: found[3]! }, contact: contacts[1]! }
    }
    const open = arm('switch-open')
    // Down the page is a larger y: the arm ends well below the contact it does not reach.
    expect(open.end.y).toBeGreaterThan(open.contact.y + 10)
    const closed = arm('switch-closed')
    expect(Math.abs(closed.end.y - closed.contact.y)).toBeLessThanOrEqual(3)
  })

  it('shows a subset in the order asked', () => {
    const html = render({ symbols: ['ldr', 'thermistor'] })
    expect(html.match(/data-symbol=/g)).toHaveLength(2)
    expect(html.indexOf('data-symbol="ldr"')).toBeLessThan(html.indexOf('data-symbol="thermistor"'))
  })
})
