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

  /**
   * The drawing hangs off the bottom of a fixed-height box, so a flat cuboid used to
   * leave most of the picture blank — 1.2 by 0.6 by 0.4 filled the lower third and put
   * 170px of white above itself on the page.
   */
  it('crops the view to the drawing, so a flat box is not mostly white space', () => {
    const viewBox = (props: Record<string, unknown>) =>
      /viewBox="([^"]+)"/.exec(renderToStaticMarkup(<Cuboid alt="" props={props} />))![1]!.split(' ').map(Number)

    const [, flatTop, , flatHeight] = viewBox({ w: 1.2, d: 0.6, h: 0.4 })
    const [, tallTop, , tallHeight] = viewBox({ w: 4, d: 3, h: 12 })

    // A flat box starts its view well down the page and is much shorter than a tall one.
    expect(flatTop!).toBeGreaterThan(100)
    expect(flatHeight!).toBeLessThan(tallHeight!)
    expect(tallTop!).toBeLessThan(20)

    // And the whole drawing still fits: nothing is drawn above the view.
    const html = renderToStaticMarkup(<Cuboid alt="" props={{ w: 1.2, d: 0.6, h: 0.4 }} />)
    // The \s matters: without it this also matches the tail of opacity="0.5".
    const ys = [...html.matchAll(/\sy[12]?="([-\d.]+)"/g)].map((m) => Number(m[1]))
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(flatTop!)
  })

  /*
   * A diagram stops shrinking at its natural width, so at 380 units the cuboid scrolled
   * 48px on a phone. Every set of dimensions the pack draws is checked here, with each
   * label's box estimated at 7.2 units a character and kept inside the view.
   */
  it('fits a phone with every label inside the view', () => {
    const pack = [
      { w: 1.2, d: 0.6, h: 0.4, show: 'both', unit: 'm' }, { w: 4, d: 3, h: 12, show: 'both' },
      { w: 6, d: 6, h: 3, show: 'both' }, { w: 4, d: 3, h: 12, show: 'both', angle: true },
      { w: 5, d: 12, h: 7, show: 'both', angle: true }, { w: 2, d: 1, h: 1.5, show: 'none', unit: 'm' },
      { w: 5, d: 3, h: 2, show: 'none' }, { w: 80, d: 40, h: 50, show: 'none' },
    ]
    for (const props of pack) {
      const html = renderToStaticMarkup(<Cuboid alt="" props={props} />)
      const [x0, , width] = /viewBox="([^"]+)"/.exec(html)![1]!.split(' ').map(Number)
      expect(width!).toBeLessThanOrEqual(298)
      const labels = [...html.matchAll(/<text x="([-\d.]+)"[^>]*text-anchor="(\w+)"[^>]*>([^<]*)<\/text>/g)]
      // The three dimension labels at least, or this checks nothing.
      expect(labels.length).toBeGreaterThanOrEqual(3)
      for (const m of labels) {
        const x = Number(m[1]), text = m[3]!, w = text.length * 7.2
        const left = m[2] === 'end' ? x - w : m[2] === 'middle' ? x - w / 2 : x
        expect(left, `${JSON.stringify(props)} ${text}`).toBeGreaterThanOrEqual(x0!)
        expect(left + w, `${JSON.stringify(props)} ${text}`).toBeLessThanOrEqual(x0! + width!)
      }
    }
  })
})
