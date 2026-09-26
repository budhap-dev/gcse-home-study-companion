import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BeamMoments } from './BeamMoments.tsx'

/**
 * Two arrows closer together than their labels are wide used to print one label on top
 * of the other. Every automated check passed — no horizontal scroll, no text under the
 * readable floor — and the diagram was still unreadable. Only a screenshot showed it.
 */
describe('beam-moments labels', () => {
  const texts = (html: string) =>
    [...html.matchAll(/<text x="([\d.]+)" y="([\d.]+)"[^>]*>([^<]*)</g)].map((m) => ({
      x: Number(m[1]), y: Number(m[2]), text: m[3]!,
    }))
  /** Two labels clash when they share a line and their boxes overlap. */
  const clashes = (html: string) => {
    const ts = texts(html).filter((t) => t.text.trim())
    const bad: string[] = []
    for (let i = 0; i < ts.length; i++) {
      for (let j = i + 1; j < ts.length; j++) {
        const a = ts[i]!, b = ts[j]!
        if (Math.abs(a.y - b.y) > 6) continue
        const half = (t: string) => (t.length * 7) / 2
        if (Math.abs(a.x - b.x) < half(a.text) + half(b.text)) bad.push(`"${a.text}" and "${b.text}"`)
      }
    }
    return bad
  }

  it('separates two long labels on arrows that are close together', () => {
    const html = renderToStaticMarkup(
      <BeamMoments alt="" props={{ length: 0.8, pivot: 0, showDistances: true, forces: [
        { at: 0.1, force: 20, label: '20 N here: 2 N m' },
        { at: 0.8, force: 20, label: '20 N here: 16 N m' },
      ] }} />,
    )
    expect(clashes(html)).toEqual([])
    expect(html).toContain('20 N here: 2 N m')
    expect(html).toContain('20 N here: 16 N m')
  })

  it('separates the distance labels under the beam too', () => {
    const html = renderToStaticMarkup(
      <BeamMoments alt="" props={{ length: 1.2, pivot: 0, showDistances: true, forces: [
        { at: 0.4, force: 600, label: 'load 600 N' },
        { at: 1.2, force: -200, label: 'lift 200 N' },
      ] }} />,
    )
    expect(clashes(html)).toEqual([])
  })

  /**
   * A force close to the pivot used to put its distance label on top of the pivot
   * triangle: an 11px label whose top sat seven pixels inside it. Both label lines moved
   * down to clear it, which is why nothing has to be stacked in the ordinary case.
   */
  it('keeps every distance label clear of the pivot triangle', () => {
    const html = renderToStaticMarkup(
      <BeamMoments alt="" props={{ length: 0.8, pivot: 0, showDistances: true, forces: [
        { at: 0.1, force: 20, label: '20 N here: 2 N m' },
        { at: 0.8, force: 20, label: '20 N here: 16 N m' },
      ] }} />,
    )
    const triangleBottom = Math.max(
      ...[.../<polygon points="([^"]+)"/.exec(html)![1]!.matchAll(/,([\d.]+)/g)].map((m) => Number(m[1])),
    )
    const near = texts(html).find((t) => t.text === '0.1 m')!
    // The baseline is below the triangle, and so is the top of the glyphs above it.
    expect(near.y - 11).toBeGreaterThan(triangleBottom)
  })

  /** When two distance labels really do collide, one drops a line and the canvas grows. */
  it('grows the drawing when two distance labels genuinely collide', () => {
    const height = (html: string) => Number(/viewBox="0 0 [\d.]+ ([\d.]+)"/.exec(html)![1])
    const crowded = renderToStaticMarkup(
      <BeamMoments alt="" props={{ length: 0.5, pivot: 0, showDistances: true, forces: [
        { at: 0.1, force: 10 },
        { at: 0.14, force: 10 },
      ] }} />,
    )
    expect(clashes(crowded)).toEqual([])
    expect(height(crowded)).toBeGreaterThan(200)
  })

  it('leaves a single force exactly where it was', () => {
    const html = renderToStaticMarkup(
      <BeamMoments alt="" props={{ length: 2, pivot: 0.5, forces: [{ at: 0.9, force: 5 }] }} />,
    )
    expect(html).toContain('viewBox="0 0 284 200"')
    expect(clashes(html)).toEqual([])
  })
})
