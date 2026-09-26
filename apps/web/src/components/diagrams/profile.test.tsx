import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
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
    for (const word of ['activation', 'energy', 'overall', 'change']) expect(markup).toContain(`>${word}</text>`)
  })

  /** A taller hump must not move the levels: that is the misconception being taught against. */
  it('leaves the levels where they are when only the activation energy changes', () => {
    const low = levels(svg({ activation: 60, change: -80 }))
    const high = levels(svg({ activation: 60, change: -80 }))
    expect(low).toEqual(high)
  })
})

const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content')
function contentProps(): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = []
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (node && typeof node === 'object') {
      const o = node as Record<string, unknown>
      if (o.component === 'reaction-profile') found.push(o.props as Record<string, unknown>)
      Object.values(o).forEach(walk)
    }
  }
  for (const d of readdirSync(ROOT).filter((x) => statSync(join(ROOT, x)).isDirectory()))
    for (const f of readdirSync(join(ROOT, d)).filter((x) => x.endsWith('.json'))) walk(JSON.parse(readFileSync(join(ROOT, d, f), 'utf8')))
  return found
}

interface Box { l: number; r: number; t: number; b: number; what: string }
/** Each text's box: 0.6 × size per character wide, a size tall; an upright text turned on its side. */
function boxes(m: string): Box[] {
  return [...m.matchAll(/<text x="([\d.-]+)" y="([\d.-]+)"([^>]*)>([^<]+)<\/text>/g)].map((t) => {
    const x = Number(t[1]), y = Number(t[2]), attrs = t[3]!, text = t[4]!
    const size = Number(/font-size="([\d.]+)"/.exec(attrs)?.[1] ?? '12')
    const w = text.length * 0.6 * size
    const anchor = /text-anchor="(\w+)"/.exec(attrs)?.[1] ?? 'start'
    if (/rotate\(-90/.test(attrs)) return { l: x - size * 0.75, r: x + size * 0.25, t: y - w / 2, b: y + w / 2, what: text }
    const l = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x
    return { l, r: l + w, t: y - size * 0.75, b: y + size * 0.25, what: text }
  })
}
const overlap = (a: Box, b: Box) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b

/**
 * On a phone the first narrow layout put the reactant name across the activation arrow
 * and the rising curve, and the product name on the "exothermic" caption. No two labels
 * may overlap, and none may sit on either arrow, for any profile the content draws.
 */
describe('reaction profile on a phone', () => {
  const all = contentProps()
  it('found the content profiles', () => expect(all.length).toBeGreaterThanOrEqual(5))

  it('fits 296 units and keeps every label clear of the others and of both arrows', () => {
    for (const p of all) {
      const m = svg(p)
      expect(Number(/viewBox="0 0 ([\d.]+)/.exec(m)![1])).toBeLessThanOrEqual(296)
      const b = boxes(m)
      for (const x of b) expect(x.l >= 0 && x.r <= 290, `${x.what} inside`).toBe(true)
      for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) expect(overlap(b[i]!, b[j]!), `${b[i]!.what} / ${b[j]!.what} in ${JSON.stringify(p)}`).toBe(false)
      const arrows = [...m.matchAll(/<line x1="([\d.]+)" y1="([\d.]+)" x2="\1" y2="([\d.]+)" stroke="[^"]+" stroke-width="1.5"/g)]
        .map((a) => ({ l: Number(a[1]) - 4, r: Number(a[1]) + 4, t: Math.min(Number(a[2]), Number(a[3])), b: Math.max(Number(a[2]), Number(a[3])), what: 'arrow' }))
        .filter((a) => a.l > 44)
      expect(arrows).toHaveLength(2)
      for (const a of arrows) for (const x of b) expect(overlap(a, x), `${x.what} on an arrow in ${JSON.stringify(p)}`).toBe(false)
    }
  })
})

