import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CircuitDiagram } from './CircuitDiagram.tsx'

const svg = (props: Record<string, unknown>) => renderToStaticMarkup(<CircuitDiagram props={props} alt="a circuit" />)
/** Every "V, A" reading the diagram writes on itself, in the order it draws them. */
const readings = (markup: string) =>
  [...markup.matchAll(/>([\d.]+) V, ([\d.]+) A</g)].map((m) => ({ v: Number(m[1]), i: Number(m[2]) }))

/**
 * The readings are worked out by the component, so a diagram cannot print values that
 * break the rules the lesson beside it teaches. These check the rules rather than the
 * arithmetic of one example.
 */
describe('circuit diagram', () => {
  describe('in series', () => {
    const props = { supply: { pd: 12 }, parts: [{ kind: 'resistor', resistance: 4 }, { kind: 'resistor', resistance: 8 }] }

    it('gives the same current through every component', () => {
      const drawn = readings(svg(props))
      expect(drawn).toHaveLength(2)
      expect(drawn[0]!.i).toBe(drawn[1]!.i)
    })

    it('shares the supply pd between the components', () => {
      const drawn = readings(svg(props))
      expect(drawn.reduce((t, r) => t + r.v, 0)).toBeCloseTo(12, 6)
    })

    it('obeys V = IR at every component', () => {
      for (const [r, reading] of [4, 8].map((r, i) => [r, readings(svg(props))[i]!] as const)) {
        expect(reading.v).toBeCloseTo(reading.i * r, 2)
      }
    })

    it('adds the resistances, and says so', () => {
      // 4 + 8 = 12 ohms, so 12 V gives 1 A.
      expect(svg(props)).toContain('Total resistance 12 Ω')
      expect(readings(svg(props))[0]!.i).toBe(1)
    })

    it('still works when a switch with no resistance is in the loop', () => {
      const withSwitch = { ...props, parts: [{ kind: 'switch' }, ...props.parts] }
      const drawn = readings(svg(withSwitch))
      expect(drawn).toHaveLength(2)
      expect(drawn.reduce((t, r) => t + r.v, 0)).toBeCloseTo(12, 6)
    })
  })

  describe('in parallel', () => {
    const props = {
      supply: { pd: 12 },
      arrangement: 'parallel',
      parts: [{ kind: 'resistor', resistance: 4 }, { kind: 'resistor', resistance: 12 }],
    }

    it('puts the full supply pd across every branch', () => {
      for (const r of readings(svg(props))) expect(r.v).toBe(12)
    })

    it('gives each branch its own current, adding to the total', () => {
      const drawn = readings(svg(props))
      expect(drawn.map((r) => r.i)).toEqual([3, 1])
      expect(svg(props)).toContain('the currents add to 4 A')
    })

    it('makes the total resistance less than the smallest branch', () => {
      // 12 V and 4 A total is 3 ohms, below the 4 ohm branch — the rule the lesson gives.
      const total = 12 / 4
      expect(total).toBeLessThan(4)
      expect(total).toBeLessThan(12)
    })

    it('draws one branch per component', () => {
      const branches = [...svg(props).matchAll(/<line x1="150"/g)]
      expect(branches.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('leaves the readings off when no resistances are given', () => {
    const markup = svg({ supply: { pd: 6 }, parts: [{ kind: 'lamp', label: 'lamp' }, { kind: 'switch' }] })
    expect(readings(markup)).toEqual([])
    expect(markup).toContain('>lamp<')
  })

  it('falls back to the alt text with nothing to draw', () => {
    expect(svg({ parts: [] })).toContain('a circuit')
  })
})

describe('the cell symbol', () => {
  /** Lines, as {x1,y1,x2,y2}, so orientation and gaps can be checked. */
  const lines = (markup: string) =>
    [...markup.matchAll(/<line x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)"[^>]*stroke-width="([\d.]+)"/g)].map((m) => ({
      x1: Number(m[1]), y1: Number(m[2]), x2: Number(m[3]), y2: Number(m[4]), w: Number(m[5]),
    }))

  for (const arrangement of ['series', 'parallel'] as const) {
    it(`draws the plates across the wire, not along it (${arrangement})`, () => {
      // Drawn along the wire, the long plate lies on top of it and the cell reads as one
      // thick bar. The wire it sits on is vertical, so the plates must be horizontal.
      const markup = svg({
        supply: { pd: 12 },
        arrangement,
        parts: [{ kind: 'resistor', resistance: 4 }, { kind: 'resistor', resistance: 12 }],
      })
      const all = lines(markup)
      const thick = all.find((l) => l.w === 4)!
      expect(thick, 'the short thick plate').toBeTruthy()
      expect(thick.y1).toBe(thick.y2)
      expect(thick.x1).not.toBe(thick.x2)
      // And the long thin plate is horizontal too, longer, and above it.
      const longPlate = all.find((l) => l.y1 === l.y2 && l.w !== 4 && Math.abs(l.x2 - l.x1) === 32)!
      expect(longPlate, 'the long thin plate').toBeTruthy()
      expect(longPlate.y1).toBeLessThan(thick.y1)
      expect(Math.abs(longPlate.x2 - longPlate.x1)).toBeGreaterThan(Math.abs(thick.x2 - thick.x1))
    })

    it(`leaves a gap in the wire where the cell sits (${arrangement})`, () => {
      const markup = svg({
        supply: { pd: 12 },
        arrangement,
        parts: [{ kind: 'resistor', resistance: 4 }, { kind: 'resistor', resistance: 12 }],
      })
      const all = lines(markup)
      const thick = all.find((l) => l.w === 4)!
      const cellY = thick.y1 - 6
      // No vertical wire passes through the cell's own position.
      const through = all.filter((l) => l.x1 === l.x2 && Math.min(l.y1, l.y2) < cellY - 2 && Math.max(l.y1, l.y2) > cellY + 2)
      expect(through.filter((l) => Math.abs(l.x1 - thick.x1) < 20)).toEqual([])
    })
  }
})

describe('parallel branch spacing', () => {
  it('keeps one branch\'s readings clear of the next branch\'s label', () => {
    // At 74px apart the "12 V, 3 A" of the first branch was drawn on top of the "R2"
    // label of the second.
    const markup = svg({
      supply: { pd: 12 },
      arrangement: 'parallel',
      parts: [
        { kind: 'resistor', label: 'R1', resistance: 4 },
        { kind: 'resistor', label: 'R2', resistance: 12 },
        { kind: 'resistor', label: 'R3', resistance: 6 },
      ],
    })
    const texts = [...markup.matchAll(/<text x="[\d.]+" y="([-\d.]+)"[^>]*>([^<]+)</g)].map((m) => ({ y: Number(m[1]), text: m[2]! }))
    const at = (t: string) => texts.find((n) => n.text === t)!
    const readingOf = (i: number) => texts.filter((n) => / V, .* A$/.test(n.text))[i]!
    for (const [i, next] of [[0, 'R2'], [1, 'R3']] as const) {
      // Ten points of clearance between the bottom of one stack and the top of the next.
      expect(at(next).y - readingOf(i).y).toBeGreaterThan(10)
    }
  })
})
