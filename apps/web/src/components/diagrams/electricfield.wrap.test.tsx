import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ElectricField } from './ElectricField.tsx'

const svg = (props: Record<string, unknown>) => renderToStaticMarkup(<ElectricField props={props} alt="two charged spheres" />)

/**
 * Two spheres sit side by side, so a long label under one ran into the label under the
 * other. The static electricity topic had exactly that: "the cloth, having lost electrons"
 * beside "the rod, having gained them". Found by measuring the rendered page, not by any
 * test — so this checks the wrapping that fixed it.
 */
describe('electric field labels', () => {
  const pair = {
    charges: [
      { sign: 1, label: 'the cloth, having lost electrons' },
      { sign: -1, label: 'the rod, having gained them' },
    ],
  }

  it('splits a long label over several lines', () => {
    const markup = svg(pair)
    const spans = [...markup.matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)].map((m) => m[1]!)
    expect(spans.length).toBeGreaterThan(2)
    for (const line of spans) expect(line.length).toBeLessThanOrEqual(24)
  })

  it('keeps a short label on one line', () => {
    const markup = svg({ charges: [{ sign: -1, label: 'polythene rod' }] })
    expect([...markup.matchAll(/<tspan[^>]*>/g)]).toHaveLength(1)
  })

  it('loses no words when it wraps', () => {
    const markup = svg(pair)
    const spans = [...markup.matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)].map((m) => m[1]!)
    const joined = spans.join(' ')
    for (const charge of pair.charges) expect(joined).toContain(charge.label)
  })

  it('draws no label element when none is given', () => {
    expect(svg({ charges: [{ sign: 1 }] })).not.toContain('<tspan')
  })
})
