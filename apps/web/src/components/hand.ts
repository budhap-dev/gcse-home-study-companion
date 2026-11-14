/**
 * Hand-drawn marks on what to remember (backlog section 15, Part C): a circle round a keyword,
 * an underline under the sentence to remember, a highlight behind a formula. A writer tags
 * them in lesson text ({{circle|word}}, see RichText); this draws them.
 *
 * Each mark is a small SVG painted as the element's background, stretched to it, with
 * box-decoration-break: clone so a mark that wraps across lines on a phone is drawn on each
 * line. The stroke keeps its width when stretched (non-scaling-stroke). Each mark gets its own
 * wobble from a seed, so two circles on a page are not the same shape, and the same mark is
 * the same shape every time it is drawn. It draws itself once, stroke by stroke, when it comes
 * into view; with the motion setting off or the device asking for reduced motion it appears
 * already drawn. The word underneath is bold (circle) or a <mark> (highlight), so the emphasis
 * survives in print, with no script and for a screen reader.
 */

export type HandKind = 'circle' | 'underline' | 'highlight'
export const HAND_KINDS: HandKind[] = ['circle', 'underline', 'highlight']

/** A small deterministic generator, so a mark's wobble is fixed by its words. */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5
    return ((s >>> 0) % 10000) / 10000
  }
}

export function seedOf(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

const r1 = (x: number) => Math.round(x * 10) / 10

/** The mark as an SVG document, in a 100 by 40 box stretched over the element. */
export function handSvg(kind: HandKind, seed: number, colour: string, animate: boolean, dash = 0): string {
  const rand = rng(seed)
  const j = (n: number) => (rand() - 0.5) * 2 * n
  let shape: string
  if (kind === 'circle') {
    // A loop that starts top left and runs a little past where it began, as a pen does.
    const start = -2.4 + j(0.3)
    const turn = 2 * Math.PI * (1.08 + rand() * 0.06)
    const pts: string[] = []
    for (let i = 0; i <= 28; i++) {
      const a = start + (turn * i) / 28
      const wob = 1 + j(0.035) + (i / 28) * 0.04
      pts.push(`${r1(50 + 47 * wob * Math.cos(a))} ${r1(20 + 17.5 * wob * Math.sin(a))}`)
    }
    shape = `<path d="M${pts.join(' L')}" fill="none" stroke="${colour}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`
  } else if (kind === 'underline') {
    const y = 36 + j(1)
    shape = `<path d="M${r1(1 + rand() * 2)} ${r1(y + j(1.2))} Q ${r1(50 + j(8))} ${r1(y - 2.5 + j(1.5))} ${r1(98 + j(1))} ${r1(y + j(1.2))}" fill="none" stroke="${colour}" stroke-width="2.4" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`
  } else {
    // A marker swipe: a rough band a little uneven at its ends.
    const top = 7 + j(2), bottom = 35 + j(2)
    shape = `<polygon class="swipe" points="${r1(1 + j(1))},${r1(top + j(2))} ${r1(99 + j(1))},${r1(top + j(2))} ${r1(98 + j(1))},${r1(bottom + j(2))} ${r1(2 + j(1))},${r1(bottom + j(2))}" fill="${colour}"/>`
  }
  const style = animate
    ? kind === 'highlight'
      ? '<style>.swipe{transform-box:fill-box;transform-origin:left center;animation:s .45s ease-out both}@keyframes s{from{transform:scaleX(0)}}</style>'
      // A stroke kept at its width as the box stretches (non-scaling-stroke) measures its dashes
      // in screen pixels, so the dash is the stroke's own length in pixels, worked out from
      // the element's size (an over-estimate draws a moment of nothing; an under-estimate
      // would leave a gap at the end).
      : `<style>path{stroke-dasharray:${dash} ${dash};stroke-dashoffset:${dash};animation:d .7s ease-out .05s forwards}@keyframes d{to{stroke-dashoffset:0}}</style>`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40" preserveAspectRatio="none">${style}${shape}</svg>`
}

export function svgUrl(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

/** True when marks should appear already drawn: the motion setting, or the device's preference. */
export function stillOnly(): boolean {
  if (typeof document === 'undefined') return true
  if (document.documentElement.dataset.motion === 'off') return true
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** A colour as the browser resolves it, so it can be written into an SVG. */
function resolved(el: Element, className: string, property: 'color' | 'backgroundColor'): string {
  const probe = document.createElement('span')
  probe.className = className
  probe.style.position = 'absolute'
  probe.style.visibility = 'hidden'
  el.appendChild(probe)
  const c = getComputedStyle(probe)[property]
  probe.remove()
  return c
}

function paint(el: HTMLElement, animate: boolean) {
  const kind = el.dataset.hand as HandKind
  if (!HAND_KINDS.includes(kind)) return
  const colour = kind === 'highlight' ? resolved(el, 'hand-highlight-probe', 'backgroundColor') : resolved(el, 'accent-ink', 'color')
  // The longest line the mark covers, in pixels: the stroke on it is the longest to draw.
  const box = [...el.getClientRects()].reduce((m, r) => ({ w: Math.max(m.w, r.width), h: Math.max(m.h, r.height) }), { w: 0, h: 0 })
  const dash = Math.ceil(kind === 'circle' ? Math.PI * (box.w + box.h) * 0.5 * 1.25 * 1.3 : box.w * 1.3) + 20
  el.style.backgroundImage = svgUrl(handSvg(kind, seedOf(`${kind}:${el.textContent ?? ''}`), colour, animate, dash))
  el.dataset.drawn = 'true'
}

const watched = new Set<HTMLElement>()
let watching = false

/** Repaints every drawn mark, still, when the theme changes its colours. */
function watchTheme() {
  if (watching || typeof MutationObserver === 'undefined') return
  watching = true
  new MutationObserver(() => {
    for (const el of watched) {
      if (!el.isConnected) { watched.delete(el); continue }
      if (el.dataset.drawn) paint(el, false)
    }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-motion', 'style', 'class'] })
}

/**
 * Draws the marks inside a piece of rich text: each as it comes into view, once. Returns a
 * clean-up for the component's effect.
 */
export function drawHands(root: HTMLElement): () => void {
  const marks = [...root.querySelectorAll<HTMLElement>('[data-hand]')]
  if (marks.length === 0) return () => {}
  watchTheme()
  for (const el of marks) watched.add(el)
  if (stillOnly() || typeof IntersectionObserver === 'undefined') {
    for (const el of marks) paint(el, false)
    return () => {}
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue
      paint(e.target as HTMLElement, true)
      io.unobserve(e.target)
    }
  }, { threshold: 0.6 })
  for (const el of marks) io.observe(el)
  return () => io.disconnect()
}
