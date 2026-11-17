import { readFileSync } from 'node:fs'
import { stripHands } from '@study/shared'
import { describe, expect, it } from 'vitest'
import { handSvg, HAND_KINDS, seedOf, svgUrl } from './hand.ts'
import { renderRichText } from './RichText.tsx'

describe('hand-drawn marks (section 15, Part C)', () => {
  it('renders each tag as its mark, with the emphasis underneath', () => {
    expect(renderRichText('The {{circle|hypotenuse}} is opposite.')).toContain('<span class="hand hand-circle" data-hand="circle"><strong>hypotenuse</strong></span>')
    expect(renderRichText('{{underline|find the right angle}}')).toContain('<span class="hand hand-underline" data-hand="underline">find the right angle</span>')
    expect(renderRichText('{{highlight|$V = IR$}} is on the sheet')).toMatch(/<mark class="hand hand-highlight" data-hand="highlight"><span class="katex">/)
  })

  it('never reads TeX braces as a tag, and leaves an unknown kind as written', () => {
    expect(renderRichText('$\\frac{{a}}{b}$')).not.toContain('data-hand')
    expect(renderRichText('{{box|word}}')).toContain('{{box|word}}')
  })

  it('takes the words out of a tag for anything that reads text', () => {
    expect(stripHands('The {{circle|hypotenuse}} and {{underline|this rule}}.')).toBe('The hypotenuse and this rule.')
  })

  it('draws the same shape for the same words, a different one for other words', () => {
    for (const k of HAND_KINDS) {
      expect(handSvg(k, seedOf('a'), '#123456', false)).toBe(handSvg(k, seedOf('a'), '#123456', false))
      expect(handSvg(k, seedOf('a'), '#123456', false)).not.toBe(handSvg(k, seedOf('b'), '#123456', false))
    }
  })

  it('animates only when asked, once, and never forever', () => {
    for (const k of HAND_KINDS) {
      const still = handSvg(k, 1, '#123456', false)
      const moving = handSvg(k, 1, '#123456', true, 300)
      expect(still).not.toContain('animation')
      expect(moving).toContain('animation')
      expect(moving).not.toContain('infinite')
    }
    // a stroke's dash is the pixel length given, so the drawn line has no gaps
    expect(handSvg('underline', 1, '#123456', true, 412)).toContain('stroke-dasharray:412 412')
  })

  it('keeps every stroke inside its box, so no mark is cut off flat', () => {
    // half the stroke (about 1 unit across, 1.5 up) must fit inside the 100 by 40 box as well
    for (let seed = 1; seed <= 500; seed++) {
      for (const k of ['circle', 'underline'] as const) {
        const d = handSvg(k, seed * 7919, '#123456', false).match(/ d="([^"]+)"/)![1]
        const n = d.match(/-?\d+(\.\d+)?/g)!.map(Number)
        expect(n.length).toBeGreaterThan(5)
        for (let i = 0; i < n.length; i += 2) {
          expect(n[i]).toBeGreaterThanOrEqual(1)
          expect(n[i]).toBeLessThanOrEqual(99)
          expect(n[i + 1]).toBeGreaterThanOrEqual(1.5)
          expect(n[i + 1]).toBeLessThanOrEqual(38.5)
        }
      }
    }
  })

  it('keeps a strike inside its box, through the middle of the words', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const n = handSvg('strike', seed * 7919, '#123456', false).match(/ d="([^"]+)"/)![1]!.match(/-?\d+(\.\d+)?/g)!.map(Number)
      for (let i = 0; i < n.length; i += 2) {
        expect(n[i]).toBeGreaterThanOrEqual(0.5)
        expect(n[i]).toBeLessThanOrEqual(99.5)
        expect(n[i + 1]).toBeGreaterThanOrEqual(18)
        expect(n[i + 1]).toBeLessThanOrEqual(28)
      }
    }
  })

  it('makes a CSS url of the SVG', () => {
    expect(svgUrl('<svg/>')).toBe('url("data:image/svg+xml,%3Csvg%2F%3E")')
  })
})

describe('strikethrough and caret (section 16, drawn only in Notebook)', () => {
  it('renders a strike as the mistake and its correction, and a caret as inserted words', () => {
    expect(renderRichText('So {{strike|16|11}} is the answer.')).toContain('<del class="hand hand-strike" data-hand="strike">16</del><span class="hand-gap"> </span><ins class="hand-fix">11</ins>')
    expect(renderRichText('The current is 2 {{caret|amperes}}.')).toContain('2 <ins class="hand-caret">amperes</ins>.')
  })

  it('leaves a strike without exactly two halves as written, for the content test to catch', () => {
    expect(renderRichText('{{strike|16}}')).toContain('{{strike|16}}')
    expect(renderRichText('{{strike|a|b|c}}')).toContain('{{strike|a|b|c}}')
  })

  it('reads as the corrected sentence for anything that reads text', () => {
    expect(stripHands('So {{strike|16|11}} is the answer, in {{caret|amperes}}.')).toBe('So 11 is the answer, in amperes.')
  })

  it('hides the mistake outside Notebook, and never shows it unstruck inside it', () => {
    const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8')
    expect(css).toContain('del.hand-strike, .hand-gap { display: none; }')
    expect(css).toMatch(/\[data-theme="notebook"\] del\.hand-strike:not\(\[data-drawn\]\) \{ text-decoration: line-through;/)
    expect(css).toMatch(/@media print \{\n  \[data-theme="notebook"\] del\.hand-strike \{ text-decoration: line-through; \}/)
  })
})
