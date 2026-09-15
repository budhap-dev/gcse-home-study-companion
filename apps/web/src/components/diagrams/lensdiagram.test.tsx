import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LensDiagram } from './LensDiagram.tsx'

const svg = (props: Record<string, unknown>) => renderToStaticMarkup(<LensDiagram props={props} alt="a ray diagram" />)
/** The object and image arrows, as {x, tip}: the tip above the axis means upright. */
const arrows = (markup: string) => {
  const out: Record<string, { x: number; tip: number }> = {}
  for (const m of markup.matchAll(/<line x1="([-\d.]+)" y1="([-\d.]+)" x2="[-\d.]+" y2="([-\d.]+)" stroke="(#2e8b57|#1e2330)" stroke-width="2.4"/g)) {
    out[m[4] === '#2e8b57' ? 'image' : 'object'] = { x: Number(m[1]), tip: Number(m[3]) }
  }
  return out
}
const stated = (markup: string) => /the image is ([a-z ]+)</.exec(markup)?.[1] ?? ''
const magnification = (markup: string) => Number(/magnification = ([\d.]+)/.exec(markup)?.[1])

/**
 * The image comes from 1/v = 1/f - 1/u, so what the picture shows and what it says about
 * the image both follow from the physics rather than from the content.
 */
describe('lens diagram', () => {
  it('makes a distant object through a convex lens real, inverted and smaller', () => {
    // u = 12, f = 4: v = 6, so a real inverted image two thirds the size.
    const markup = svg({ kind: 'convex', focalLength: 4, objectDistance: 12, objectHeight: 3 })
    expect(stated(markup)).toBe('real and inverted')
    const { object, image } = arrows(markup)
    expect(object.tip).toBeLessThan(150)          // object points up
    expect(image.tip).toBeGreaterThan(140)        // inverted: image points down
    expect(image.x).toBeGreaterThan(object.x)     // formed on the far side of the lens
    expect(magnification(markup)).toBeCloseTo(0.5, 2)
  })

  it('makes a close object through a convex lens virtual, upright and larger', () => {
    // u = 3, f = 4: v = -12, the magnifying glass case.
    const markup = svg({ kind: 'convex', focalLength: 4, objectDistance: 3, objectHeight: 2 })
    expect(stated(markup)).toBe('virtual and upright')
    const { object, image } = arrows(markup)
    expect(image.tip).toBeLessThan(object.tip)    // upright, and taller
    expect(image.x).toBeLessThan(object.x)        // same side as the object
    expect(magnification(markup)).toBeCloseTo(4, 2)
    expect(markup).toContain('larger than the object')
  })

  it('always makes a concave lens image virtual, upright and smaller', () => {
    for (const u of [2, 6, 20]) {
      const markup = svg({ kind: 'concave', focalLength: 4, objectDistance: u, objectHeight: 3 })
      expect(stated(markup), `u = ${u}`).toBe('virtual and upright')
      expect(magnification(markup)).toBeLessThan(1)
      expect(markup).toContain('smaller than the object')
    }
  })

  it('draws the lens symbol pointing outwards for convex and inwards for concave', () => {
    // The two symbols differ only in which way the arrowheads face, and that is the whole
    // distinction a student is asked to draw.
    const convex = svg({ kind: 'convex', focalLength: 4, objectDistance: 12 })
    const concave = svg({ kind: 'concave', focalLength: 4, objectDistance: 12 })
    const heads = (m: string) => [...m.matchAll(/<polygon points="([-\d.]+),([-\d.]+) /g)].map((x) => Number(x[2]))
    expect(heads(convex)).not.toEqual(heads(concave))
    expect(convex).toContain('Convex lens')
    expect(concave).toContain('Concave lens')
  })

  it('marks a principal focus on each side of the lens', () => {
    const markup = svg({ kind: 'convex', focalLength: 4, objectDistance: 12 })
    const fs = [...markup.matchAll(/<circle cx="([\d.]+)" cy="[\d.]+" r="3"/g)].map((m) => Number(m[1]))
    expect(fs).toHaveLength(2)
    expect(Math.min(...fs)).toBeLessThan(230)
    expect(Math.max(...fs)).toBeGreaterThan(230)
  })
})

describe('the lens symbol', () => {
  /** Each arrowhead as {tip, base}, so which way it points can be read off. */
  const heads = (markup: string) =>
    [...markup.matchAll(/<polygon points="([-\d.]+),([-\d.]+) [-\d.]+,([-\d.]+) /g)].map((m) => ({
      x: Number(m[1]),
      tip: Number(m[2]),
      base: Number(m[3]),
    }))

  it('points both heads outwards for a convex lens', () => {
    // The first version cancelled an offset against a rotate, so both heads pointed the
    // same way and the symbol read as a single arrow rather than a lens.
    const drawn = heads(svg({ kind: 'convex', focalLength: 4, objectDistance: 12 })).filter((h) => Math.abs(h.x - 230) < 2)
    expect(drawn).toHaveLength(2)
    const [top, bottom] = drawn.sort((a, b) => a.tip - b.tip)
    expect(top.tip).toBeLessThan(top.base)        // the upper head points up
    expect(bottom.tip).toBeGreaterThan(bottom.base) // the lower head points down
  })

  it('points both heads inwards for a concave lens', () => {
    const drawn = heads(svg({ kind: 'concave', focalLength: 4, objectDistance: 12 })).filter((h) => Math.abs(h.x - 230) < 2)
    expect(drawn).toHaveLength(2)
    const [top, bottom] = drawn.sort((a, b) => a.tip - b.tip)
    expect(top.tip).toBeGreaterThan(top.base)     // the upper head points down, inwards
    expect(bottom.tip).toBeLessThan(bottom.base)  // the lower head points up, inwards
  })
})
