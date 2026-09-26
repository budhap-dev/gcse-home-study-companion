import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EquationCard } from './EquationCard.tsx'

const svg = (props: Record<string, unknown>) => renderToStaticMarkup(<EquationCard props={props} alt="a card of equations" />)
const short = { name: 'Kinetic energy', equation: 'Ek = ½ m v²', units: 'J, kg, m/s' }
const long = {
  name: '% change = (change ÷ original) × 100',
  equation: 'change = final mass − starting mass',
  units: 'a percentage; negative means mass was lost',
}
const sentence = {
  name: 'energy (J) = mass of water (g) × 4.2 × temperature change (°C)',
  equation: '4.2 is the energy needed to raise 1 g of water by 1 °C',
  units: 'J, g, °C',
}

const box = (markup: string) => {
  const m = markup.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/)!
  return { w: Number(m[1]), h: Number(m[2]) }
}

/**
 * The card used to be 520 units wide and to anchor the equation to its right edge. Below
 * its natural width a diagram stops shrinking and scrolls instead, so on a phone the part
 * that scrolled out of sight was the equation: the card showed "Potential difference /
 * V, A, ohms" and the student had to drag sideways to find "V = I R".
 *
 * It is now drawn at 300 units, inside the roughly 332 a topic card leaves on a 390px
 * phone, with every row stacked and wrapped.
 */
describe('equation card', () => {
  /** The measurement that matters: it has to fit the phone it is read on. */
  it('is narrow enough for a topic card on a 390px phone', () => {
    for (const equations of [[short], [long], [sentence], [short, long, sentence]]) {
      expect(box(svg({ equations })).w).toBeLessThanOrEqual(332)
    }
  })

  it('puts the equation on its own line rather than anchoring it to the right edge', () => {
    for (const equations of [[short], [long], [sentence]]) {
      expect(svg({ equations })).not.toContain('text-anchor="end"')
    }
  })

  it('wraps a sentence in the equation slot instead of letting it run off', () => {
    const markup = svg({ equations: [sentence] })
    const texts = [...markup.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]!)
    // The long name and the long equation each become several lines.
    expect(texts.length).toBeGreaterThan(4)
    for (const t of texts) expect(t.length).toBeLessThan(45)
  })

  it('grows taller, not wider, as it is given more to hold', () => {
    const one = box(svg({ equations: [short] }))
    const three = box(svg({ equations: [short, short, short] }))
    expect(three.w).toBe(one.w)
    expect(three.h).toBeGreaterThan(one.h)
  })

  it('never lets any text fall outside the card', () => {
    for (const equations of [[short], [long], [sentence], [short, long], [long, long, short]]) {
      const markup = svg({ equations })
      const { h } = box(markup)
      const ys = [...markup.matchAll(/<text[^>]*\by="(\d+(?:\.\d+)?)"/g)].map((m) => Number(m[1]))
      expect(ys.length).toBeGreaterThan(0)
      expect(Math.max(...ys)).toBeLessThan(h)
      expect(Math.min(...ys)).toBeGreaterThan(0)
    }
  })

  it('sets a formula larger than a sentence, and never below 12', () => {
    expect(svg({ equations: [short] })).toContain('font-size="20"')
    const sizes = [...svg({ equations: [sentence] }).matchAll(/font-size="(\d+)"/g)].map((m) => Number(m[1]))
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(12)
  })

  /**
   * The card is authored content's, not the component's: every card in the pack has to fit,
   * including the Chemistry and Biology ones whose "equation" is a sentence.
   */
  it('fits every equation card in the content pack', () => {
    const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content')
    const cards: { name: string; equation: string; units: string }[][] = []
    for (const sub of readdirSync(ROOT).filter((d) => statSync(join(ROOT, d)).isDirectory())) {
      for (const f of readdirSync(join(ROOT, sub)).filter((x) => x.endsWith('.json'))) {
        const doc = JSON.parse(readFileSync(join(ROOT, sub, f), 'utf8'))
        for (const step of doc.lesson.steps) {
          for (const v of step.visuals ?? []) {
            if (v.component === 'equation-card' && Array.isArray(v.props?.equations)) cards.push(v.props.equations)
          }
        }
      }
    }
    expect(cards.length).toBeGreaterThan(50)
    for (const equations of cards) {
      const markup = svg({ equations })
      const { w, h } = box(markup)
      expect(w).toBeLessThanOrEqual(332)
      const ys = [...markup.matchAll(/<text[^>]*\by="(\d+(?:\.\d+)?)"/g)].map((m) => Number(m[1]))
      expect(Math.max(...ys), `a card runs past its own height`).toBeLessThan(h)
    }
  })

  /**
   * The phone-fit floor the whole pack has to clear: the viewBox itself must be at most
   * 296 units (the 298 CSS px `Visual.tsx` leaves on a 390px phone, less a small margin),
   * and every text's estimated extent — x ± 0.6 × fontSize × characters, by its
   * text-anchor — must lie inside it. HTML entities (a "<" or ">" in a rate law) are
   * decoded first so a `>` counted as four characters ("&gt;") does not fail a line that
   * actually fits.
   */
  it('is drawn to 296 units or less, with every text estimated to stay inside it', () => {
    const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content')
    const cards: { name: string; equation: string; units: string }[][] = []
    for (const sub of readdirSync(ROOT).filter((d) => statSync(join(ROOT, d)).isDirectory())) {
      for (const f of readdirSync(join(ROOT, sub)).filter((x) => x.endsWith('.json'))) {
        const doc = JSON.parse(readFileSync(join(ROOT, sub, f), 'utf8'))
        for (const step of doc.lesson.steps) {
          for (const v of step.visuals ?? []) {
            if (v.component === 'equation-card' && Array.isArray(v.props?.equations)) cards.push(v.props.equations)
          }
        }
      }
    }
    expect(cards.length).toBeGreaterThan(50)
    for (const equations of cards) {
      const markup = svg({ equations })
      const w = box(markup).w
      expect(w, JSON.stringify(equations).slice(0, 60)).toBeLessThanOrEqual(296)
      for (const t of markup.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
        const attrs = t[1]!
        const x = Number(/\bx="(-?[\d.]+)"/.exec(attrs)![1])
        const size = Number(/font-size="([\d.]+)"/.exec(attrs)?.[1] ?? '12')
        const anchor = /text-anchor="(\w+)"/.exec(attrs)?.[1] ?? 'start'
        const text = t[2]!.replace(/<[^>]+>/g, '').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&')
        const half = text.length * 0.6 * size
        const left = anchor === 'end' ? x - half : anchor === 'middle' ? x - half / 2 : x
        const right = anchor === 'end' ? x : anchor === 'middle' ? x + half / 2 : x + half
        expect(left, `"${text}"`).toBeGreaterThanOrEqual(-0.5)
        expect(right, `"${text}"`).toBeLessThanOrEqual(w + 0.5)
      }
    }
  })
})
