import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BANDS, EmSpectrum, W } from './EmSpectrum.tsx'

const html = renderToStaticMarkup(<EmSpectrum props={{}} alt="The electromagnetic spectrum" />)

describe('the electromagnetic spectrum', () => {
  /** AQA 8463 4.6.2.1: "Going from long to short wavelength … radio, microwave, infrared, visible light, ultraviolet, X-rays and gamma rays." */
  it('lists the seven groups in the specification’s order, long wavelength first', () => {
    expect(BANDS.map((b) => b.name)).toEqual(['Radio waves', 'Microwaves', 'Infrared', 'Visible light', 'Ultraviolet', 'X-rays', 'Gamma rays'])
    let at = -1
    for (const b of BANDS) { const i = html.indexOf(`data-band="${b.name}"`); expect(i).toBeGreaterThan(at); at = i }
  })

  it('draws shorter waves further down', () => {
    for (let i = 1; i < BANDS.length; i++) expect(BANDS[i]!.cycles).toBeGreaterThan(BANDS[i - 1]!.cycles)
  })

  /** 4.6.2.3 names the harm for ultraviolet, X-rays and gamma rays, and for nothing else. */
  it('names the harm only where the specification does', () => {
    expect(BANDS.filter((b) => b.harm).map((b) => b.name)).toEqual(['Ultraviolet', 'X-rays', 'Gamma rays'])
  })

  it('fits a phone card', () => {
    expect(W).toBeLessThanOrEqual(298)
    const lines = [...html.matchAll(/font-size="12"[^>]*>([^<]+)</g)].map((m) => m[1]!)
    for (const l of lines) expect(l.length * 12 * 0.6, l).toBeLessThanOrEqual(W - 10)
  })
})
