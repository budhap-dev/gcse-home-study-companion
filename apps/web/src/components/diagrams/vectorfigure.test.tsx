import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { VectorFigure } from './VectorFigure.tsx'

const svg = (props: Record<string, unknown>) => renderToStaticMarkup(<VectorFigure props={props} alt="a vector figure" />)
/** Where each named vertex was actually drawn, taken from its dot. */
const dots = (markup: string) => [...markup.matchAll(/<circle cx="([-\d.]+)" cy="([-\d.]+)"/g)].map((m) => [Number(m[1]), Number(m[2])] as const)

/**
 * A vector proof stands on the figure agreeing with the algebra: if the lesson says M is
 * the midpoint of AB, the M in the picture has to be at the midpoint. These check the
 * derived positions rather than the pixels, because the point of the component is that a
 * midpoint is computed and so cannot be typed in the wrong place.
 */
describe('vector figure', () => {
  const triangle = [
    { name: 'O', x: 0, y: 0 },
    { name: 'A', x: 4, y: 0 },
    { name: 'B', x: 0, y: 3 },
  ]

  it('puts a derived midpoint midway between its two ends', () => {
    const [o, a, b, m] = dots(svg({ points: [...triangle, { name: 'M', between: ['A', 'B'] }] }))
    expect(o && a && b && m).toBeTruthy()
    expect(m![0]).toBeCloseTo((a![0] + b![0]) / 2, 6)
    expect(m![1]).toBeCloseTo((a![1] + b![1]) / 2, 6)
  })

  it('honours a fraction other than a half', () => {
    const [, a, b, p] = dots(svg({ points: [...triangle, { name: 'P', between: ['A', 'B'], fraction: 0.25 }] }))
    expect(p![0]).toBeCloseTo(a![0] + 0.25 * (b![0] - a![0]), 6)
    expect(p![1]).toBeCloseTo(a![1] + 0.25 * (b![1] - a![1]), 6)
  })

  it('resolves a midpoint whose ends are themselves derived, whatever order they are given in', () => {
    const points = [
      { name: 'N', between: ['M', 'P'] },
      { name: 'M', between: ['O', 'A'] },
      { name: 'P', between: ['O', 'B'] },
      ...triangle,
    ]
    const drawn = svg({ points })
    // All six are placed: N depends on M and P, which are declared after it.
    expect(dots(drawn)).toHaveLength(6)
    expect(drawn).toContain('>N<')
  })

  it('draws a labelled edge for each vector, with a head showing its direction', () => {
    const markup = svg({
      points: triangle,
      edges: [
        { from: 'O', to: 'A', label: 'a' },
        { from: 'O', to: 'B', label: 'b' },
        { from: 'A', to: 'B', label: 'b − a', dashed: true },
      ],
    })
    expect(markup.match(/<line /g)).toHaveLength(3)
    expect(markup.match(/<polygon /g)).toHaveLength(3)
    expect(markup).toContain('>b − a<')
    expect(markup).toContain('stroke-dasharray')
  })

  it('falls back to the alt text rather than drawing an empty box when nothing resolves', () => {
    expect(svg({ points: [{ name: 'M', between: ['A', 'B'] }] })).toContain('a vector figure')
  })

  it('keeps an edge label clear of a midpoint sitting on that same edge', () => {
    // The first drawing of the midpoint theorem put the labels for OA and OB exactly on
    // top of the letters P and Q, because a midpoint is at the middle of its edge and
    // that is where an edge label was anchored.
    const markup = svg({
      points: [...triangle, { name: 'P', between: ['O', 'A'] }, { name: 'Q', between: ['O', 'B'] }],
      edges: [
        { from: 'O', to: 'A', label: 'a' },
        { from: 'O', to: 'B', label: 'b' },
        { from: 'P', to: 'Q', label: 'PQ' },
      ],
    })
    const texts = [...markup.matchAll(/<text x="([-\d.]+)" y="([-\d.]+)"[^>]*>([^<]+)</g)].map((m) => ({
      x: Number(m[1]),
      y: Number(m[2]),
      text: m[3],
    }))
    const spot = (t: string) => texts.find((n) => n.text === t)!
    for (const [edge, vertex] of [['a', 'P'], ['b', 'Q']] as const) {
      expect(Math.hypot(spot(edge).x - spot(vertex).x, spot(edge).y - spot(vertex).y)).toBeGreaterThan(20)
    }
  })
})
