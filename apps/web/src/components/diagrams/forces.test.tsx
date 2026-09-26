import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FreeBody } from './FreeBody.tsx'
import { MotionGraph } from './MotionGraph.tsx'
import { VectorTriangle } from './VectorTriangle.tsx'

/**
 * The three Year 9 Forces diagrams compute what they print, so the numbers on the
 * picture must agree with the content that names them: a resultant, a gradient, an
 * area, a vector sum. A diagram that printed the wrong resultant would teach it.
 */
describe('free body diagram', () => {
  it('writes the resultant from the arrows', () => {
    const html = renderToStaticMarkup(<FreeBody alt="" props={{ object: 'crate', forces: [{ direction: 'right', size: 300, label: 'push' }, { direction: 'left', size: 200, label: 'friction' }] }} />)
    expect(html).toContain('100 N to the right')
    // The name and the size are two lines above the arrow.
    expect(html).toContain('>push</text>')
    expect(html).toContain('>300 N</text>')
  })
  it('calls equal and opposite forces balanced', () => {
    const html = renderToStaticMarkup(<FreeBody alt="" props={{ object: 'book', forces: [{ direction: 'down', size: 8 }, { direction: 'up', size: 8 }] }} />)
    expect(html).toContain('the forces are balanced')
  })
  it('gives a vertical resultant its direction', () => {
    const html = renderToStaticMarkup(<FreeBody alt="" props={{ object: 'rocket', forces: [{ direction: 'up', size: 1200 }, { direction: 'down', size: 800 }] }} />)
    expect(html).toContain('400 N upwards')
  })
})

describe('motion graph', () => {
  it('labels a gradient triangle with its rise and run', () => {
    const html = renderToStaticMarkup(<MotionGraph alt="" props={{ kind: 'distance-time', points: [{ t: 0, y: 0 }, { t: 20, y: 160 }, { t: 35, y: 160 }], gradient: { from: 0, to: 20, label: '8 m/s' } }} />)
    expect(html).toContain('>20 s<')
    expect(html).toContain('>160<')
    expect(html).toContain('8 m/s')
    expect(html).toContain('distance (m)')
  })
  it('shades an area under a velocity-time graph and puts its label on it', () => {
    const html = renderToStaticMarkup(<MotionGraph alt="" props={{ kind: 'velocity-time', points: [{ t: 0, y: 0 }, { t: 6, y: 12 }, { t: 10, y: 12 }], shade: [{ from: 0, to: 6, label: '36 m' }] }} />)
    expect(html).toContain('36 m')
    expect(html).toContain('velocity (m/s)')
    expect((html.match(/<path/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })
  it('interpolates the gradient triangle onto a sloped section', () => {
    // Between 0 s and 3 s on a line rising 12 m/s over 6 s the rise is 6.
    const html = renderToStaticMarkup(<MotionGraph alt="" props={{ kind: 'velocity-time', points: [{ t: 0, y: 0 }, { t: 6, y: 12 }], gradient: { from: 0, to: 3 } }} />)
    expect(html).toContain('>3 s<')
    expect(html).toContain('>6<')
  })
  it('puts the time axis along the foot of the plot when asked, not through a plateau at 0', () => {
    // A heating curve from -20 °C: its melting plateau is at 0, where the axis normally goes.
    const points = [{ t: 0, y: -20 }, { t: 20, y: 0 }, { t: 180, y: 0 }, { t: 400, y: 100 }]
    // The axes are the only lines drawn 1.5 wide; the horizontal one has equal y1 and y2.
    const axisY = (html: string) => [...html.matchAll(/<line x1="[\d.]+" y1="([\d.]+)" x2="[\d.]+" y2="([\d.]+)" stroke="[^"]+" stroke-width="1.5"/g)].find((m) => m[1] === m[2])?.[1]
    const bottom = String(300 - 44)
    expect(axisY(renderToStaticMarkup(<MotionGraph alt="" props={{ points, yMax: 120, axisAtBottom: true }} />))).toBe(bottom)
    expect(axisY(renderToStaticMarkup(<MotionGraph alt="" props={{ points, yMax: 120 }} />))).not.toBe(bottom)
  })
})

describe('vector triangle', () => {
  it('works out the resultant of perpendicular forces', () => {
    const html = renderToStaticMarkup(<VectorTriangle alt="" props={{ vectors: [{ x: 4, y: 0, label: '4 N' }, { x: 0, y: 3, label: '3 N' }] }} />)
    expect(html).toContain('resultant 5 N')
  })
  it('can leave the resultant for the student to draw', () => {
    const html = renderToStaticMarkup(<VectorTriangle alt="" props={{ vectors: [{ x: 6, y: 0 }, { x: 0, y: 8 }], resultant: false, unit: 'kN' }} />)
    expect(html).not.toContain('resultant')
    expect(html).toContain('6 kN')
  })
})

/**
 * On a phone the labels once sat beyond each horizontal arrow's tip, which needed up to
 * 500 units; squeezed, the arrow ran through its own label. Every free body diagram the
 * content draws must fit 296 units with no label on an arrow or on another label, and a
 * bigger force must still get a longer arrow.
 */
describe('free body diagram on a phone', () => {
  const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content')
  const all: Record<string, unknown>[] = []
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (node && typeof node === 'object') {
      const o = node as Record<string, unknown>
      if (o.component === 'free-body') all.push(o.props as Record<string, unknown>)
      Object.values(o).forEach(walk)
    }
  }
  for (const d of readdirSync(ROOT).filter((x) => statSync(join(ROOT, x)).isDirectory()))
    for (const f of readdirSync(join(ROOT, d)).filter((x) => x.endsWith('.json'))) walk(JSON.parse(readFileSync(join(ROOT, d, f), 'utf8')))

  it('found the content diagrams', () => expect(all.length).toBeGreaterThanOrEqual(8))

  it('fits, keeps labels off arrows and each other, and scales arrows by force', () => {
    for (const p of all) {
      const m = renderToStaticMarkup(<FreeBody alt="" props={p} />)
      const vw = Number(/viewBox="0 0 ([\d.]+)/.exec(m)![1])
      expect(vw).toBeLessThanOrEqual(296)
      const texts = [...m.matchAll(/<text x="([\d.]+)" y="([\d.]+)" text-anchor="(\w+)"[^>]*font-size="(\d+)"[^>]*>([^<]+)<\/text>/g)].map((t) => {
        const x = Number(t[1]), y = Number(t[2]), size = Number(t[4]), w = t[5]!.length * 0.6 * size
        const l = t[3] === 'middle' ? x - w / 2 : t[3] === 'end' ? x - w : x
        return { l, r: l + w, t: y - size * 0.75, b: y + size * 0.25, what: t[5]! }
      })
      for (const t of texts) expect(t.l >= 0 && t.r <= vw, `${t.what} inside`).toBe(true)
      const arrows = [...m.matchAll(/<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/g)].map((a) => {
        const [x1, y1, x2, y2] = [a[1], a[2], a[3], a[4]].map(Number) as [number, number, number, number]
        return { l: Math.min(x1, x2) - 4, r: Math.max(x1, x2) + 4, t: Math.min(y1, y2) - 4, b: Math.max(y1, y2) + 4, len: Math.hypot(x2 - x1, y2 - y1) }
      })
      const hit = (a: { l: number; r: number; t: number; b: number }, b: { l: number; r: number; t: number; b: number }) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b
      for (const t of texts) for (const a of arrows) expect(hit(t, a), `${t.what} on an arrow in ${JSON.stringify(p).slice(0, 80)}`).toBe(false)
      for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) expect(hit(texts[i]!, texts[j]!), `${texts[i]!.what} / ${texts[j]!.what}`).toBe(false)
      // Arrows are drawn left, right, up, down; match each force to its arrow in that order.
      const order = ['left', 'right', 'up', 'down']
      const sizes = ((p.forces as { size: number; direction: string }[]) ?? []).filter((f) => f.size !== 0)
        .sort((a, b) => order.indexOf(a.direction) - order.indexOf(b.direction)).map((f) => Math.abs(f.size))
      for (let i = 0; i < sizes.length; i++) for (let j = 0; j < sizes.length; j++)
        if (sizes[i]! > sizes[j]!) expect(arrows[i]!.len, `${sizes[i]} N longer than ${sizes[j]} N`).toBeGreaterThan(arrows[j]!.len)
    }
  })
})

