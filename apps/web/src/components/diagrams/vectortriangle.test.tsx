import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { VectorTriangle } from './VectorTriangle.tsx'

/**
 * The resultant's label was always pushed to one fixed side, which for a 200-north and
 * 50-east pair was the side the chain of vectors is on — so "resultant 206.16 km/h" was
 * drawn straight through "200 north". It now goes to the side the chain is not on.
 */
describe('vector-triangle', () => {
  /** Every label, with the box it occupies, estimated from its anchor and length. */
  const labels = (html: string) =>
    [...html.matchAll(/<text x="([-\d.]+)" y="([-\d.]+)" text-anchor="(\w+)"[^>]*font-size="12"[^>]*>([^<]*)<\/text>/g)].map((m) => {
      const x = Number(m[1]), anchor = m[3], text = m[4]!
      const w = text.length * 6.9
      const left = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x
      return { left, right: left + w, y: Number(m[2]), text }
    })

  const overlaps = (props: Record<string, unknown>) => {
    const ls = labels(renderToStaticMarkup(<VectorTriangle alt="" props={props} />))
    const hits: string[] = []
    for (let i = 0; i < ls.length; i++) {
      for (let j = i + 1; j < ls.length; j++) {
        const a = ls[i]!, b = ls[j]!
        if (Math.abs(a.y - b.y) < 12 && a.right > b.left && a.left < b.right) hits.push(`${a.text} / ${b.text}`)
      }
    }
    return hits
  }

  it('keeps the resultant label off the other labels', () => {
    expect(overlaps({ vectors: [{ x: 0, y: 200, label: '200 north' }, { x: 50, y: 0, label: '50 east' }], unit: 'km/h' })).toEqual([])
  })

  it('does the same when the chain turns the other way', () => {
    expect(overlaps({ vectors: [{ x: 4, y: 0, label: '4 N' }, { x: 0, y: 3, label: '3 N' }], unit: 'N' })).toEqual([])
    expect(overlaps({ vectors: [{ x: 0, y: 3, label: '3 N' }, { x: 4, y: 0, label: '4 N' }], unit: 'N' })).toEqual([])
  })

  it('still works out the resultant from the components', () => {
    const html = renderToStaticMarkup(<VectorTriangle alt="" props={{ vectors: [{ x: 4, y: 0 }, { x: 0, y: 3 }], unit: 'N' }} />)
    expect(html).toContain('resultant 5 N')
  })
})
