import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DotAndCross } from './DotAndCross.tsx'

const svg = (props: Record<string, unknown>) =>
  renderToStaticMarkup(<DotAndCross props={props} alt="a dot and cross diagram" />)

const ionic = (transfer: number) =>
  svg({
    kind: 'ionic',
    atoms:
      transfer === 1
        ? [{ symbol: 'Na', outer: 1, mark: 'cross' }, { symbol: 'Cl', outer: 7, mark: 'dot' }]
        : [{ symbol: 'Mg', outer: 2, mark: 'cross' }, { symbol: 'O', outer: 6, mark: 'dot' }],
    transfer,
  })

/** Every `<text>` with its position, so a label can be tested against the shapes it sits near. */
const labels = (markup: string) => {
  const out: { text: string; x: number; y: number }[] = []
  for (const m of markup.matchAll(/<text x="([-\d.]+)" y="([-\d.]+)"[^>]*>(.*?)<\/text>/g)) {
    out.push({ text: m[3]!.replace(/<[^>]+>/g, ''), x: Number(m[1]), y: Number(m[2]) })
  }
  return out
}
const find = (markup: string, needle: string) => labels(markup).find((l) => l.text.includes(needle))!
const box = (markup: string) => {
  const m = /<rect x="([-\d.]+)" y="([-\d.]+)" width="([-\d.]+)" height="([-\d.]+)"/.exec(markup)!
  const [x, y, w, h] = m.slice(1).map(Number) as [number, number, number, number]
  return { top: y, bottom: y + h, left: x, right: x + w }
}

/**
 * Both annotations on an ionic diagram used to be drawn inside the figure they describe:
 * the transfer label between two boxes only 62px apart, and "outer electrons given away"
 * inside the circle. SVG neither wraps nor clips, so both simply printed over the atoms
 * and every check passed — the collisions were with a box and a circle, not with other
 * text, which is what a label-against-label scan looks at.
 */
describe('ionic dot and cross', () => {
  it('keeps the transfer label above the atoms rather than across them', () => {
    const markup = ionic(1)
    const label = find(markup, 'transferred')
    expect(label.text.replace(/\s+/g, ' ')).toBe('1 electron transferred')
    // An 11px label of this length is about 120 wide, and the gap between the boxes is 62.
    expect(label.y).toBeLessThan(box(markup).top)
  })

  it('puts the "given away" note below the box, not through the circle', () => {
    const markup = ionic(1)
    const note = find(markup, 'given away')
    const circle = /<circle cx="([-\d.]+)" cy="([-\d.]+)" r="([-\d.]+)"/.exec(markup)!
    const [, cy, r] = circle.slice(1).map(Number) as [number, number, number]
    expect(note.y).toBeGreaterThan(cy + r)
    expect(note.y).toBeGreaterThan(box(markup).bottom)
  })

  it('leaves room for both bands in the canvas', () => {
    const markup = ionic(2)
    const height = Number(/viewBox="0 0 [\d.]+ ([\d.]+)"/.exec(markup)![1])
    const caption = labels(markup).at(-1)!
    expect(find(markup, 'transferred').text).toContain('2 electrons')
    expect(caption.y).toBeLessThan(height)
    expect(caption.y).toBeGreaterThan(find(markup, 'given away').y)
  })

  it('leaves a covalent diagram canvas alone', () => {
    const markup = svg({ kind: 'covalent', atoms: [{ symbol: 'H', outer: 1, mark: 'dot' }, { symbol: 'Cl', outer: 7, mark: 'cross' }], shared: 1 })
    expect(markup).toContain('viewBox="0 0 274 160"')
  })
})
