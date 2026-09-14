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
      for (const svg of host.querySelectorAll('svg')) fitTextInsideViewBox(svg)
    }
    fit()
    void document.fonts?.ready.then(fit).catch(() => {})
    return () => { live = false }
  })
  return ref
}
