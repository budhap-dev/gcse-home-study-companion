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
})
