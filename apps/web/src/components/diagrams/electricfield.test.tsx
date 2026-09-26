import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ElectricField } from './ElectricField.tsx'

const svg = (props: Record<string, unknown>) => renderToStaticMarkup(<ElectricField props={props} alt="an electric field" />)
/** Each arrowhead as its tip, so the direction it points can be worked out. */
const heads = (markup: string) =>
  [...markup.matchAll(/<polygon points="([-\d.]+),([-\d.]+) ([-\d.]+),([-\d.]+) ([-\d.]+),([-\d.]+)"/g)].map((m) => ({
    tip: [Number(m[1]), Number(m[2])] as const,
    back: [(Number(m[3]) + Number(m[5])) / 2, (Number(m[4]) + Number(m[6])) / 2] as const,
  }))
/** Where the charged spheres are drawn. */
const spheres = (markup: string) => [...markup.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="24"/g)].map((m) => [Number(m[1]), Number(m[2])] as const)
/** The viewBox width, so the middle of the drawing can be found without a hardcoded number. */
const width = (markup: string) => Number(/viewBox="0 0 ([\d.]+)/.exec(markup)![1])

/**
 * The direction of every arrow follows from the signs given, so the picture cannot
 * contradict the two rules the lesson states: field lines leave a positive charge, and
 * like charges repel.
 */
describe('electric field', () => {
  it('points the field lines away from a positive charge', () => {
    const markup = svg({ charges: [{ sign: 1 }] })
    const centre = width(markup) / 2
    const [, midY] = spheres(markup)[0]!
    const drawn = heads(markup)
    expect(drawn.length).toBeGreaterThan(6)
    for (const { tip, back } of drawn) {
      const outwards = Math.hypot(tip[0] - centre, tip[1] - midY) - Math.hypot(back[0] - centre, back[1] - midY)
      expect(outwards).toBeGreaterThan(0)
    }
  })

  it('points the field lines towards a negative charge', () => {
    const markup = svg({ charges: [{ sign: -1 }] })
    const centre = width(markup) / 2
    const [, midY] = spheres(markup)[0]!
    for (const { tip, back } of heads(markup)) {
      const outwards = Math.hypot(tip[0] - centre, tip[1] - midY) - Math.hypot(back[0] - centre, back[1] - midY)
      expect(outwards).toBeLessThan(0)
    }
  })

  it('draws two like charges pushing apart', () => {
    for (const pair of [[1, 1], [-1, -1]] as const) {
      const markup = svg({ charges: pair.map((sign) => ({ sign })) })
      const centre = width(markup) / 2
      const [[left], [right]] = spheres(markup)
      const drawn = heads(markup)
      expect(drawn).toHaveLength(2)
      // The arrow near the left sphere points further left; the right one further right.
      const leftArrow = drawn.find((h) => h.tip[0] < centre)!
      const rightArrow = drawn.find((h) => h.tip[0] > centre)!
      expect(leftArrow.tip[0]).toBeLessThan(left!)
      expect(rightArrow.tip[0]).toBeGreaterThan(right!)
      expect(markup).toContain('they repel')
    }
  })

  it('draws two unlike charges pulling together', () => {
    for (const pair of [[1, -1], [-1, 1]] as const) {
      const markup = svg({ charges: pair.map((sign) => ({ sign })) })
      const centre = width(markup) / 2
      const drawn = heads(markup)
      expect(drawn).toHaveLength(2)
      // Both arrows point inwards, so each tip is nearer the middle than its tail.
      for (const { tip, back } of drawn) {
        expect(Math.abs(tip[0] - centre)).toBeLessThan(Math.abs(back[0] - centre))
      }
      expect(markup).toContain('they attract')
    }
  })

  it('labels each sphere with its own sign', () => {
    const markup = svg({ charges: [{ sign: 1, label: 'rod' }, { sign: -1, label: 'cloth' }] })
    expect(markup).toContain('>+<')
    expect(markup).toContain('>−<')
    expect(markup).toContain('>rod<')
    expect(markup).toContain('>cloth<')
  })
})
