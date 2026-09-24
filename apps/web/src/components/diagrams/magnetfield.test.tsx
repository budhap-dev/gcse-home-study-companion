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

/**
 * The field a current makes is derived from the current the content gives, by the
 * right-hand grip rule, so a card cannot draw the field circling the wrong way or put
 * north at the end the rule says is south.
 */
describe('the field a current makes', () => {
  /** Each arrowhead's tip and the middle of its base, in drawing order. */
  const heads = (markup: string) =>
    [...markup.matchAll(/<polygon points="([^"]+)"/g)].map((m) => {
      const [tip, a, b] = m[1]!.split(' ').map((p) => p.split(',').map(Number)) as [number, number][]
      return { tip, base: [(a![0] + b![0]) / 2, (a![1] + b![1]) / 2] as [number, number] }
    })

  it('circles the wire anticlockwise when the current comes towards you, clockwise when it goes away', () => {
    const out = svg({ kind: 'wire', current: 'out' })
    const into = svg({ kind: 'wire', current: 'in' })
    expect(out).toContain('anticlockwise')
    expect(into).toContain('circles clockwise')
    // The first head sits at the top of the innermost circle: anticlockwise there is leftwards.
    expect(heads(out)[0]!.tip[0]).toBeLessThan(heads(out)[0]!.base[0])
    expect(heads(into)[0]!.tip[0]).toBeGreaterThan(heads(into)[0]!.base[0])
    expect(heads(out)).toHaveLength(6)
  })

  it('draws the wire as a dot for current towards you and a cross for current away', () => {
    expect(svg({ kind: 'wire', current: 'out' })).toContain('r="3"')
    expect(svg({ kind: 'wire', current: 'in' })).not.toContain('r="3"')
  })

  it('puts north at the end the grip rule gives, and moves it when the current reverses', () => {
    const up = svg({ kind: 'solenoid', current: 'up' })
    const down = svg({ kind: 'solenoid', current: 'down' })
    expect(up).toContain('north is on the left')
    expect(down).toContain('north is on the right')
    const pole = (markup: string, letter: 'N' | 'S') => Number(new RegExp(`<text x="([\\d.]+)"[^>]*>${letter}</text>`).exec(markup)![1])
    expect(pole(up, 'N')).toBeLessThan(pole(up, 'S'))
    expect(pole(down, 'N')).toBeGreaterThan(pole(down, 'S'))
  })

  it('reverses every field arrow of the solenoid when the current reverses', () => {
    const up = heads(svg({ kind: 'solenoid', current: 'up' }))
    const down = heads(svg({ kind: 'solenoid', current: 'down' }))
    expect(up.length).toBeGreaterThan(8)
    expect(up).toHaveLength(down.length)
    // Field heads (not the current heads on the turns) point the opposite way in x.
    const fieldUp = up.slice(0, 7), fieldDown = down.slice(0, 7)
    for (let i = 0; i < fieldUp.length; i++) {
      const dxUp = fieldUp[i]!.tip[0] - fieldUp[i]!.base[0]
      const dxDown = fieldDown[i]!.tip[0] - fieldDown[i]!.base[0]
      expect(Math.sign(dxUp)).toBe(-Math.sign(dxDown))
    }
  })

  it('runs the lines inside the solenoid straight, parallel and evenly spaced', () => {
    const markup = svg({ kind: 'solenoid', current: 'up' })
    const ys = [...markup.matchAll(/<line x1="58" y1="([\d.]+)"[^>]*x2="238" y2="([\d.]+)"/g)].map((m) => [Number(m[1]), Number(m[2])])
    expect(ys).toHaveLength(3)
    for (const [y1, y2] of ys) expect(y1).toBe(y2)
    const sorted = ys.map((p) => p[0]!).sort((a, b) => a - b)
    expect(sorted[1]! - sorted[0]!).toBe(sorted[2]! - sorted[1]!)
  })

  it('keeps the current pictures narrow enough for a phone card and their labels inside', () => {
    for (const props of [{ kind: 'wire', current: 'out' }, { kind: 'wire', current: 'in', note: 'a compass follows the circle' }, { kind: 'solenoid', current: 'up' }, { kind: 'solenoid', current: 'down', note: 'reverse the current and the poles swap' }]) {
      const markup = svg(props)
      const [, w, h] = markup.match(/viewBox="0 0 (\d+) (\d+)"/)!.map(Number)
      expect(w).toBeLessThanOrEqual(298)
      for (const m of markup.matchAll(/<text[^>]*\bx="([\d.]+)"[^>]*\by="([\d.]+)"/g)) {
        expect(Number(m[1])).toBeLessThan(w!)
        expect(Number(m[1])).toBeGreaterThan(0)
        expect(Number(m[2])).toBeLessThan(h!)
      }
    }
  })
})
