import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { INDICATOR, PhScale, W } from './PhScale.tsx'

const html = renderToStaticMarkup(<PhScale props={{}} alt="The pH scale" />)

/** Where a colour sits round the colour wheel, in degrees: red 0, yellow 60, green 120, blue 240. */
function hue(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number]
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return (h * 60 + 360) % 360
}

describe('the pH scale', () => {
  it('runs from 0 to 14', () => {
    expect(INDICATOR).toHaveLength(15)
    expect(html).toContain(`viewBox="0 0 ${W} `)
    expect(W).toBeLessThanOrEqual(298)
  })

  /**
   * The sheet teaches the colours, so the word beside a swatch must be the swatch's
   * colour. pH 2 was an orange under the word "red", the same swatch as vinegar's orange.
   */
  it('gives each substance a swatch of the colour it names', () => {
    const BAND: Record<string, [number, number]> = { red: [0, 14], orange: [15, 42], yellow: [43, 75], green: [76, 150], 'blue-green': [150, 195], blue: [196, 235], purple: [236, 300] }
    const rows = [...html.matchAll(/data-substance="[^"]+"><rect[^>]*fill="(#[0-9a-f]{6})"[^>]*>.*?<text[^>]*font-size="12"[^>]*>([^<]*)<\/text>(?:<text[^>]*font-size="12"[^>]*>([^<]*)<\/text>)?/g)]
    expect(rows).toHaveLength(7)
    for (const [, fill, first, second] of rows) {
      const word = /, ([a-z-]+)$/.exec(`${first} ${second ?? ''}`.trim())![1]!
      const [lo, hi] = BAND[word]!
      const at = hue(fill!) > 330 ? hue(fill!) - 360 : hue(fill!)
      expect(at, `${first}: ${fill} is not ${word}`).toBeGreaterThanOrEqual(word === 'red' ? -15 : lo)
      expect(at, `${first}: ${fill} is not ${word}`).toBeLessThanOrEqual(hi)
    }
  })

  it('moves one way round the colours from acid to alkali, never back', () => {
    // The wheel joins at red: a red just short of 360 is counted as just below 0.
    const hues = INDICATOR.map(hue).map((h) => (h > 330 ? h - 360 : h))
    for (let ph = 1; ph < hues.length; ph++) expect(hues[ph], `pH ${ph}`).toBeGreaterThanOrEqual(hues[ph - 1]! - 1)
  })
})
