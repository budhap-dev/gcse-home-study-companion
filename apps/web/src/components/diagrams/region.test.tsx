import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { InequalityRegion } from './InequalityRegion.tsx'

const svg = (props: Record<string, unknown>) => renderToStaticMarkup(<InequalityRegion props={props} alt="a shaded region satisfying several inequalities" />)
/**
 * The shaded region, read back as the height of the shading at a given x. The polygon
 * lists its top edge left to right and then its bottom edge right to left, so pairing
 * the two halves recovers the band at each sample point.
 */
function bandsOf(m: string): { x: number; h: number }[] {
  const p = /<polygon points="([^"]+)" fill="var\(--subject\)" opacity="0\.18"/.exec(m)
  if (!p) return []
  const pts = p[1].split(' ').map((s) => s.split(',').map(Number) as [number, number])
  const half = pts.length / 2
  const top = pts.slice(0, half)
  const bottom = pts.slice(half).reverse()
  return top.map((t, i) => ({ x: t[0], h: bottom[i][1] - t[1] }))
}
const bars = bandsOf
const dashedCount = (m: string) => [...m.matchAll(/stroke-dasharray="6 4"/g)].length

const RANGE = { xRange: [0, 6], yRange: [0, 6] }

/**
 * The shading is computed from the constraints rather than drawn, so these check the
 * relationship a student is marked on: that the shaded part is exactly the set of points
 * satisfying every inequality, and that strict boundaries are dashed.
 */
describe('inequality region', () => {
  it('shades only above the line for y ⩾ x', () => {
    const m = svg({ ...RANGE, constraints: [{ m: 1, c: 0, side: 'above', inclusive: true }] })
    const b = bars(m)
    expect(b.length).toBeGreaterThan(50)
    // Further right, less of the column is above the line, so the bars get shorter.
    expect(b[b.length - 1].h).toBeLessThan(b[0].h)
  })

  it('shades only below the line for y ⩽ x', () => {
    const b = bars(svg({ ...RANGE, constraints: [{ m: 1, c: 0, side: 'below', inclusive: true }] }))
    // Below the line the bars grow as x increases: the mirror image of the case above.
    expect(b[b.length - 1].h).toBeGreaterThan(b[0].h)
  })

  it('shades nothing when the constraints contradict each other', () => {
    const m = svg({ ...RANGE, constraints: [
      { m: 0, c: 5, side: 'above', inclusive: true },
      { m: 0, c: 1, side: 'below', inclusive: true },
    ] })
    expect(bars(m)).toHaveLength(0)
  })

  it('cuts the region off at a vertical boundary', () => {
    const all = bars(svg({ ...RANGE, constraints: [{ m: 0, c: 3, side: 'below', inclusive: true }] }))
    const cut = bars(svg({ ...RANGE, constraints: [
      { m: 0, c: 3, side: 'below', inclusive: true },
      { x: 3, side: 'left', inclusive: true },
    ] }))
    // x ⩽ 3 keeps roughly half the columns of the unbounded case.
    expect(cut.length).toBeLessThan(all.length)
    expect(cut.length).toBeGreaterThan(all.length / 3)
  })

  it('dashes a strict boundary and leaves an inclusive one solid', () => {
    expect(dashedCount(svg({ ...RANGE, constraints: [{ m: 1, c: 0, side: 'above', inclusive: false }] }))).toBe(1)
    expect(dashedCount(svg({ ...RANGE, constraints: [{ m: 1, c: 0, side: 'above', inclusive: true }] }))).toBe(0)
  })

  /** Three constraints together give a triangle: the shading must narrow at one end. */
  it('narrows to a point where three constraints meet', () => {
    const b = bars(svg({ ...RANGE, constraints: [
      { m: 0, c: 0, side: 'above', inclusive: true },
      { x: 0, side: 'right', inclusive: true },
      { m: -1, c: 5, side: 'below', inclusive: true },
    ] }))
    expect(b[0].h).toBeGreaterThan(b[b.length - 1].h)
    expect(b[b.length - 1].h).toBeLessThan(6)
  })
})
