import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CircuitSymbols, SYMBOLS, TILE_W, W } from './CircuitSymbols.tsx'

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

  it('shows a subset in the order asked', () => {
    const html = render({ symbols: ['ldr', 'thermistor'] })
    expect(html.match(/data-symbol=/g)).toHaveLength(2)
    expect(html.indexOf('data-symbol="ldr"')).toBeLessThan(html.indexOf('data-symbol="thermistor"'))
  })
})
