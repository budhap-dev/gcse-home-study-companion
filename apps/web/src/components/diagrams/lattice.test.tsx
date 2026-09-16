import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Lattice } from './Lattice.tsx'

const svg = (props: Record<string, unknown>) => renderToStaticMarkup(<Lattice props={props} alt="a lattice" />)

/** Every <text> with its position, so overlapping labels can be detected. */
function labels(markup: string): { x: number; y: number; text: string }[] {
  return [...markup.matchAll(/<text[^>]*\bx="([\d.]+)"[^>]*\by="([\d.]+)"[^>]*>([^<]*)<\/text>/g)]
    .map((m) => ({ x: Number(m[1]), y: Number(m[2]), text: m[3]! }))
}

describe('metallic lattice', () => {
  /**
   * The delocalised electrons were positioned by a formula that knew nothing about the
   * ions, so some were drawn directly on top of an ion's "+". That is unreadable, and it
   * misrepresents metallic bonding: the electrons are a sea *between* the positive ions.
   */
  it('never draws an electron on top of an ion', () => {
    const drawn = labels(svg({ kind: 'metallic' }))
    const ions = drawn.filter((l) => l.text === '+')
    const electrons = drawn.filter((l) => l.text.startsWith('e'))
    expect(ions.length).toBeGreaterThan(10)
    expect(electrons.length).toBeGreaterThan(10)
    for (const e of electrons) {
      for (const ion of ions) {
        // The ion circle has a radius of 16, so an electron inside that is on top of it.
        expect(Math.hypot(e.x - ion.x, e.y - ion.y), `${e.text} at ${e.x},${e.y}`).toBeGreaterThan(16)
      }
    }
  })

  it('still draws a full lattice of ions and a sea of electrons', () => {
    const drawn = labels(svg({ kind: 'metallic' }))
    expect(drawn.filter((l) => l.text === '+')).toHaveLength(18)
    expect(drawn.filter((l) => l.text.startsWith('e')).length).toBeGreaterThanOrEqual(12)
  })
})
