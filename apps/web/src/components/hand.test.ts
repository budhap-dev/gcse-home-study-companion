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

  it('makes a CSS url of the SVG', () => {
    expect(svgUrl('<svg/>')).toBe('url("data:image/svg+xml,%3Csvg%2F%3E")')
  })
})
