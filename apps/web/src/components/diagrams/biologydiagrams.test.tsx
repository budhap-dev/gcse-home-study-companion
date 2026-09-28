import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CellDiagram, LABELS, W as CELL_W, leaderLines } from './CellDiagram.tsx'
import { HeartDiagram, W as HEART_W } from './HeartDiagram.tsx'

const cell = (kind: string) => renderToStaticMarkup(<CellDiagram props={{ cell: kind }} alt="A labelled cell" />)

type P = [number, number]
/** Whether segments ab and cd cross, strictly: touching at an end does not count. */
const cross = (a: P, b: P, c: P, d: P) => {
  const o = (p: P, q: P, r: P) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]))
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0
}

describe('the cell diagram', () => {
  /** Edexcel 1BI0 1.1 names the structures for each kind of cell; every one must be labelled. */
  it('labels every structure 1.1 names', () => {
    const want: Record<string, string[]> = {
      animal: ['Nucleus', 'Cell membrane', 'Mitochondria', 'Ribosomes'],
      plant: ['Nucleus', 'Cell membrane', 'Cell wall', 'Chloroplasts', 'Mitochondria', 'Vacuole', 'Ribosomes'],
      bacterium: ['Chromosomal DNA', 'Plasmid DNA', 'Cell membrane', 'Ribosomes', 'Flagellum'],
    }
    for (const [kind, names] of Object.entries(want)) {
      const html = cell(kind)
      for (const n of names) expect(html, `${kind}: ${n}`).toContain(`data-label="${n}"`)
    }
  })

  /** No two leader lines cross: a crossing makes it look as if a label points at the wrong part. */
  it('draws leader lines that never cross', () => {
    for (const kind of ['animal', 'plant', 'bacterium'] as const) {
      const lines = leaderLines(kind)
      for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
        expect(cross(lines[i]!.from, lines[i]!.to, lines[j]!.from, lines[j]!.to), `${kind}: ${lines[i]!.name} crosses ${lines[j]!.name}`).toBe(false)
      }
    }
  })

  it('knows a crossing when it sees one', () => {
    expect(cross([0, 0], [10, 10], [0, 10], [10, 0])).toBe(true)
    expect(cross([0, 0], [10, 0], [0, 5], [10, 5])).toBe(false)
  })

  it('fits a phone card, labels included', () => {
    expect(CELL_W).toBeLessThanOrEqual(298)
    for (const labels of Object.values(LABELS)) for (const l of labels) expect(176 + l.name.length * 12 * 0.6, l.name).toBeLessThanOrEqual(CELL_W)
  })
})

describe('the heart diagram', () => {
  const html = renderToStaticMarkup(<HeartDiagram props={{}} alt="The heart" />)

  /** 1BI0 8.8: the chambers, the major blood vessels and the valves. */
  it('names the four chambers and the four vessels', () => {
    for (const t of ['Right', 'Left', 'atrium', 'ventricle', 'Pulmonary', 'artery', 'vein', 'Vena cava', 'Aorta', 'Valve']) expect(html, t).toContain(t)
  })

  it('draws the left ventricle with the thickest wall', () => {
    const walls = [...html.matchAll(/<rect[^>]*stroke-width="(\d+)"[^>]*>(?:<\/rect>)?<text[^>]*>(Left|Right)<\/text><text[^>]*>(atrium|ventricle)</g)].map((m) => ({ name: `${m[2]} ${m[3]}`, wall: Number(m[1]) }))
    expect(walls).toHaveLength(4)
    const lv = walls.find((w) => w.name === 'Left ventricle')!
    for (const w of walls) if (w !== lv) expect(lv.wall, w.name).toBeGreaterThan(w.wall)
  })

  /** Every label inside the 294 units, however it is anchored, at 0.6 of the font size a character. */
  it('fits a phone card', () => {
    expect(HEART_W).toBeLessThanOrEqual(298)
    const texts = [...html.matchAll(/<text x="([\d.]+)"([^>]*)>([^<]+)<\/text>/g)]
    expect(texts.length).toBeGreaterThan(15)
    for (const [, xs, attrs, text] of texts) {
      const x = Number(xs), size = Number(/font-size="(\d+)"/.exec(attrs!)?.[1] ?? 12), w = text!.length * size * 0.6
      const [left, right] = /text-anchor="end"/.test(attrs!) ? [x - w, x] : /text-anchor="middle"/.test(attrs!) ? [x - w / 2, x + w / 2] : [x, x + w]
      expect(left, text).toBeGreaterThanOrEqual(0)
      expect(right, text).toBeLessThanOrEqual(HEART_W)
    }
  })
})
