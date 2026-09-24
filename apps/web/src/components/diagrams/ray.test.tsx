import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { RayDiagram } from './RayDiagram.tsx'

const svg = (props: Record<string, unknown>) => renderToStaticMarkup(<RayDiagram props={props} alt="a ray diagram" />)
/** Every angle the diagram writes on itself, in the order it draws them. */
const angles = (markup: string) => [...markup.matchAll(/>(\d+)°</g)].map((m) => Number(m[1]))
/** The horizontal run of each line, which is what shows whether rays stay parallel. */
const runs = (markup: string) =>
  [...markup.matchAll(/<line[^>]*x1="([-\d.]+)"[^>]*x2="([-\d.]+)"/g)].map((m) => Math.round(Number(m[2]) - Number(m[1])))

/**
 * The angles are computed from the physics rather than drawn by hand, so a diagram
 * cannot say one thing while the lesson beside it says another. These check the
 * relationships a student is marked on, not the pixels.
 */
describe('ray diagram', () => {
  it('reflects at the angle of incidence', () => {
    const drawn = angles(svg({ kind: 'reflection', incidence: 35 }))
    expect(drawn).toEqual([35, 35])
  })

  it('bends towards the normal when the light slows down', () => {
    const markup = svg({ kind: 'refraction', incidence: 40, speedRatio: 2 / 3 })
    const [i, r] = angles(markup)
    expect(r).toBeLessThan(i)
    expect(r).toBe(Math.round((Math.asin(Math.sin((40 * Math.PI) / 180) * (2 / 3)) * 180) / Math.PI))
    expect(markup).toContain('towards the normal')
  })

  it('bends away from the normal when the light speeds up', () => {
    const markup = svg({ kind: 'refraction', incidence: 30, speedRatio: 1.5 })
    const [i, r] = angles(markup)
    expect(r).toBeGreaterThan(i)
    expect(markup).toContain('away from the normal')
  })

  /** A bigger angle of incidence must give a bigger angle of refraction, never a smaller one. */
  it('keeps the refracted angle rising with the incident angle', () => {
    const at = (i: number) => angles(svg({ kind: 'refraction', incidence: i, speedRatio: 2 / 3 }))[1]
    expect(at(20)).toBeLessThan(at(50))
    expect(at(50)).toBeLessThan(at(70))
  })

  it('scatters on a rough surface but not on a smooth one', () => {
    // The last three lines drawn are the reflected rays.
    const smooth = runs(svg({ kind: 'specular' })).slice(-3)
    const rough = runs(svg({ kind: 'diffuse' })).slice(-3)
    expect(new Set(smooth).size).toBe(1)
    expect(new Set(rough).size).toBeGreaterThan(1)
  })
})

/**
 * Required practical 9 traces a ray through a rectangular block. The refracted angle is
 * computed from the speed ratio, and the ray leaves the far face at the angle it arrived,
 * so the emergent ray is parallel to the incident one. Both follow from the physics; the
 * content only names the angle of incidence and the material.
 */
describe('ray through a block', () => {
  it('writes the angle of incidence, the refracted angle, and the same angle again on the way out', () => {
    const markup = svg({ kind: 'block', incidence: 25, speedRatio: 0.69 })
    expect(angles(markup)).toEqual([25, 17, 25])
  })

  it('gives AQA\'s technician results for glass and Perspex from their speed ratios', () => {
    // 25° in gave 17° in glass and 16° in Perspex; the ratios are sin 17 / sin 25 and sin 16 / sin 25.
    expect(angles(svg({ kind: 'block', incidence: 25, speedRatio: 0.69 }))[1]).toBe(17)
    expect(angles(svg({ kind: 'block', incidence: 25, speedRatio: 0.65 }))[1]).toBe(16)
  })

  it('sends the emergent ray out parallel to the incident ray', () => {
    const markup = svg({ kind: 'block', incidence: 40, speedRatio: 2 / 3 })
    const solid = [...markup.matchAll(/<line x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)" stroke="var\(--subject\)" stroke-width="2.5"/g)]
      .map((m) => m.slice(1, 5).map(Number))
    expect(solid).toHaveLength(3)
    const slope = ([x1, y1, x2, y2]: number[]) => (x2! - x1!) / (y2! - y1!)
    const incident = solid[0]!, refracted = solid[1]!, emergent = solid[2]!
    expect(slope(emergent)).toBeCloseTo(slope(incident), 6)
    // Inside the block the ray is steeper: closer to the normal.
    expect(Math.abs(slope(refracted))).toBeLessThan(Math.abs(slope(incident)))
    // And it is shifted sideways: it leaves to the right of where the straight line would have gone.
    expect(emergent[0]).toBeGreaterThan(incident[2]!)
  })

  it('draws a normal at the point of entry and at the point of exit', () => {
    const markup = svg({ kind: 'block', incidence: 30 })
    expect(markup.match(/stroke-dasharray="5 4"/g)).toHaveLength(2)
  })
})
