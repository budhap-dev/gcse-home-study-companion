import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { InequalityLine } from './InequalityLine.tsx'

const svg = (props: Record<string, unknown>) => renderToStaticMarkup(<InequalityLine props={props} alt="a number line showing a solution set" />)
/** Each circle's centre and whether it is filled, in the order drawn. */
const circles = (m: string) =>
  [...m.matchAll(/<circle[^>]*cx="([\d.]+)"[^>]*fill="([^"]+)"/g)].map((c) => ({ cx: Number(c[1]), filled: c[2] !== '#ffffff' }))
/** The shaded bar, which is the one thick line. */
const bar = (m: string) => {
  const b = /<line[^>]*x1="([\d.]+)"[^>]*x2="([\d.]+)"[^>]*stroke-width="5"/.exec(m)
  return b ? { x1: Number(b[1]), x2: Number(b[2]) } : null
}

/**
 * The whole point of the component is that the circle and the shading come from the
 * inequality rather than from whoever drew it, so a diagram cannot show a filled circle
 * over a strict inequality. These check that relationship, not the pixels.
 */
describe('inequality number line', () => {
  it('fills the circle for an inclusive bound and leaves it open for a strict one', () => {
    expect(circles(svg({ from: -5, to: 5, lower: { value: 2, inclusive: true } }))[0].filled).toBe(true)
    expect(circles(svg({ from: -5, to: 5, lower: { value: 2, inclusive: false } }))[0].filled).toBe(false)
  })

  it('shades to the right when only a lower bound is given', () => {
    const m = svg({ from: -5, to: 5, lower: { value: 1, inclusive: false } })
    const b = bar(m)!
    expect(b.x2).toBeGreaterThan(b.x1)
    expect(b.x1).toBeCloseTo(circles(m)[0].cx, 5)
  })

  it('shades to the left when only an upper bound is given', () => {
    const m = svg({ from: -5, to: 5, upper: { value: 1, inclusive: true } })
    const b = bar(m)!
    // The bar starts at the left edge and stops at the circle.
    expect(b.x2).toBeCloseTo(circles(m)[0].cx, 5)
    expect(b.x1).toBeLessThan(b.x2)
  })

  it('shades between two bounds and draws both circles', () => {
    const m = svg({ from: -5, to: 5, lower: { value: -2, inclusive: true }, upper: { value: 3, inclusive: false } })
    const c = circles(m)
    expect(c).toHaveLength(2)
    expect(c[0].filled).toBe(true)
    expect(c[1].filled).toBe(false)
    const b = bar(m)!
    expect(b.x1).toBeCloseTo(c[0].cx, 5)
    expect(b.x2).toBeCloseTo(c[1].cx, 5)
  })

  /** A one-ended solution carries on, so it needs an arrowhead; a bounded one does not. */
  it('draws an arrowhead only where the solution continues', () => {
    const heads = (m: string) => [...m.matchAll(/<polygon/g)].length
    expect(heads(svg({ from: -5, to: 5, lower: { value: 1, inclusive: false } }))).toBe(1)
    expect(heads(svg({ from: -5, to: 5, lower: { value: -2, inclusive: true }, upper: { value: 3, inclusive: false } }))).toBe(0)
  })

  it('places a larger value further right', () => {
    const at = (v: number) => circles(svg({ from: -5, to: 5, lower: { value: v, inclusive: true } }))[0].cx
    expect(at(-3)).toBeLessThan(at(0))
    expect(at(0)).toBeLessThan(at(4))
  })

  /**
   * `span` was Math.max(1, to - from), which guards a zero span but silently ruins a
   * fractional one: a 49.9 to 50.1 tolerance band was squashed into the leftmost fifth
   * of the line, and whole-number ticks left it with a single mark.
   */
  describe('a fractional range', () => {
    const TOL = { from: 49.9, to: 50.1, lower: { value: 49.95, inclusive: true }, upper: { value: 50.05, inclusive: true } }
    const tickLabels = (html: string) => [...html.matchAll(/font-size="12"[^>]*>([\d.-]+)</g)].map((m) => m[1]!)

    it('spreads the bounds across the line rather than squashing them left', () => {
      const cs = circles(svg(TOL))
      expect(cs).toHaveLength(2)
      // 49.95 and 50.05 sit a quarter and three quarters along a 49.9 to 50.1 line,
      // drawn 280 wide (22 to 258) since the 420-wide line scrolled on a phone.
      expect(cs[0]!.cx).toBeGreaterThan(60)
      expect(cs[1]!.cx).toBeLessThan(220)
      expect(cs[1]!.cx - cs[0]!.cx).toBeGreaterThan(100)
    })

    it('labels it in the right steps', () => {
      expect(tickLabels(svg(TOL))).toEqual(['49.90', '49.95', '50.00', '50.05', '50.10'])
    })

    it('still marks every whole number on an ordinary line', () => {
      expect(tickLabels(svg({ from: -5, to: 5, lower: { value: 2, inclusive: true } })))
        .toEqual(['-5', '-4', '-3', '-2', '-1', '0', '1', '2', '3', '4', '5'])
    })
  })
})
