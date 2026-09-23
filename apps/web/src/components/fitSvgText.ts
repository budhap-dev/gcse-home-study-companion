import { useLayoutEffect, useRef, useState, type RefObject } from 'react'

/**
 * Diagrams size their own viewBox from the shapes they draw, which cannot account for
 * how wide a label actually typesets: fonts differ by device, and a caption longer than
 * the drawing is simply cut off at the viewBox edge, mid-word and on both sides. The
 * real extent is only knowable once the text has been laid out, so this measures every
 * `text` in the diagram and, if any of them spills out, widens the viewBox to contain
 * it. The inline max-width grows by the same ratio, so the drawing keeps its size on
 * screen instead of shrinking to make room; `width="100%"` still caps it at the
 * container, so a diagram can never overflow its card.
 *
 * Only `text` is measured, never the diagram as a whole, so artwork that a component
 * deliberately crops at the viewBox edge stays cropped.
 */
export function fitTextInsideViewBox(svg: SVGSVGElement): void {
  // Remember what the component asked for, and measure from that every time, so a
  // second pass cannot compound its own correction. But only while the viewBox is still
  // the one this function set: a component that lays itself out again (a table reflowing
  // to its box) declares a new one, and restoring the remembered one put the table back
  // at its old width the moment the web font loaded.
  const current = svg.getAttribute('viewBox')
  const ours = svg.dataset.fitted !== undefined && current === svg.dataset.fitted
  const declared = ours ? svg.dataset.viewbox : current
  if (!declared) return
  const declaredMax = ours && svg.style.maxWidth === svg.dataset.fittedmax ? (svg.dataset.maxwidth ?? '') : svg.style.maxWidth
  svg.dataset.viewbox = declared
  svg.dataset.maxwidth = declaredMax
  svg.setAttribute('viewBox', declared)
  svg.style.maxWidth = declaredMax
  svg.dataset.fitted = declared
  svg.dataset.fittedmax = declaredMax

  const [vx, vy, vw, vh] = declared.split(/[\s,]+/).map(Number)
  if (![vx, vy, vw, vh].every(Number.isFinite) || vw <= 0 || vh <= 0) return
  // Screen rectangles rather than getBBox, because a label inside a translated group
  // reports its box in that group's coordinates, and the three axis labels that this
  // first got wrong were exactly those.
  const canvas = svg.getBoundingClientRect()
  if (!canvas.width || !canvas.height) return
  const perPixelX = vw / canvas.width
  const perPixelY = vh / canvas.height

  let left = 0, right = 0, top = 0, bottom = 0
  for (const text of svg.querySelectorAll('text')) {
    const box = text.getBoundingClientRect()
    if (!box.width && !box.height) continue
    left = Math.max(left, canvas.left - box.left)
    right = Math.max(right, box.right - canvas.right)
    top = Math.max(top, canvas.top - box.top)
    bottom = Math.max(bottom, box.bottom - canvas.bottom)
  }
  if (left < 0.5 && right < 0.5 && top < 0.5 && bottom < 0.5) return

  const pad = 2
  const growLeft = left > 0 ? left * perPixelX + pad : 0
  const growRight = right > 0 ? right * perPixelX + pad : 0
  const growTop = top > 0 ? top * perPixelY + pad : 0
  const growBottom = bottom > 0 ? bottom * perPixelY + pad : 0
  const width = vw + growLeft + growRight
  const height = vh + growTop + growBottom
  svg.setAttribute('viewBox', `${vx - growLeft} ${vy - growTop} ${width} ${height}`)
  svg.dataset.fitted = svg.getAttribute('viewBox')!

  // Growing the viewBox alone would shrink the drawing to fit; growing the cap by the
  // same ratio keeps it the size the component intended. width="100%" still holds it
  // inside the card.
  const max = Number.parseFloat(declaredMax)
  if (Number.isFinite(max) && declaredMax.trim().endsWith('px')) {
    svg.style.maxWidth = `${Math.round(max * (width / vw))}px`
  }
  svg.dataset.fittedmax = svg.style.maxWidth
}

/**
 * A drawing scaled into a narrow card takes its text down with it. `width="100%"` fits
 * the whole viewBox to the box it is given, so a 520-unit table in the 298px card a
 * 390px phone leaves for it renders its 12px labels at **6.9px**. Measured across the
 * pack on 20 September 2026: 97 of 120 example diagrams were under 10px on a phone and
 * the worst was 6.2. Nothing was looking for it, because `getComputedStyle` on SVG text
 * reports the font-size inside the viewBox rather than the size the eye gets.
 *
 * So below its natural width the drawing stops shrinking and the card scrolls sideways
 * instead. `min-width` is the whole mechanism: it beats the inline `max-width`, and above
 * the natural width `width="100%"` still governs, so a wide screen is unaffected.
 *
 * Read the viewBox as it stands rather than as declared, because fitTextInsideViewBox
 * may just have widened it to hold an overhanging label; matching that keeps the scale
 * at exactly 1.
 */
export function stopShrinkingBelowNaturalWidth(svg: SVGSVGElement): void {
  const vw = Number(svg.getAttribute('viewBox')?.split(/[\s,]+/)[2])
  if (!Number.isFinite(vw) || vw <= 0) return
  svg.style.minWidth = `${Math.round(vw)}px`
  /*
   * Centre with auto margins rather than the parent's justify-content. A centred flex
   * item that overflows its scroll container puts its own left edge before the scroll
   * origin, and no amount of scrolling reaches it. Auto margins collapse to zero when
   * there is no free space, so the drawing starts at the left edge and scrolls right.
   */
  svg.style.marginInline = 'auto'
}

/**
 * Fits every SVG inside the returned ref once it is laid out, again after each render
 * (a slider graph redraws its labels as the student drags), and again when the webfont
 * lands, since text measured in the fallback face measures differently.
 */
/** Dispatched, bubbling, from an svg whose own layout changed. */
export const REFIT = 'diagram-refit'

export function useFitSvgText<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useLayoutEffect(() => {
    const host = ref.current
    if (!host) return
    let live = true
    const fit = () => {
      if (!live) return
      for (const svg of host.querySelectorAll('svg')) {
        fitTextInsideViewBox(svg)
        stopShrinkingBelowNaturalWidth(svg)
      }
    }
    fit()
    void document.fonts?.ready.then(fit).catch(() => {})
    // A diagram that lays itself out again without its parent re-rendering (a table
    // reflowing to the width it was given) announces it, so the fit follows it.
    host.addEventListener(REFIT, fit)
    return () => {
      live = false
      host.removeEventListener(REFIT, fit)
    }
  })
  return ref
}

/**
 * The content width of the box a diagram sits in, kept current as it resizes. Undefined
 * until measured, and where there is no layout to measure (tests, the server), in which
 * case the diagram takes its natural width exactly as it always did.
 */
export function useAvailableWidth(svg: RefObject<SVGSVGElement | null>): number | undefined {
  const [width, setWidth] = useState<number>()
  useLayoutEffect(() => {
    const box = svg.current?.parentElement
    if (!box || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const style = getComputedStyle(box)
      const inner = box.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      if (inner > 0) setWidth(Math.floor(inner))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    return () => observer.disconnect()
  }, [svg])
  return width
}
