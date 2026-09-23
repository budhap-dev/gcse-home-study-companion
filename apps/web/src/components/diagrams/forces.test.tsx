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
    expect(html).toContain('push 300 N')
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
