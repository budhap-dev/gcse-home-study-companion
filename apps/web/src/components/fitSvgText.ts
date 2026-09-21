import { useLayoutEffect, useRef } from 'react'

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
  const declared = svg.dataset.viewbox ?? svg.getAttribute('viewBox')
  if (!declared) return
  const declaredMax = svg.dataset.maxwidth ?? svg.style.maxWidth
  // Remember what the component asked for, and measure from that every time, so a
  // second pass cannot compound its own correction.
  svg.dataset.viewbox = declared
  svg.dataset.maxwidth = declaredMax
  svg.setAttribute('viewBox', declared)
  svg.style.maxWidth = declaredMax

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

  // Growing the viewBox alone would shrink the drawing to fit; growing the cap by the
  // same ratio keeps it the size the component intended. width="100%" still holds it
  // inside the card.
  const max = Number.parseFloat(declaredMax)
  if (Number.isFinite(max) && declaredMax.trim().endsWith('px')) {
    svg.style.maxWidth = `${Math.round(max * (width / vw))}px`
  }
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
    return () => { live = false }
  })
  return ref
}
