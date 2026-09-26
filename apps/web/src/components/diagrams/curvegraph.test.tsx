import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CurveGraph } from './CurveGraph.tsx'

const svg = (props: Record<string, unknown>) => renderToStaticMarkup(<CurveGraph props={props} alt="a rate graph" />)

/**
 * Every number the SVG actually draws with, including the ones inside the `d` of a path
 * and the `y` a label is placed at. An earlier version of this read only the attributes
 * and so missed the curve itself, which is exactly where the broken coordinates were.
 */
function numbers(markup: string): number[] {
  const out: number[] = []
  for (const m of markup.matchAll(/(?:\b(?:x|y|x1|y1|x2|y2|cx|cy)|d|points)="([^"]*)"/g)) {
    for (const n of m[1]!.matchAll(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)) out.push(Number(n[0]))
  }
  return out.filter((n) => !Number.isNaN(n))
}

describe('curve graph', () => {
  it('draws the usual positive curves inside its own box', () => {
    for (const kind of ['saturating', 'optimum', 'linear', 'inverse-square']) {
      const drawn = numbers(svg({ curves: [{ kind }] }))
      expect(drawn.every((n) => Number.isFinite(n)), kind).toBe(true)
      expect(Math.max(...drawn.map(Math.abs)), kind).toBeLessThan(1000)
    }
  })

  /**
   * A falling line makes every sample negative, which collapsed the vertical scale and
   * produced y coordinates around 3.4e7. The SVG still rendered, but the page around it
   * was pushed so far down that the lesson's answer buttons could not be clicked — a
   * failure no test could see and the clipped-text scan did not catch either.
   */
  it('stays inside its box when a curve goes negative', () => {
    const drawn = numbers(svg({ curves: [{ kind: 'linear', m: -1 }], markers: [{ x: 5, label: 'crosses zero' }] }))
    expect(drawn.every(Number.isFinite)).toBe(true)
    expect(Math.max(...drawn.map(Math.abs))).toBeLessThan(1000)
  })

  it('never emits a coordinate that is not a finite number', () => {
    for (const curves of [[{ kind: 'linear', m: 0 }], [{ kind: 'saturating', max: 0 }], [{ kind: 'linear', m: -5 }, { kind: 'optimum' }]]) {
      const markup = svg({ curves })
      expect(markup).not.toContain('NaN')
      expect(markup).not.toContain('Infinity')
    }
  })

  it('labels the axes and draws a marker where it is asked for', () => {
    const markup = svg({ xLabel: 'temperature', yLabel: 'rate', markers: [{ x: 6, label: 'optimum' }] })
    expect(markup).toContain('temperature')
    expect(markup).toContain('rate')
    expect(markup).toContain('optimum')
  })

  it('keeps every label at 11px or more, which is the readable floor on a phone', () => {
    const sizes = [...svg({ numbers: true, markers: [{ x: 5, label: 'here' }], curves: [{ kind: 'optimum', label: 'activity' }] }).matchAll(/font-size="(\d+)"/g)].map((m) => Number(m[1]))
    expect(sizes.length).toBeGreaterThan(0)
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(11)
  })

  /**
   * A curve's label sits just above the curve at the right-hand edge — which, for a curve
   * that has levelled off, is exactly where the top gridline runs, so the label had a line
   * through it. Both it and a marker's label are drawn on a white halo now, the same way
   * `ReactionProfile` draws text that has to sit over the picture.
   */
  it('draws a curve label on a white halo', () => {
    const label = /<text[^>]*>more carbon dioxide<\/text>/.exec(svg({ curves: [{ kind: 'saturating', label: 'more carbon dioxide' }] }))![0]
    expect(label).toContain('paint-order="stroke"')
    expect(label).toContain('stroke="#ffffff"')
  })

  it('draws a marker label on a white halo too', () => {
    const label = /<text[^>]*>37 °C<\/text>/.exec(svg({ curves: [{ kind: 'optimum' }], markers: [{ x: 3.7, label: '37 °C' }] }))![0]
    expect(label).toContain('paint-order="stroke"')
  })

  it('still puts a curve label at the right-hand end unless labelX says otherwise', () => {
    const at = (props: Record<string, unknown>) => Number(/<text x="([\d.]+)"[^>]*>named<\/text>/.exec(svg(props))![1])
    expect(at({ curves: [{ kind: 'linear', label: 'named' }] })).toBeGreaterThan(200)
    expect(at({ curves: [{ kind: 'linear', label: 'named', labelX: 2 }] })).toBeLessThan(200)
  })
})

/**
 * The measurement that matters: every curve graph the content pack actually draws has to
 * fit a 390px phone without scrolling. `fitSvgText` stops the drawing shrinking below its
 * own viewBox width, so anything wider than the ~298 units a phone card leaves scrolls
 * sideways — this scrolled 62px before the graph was narrowed to 280 units wide.
 */
describe('curve graph fits a phone', () => {
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
   * A text's on-page extent, estimated the way this whole pack of phone-fit tests does:
   * a character is 0.6 × its font size wide, and text-anchor says which way that width
   * runs from the x it is drawn at.
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

  it('found curve-graph in the content pack', () => {
    expect(findProps('curve-graph').length).toBeGreaterThan(10)
  })

  it('keeps every viewBox at or under 296, with every label inside it', () => {
    for (const props of findProps('curve-graph')) {
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

/**
 * A later curve used to be painted over an earlier curve's label, and every curve over the
 * marker labels. Labels are drawn after every line so their white halo can do its job.
 */
describe('curve graph labels', () => {
  it('draws every label after every line', () => {
    const html = renderToStaticMarkup(
      <CurveGraph
        alt="two antibody responses"
        props={{ xLabel: 'time', yLabel: 'antibodies', markers: [{ x: 5, label: 'optimum' }], curves: [{ kind: 'optimum', label: 'first', peak: 6, max: 1 }, { kind: 'optimum', label: 'second', peak: 3, max: 4 }] }}
      />,
    )
    const lastPath = html.lastIndexOf('<path')
    for (const label of ['first', 'second', 'optimum']) expect(html.indexOf(`>${label}</text>`), label).toBeGreaterThan(lastPath)
  })
})
