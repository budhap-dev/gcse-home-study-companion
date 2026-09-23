import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { NetworkTopology } from './NetworkTopology.tsx'

/** Boxes as [x, y, width, height], from the white device rectangles. */
const boxes = (html: string) =>
  [...html.matchAll(/<rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.]+)" height="([\d.]+)" rx="5"/g)].map((m) => m.slice(1, 5).map(Number))

describe('network-topology', () => {
  it('draws a star as one cable from the switch to each device', () => {
    const html = renderToStaticMarkup(<NetworkTopology alt="" props={{ layout: 'star', devices: ['PC 1', 'PC 2', 'PC 3', 'PC 4', 'PC 5', 'Printer'] }} />)
    expect(boxes(html)).toHaveLength(6)
    expect(html.match(/<line /g)).toHaveLength(6)
    expect(html).toContain('Switch')
    expect(html).toContain('Printer')
  })

  it('draws a bus with a terminator at each end of the backbone', () => {
    const html = renderToStaticMarkup(<NetworkTopology alt="" props={{ layout: 'bus', devices: ['A', 'B', 'C', 'D', 'E'] }} />)
    expect(boxes(html)).toHaveLength(5)
    expect(html.match(/<rect x="[\d.]+" y="[\d.-]+" width="7" height="18"/g)).toHaveLength(2)
    // The backbone and one drop cable per device.
    expect(html.match(/<line /g)).toHaveLength(6)
  })

  it('names the backbone and terminators in a key below every device, where no cable reaches', () => {
    for (let n = 1; n <= 6; n++) {
      const html = renderToStaticMarkup(<NetworkTopology alt="" props={{ layout: 'bus', devices: Array.from({ length: n }, (_, i) => `PC ${i + 1}`) }} />)
      const lowest = Math.max(...boxes(html).map(([, y, , h]) => y! + h!))
      for (const word of ['backbone', 'terminator']) {
        const y = Number(html.match(new RegExp(`<text x="[\\d.]+" y="([\\d.]+)"[^>]*>${word}<`))![1])
        expect(y - 11, `${word} with ${n} devices`).toBeGreaterThan(lowest)
      }
    }
  })

  it('keeps every device inside a phone-width drawing and clear of the others', () => {
    for (const [layout, n] of [['star', 8], ['bus', 6]] as const) {
      const devices = Array.from({ length: n }, (_, i) => `Laptop ${i + 1}`)
      const b = boxes(renderToStaticMarkup(<NetworkTopology alt="" props={{ layout, devices }} />))
      for (const [x, y, w] of b) {
        expect(x).toBeGreaterThanOrEqual(0)
        expect(x + w).toBeLessThanOrEqual(296)
        expect(y).toBeGreaterThanOrEqual(0)
      }
      for (let i = 0; i < b.length; i++)
        for (let j = i + 1; j < b.length; j++) {
          const [x1, y1, w1, h1] = b[i]!
          const [x2, y2, w2, h2] = b[j]!
          const apart = x1 + w1 <= x2 || x2 + w2 <= x1 || y1 + h1 <= y2 || y2 + h2 <= y1
          expect(apart, `${layout} boxes ${i} and ${j} overlap`).toBe(true)
        }
    }
  })
})
