import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { GeneratorOutput, inducedPd } from './GeneratorOutput.tsx'

const svg = (props: Record<string, unknown>) => renderToStaticMarkup(<GeneratorOutput props={props} alt="a generator's output" />)
/** The y coordinates a graph's first path passes through. */
const pathYs = (markup: string) => [...markup.match(/<path d="([^"]+)"/)![1]!.matchAll(/[ML] [\d.]+ ([\d.]+)/g)].map((m) => Number(m[1]))

/**
 * The graph is computed from how a coil cuts a field, so the content cannot draw a dynamo
 * whose output reverses or an alternator whose output does not.
 */
describe('generator output', () => {
  it('peaks a quarter turn in, is zero when the coil is upright, and reverses on the second half turn', () => {
    expect(inducedPd('alternator', 0.25)).toBeCloseTo(1)
    expect(inducedPd('alternator', 0.5)).toBeCloseTo(0)
    expect(inducedPd('alternator', 0.75)).toBeCloseTo(-1)
    expect(inducedPd('dynamo', 0.75)).toBeCloseTo(1)
  })

  it('never lets a dynamo go negative, and gives an alternator equal time either side of zero', () => {
    const samples = Array.from({ length: 400 }, (_, i) => i / 200)
    expect(samples.every((t) => inducedPd('dynamo', t) >= -1e-12)).toBe(true)
    const above = samples.filter((t) => inducedPd('alternator', t) > 1e-9).length
    const below = samples.filter((t) => inducedPd('alternator', t) < -1e-9).length
    expect(above).toBe(below)
  })

  it('draws the dynamo curve entirely on or above the time axis and the alternator on both sides', () => {
    const axisY = (markup: string) => Number(/<line x1="34" y1="([\d.]+)" x2="284" y2="\1"/.exec(markup)![1])
    const dynamo = svg({ kind: 'dynamo' })
    const alternator = svg({ kind: 'alternator' })
    expect(Math.max(...pathYs(dynamo))).toBeLessThanOrEqual(axisY(dynamo) + 0.05)
    expect(Math.max(...pathYs(alternator))).toBeGreaterThan(axisY(alternator) + 30)
    expect(Math.min(...pathYs(alternator))).toBeLessThan(axisY(alternator) - 30)
  })

  it('names the contacts that make the difference', () => {
    expect(svg({ kind: 'alternator' })).toContain('slip rings')
    expect(svg({ kind: 'dynamo' })).toContain('commutator')
    expect(svg({ kind: 'alternator', view: 'contacts' })).toContain('two slip rings')
    expect(svg({ kind: 'dynamo', view: 'contacts' })).toContain('split-ring commutator')
  })

  it('draws two rings for an alternator and one split ring for a dynamo', () => {
    const rings = (markup: string) => (markup.match(/fill="#e8c46a"/g) ?? []).length
    expect(rings(svg({ kind: 'alternator', view: 'contacts' }))).toBe(2)
    expect(rings(svg({ kind: 'dynamo', view: 'contacts' }))).toBe(1)
    // Both ends of the coil are wired out in either machine.
    const wires = (markup: string) => (markup.match(/stroke="var\(--subject\)" stroke-width="1.4"/g) ?? []).length
    expect(wires(svg({ kind: 'alternator', view: 'contacts' }))).toBe(2)
    expect(wires(svg({ kind: 'dynamo', view: 'contacts' }))).toBe(2)
  })

  it('overlays a faster coil as a taller, more frequent dashed curve', () => {
    const markup = svg({ kind: 'alternator', compareSpeed: 2 })
    const paths = [...markup.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]!)
    expect(paths).toHaveLength(2)
    const peaks = (d: string) => [...d.matchAll(/[ML] [\d.]+ ([\d.]+)/g)].map((m) => Number(m[1]))
    const slow = peaks(paths[0]!), fast = peaks(paths[1]!)
    // Twice the speed: twice the peak, so the fast curve reaches twice as far from the axis.
    const axis = (Math.max(...fast) + Math.min(...fast)) / 2
    expect((axis - Math.min(...fast)) / (axis - Math.min(...slow))).toBeCloseTo(2, 1)
    expect(markup).toContain('2× the speed')
  })

  it('fits the tightest phone card and keeps every label inside', () => {
    for (const props of [{ kind: 'alternator' }, { kind: 'dynamo', note: 'a bicycle dynamo' }, { kind: 'alternator', view: 'contacts' }, { kind: 'dynamo', view: 'contacts', note: 'the gap is the insulation' }, { kind: 'alternator', compareSpeed: 2 }]) {
      const markup = svg(props)
      const [, w, h] = markup.match(/viewBox="0 0 (\d+) (\d+)"/)!.map(Number)
      expect(w).toBeLessThanOrEqual(298)
      for (const m of markup.matchAll(/<text[^>]*\bx="([\d.]+)"[^>]*\by="([\d.]+)"/g)) {
        expect(Number(m[1])).toBeLessThan(w!)
        expect(Number(m[2])).toBeLessThan(h!)
      }
    }
  })
})
