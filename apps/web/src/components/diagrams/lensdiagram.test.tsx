import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
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
    // The lens itself sits at W / 2 = 140; one focus is on each side of it.
    expect(Math.min(...fs)).toBeLessThan(140)
    expect(Math.max(...fs)).toBeGreaterThan(140)
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
    const drawn = heads(svg({ kind: 'convex', focalLength: 4, objectDistance: 12 })).filter((h) => Math.abs(h.x - 140) < 2)
    expect(drawn).toHaveLength(2)
    const [top, bottom] = drawn.sort((a, b) => a.tip - b.tip)
    expect(top.tip).toBeLessThan(top.base)        // the upper head points up
    expect(bottom.tip).toBeGreaterThan(bottom.base) // the lower head points down
  })

  it('points both heads inwards for a concave lens', () => {
    const drawn = heads(svg({ kind: 'concave', focalLength: 4, objectDistance: 12 })).filter((h) => Math.abs(h.x - 140) < 2)
    expect(drawn).toHaveLength(2)
    const [top, bottom] = drawn.sort((a, b) => a.tip - b.tip)
    expect(top.tip).toBeGreaterThan(top.base)     // the upper head points down, inwards
    expect(bottom.tip).toBeLessThan(bottom.base)  // the lower head points up, inwards
  })
})

describe('labels near the focus', () => {
  /**
   * A distant object images at the focus. The image label used to sit under a tiny
   * arrow, straight across the F label, and the arrow itself ran through the F.
   */
  it('puts a short image label beside its arrow and steps the F label aside', () => {
    const html = renderToStaticMarkup(
      <LensDiagram props={{ kind: 'convex', focalLength: 4, objectDistance: 100, objectHeight: 3 }} alt="a very distant object imaged at the principal focus of a convex lens" />,
    )
    const image = html.match(/<text x="([\d.]+)" y="([\d.]+)" text-anchor="middle"[^>]*>image<\/text>/)
    expect(image).not.toBeNull()
    const fs = [...html.matchAll(/<text x="([\d.]+)" y="([\d.]+)" text-anchor="(start|end|middle)"[^>]*>F<\/text>/g)]
    expect(fs).toHaveLength(2)
    // The covered F steps to the side away from the lens (the lens is at x = W/2 = 140).
    const covered = fs.find((m) => m[3] !== 'middle')
    expect(covered).toBeDefined()
    expect(covered![3]).toBe('start')
    expect(Number(covered![1])).toBeGreaterThan(140)
    // The axis is at H/2 - 10 = 140: the covered F sits above it, the image label well below.
    expect(Number(covered![2])).toBeLessThan(140)
    expect(Number(image![2])).toBeGreaterThanOrEqual(140 + 34)
    // And the word "image" clears the lens line: half its width, about 18, plus a margin.
    expect(Math.abs(Number(image![1]) - 140)).toBeGreaterThanOrEqual(18)
  })

  it('leaves a tall image labelled under its arrow as before', () => {
    const html = renderToStaticMarkup(
      <LensDiagram props={{ kind: 'convex', focalLength: 4, objectDistance: 12, objectHeight: 3 }} alt="an object beyond twice the focal length of a convex lens" />,
    )
    expect(html).toMatch(/text-anchor="middle"[^>]*>image<\/text>/)
  })
})

/**
 * The measurement that matters: every lens diagram the content pack actually draws has to
 * fit a 390px phone without scrolling. `fitSvgText` stops the drawing shrinking below its
 * own viewBox width, so anything wider than the ~298 units a phone card leaves scrolls
 * sideways — this scrolled up to 246px before the diagram was narrowed to 280 units wide,
 * with its title and caption sentences wrapped onto more than one line to still fit.
 */
describe('lens diagram fits a phone', () => {
  const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content')
  function findProps(component: string): Record<string, unknown>[] {
    const out: Record<string, unknown>[] = []
    for (const sub of readdirSync(ROOT).filter((d) => statSync(join(ROOT, d)).isDirectory())) {
      for (const f of readdirSync(join(ROOT, sub)).filter((x) => x.endsWith('.json'))) {
        const doc = JSON.parse(readFileSync(join(ROOT, sub, f), 'utf8'))
        for (const step of doc.lesson?.steps ?? []) {
          for (const v of step.visuals ?? []) if (v.component === component) out.push(v.props ?? {})
        }
        for (const ex of doc.why?.examples ?? []) {
          if (ex.visual?.component === component) out.push(ex.visual.props ?? {})
        }
      }
    }
    return out
  }

  /**
   * A text's on-page extent, estimated the way this whole pack of phone-fit tests does: a
   * character is 0.6 × its font size wide, and text-anchor says which way that width runs
   * from the x it is drawn at. Every text here is unrotated.
   */
  function textExtents(markup: string): { left: number; right: number; text: string }[] {
    const out: { left: number; right: number; text: string }[] = []
    for (const m of markup.matchAll(/<text\s+([^>]*)>([^<]*)<\/text>/g)) {
      const attrs = m[1]!, text = m[2]!
      if (!text.trim()) continue
      const x = Number(/(?:^|\s)x="(-?[\d.]+)"/.exec(attrs)?.[1])
      if (!Number.isFinite(x)) continue
      const size = Number(/font-size="(-?[\d.]+)"/.exec(attrs)?.[1] ?? 11)
      const anchor = /text-anchor="(\w+)"/.exec(attrs)?.[1] ?? 'start'
      const w = text.length * size * 0.6
      const [left, right] = anchor === 'end' ? [x - w, x] : anchor === 'middle' ? [x - w / 2, x + w / 2] : [x, x + w]
      out.push({ left, right, text })
    }
    return out
  }

  it('found lens-diagram in the content pack', () => {
    expect(findProps('lens-diagram').length).toBeGreaterThan(3)
  })

  it('keeps every viewBox at or under 296, with every label inside it', () => {
    for (const props of findProps('lens-diagram')) {
      const markup = svg(props)
      const vw = Number(/viewBox="0 0 ([\d.]+)/.exec(markup)?.[1])
      expect(vw, JSON.stringify(props)).toBeLessThanOrEqual(296)
      for (const { left, right, text } of textExtents(markup)) {
        expect(left, `"${text}" in ${JSON.stringify(props)}`).toBeGreaterThanOrEqual(-0.5)
        expect(right, `"${text}" in ${JSON.stringify(props)}`).toBeLessThanOrEqual(vw + 0.5)
      }
    }
  })
})
