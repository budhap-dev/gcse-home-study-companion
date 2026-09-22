import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MagnetField } from './MagnetField.tsx'

const svg = (props: Record<string, unknown>) => renderToStaticMarkup(<MagnetField props={props} alt="a magnetic field" />)

/**
 * The direction in this picture is computed, never taken from the content, so a card
 * cannot be made to show like poles attracting -- which is exactly the claim the lesson
 * beside it is making.
 */
describe('magnet field', () => {
  it('says unlike poles attract and like poles repel, from the poles alone', () => {
    expect(svg({ kind: 'pair', magnets: [{ facing: 'N' }, { facing: 'S' }] })).toContain('Unlike poles: attract')
    expect(svg({ kind: 'pair', magnets: [{ facing: 'S' }, { facing: 'N' }] })).toContain('Unlike poles: attract')
    expect(svg({ kind: 'pair', magnets: [{ facing: 'N' }, { facing: 'N' }] })).toContain('Like poles: repel')
    expect(svg({ kind: 'pair', magnets: [{ facing: 'S' }, { facing: 'S' }] })).toContain('Like poles: repel')
  })

  /** Attracting magnets are pulled together; repelling ones are pushed apart. */
  it('points the force arrows together only when the poles are unlike', () => {
    const tips = (markup: string) =>
      [...markup.matchAll(/<line x1="([\d.]+)"[^>]*x2="([\d.]+)"/g)].map((m) => Number(m[2]) - Number(m[1]))
    const attract = tips(svg({ kind: 'pair', magnets: [{ facing: 'N' }, { facing: 'S' }] }))
    const repel = tips(svg({ kind: 'pair', magnets: [{ facing: 'N' }, { facing: 'N' }] }))
    expect(attract).toHaveLength(2)
    // The left magnet's arrow runs right and the right one's runs left, or the reverse.
    expect(Math.sign(attract[0]!)).toBe(1)
    expect(Math.sign(attract[1]!)).toBe(-1)
    expect(Math.sign(repel[0]!)).toBe(-1)
    expect(Math.sign(repel[1]!)).toBe(1)
  })

  it('draws both poles of a bar magnet, whichever end north is', () => {
    for (const northAt of ['left', 'right']) {
      const markup = svg({ kind: 'bar', northAt })
      expect(markup.match(/>N</g)).toHaveLength(1)
      expect(markup.match(/>S</g)).toHaveLength(1)
    }
  })

  /**
   * Outside the magnet the field runs north to south, so flipping which end is north has
   * to flip every arrow. If it did not, one of the two pictures would be wrong.
   */
  it('reverses every field arrow when north moves to the other end', () => {
    const heads = (markup: string) => [...markup.matchAll(/<polygon points="([^"]+)"/g)].map((m) => m[1]!)
    const right = heads(svg({ kind: 'bar', northAt: 'right' }))
    const left = heads(svg({ kind: 'bar', northAt: 'left' }))
    expect(right.length).toBeGreaterThan(4)
    expect(right).toHaveLength(left.length)
    expect(right).not.toEqual(left)
  })

  /**
   * The narrowest card that holds one of these is the "why" page's: 322px on a 390px
   * phone, of which the figure's own padding takes 24. Wider than 298 and the drawing
   * scrolls inside its card, which puts the far pole out of sight.
   */
  it('is narrow enough for the tightest card on a 390px phone', () => {
    for (const props of [{ kind: 'bar' }, { kind: 'pair' }, { kind: 'bar', note: 'a plotting compass lines up with the field' }]) {
      const w = Number(svg(props).match(/viewBox="0 0 (\d+)/)![1])
      expect(w).toBeLessThanOrEqual(298)
    }
  })

  /** Nothing drawn may stick out sideways past the viewBox either. */
  it('keeps both magnets and their arrows inside the drawing', () => {
    const markup = svg({ kind: 'pair', magnets: [{ facing: 'N' }, { facing: 'N' }] })
    const w = Number(markup.match(/viewBox="0 0 (\d+)/)![1])
    const xs = [
      ...[...markup.matchAll(/<rect[^>]*\bx="([\d.]+)"[^>]*\bwidth="([\d.]+)"/g)].map((m) => Number(m[1]) + Number(m[2])),
      ...[...markup.matchAll(/<line[^>]*\bx2="([\d.-]+)"/g)].map((m) => Number(m[1])),
    ]
    expect(xs.length).toBeGreaterThan(2)
    expect(Math.max(...xs)).toBeLessThanOrEqual(w)
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0)
  })

  it('keeps every label inside the drawing', () => {
    for (const props of [{ kind: 'bar', note: 'north is on the right' }, { kind: 'pair', note: 'they are pushed apart' }]) {
      const markup = svg(props)
      const [, w, h] = markup.match(/viewBox="0 0 (\d+) (\d+)"/)!.map(Number)
      for (const m of markup.matchAll(/<text[^>]*\bx="([\d.]+)"[^>]*\by="([\d.]+)"/g)) {
        expect(Number(m[1])).toBeLessThan(w!)
        expect(Number(m[2])).toBeLessThan(h!)
      }
    }
  })
})
