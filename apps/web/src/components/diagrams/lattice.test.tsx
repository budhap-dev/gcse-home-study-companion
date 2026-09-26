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

/**
 * Every `kind` the content actually uses (`grep -rl '"component": "lattice"' supabase/seed/content`:
 * covalent-bonding, carbon-structures-and-nanoparticles, ionic-bonding, states-of-matter,
 * metallic-bonding-and-alloys), at the 296-wide budget a phone gives it. The canvas used to
 * be a flat 320 regardless of `kind`, which scrolled sideways on every page that used it;
 * some kinds (metallic's grid, polymer's dangling bond, several bottom captions) were also
 * drawn right at that edge, so shrinking the canvas without re-laying them out would have
 * cut them off instead of just fitting.
 */
describe('lattice fits a phone for every kind the content uses', () => {
  const kinds = ['ionic', 'metallic', 'giant-covalent', 'simple-molecules', 'polymer', 'graphite', 'graphene', 'fullerene', 'nanotube', 'alloy']

  it('keeps the viewBox within the phone width for every kind', () => {
    for (const kind of kinds) {
      const markup = svg({ kind })
      const [width] = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(markup)!.slice(1).map(Number)
      expect(width, kind).toBeLessThanOrEqual(296)
    }
  })

  /** x ± 0.6 × fontSize × characters, by text-anchor, must lie inside the viewBox. */
  it('keeps every label inside the viewBox', () => {
    const escaped: string[] = []
    for (const kind of kinds) {
      const markup = svg({ kind })
      const [width, height] = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(markup)!.slice(1).map(Number) as [number, number]
      const texts = [...markup.matchAll(/<text x="([-\d.]+)" y="([-\d.]+)"([^>]*)>([^<]*)<\/text>/g)]
      for (const m of texts) {
        const x = Number(m[1]), y = Number(m[2]), attrs = m[3]!, text = m[4]!
        if (!text.trim()) continue
        const fontSize = Number(/font-size="([\d.]+)"/.exec(attrs)?.[1] ?? 11)
        const anchor = /text-anchor="(\w+)"/.exec(attrs)?.[1] ?? 'start'
        const w = 0.6 * fontSize * text.length
        const left = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x
        const right = left + w
        if (left < -0.5 || right > width + 0.5 || y < 0 || y > height + 0.5) {
          escaped.push(`${kind}: "${text}" left ${left.toFixed(1)} right ${right.toFixed(1)} y ${y} (canvas ${width}x${height})`)
        }
      }
    }
    expect(escaped).toEqual([])
  })

  it('never lowers a fontSize below 11', () => {
    for (const kind of kinds) {
      const markup = svg({ kind })
      const sizes = [...markup.matchAll(/font-size="([\d.]+)"/g)].map((m) => Number(m[1]))
      for (const s of sizes) expect(s, kind).toBeGreaterThanOrEqual(11)
    }
  })
})
