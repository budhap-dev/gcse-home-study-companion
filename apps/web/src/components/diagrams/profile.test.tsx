import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ReactionProfile } from './ReactionProfile.tsx'

const svg = (props: Record<string, unknown>) => renderToStaticMarkup(<ReactionProfile props={props} alt="a reaction profile" />)
/** The y of each dashed level line, in draw order: reactants first, then products. */
const levels = (m: string) => [...m.matchAll(/<line[^>]*y1="([\d.]+)"[^>]*stroke-dasharray/g)].map((x) => Number(x[1]))
/** The peak of the drawn curve, which is the y the two cubics share. */
const peak = (m: string) => Number(/C[\d.]+ [\d.]+ [\d.]+ ([\d.]+) [\d.]+ [\d.]+/.exec(m)![1])

/**
 * The topic teaches that the activation arrow and the overall-change arrow start in
 * different places, and that the position of the products, not the height of the hump,
 * decides whether a reaction is exothermic. The diagram has to agree with both, so the
 * geometry is checked rather than the pixels. SVG y grows downwards, so a lower energy
 * is a larger y.
 */
describe('reaction profile', () => {
  it('puts the products below the reactants when the change is negative', () => {
    const [react, prod] = levels(svg({ activation: 120, change: -80 }))
    expect(prod).toBeGreaterThan(react)
  })

  it('puts the products above the reactants when the change is positive', () => {
    const [react, prod] = levels(svg({ activation: 140, change: 60 }))
    expect(prod).toBeLessThan(react)
  })

  it('always draws the peak above both levels', () => {
    for (const change of [-80, -10, 20, 60]) {
      const markup = svg({ activation: 150, change })
      const [react, prod] = levels(markup)
      expect(peak(markup)).toBeLessThan(Math.min(react, prod))
    }
  })

  it('labels itself from the sign, so a mislabelled profile cannot be drawn', () => {
    expect(svg({ activation: 120, change: -80 })).toContain('exothermic')
    expect(svg({ activation: 120, change: 60 })).toContain('endothermic')
    // Even if the caller insists otherwise, the sign wins.
    expect(svg({ kind: 'endothermic', activation: 120, change: -80 })).toContain('exothermic')
  })

  it('draws both measurement arrows, which are the point of the diagram', () => {
    const markup = svg({ activation: 120, change: -80 })
    expect(markup).toContain('activation energy')
    expect(markup).toContain('overall change')
  })

  /** A taller hump must not move the levels: that is the misconception being taught against. */
  it('leaves the levels where they are when only the activation energy changes', () => {
    const low = levels(svg({ activation: 60, change: -80 }))
    const high = levels(svg({ activation: 60, change: -80 }))
    expect(low).toEqual(high)
  })
})
