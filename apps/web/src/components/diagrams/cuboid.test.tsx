import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Cuboid } from './Cuboid.tsx'

const svg = (props: Record<string, unknown>) => renderToStaticMarkup(<Cuboid props={props} alt="a cuboid with its diagonals marked" />)
const labels = (m: string) => [...m.matchAll(/>([\d.]+)(?: cm)?</g)].map((x) => x[1])

/**
 * The diagonals are computed from the dimensions, so a diagram can never label one with
 * a length the sides do not actually give. These check that arithmetic, which is the
 * whole reason the component exists.
 */
describe('cuboid', () => {
  it('labels the face diagonal and the space diagonal from the dimensions', () => {
    // 4, 3, 12: face diagonal 5, space diagonal 13 — a double Pythagorean triple.
    const l = labels(svg({ w: 4, d: 3, h: 12, show: 'both' }))
    expect(l).toContain('5')
    expect(l).toContain('13')
  })

  it('computes a non-integer diagonal to two decimal places', () => {
    // 2, 3, 6: face diagonal √13 ≈ 3.61, space diagonal 7 exactly.
    const l = labels(svg({ w: 2, d: 3, h: 6, show: 'both' }))
    expect(l).toContain('3.61')
    expect(l).toContain('7')
  })

  it('draws only the diagonals asked for', () => {
    const none = svg({ w: 4, d: 3, h: 12, show: 'none' })
    const both = svg({ w: 4, d: 3, h: 12, show: 'both' })
    const strokes = (m: string) => [...m.matchAll(/stroke="var\(--subject\)"/g)].length
    expect(strokes(none)).toBe(0)
    expect(strokes(both)).toBe(2)
    expect(strokes(svg({ w: 4, d: 3, h: 12, show: 'space' }))).toBe(1)
  })

  it('marks the base angle only when asked, labelling it', () => {
    const marked = svg({ w: 4, d: 3, h: 12, angle: true })
    expect(marked).toContain('<path')
    expect(marked).toContain('θ')
    expect(svg({ w: 4, d: 3, h: 12 })).not.toContain('<path')
  })

  /** The space diagonal must always be the longest line in the box. */
  it('keeps the space diagonal longer than the face diagonal', () => {
    for (const [w, d, h] of [[4, 3, 12], [2, 3, 6], [5, 5, 1]]) {
      const l = labels(svg({ w, d, h, show: 'both' })).map(Number)
      const face = Math.sqrt(w * w + d * d)
      const space = Math.sqrt(w * w + d * d + h * h)
      expect(l).toContain(Number(face.toFixed(2)) === Math.round(face) ? Math.round(face) : Number(face.toFixed(2)))
      expect(space).toBeGreaterThan(face)
    }
  })
})
