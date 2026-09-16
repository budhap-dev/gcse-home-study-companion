import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FrequencyTree } from './FrequencyTree.tsx'

/**
 * Counts sit at the nodes and categories along the branches. The tree draws exactly
 * the counts it is given, so every number in the data must appear in the picture,
 * and every category label must appear once, on its branch.
 */
describe('frequency tree', () => {
  const TREE = {
    label: '120 students', count: 120,
    children: [
      { label: 'boys', count: 70, children: [{ label: 'walks', count: 42 }, { label: 'does not walk', count: 28 }] },
      { label: 'girls', count: 50, children: [{ label: 'walks', count: 35 }, { label: 'does not walk', count: 15 }] },
    ],
  }

  it('prints every count at a node', () => {
    const html = renderToStaticMarkup(<FrequencyTree alt="" props={{ root: TREE }} />)
    for (const n of ['120', '70', '50', '42', '28', '35', '15']) expect(html, n).toContain(`>${n}<`)
  })

  it('labels every branch with its category, and the root with its description', () => {
    const html = renderToStaticMarkup(<FrequencyTree alt="" props={{ root: TREE }} />)
    expect(html.match(/>boys</g)?.length).toBe(1)
    expect(html.match(/>girls</g)?.length).toBe(1)
    expect(html.match(/>walks</g)?.length).toBe(2)
    expect(html).toContain('120 students')
  })

  it('draws one node box per count and one branch per child', () => {
    const html = renderToStaticMarkup(<FrequencyTree alt="" props={{ root: TREE }} />)
    expect(html.match(/<rect /g)?.length).toBe(7)
    expect(html.match(/<line /g)?.length).toBe(6)
  })

  it('falls back to the alt text rather than crashing when given no tree', () => {
    expect(renderToStaticMarkup(<FrequencyTree alt="a frequency tree" props={{}} />)).toContain('a frequency tree')
  })
})
