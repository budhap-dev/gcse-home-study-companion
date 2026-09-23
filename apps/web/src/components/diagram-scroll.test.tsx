import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Visual } from './Visual.tsx'
import { fitTextInsideViewBox, stopShrinkingBelowNaturalWidth } from './fitSvgText.ts'
import { naturalWidth } from './diagrams/tableLayout.ts'

/**
 * A diagram drawn at `width="100%"` scales its whole viewBox into whatever box it is
 * given, and takes its text down with it. In the 298px card a 390px phone leaves, 97 of
 * the pack's 120 example diagrams rendered their smallest text under 10px and the worst
 * was 6.2px — while the browser walk read `getComputedStyle(...).fontSize` and reported
 * a comfortable 11px for every one of them, because that is the size inside the viewBox
 * and not the size the eye gets.
 *
 * The fix is that a drawing stops shrinking at its natural width and its card scrolls
 * sideways instead. These hold the two halves of that in place.
 */
describe('a diagram that does not fit its card', () => {
  /** A minimal stand-in for an SVG element: only the bits the function touches. */
  const fakeSvg = (viewBox: string) => {
    const style: Record<string, string> = {}
    return {
      style,
      dataset: {} as Record<string, string>,
      getAttribute: (n: string) => (n === 'viewBox' ? viewBox : null),
    } as unknown as SVGSVGElement & { style: Record<string, string> }
  }

  it('pins its width to the viewBox, so the drawing keeps its own scale', () => {
    const svg = fakeSvg('0 0 520 240') as SVGSVGElement & { style: Record<string, string> }
    stopShrinkingBelowNaturalWidth(svg)
    expect(svg.style.minWidth).toBe('520px')
  })

  /*
   * justify-content cannot be used for the centring: a centred flex item wider than its
   * scroll container starts before the scroll origin and its left edge is unreachable.
   * Auto margins collapse to zero when there is no free space, so they centre a small
   * drawing and left-align a large one.
   */
  it('centres with auto margins rather than the parent', () => {
    const svg = fakeSvg('0 0 460 120') as SVGSVGElement & { style: Record<string, string> }
    stopShrinkingBelowNaturalWidth(svg)
    expect(svg.style.marginInline).toBe('auto')
    expect(renderToStaticMarkup(<Visual visual={{ type: 'diagram', component: 'size-compare', props: { bars: [] }, alt: 'x'.repeat(50) }} />))
      .not.toContain('justify-center')
  })

  it('gives the figure something to scroll inside', () => {
    const html = renderToStaticMarkup(
      <Visual visual={{ type: 'diagram', component: 'size-compare', props: { bars: [{ label: 'a', value: 1 }] }, alt: 'x'.repeat(50) }} />,
    )
    expect(html).toContain('overflow-x-auto')
    expect(html).toContain('data-diagram="size-compare"')
  })

  it('leaves a viewBox it cannot read alone', () => {
    for (const bad of ['', 'nonsense', '0 0 0 240', '0 0 -5 240']) {
      const svg = fakeSvg(bad) as SVGSVGElement & { style: Record<string, string> }
      stopShrinkingBelowNaturalWidth(svg)
      expect(svg.style.minWidth).toBeUndefined()
    }
  })

  /*
   * The order matters. fitTextInsideViewBox may widen the viewBox to hold a label that
   * overhangs the drawing, and the width pinned afterwards has to match what it ended
   * up with, or the scale is not 1 after all.
   */
  it('reads the viewBox after the text fit has had its say', () => {
    const svg = fakeSvg('0 0 300 100') as SVGSVGElement & { style: Record<string, string> }
    // jsdom lays nothing out, so the fit pass bails at a zero-sized canvas and leaves
    // the declared box; what matters here is that the two run in this order at all.
    ;(svg as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect =
      () => ({ width: 0, height: 0, left: 0, right: 0, top: 0, bottom: 0 }) as DOMRect
    ;(svg as unknown as { setAttribute: (n: string, v: string) => void }).setAttribute = () => {}
    ;(svg as unknown as { querySelectorAll: () => never[] }).querySelectorAll = () => []
    fitTextInsideViewBox(svg)
    stopShrinkingBelowNaturalWidth(svg)
    expect(svg.style.minWidth).toBe('300px')
  })

  /*
   * The old guarantee was that a table renders above 10px in the 742px desktop box. With
   * the card scrolling, every table renders at its own scale whatever the screen — so
   * this records what the phone would otherwise have done, and is the reason the
   * mechanism exists rather than a rule anything has to pass.
   */
  it('is the reason: most of the pack would be illegible on a phone without it', () => {
    const PHONE_CARD = 298
    const shrunk = naturalWidth(['Where you are', 'Sound speed', 'Gap between your ears'], [['in air', '340 m/s', '0.53 ms']])
    expect((12 * PHONE_CARD) / shrunk).toBeLessThan(10)
    expect(shrunk).toBeGreaterThan(PHONE_CARD)
  })
})

/**
 * fitTextInsideViewBox remembers the viewBox a component declared, so a second pass does
 * not compound its own widening. A table that lays itself out again to fit a phone
 * declares a new, narrower viewBox; restoring the remembered one when the web font
 * loaded put 1 700 tables back at their old width, scrolling, with nothing failing.
 */
describe('fitting after a diagram lays itself out again', () => {
  /** An svg whose attributes can change, laid out at zero size so nothing is measured. */
  const liveSvg = (viewBox: string) => {
    const attrs: Record<string, string> = { viewBox }
    return {
      style: {} as Record<string, string>,
      dataset: {} as Record<string, string>,
      getAttribute: (n: string) => attrs[n] ?? null,
      setAttribute: (n: string, v: string) => { attrs[n] = v },
      getBoundingClientRect: () => ({ width: 0, height: 0, left: 0, right: 0, top: 0, bottom: 0 }),
      querySelectorAll: () => [],
    } as unknown as SVGSVGElement & { style: Record<string, string> }
  }

  it('measures from the new viewBox, not the one it remembered', () => {
    const svg = liveSvg('0 0 616 300')
    svg.style.maxWidth = '678px'
    fitTextInsideViewBox(svg)
    expect(svg.getAttribute('viewBox')).toBe('0 0 616 300')

    svg.setAttribute('viewBox', '0 0 331 420')
    svg.style.maxWidth = '364px'
    fitTextInsideViewBox(svg)
    expect(svg.getAttribute('viewBox')).toBe('0 0 331 420')
    expect(svg.style.maxWidth).toBe('364px')
  })

  it('still measures from the declared viewBox after widening it itself', () => {
    const svg = liveSvg('0 0 300 200')
    fitTextInsideViewBox(svg)
    // As if that pass had widened the viewBox for an overhanging label.
    svg.setAttribute('viewBox', '-10 0 320 200')
    svg.dataset.fitted = '-10 0 320 200'
    fitTextInsideViewBox(svg)
    expect(svg.getAttribute('viewBox')).toBe('0 0 300 200')
  })
})
