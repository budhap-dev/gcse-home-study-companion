import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ACROSS_W, BANDS, EmSpectrum, W, chirp, keepUnits } from './EmSpectrum.tsx'

const html = renderToStaticMarkup(<EmSpectrum props={{}} alt="The electromagnetic spectrum" />)

describe('the electromagnetic spectrum', () => {
  /** AQA 8463 4.6.2.1: "Going from long to short wavelength … radio, microwave, infrared, visible light, ultraviolet, X-rays and gamma rays." */
  it('lists the seven groups in the specification’s order, long wavelength first', () => {
    expect(BANDS.map((b) => b.name)).toEqual(['Radio waves', 'Microwaves', 'Infrared', 'Visible light', 'Ultraviolet', 'X-rays', 'Gamma rays'])
    let at = -1
    for (const b of BANDS) { const i = html.indexOf(`data-band="${b.name}"`); expect(i).toBeGreaterThan(at); at = i }
  })

  /**
   * "400 to 700 nm, red to violet" put the numbers one way and the colours the other, so it
   * read as red at 400 nm. Red is the long end: 4.6.2.1 lists "visible light (red to
   * violet)" going from long wavelength to short.
   */
  it('gives red the longer wavelength', () => {
    const about = BANDS.find((b) => b.name === 'Visible light')!.about
    const red = Number(/red (\d+)/.exec(about)![1]), violet = Number(/violet (\d+)/.exec(about)![1])
    expect(red).toBeGreaterThan(violet)
    expect(about.indexOf('red')).toBeLessThan(about.indexOf('violet'))
  })

  /** The app's own Wi-Fi example is 12.5 cm; "about 1 cm" left it nowhere to sit. */
  it('gives microwaves a range that holds the 12.5 cm of Wi-Fi, in order down the spectrum', () => {
    expect(BANDS.find((b) => b.name === 'Microwaves')!.about).toBe('about 1 cm to 10 cm')
    // Each group's figure, in metres, is no longer than the one before it.
    const UNIT: Record<string, number> = { km: 1e3, m: 1, cm: 1e-2, 'μm': 1e-6, nm: 1e-9 }
    const longest = BANDS.map((b) => Math.max(...[...b.about.matchAll(/([\d.]+) (km|cm|μm|nm|m)\b/g)].map((m) => Number(m[1]) * UNIT[m[2]!]!)))
    for (let i = 1; i < longest.length; i++) expect(longest[i], BANDS[i]!.name).toBeLessThanOrEqual(longest[i - 1]!)
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

/**
 * The layout a laptop gets: the seven groups side by side under one wave that tightens
 * from left to right, which is the picture every textbook draws.
 */
describe('the spectrum drawn across', () => {
  const across = renderToStaticMarkup(<EmSpectrum props={{ layout: 'across' }} alt="The electromagnetic spectrum" />)
  const COL = ACROSS_W / BANDS.length
  /** The points of a path of straight segments. */
  const points = (d: string) => [...d.matchAll(/[ML]([\d.-]+) ([\d.-]+)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }))

  it('keeps the seven groups in order, long wavelength on the left', () => {
    expect(across).toContain('data-layout="across"')
    expect(across).toContain(`viewBox="0 0 ${ACROSS_W} `)
    const names = [...across.matchAll(/data-band="([^"]+)"/g)].map((m) => m[1])
    expect(names).toEqual(BANDS.map((b) => b.name))
    expect(across.indexOf('Longer wavelength')).toBeLessThan(across.indexOf('Shorter wavelength'))
  })

  it('is the default drawing unless asked', () => {
    expect(html).toContain('data-layout="down"')
  })

  /** Seven sine curves joined end to end would kink at every join; one wave does not. */
  it('draws one unbroken wave: each group starts where the last one stopped', () => {
    const waves = [...across.matchAll(/<path d="([^"]+)"[^>]*data-wave/g)].map((m) => points(m[1]!))
    expect(waves).toHaveLength(7)
    for (let i = 1; i < waves.length; i++) {
      const end = waves[i - 1]!.at(-1)!, start = waves[i]![0]!
      expect(start.x, BANDS[i]!.name).toBeCloseTo(end.x, 1)
      expect(start.y, BANDS[i]!.name).toBeCloseTo(end.y, 1)
      expect(start.x).toBeCloseTo(i * COL, 1)
    }
  })

  it('squeezes the wave steadily: every half wave is shorter than the one before', () => {
    const wave = points(chirp(0, ACROSS_W, 0, 10))
    // Where the wave crosses its middle line, found between the two points either side.
    const crossings: number[] = []
    for (let j = 1; j < wave.length; j++) {
      const [a, b] = [wave[j - 1]!, wave[j]!]
      if (a.y !== 0 && Math.sign(a.y) !== Math.sign(b.y)) crossings.push(a.x + ((b.x - a.x) * a.y) / (a.y - b.y))
    }
    const halves = crossings.slice(1).map((x, j) => x - crossings[j]!)
    expect(halves.length).toBeGreaterThan(30)
    // Coordinates are written to two decimal places, so allow that much.
    for (let j = 1; j < halves.length; j++) expect(halves[j]!, `half wave ${j}`).toBeLessThan(halves[j - 1]! + 0.02)
    expect(halves[0]! / halves.at(-1)!).toBeGreaterThan(8)
    // Drawn finely enough to be a curve, not a zigzag: the tightest half wave still has five points.
    expect(halves.at(-1)! / 0.75).toBeGreaterThanOrEqual(5)
  })

  it('wraps every line of text inside its own column', () => {
    const lines = [...across.matchAll(/<text x="([\d.]+)"[^>]*font-size="12"[^>]*>([^<]+)</g)]
      .map((m) => ({ x: Number(m[1]), text: m[2]!.replace(/&[a-z]+;/g, 'x') }))
      .filter((l) => !/wavelength/.test(l.text))
    expect(lines.length).toBeGreaterThan(21)
    for (const l of lines) {
      const left = Math.floor(l.x / COL) * COL
      expect(l.x + l.text.length * 12 * 0.6, l.text).toBeLessThanOrEqual(left + COL - 4)
    }
  })

  /** "about 1 m to 1 km" ended a line on the 1 and began the next with "km". */
  it('never parts a number from its unit at the end of a line', () => {
    expect(keepUnits('about 1 m to 1 km')).toBe('about 1\u00a0m to 1\u00a0km')
    expect(keepUnits('400 to 700 nm, red to violet')).toBe('400 to 700\u00a0nm, red to violet')
    expect(keepUnits('about 10 μm')).toBe('about 10\u00a0μm')
    const lines = [...across.matchAll(/<text[^>]*font-size="12"[^>]*>([^<]+)</g)].map((m) => m[1]!)
    for (const l of lines) {
      expect(l, l).not.toMatch(/\d$/)
      expect(l, l).not.toMatch(/^(?:km|cm|mm|nm|μm|m)\b/)
    }
  })

  /** Both drawings are built from BANDS, so neither can say something the other does not. */
  it('says what the narrow drawing says', () => {
    const words = (markup: string) => [...markup.matchAll(/<text[^>]*>([^<]+)</g)].map((m) => m[1]!).join(' ').replace(/[\s\u00a0]+/g, ' ')
    for (const b of BANDS) {
      for (const phrase of [b.name, b.about, ...(b.harm ? ['Harm:'] : [])]) {
        expect(words(html), phrase).toContain(phrase.split(' ')[0])
        expect(words(across), phrase).toContain(phrase.split(' ')[0])
      }
    }
    expect(across.match(/Harm:/g)).toHaveLength(html.match(/Harm:/g)!.length)
  })
})
