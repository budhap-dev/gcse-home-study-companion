import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CircleTheorem } from './CircleTheorem.tsx'
import { LineGraph } from './LineGraph.tsx'
import { Cuboid } from './Cuboid.tsx'
import { DotAndCross } from './DotAndCross.tsx'
import { FourBox } from './FourBox.tsx'
import { InequalityRegion } from './InequalityRegion.tsx'
import { LensDiagram } from './LensDiagram.tsx'
import { LogicCircuit } from './LogicCircuit.tsx'
import { MotionGraph } from './MotionGraph.tsx'
import { TriangleConstruction } from './TriangleConstruction.tsx'
import { TrianglePair } from './TrianglePair.tsx'

const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content')
function findProps(comp: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  for (const sub of readdirSync(ROOT).filter((d) => statSync(join(ROOT, d)).isDirectory())) {
    for (const f of readdirSync(join(ROOT, sub)).filter((x) => x.endsWith('.json'))) {
      const doc = JSON.parse(readFileSync(join(ROOT, sub, f), 'utf8'))
      for (const step of doc.lesson?.steps ?? []) {
        for (const v of step.visuals ?? []) if (v.component === comp) out.push(v.props ?? {})
      }
      for (const ex of doc.why?.examples ?? []) {
        if (ex.visual?.component === comp) out.push(ex.visual.props ?? {})
      }
    }
  }
  return out
}

type Pt = { x: number; y: number }
const num = (attrs: string, name: string) => Number(new RegExp(`\\b${name}="(-?[\\d.e-]+)"`).exec(attrs)?.[1] ?? NaN)

/** An SVG arc command from `p`, flattened into short chords (the spec's endpoint-to-centre conversion). */
function arcChords(p: Pt, rx: number, ry: number, large: number, sweep: number, q: Pt, n = 10): [Pt, Pt][] {
  if (!rx || !ry) return [[p, q]]
  const x1 = (p.x - q.x) / 2, y1 = (p.y - q.y) / 2
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry)
  if (lambda > 1) { rx *= Math.sqrt(lambda); ry *= Math.sqrt(lambda) }
  const sign = large === sweep ? -1 : 1
  const k = sign * Math.sqrt(Math.max(0, (rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1) / (rx * rx * y1 * y1 + ry * ry * x1 * x1)))
  const cx = k * ((rx * y1) / ry) + (p.x + q.x) / 2, cy = k * (-(ry * x1) / rx) + (p.y + q.y) / 2
  const a1 = Math.atan2((p.y - cy) / ry, (p.x - cx) / rx)
  let da = Math.atan2((q.y - cy) / ry, (q.x - cx) / rx) - a1
  if (sweep && da < 0) da += 2 * Math.PI
  if (!sweep && da > 0) da -= 2 * Math.PI
  const out: [Pt, Pt][] = []
  for (let i = 0; i < n; i++) {
    const t1 = a1 + (da * i) / n, t2 = a1 + (da * (i + 1)) / n
    out.push([{ x: cx + rx * Math.cos(t1), y: cy + ry * Math.sin(t1) }, { x: cx + rx * Math.cos(t2), y: cy + ry * Math.sin(t2) }])
  }
  return out
}

/** Every piece drawn, as straight segments: lines, circles, polygons, and paths' lines and arcs. */
function shapes(markup: string): [Pt, Pt][][] {
  const out: [Pt, Pt][][] = []
  for (const m of markup.matchAll(/<line\b([^>]*)\/?>/g)) {
    if (/stroke="#e3e0d8"/.test(m[1]!)) continue
    out.push([[{ x: num(m[1]!, 'x1'), y: num(m[1]!, 'y1') }, { x: num(m[1]!, 'x2'), y: num(m[1]!, 'y2') }]])
  }
  // Circles bigger than a point's dot, as 48 chords.
  for (const m of markup.matchAll(/<circle\b([^>]*)\/?>/g)) {
    const cx = num(m[1]!, 'cx'), cy = num(m[1]!, 'cy'), r = num(m[1]!, 'r')
    if (!(r > 6) || /stroke="#e3e0d8"/.test(m[1]!)) continue
    const ring: [Pt, Pt][] = []
    for (let i = 0; i < 48; i++) {
      const t1 = (i * Math.PI) / 24, t2 = ((i + 1) * Math.PI) / 24
      ring.push([{ x: cx + r * Math.cos(t1), y: cy + r * Math.sin(t1) }, { x: cx + r * Math.cos(t2), y: cy + r * Math.sin(t2) }])
    }
    out.push(ring)
  }
  for (const m of markup.matchAll(/<polygon\b[^>]*points="([^"]+)"/g)) {
    const p = m[1]!.trim().split(/[\s]+/).map((xy) => { const [x, y] = xy.split(',').map(Number); return { x: x!, y: y! } })
    out.push(p.map((a, i) => [a, p[(i + 1) % p.length]!] as [Pt, Pt]))
  }
  for (const m of markup.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)) {
    const path: [Pt, Pt][] = []
    let last: Pt | undefined
    for (const c of m[1]!.matchAll(/([MLA])\s*([^MLA]+)/g)) {
      const n = c[2]!.trim().split(/[\s,]+/).map(Number)
      const end = { x: n[n.length - 2]!, y: n[n.length - 1]! }
      if (c[1] === 'L' && last) path.push([last, end])
      if (c[1] === 'A' && last) path.push(...arcChords(last, n[0]!, n[1]!, n[3]!, n[4]!, end))
      last = end
    }
    out.push(path)
  }
  return out
}

/**
 * A label's box from its attributes: its width estimated from its characters, its height the
 * glyphs' own, above the baseline. A white-haloed label is meant to sit over lines, and is left out.
 */
function labels(markup: string, halos = false) {
  const out: { text: string; box: { x: number; y: number; w: number; h: number } }[] = []
  for (const t of markup.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
    const attrs = t[1]!
    if (!halos && /paint-order="stroke"/.test(attrs)) continue
    const text = t[2]!.replace(/<[^>]+>/g, '').replace(/&#?[a-z0-9]+;/gi, 'x')
    if (!text.trim()) continue
    // With halos counted, tick numbers are left out: they sit on the axes by design, and a curve crossing an axis crosses them.
    if (halos && /^[-−]?[\d.]+$/.test(text.trim())) continue
    // The size is an attribute, or set through style (font-size:12px) by components that use the font shorthand.
    const size = num(attrs, 'font-size') || Number(/font-size:\s*([\d.]+)px/.exec(attrs)?.[1]) || 16
    const w = text.length * size * (/font-weight(="|:\s*)700/.test(attrs) ? 0.62 : 0.56)
    const anchor = /text-anchor="(\w+)"/.exec(attrs)?.[1] ?? 'start'
    const x = num(attrs, 'x'), y = num(attrs, 'y')
    const left = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x
    out.push({ text, box: { x: left, y: y - size * 0.7, w, h: size * 0.7 } })
  }
  return out
}

/**
 * A line crossing a label: the points of one drawn element that fall inside the label's box
 * span most of its width or height. A line that ends at a label reaches in and stops; one
 * drawn through it enters one side and leaves the other. (The browser walk uses the same rule.)
 */
function crossings(markup: string, halos = false) {
  const found: string[] = []
  const elements = shapes(markup)
  for (const { text, box } of labels(markup, halos)) {
    for (const segs of elements) {
      const inside: Pt[] = []
      for (const [p, q] of segs) {
        const steps = Math.max(1, Math.ceil(Math.hypot(q.x - p.x, q.y - p.y)))
        for (let i = 0; i <= steps; i++) {
          const pt = { x: p.x + ((q.x - p.x) * i) / steps, y: p.y + ((q.y - p.y) * i) / steps }
          if (pt.x > box.x && pt.x < box.x + box.w && pt.y > box.y && pt.y < box.y + box.h) inside.push(pt)
        }
      }
      if (inside.length < 2) continue
      const spanX = (Math.max(...inside.map((p) => p.x)) - Math.min(...inside.map((p) => p.x))) / box.w
      const spanY = (Math.max(...inside.map((p) => p.y)) - Math.min(...inside.map((p) => p.y))) / box.h
      if (spanX > 0.6 || spanY > 0.6) { found.push(`"${text}" crossed near ${inside[0]!.x.toFixed(0)},${inside[0]!.y.toFixed(0)}`); break }
    }
  }
  return found
}

const LINE_GRAPH_CROSSINGS = 6
const MOTION_GRAPH_CROSSINGS = 2

const cases: [string, ComponentType<{ props: Record<string, unknown>; alt: string }>][] = [
  ['cuboid', Cuboid],
  ['triangle-construction', TriangleConstruction],
  ['triangle-pair', TrianglePair],
  ['circle-theorem', CircleTheorem],
  ['dot-and-cross', DotAndCross],
  ['four-box', FourBox],
  ['inequality-region', InequalityRegion],
  ['lens-diagram', LensDiagram],
  ['logic-circuit', LogicCircuit],
]

/**
 * The browser walk found drawn lines running through labels in these geometry diagrams: the
 * arcs that cross at C in a construction, a radius through O, a right-angle mark through
 * "90°", a hidden edge through a cuboid's θ. Each placed its labels at a fixed offset. This
 * renders every prop set the content uses and fails on any straight line through a label.
 */
describe('labels clear of lines', () => {
  it('can see a line through a label', () => {
    const markup = '<svg><line x1="0" y1="25" x2="200" y2="25" stroke="#000"/><text x="20" y="30" font-size="14">through</text><line x1="0" y1="80" x2="24" y2="76" stroke="#000"/><text x="24" y="80" font-size="14">ending</text></svg>'
    expect(crossings(markup)).toEqual(['"through" crossed near 21,25'])
  })
  /*
   * Every LineGraph label is drawn on a halo, so the check above would pass it whatever it
   * did. Counting haloed labels too (but not tick numbers), this estimate finds 62 names,
   * equations and point labels crossed across the pack on main (27 September 2026). They
   * now look for a clear place, and the 6 left are crowded figures where none exists: two
   * nested circles, three overlapping ones, a stock level's sawtooth. This holds the count.
   */
  it('line-graph, haloed labels included', () => {
    const all = findProps('line-graph')
    expect(all.length).toBeGreaterThan(100)
    const found = all.flatMap((props) => crossings(renderToStaticMarkup(<LineGraph props={props} alt="" />), true).map((f) => `${f} in ${JSON.stringify(props).slice(0, 60)}`))
    expect(found.length, found.join('\n')).toBeLessThanOrEqual(LINE_GRAPH_CROSSINGS)
  })
  // MotionGraph's labels are all haloed too since they were moved clear of what is drawn:
  // 6 crossed on main by this estimate, 2 left where a gradient or tangent sits among markers.
  it('motion-graph, haloed labels included', () => {
    const all = findProps('motion-graph')
    expect(all.length).toBeGreaterThan(10)
    const found = all.flatMap((props) => crossings(renderToStaticMarkup(<MotionGraph props={props} alt="" />), true).map((f) => `${f} in ${JSON.stringify(props).slice(0, 60)}`))
    expect(found.length, found.join('\n')).toBeLessThanOrEqual(MOTION_GRAPH_CROSSINGS)
  })
  for (const [kind, Comp] of cases) {
    it(kind, () => {
      const all = findProps(kind)
      expect(all.length, kind).toBeGreaterThan(0)
      for (const props of all) {
        const found = crossings(renderToStaticMarkup(<Comp props={props} alt="" />))
        expect(found, `${kind} ${JSON.stringify(props).slice(0, 120)}`).toEqual([])
      }
    })
  }
})
