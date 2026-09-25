import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FourBox, FourBoxStack } from './FourBox.tsx'

/**
 * Fourteen diagrams in the content pack were written with `body` on each box while the
 * component read only `points`. They rendered four titles over empty space, and every
 * test passed, because a prop nothing reads looks exactly like a prop that is absent.
 * Both shapes have to draw their text, and the box has to grow to hold it.
 */
describe('four-box', () => {
  const LONG = 'The specification says the unfamiliar piece is stylistically close to a set work, so the vocabulary you already have transfers straight across to it.'

  it('draws the points given to it', () => {
    const html = renderToStaticMarkup(
      <FourBox alt="" props={{ centre: 'Middle', boxes: [{ title: 'One', points: ['first point', 'second point'] }] }} />,
    )
    expect(html).toContain('first point')
    expect(html).toContain('second point')
    expect(html).toContain('Middle')
  })

  it('wraps a long point inside its box instead of running it out of the side', () => {
    // Found in the Music review pass, 25 September 2026: the grid drew each point on one
    // line, so 832 of the pack's 1261 points ran out of their box and under the centre
    // circle. Only the phone layout wrapped them.
    const point = 'a light, bell-like note made by touching the string'
    const html = renderToStaticMarkup(<FourBox alt="" props={{ centre: 'Bass', boxes: [{ title: 'Harmonic', points: [point] }] }} />)
    const lines = [...html.matchAll(/<text [^>]*font-size="12"[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]!)
    expect(lines.length).toBeGreaterThan(1)
    // A 186-wide box less 14 padding each side holds 22 characters at 7 a character.
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(22)
    for (const word of point.split(' ')) expect(lines.join(' ')).toContain(word)
  })

  it('draws a body, wrapped, rather than dropping it', () => {
    const html = renderToStaticMarkup(<FourBox alt="" props={{ boxes: [{ title: 'One', body: LONG }] }} />)
    // Every word of the body reaches the drawing.
    for (const word of LONG.split(' ')) expect(html).toContain(word)
    // And it is wrapped over several lines rather than run off the side in one.
    const lines = html.match(/<text [^>]*font-size="12"[^>]*>/g) ?? []
    expect(lines.length).toBeGreaterThan(3)
  })

  it('grows tall enough to hold the longest body', () => {
    const short = renderToStaticMarkup(<FourBox alt="" props={{ boxes: [{ title: 'One', points: ['a'] }] }} />)
    const tall = renderToStaticMarkup(<FourBox alt="" props={{ boxes: [{ title: 'One', body: LONG }] }} />)
    const heightOf = (html: string) => Number(/viewBox="0 0 \d+ (\d+)"/.exec(html)![1])
    expect(heightOf(short)).toBe(300)
    expect(heightOf(tall)).toBeGreaterThan(300)
  })

  it('keeps the centre label inside its circle', () => {
    for (const centre of ['Melody', 'The dictation question', 'Which set work is it standing next to?', 'The three things that move you from level 2 to level 3']) {
      const html = renderToStaticMarkup(<FourBox alt="" props={{ centre, boxes: [{ title: 'One', points: ['a'] }] }} />)
      const c = /<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/.exec(html)!
      const [cx, cy, r] = [Number(c[1]), Number(c[2]), Number(c[3])]
      const lines = [...html.matchAll(/<text x="([\d.]+)" y="([\d.]+)"[^>]*font-size="13"[^>]*>([^<]*)</g)]
      expect(lines.length, centre).toBeGreaterThan(0)
      // Every word survives the wrap, and every line fits inside the circle.
      expect(lines.map((m) => m[3]).join(' ')).toBe(centre)
      for (const m of lines) {
        const y = Number(m[2]), halfWidth = (m[3]!.length * 7) / 2
        // The widest point of a line is its corner: half its width across, and its
        // baseline above or below the centre.
        expect(Math.hypot(halfWidth, Math.abs(y - cy) + 5), `${centre}: "${m[3]}"`).toBeLessThanOrEqual(r)
        expect(Number(m[1])).toBe(cx)
      }
    }
  })

  it('leaves a short label the geometry it always had', () => {
    const html = renderToStaticMarkup(<FourBox alt="" props={{ centre: 'Melody', boxes: [{ title: 'One', points: ['a'] }] }} />)
    expect(html).toContain('viewBox="0 0 480 300"')
    expect(html).toContain('r="44"')
  })

  it('wraps a title too wide for its box', () => {
    const long = 'Given concentration and volume, want moles'
    const html = renderToStaticMarkup(<FourBox alt="" props={{ boxes: [{ title: long, points: ['a'] }] }} />)
    const lines = [...html.matchAll(/<text x="[\d.]+" y="[\d.]+"[^>]*font-size="15"[^>]*>([^<]*)</g)].map((m) => m[1])
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.join(' ')).toBe(long)
    // No line is wider than the box allows.
    for (const l of lines) expect(l!.length * 7.8).toBeLessThanOrEqual(186 - 28)
  })

  it('keeps every line of text inside its box', () => {
    const html = renderToStaticMarkup(<FourBox alt="" props={{ boxes: [{ title: 'One', body: LONG }, { title: 'A title long enough that it has to wrap onto two lines', body: LONG }, { title: 'Three', points: ['one', 'two', 'three'] }, { title: 'Four', body: LONG }] }} />)
    const boxes = [...html.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)]
      .map((m) => ({ x: Number(m[1]), y: Number(m[2]), w: Number(m[3]), h: Number(m[4]) }))
    expect(boxes).toHaveLength(4)
    const texts = [...html.matchAll(/<text x="([\d.]+)" y="([\d.]+)"/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }))
    expect(texts.length).toBeGreaterThan(4)
    for (const t of texts) {
      const inside = boxes.some((b) => t.x >= b.x && t.x <= b.x + b.w && t.y >= b.y && t.y <= b.y + b.h)
      expect(inside, `text at ${t.x},${t.y} is outside every box`).toBe(true)
    }
  })
})

/**
 * On a phone the grid is wider than the card, and a diagram stops shrinking at its natural
 * width, so the right-hand boxes sat off-screen. The stacked layout has to fit the width
 * it is given and still carry every word.
 */
describe('four-box stacked for a narrow screen', () => {
  const CENTRE = 'The marketing mix, four decisions that pull on one product'
  const boxes = [
    { title: 'Product', points: ['what is sold', 'its design and quality'] },
    { title: 'Price', body: 'What the customer pays, set against costs, competitors and what the market will bear.' },
    { title: 'Place', points: ['where it is sold'] },
    { title: 'A title long enough that it has to wrap onto a second line', body: 'Short.' },
  ]
  const render = (width: number) =>
    renderToStaticMarkup(<FourBoxStack centre={CENTRE} boxes={boxes} width={width} alt="" svgRef={{ current: null }} />)

  it('draws exactly as wide as the space it is given', () => {
    expect(render(298)).toContain('viewBox="0 0 298 ')
  })

  it('keeps every word of the titles, points, bodies and centre', () => {
    const html = render(298)
    const words = [CENTRE, ...boxes.flatMap((b) => [b.title, ...(b.points ?? []), b.body ?? ''])].join(' ').split(' ').filter(Boolean)
    for (const w of words) expect(html).toContain(w)
  })

  it('wraps every line of text to fit the width', () => {
    const texts = [...render(298).matchAll(/<text ([^>]*)>([^<]*)<\/text>/g)].map(([, attrs, text]) => ({
      x: Number(/x="([\d.]+)"/.exec(attrs!)![1]),
      size: /font-size="(\d+)"/.exec(attrs!)![1],
      middle: attrs!.includes('text-anchor="middle"'),
      text: text!,
    }))
    expect(texts.length).toBeGreaterThan(10)
    for (const { x, size, middle, text } of texts) {
      const w = text.length * (size === '15' ? 7.8 : size === '13' ? 7.6 : 7)
      const start = middle ? x - w / 2 : x
      expect(start, text).toBeGreaterThanOrEqual(0)
      expect(start + w, text).toBeLessThanOrEqual(298)
    }
  })

  it('stacks the boxes without overlap', () => {
    const rects = [...render(298).matchAll(/<rect x="1" y="([\d.]+)" width="[\d.]+" height="([\d.]+)" rx="10" fill="var\(--subject-soft\)"/g)].map((m) => [Number(m[1]), Number(m[2])])
    expect(rects).toHaveLength(4)
    for (let i = 1; i < rects.length; i++) expect(rects[i]![0]).toBeGreaterThanOrEqual(rects[i - 1]![0] + rects[i - 1]![1])
  })
})
