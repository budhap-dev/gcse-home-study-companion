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
