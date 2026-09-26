import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DotAndCross } from './DotAndCross.tsx'

const CONTENT = join(import.meta.dirname, '../../../../../supabase/seed/content')

/** Every distinct props object a "dot-and-cross" use in the content pack passes. */
function everyDotAndCrossProps(): Record<string, unknown>[] {
  const seen = new Map<string, Record<string, unknown>>()
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (node && typeof node === 'object') {
      const o = node as Record<string, unknown>
      if (o.component === 'dot-and-cross' && o.props) {
        const p = o.props as Record<string, unknown>
        seen.set(JSON.stringify(p), p)
      }
      for (const v of Object.values(o)) walk(v)
    }
  }
  for (const subject of readdirSync(CONTENT)) {
    const dir = join(CONTENT, subject)
    if (!statSync(dir).isDirectory()) continue
    for (const f of readdirSync(dir)) {
      if (f.endsWith('.json')) walk(JSON.parse(readFileSync(join(dir, f), 'utf8')))
    }
  }
  return [...seen.values()]
}

const svg = (props: Record<string, unknown>) =>
  renderToStaticMarkup(<DotAndCross props={props} alt="a dot and cross diagram" />)

const ionic = (transfer: number) =>
  svg({
    kind: 'ionic',
    atoms:
      transfer === 1
        ? [{ symbol: 'Na', outer: 1, mark: 'cross' }, { symbol: 'Cl', outer: 7, mark: 'dot' }]
        : [{ symbol: 'Mg', outer: 2, mark: 'cross' }, { symbol: 'O', outer: 6, mark: 'dot' }],
    transfer,
  })

/** Every `<text>` with its position, so a label can be tested against the shapes it sits near. */
const labels = (markup: string) => {
  const out: { text: string; x: number; y: number }[] = []
  for (const m of markup.matchAll(/<text x="([-\d.]+)" y="([-\d.]+)"[^>]*>(.*?)<\/text>/g)) {
    out.push({ text: m[3]!.replace(/<[^>]+>/g, ''), x: Number(m[1]), y: Number(m[2]) })
  }
  return out
}
const find = (markup: string, needle: string) => labels(markup).find((l) => l.text.includes(needle))!
const box = (markup: string) => {
  const m = /<rect x="([-\d.]+)" y="([-\d.]+)" width="([-\d.]+)" height="([-\d.]+)"/.exec(markup)!
  const [x, y, w, h] = m.slice(1).map(Number) as [number, number, number, number]
  return { top: y, bottom: y + h, left: x, right: x + w }
}

/**
 * Both annotations on an ionic diagram used to be drawn inside the figure they describe:
 * the transfer label between two boxes only 62px apart, and "outer electrons given away"
 * inside the circle. SVG neither wraps nor clips, so both simply printed over the atoms
 * and every check passed — the collisions were with a box and a circle, not with other
 * text, which is what a label-against-label scan looks at.
 */
describe('ionic dot and cross', () => {
  it('keeps the transfer label above the atoms rather than across them', () => {
    const markup = ionic(1)
    const label = find(markup, 'transferred')
    expect(label.text.replace(/\s+/g, ' ')).toBe('1 electron transferred')
    // An 11px label of this length is about 120 wide, and the gap between the boxes is 62.
    expect(label.y).toBeLessThan(box(markup).top)
  })

  it('puts the "given away" note below the box, not through the circle', () => {
    const markup = ionic(1)
    const note = find(markup, 'given away')
    const circle = /<circle cx="([-\d.]+)" cy="([-\d.]+)" r="([-\d.]+)"/.exec(markup)!
    const [, cy, r] = circle.slice(1).map(Number) as [number, number, number]
    expect(note.y).toBeGreaterThan(cy + r)
    expect(note.y).toBeGreaterThan(box(markup).bottom)
  })

  it('leaves room for both bands in the canvas', () => {
    const markup = ionic(2)
    const height = Number(/viewBox="0 0 [\d.]+ ([\d.]+)"/.exec(markup)![1])
    const caption = labels(markup).at(-1)!
    expect(find(markup, 'transferred').text).toContain('2 electrons')
    expect(caption.y).toBeLessThan(height)
    expect(caption.y).toBeGreaterThan(find(markup, 'given away').y)
  })

  it('leaves a covalent diagram canvas alone', () => {
    const markup = svg({ kind: 'covalent', atoms: [{ symbol: 'H', outer: 1, mark: 'dot' }, { symbol: 'Cl', outer: 7, mark: 'cross' }], shared: 1 })
    expect(markup).toContain('viewBox="0 0 274 160"')
  })
})

/**
 * The ionic layout used to be a fixed 378 wide regardless of props — 82px over a phone's
 * 296-wide budget — because of unused margin, not anything the atoms or their labels
 * needed. Every prop set the content pack actually uses is checked here, so a fix that
 * happens to work for sodium chloride cannot quietly leave magnesium oxide, or the
 * central-atom molecules, still scrolling.
 */
describe('dot and cross fits a phone for every use in the content pack', () => {
  const uses = everyDotAndCrossProps()

  it('found them', () => {
    expect(uses.length).toBeGreaterThanOrEqual(9)
  })

  it('keeps the viewBox within the phone width for every use', () => {
    for (const props of uses) {
      const markup = svg(props)
      const [width] = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(markup)!.slice(1).map(Number)
      expect(width, JSON.stringify(props)).toBeLessThanOrEqual(296)
    }
  })

  it('never lowers a fontSize below 11', () => {
    for (const props of uses) {
      const sizes = [...svg(props).matchAll(/font-size="([\d.]+)"/g)].map((m) => Number(m[1]))
      for (const s of sizes) expect(s, JSON.stringify(props)).toBeGreaterThanOrEqual(11)
    }
  })

  /** x ± 0.6 × fontSize × characters, by text-anchor, must lie inside the viewBox. */
  it('keeps every label inside the viewBox', () => {
    const escaped: string[] = []
    for (const props of uses) {
      const markup = svg(props)
      const [width, height] = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(markup)!.slice(1).map(Number) as [number, number]
      const texts = [...markup.matchAll(/<text x="([-\d.]+)" y="([-\d.]+)"([^>]*)>([^<]*)<\/text>/g)]
      for (const m of texts) {
        const x = Number(m[1]), y = Number(m[2]), attrs = m[3]!, text = m[4]!
        if (!text.trim()) continue
        const fontSize = Number(/font-size="([\d.]+)"/.exec(attrs)?.[1] ?? 11)
        const anchor = /text-anchor="(\w+)"/.exec(attrs)?.[1] ?? 'start'
        const w = 0.6 * fontSize * text.length
        const left = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x
        const right = left + w
        if (left < -0.5 || right > width + 0.5 || y < 0 || y > height + 0.5) {
          escaped.push(`${JSON.stringify(props)}: "${text}" left ${left.toFixed(1)} right ${right.toFixed(1)} y ${y} (canvas ${width}x${height})`)
        }
      }
    }
    expect(escaped).toEqual([])
  })
})
