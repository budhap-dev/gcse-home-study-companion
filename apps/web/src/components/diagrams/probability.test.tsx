import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ProbabilityTree } from './ProbabilityTree.tsx'
import { VennDiagram } from './VennDiagram.tsx'

/**
 * Both diagrams print numbers a student copies into an answer, so the numbers the
 * picture computes must be the ones the lesson beside it claims. The tree multiplies
 * along each path itself; that arithmetic is what is checked here.
 */
describe('probability tree', () => {
  const TWO_COUNTERS = {
    children: [
      { label: 'Red', prob: '3/5', children: [{ label: 'Red', prob: '1/2' }, { label: 'Blue', prob: '1/2' }] },
      { label: 'Blue', prob: '2/5', children: [{ label: 'Red', prob: '3/4' }, { label: 'Blue', prob: '1/4' }] },
    ],
  }

  it('multiplies along each path and prints the product as an exact fraction', () => {
    const html = renderToStaticMarkup(<ProbabilityTree alt="" props={{ tree: TWO_COUNTERS }} />)
    // 3/5 × 1/2 = 3/10, and 2/5 × 1/4 = 1/10 after cancelling.
    expect(html).toContain('Red, Red = 3/10')
    expect(html).toContain('Red, Blue = 3/10')
    expect(html).toContain('Blue, Red = 3/10')
    expect(html).toContain('Blue, Blue = 1/10')
  })

  it('writes every branch probability on its branch', () => {
    const html = renderToStaticMarkup(<ProbabilityTree alt="" props={{ tree: TWO_COUNTERS }} />)
    for (const p of ['3/5', '2/5', '1/2', '3/4', '1/4']) expect(html, p).toContain(`>${p}<`)
  })

  it('handles decimal branches as well as fractions', () => {
    const tree = { children: [{ label: 'On time', prob: '0.8', children: [{ label: 'On time', prob: '0.8' }] }] }
    // 0.8 × 0.8 = 64/100, which cancels to 16/25.
    expect(renderToStaticMarkup(<ProbabilityTree alt="" props={{ tree }} />)).toContain('= 16/25')
  })

  it('falls back to the alt text rather than crashing when given no tree', () => {
    expect(renderToStaticMarkup(<ProbabilityTree alt="a tree" props={{}} />)).toContain('a tree')
  })
})

describe('venn diagram', () => {
  it('keys regions by position, so two sets with the same initial do not collide', () => {
    const html = renderToStaticMarkup(
      <VennDiagram alt="" props={{ labels: ['French', 'Spanish'], values: { A: 12, B: 7, AB: 5, none: 6 } }} />,
    )
    for (const v of ['12', '7', '5', '6']) expect(html, v).toContain(`>${v}<`)
    expect(html).toContain('>French<')
    expect(html).toContain('>Spanish<')
  })

  it('draws the universal set around three circles when given three sets', () => {
    const html = renderToStaticMarkup(
      <VennDiagram alt="" props={{ labels: ['A', 'B', 'C'], values: { ABC: 2, none: 4 } }} />,
    )
    expect((html.match(/<circle/g) ?? []).length).toBe(3)
    expect(html).toContain('ξ')
    expect(html).toContain('>2<')
    expect(html).toContain('>4<')
  })

  /*
   * At 440 units the diagram scrolled 108px on a phone, since a drawing stops shrinking
   * at its natural width, and the second label and the outside count were out of sight.
   * Shrinking it moved every region's value, so each is checked against the circles:
   * inside exactly the ones its key names, with room for a two-digit number.
   */
  it('fits a phone, with every value inside exactly the circles its region names', () => {
    for (const labels of [['A', 'B'], ['A', 'B', 'C']]) {
      const regions = labels.length === 3 ? ['A', 'B', 'C', 'AB', 'AC', 'BC', 'ABC'] : ['A', 'B', 'AB']
      const values = Object.fromEntries([...regions, 'none'].map((k) => [k, k === 'none' ? '99' : `${k}#`]))
      const html = renderToStaticMarkup(<VennDiagram alt="" props={{ labels, values, title: 'Title' }} />)
      const [, , width, height] = /viewBox="([^"]+)"/.exec(html)![1]!.split(' ').map(Number)
      expect(width).toBeLessThanOrEqual(298)
      const circles = [...html.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/g)].map((m) => m.slice(1).map(Number))
      expect(circles).toHaveLength(labels.length)
      const spot = (text: string) => {
        const m = new RegExp(`<text x="([\\d.]+)" y="([\\d.]+)"[^>]*>${text}<`).exec(html)!
        return [Number(m[1]), Number(m[2]) - 5]
      }
      for (const k of regions) {
        const [x, y] = spot(`${k}#`)
        // The corners of a two-digit number's box, 18 by 10.
        for (const [dx, dy] of [[-9, -5], [9, -5], [-9, 5], [9, 5]]) {
          circles.forEach(([cx, cy, r], i) => {
            expect(Math.hypot(x! + dx! - cx!, y! + dy! - cy!) < r!, `${k} in circle ${i}`).toBe(k.includes('ABC'[i]!))
          })
        }
      }
      const [nx, ny] = spot('99')
      expect(nx!).toBeLessThan(width! - 10)
      expect(ny!).toBeLessThan(height!)
      circles.forEach(([cx, cy, r]) => expect(Math.hypot(nx! - cx!, ny! - cy!)).toBeGreaterThan(r! + 10))
    }
  })

  it('leaves a region blank rather than printing undefined', () => {
    const html = renderToStaticMarkup(<VennDiagram alt="" props={{ labels: ['A', 'B'], values: { A: 3 } }} />)
    expect(html).not.toContain('undefined')
    expect(html).toContain('>3<')
  })
})
