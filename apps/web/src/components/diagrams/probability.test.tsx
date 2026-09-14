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

  it('leaves a region blank rather than printing undefined', () => {
    const html = renderToStaticMarkup(<VennDiagram alt="" props={{ labels: ['A', 'B'], values: { A: 3 } }} />)
    expect(html).not.toContain('undefined')
    expect(html).toContain('>3<')
  })
})
