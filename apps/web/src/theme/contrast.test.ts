import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { SUBJECTS, STATUS_COLOUR } from '@study/shared'
import { describe, expect, it } from 'vitest'
import { THEMES } from './themes.ts'

/**
 * Text has to be readable in every theme, not just the one the page was designed in.
 *
 * An audit of 61,000 rendered elements across 21 routes and 5 themes found 5,112 failures,
 * all of one shape: a colour pinned for a light page meeting text that follows the theme.
 * The subject accents sat at 1.4:1 to 3.0:1 on the dark themes, the muted ink failed on
 * every theme including the light ones, and a filter chip painted white on white.
 *
 * The browser does the real check; this pins the arithmetic behind it so a new theme, a new
 * subject accent or a nudged token cannot reintroduce the same class without failing here.
 */

const WCAG_AA = 4.5

function channel(v: number) {
  const s = v / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
const luminance = ([r, g, b]: number[]) => 0.2126 * channel(r!) + 0.7152 * channel(g!) + 0.0722 * channel(b!)
function ratio(a: number[], b: number[]) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}
function rgb(hex: string): number[] {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}

/** The OKLCH conversions, so the test measures what the CSS clamp actually paints. */
function toOklch([r, g, b]: number[]): [number, number, number] {
  const lin = (v: number) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
  const [R, G, B] = [lin(r!), lin(g!), lin(b!)]
  const cb = (x: number) => Math.cbrt(x)
  const l = cb(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B)
  const m = cb(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B)
  const s = cb(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const Bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return [L, Math.hypot(A, Bb), Math.atan2(Bb, A)]
}
function fromOklch([L, C, H]: [number, number, number]): number[] {
  const a = C * Math.cos(H), b = C * Math.sin(H)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const out = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  return out.map((v) => {
    const c = Math.min(1, Math.max(0, v))
    return 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)
  })
}

/** What `.accent-ink` and `.chip` paint: hue and chroma kept, lightness clamped per theme. */
function accentInk(hex: string, min: number, max: number) {
  const [L, C, H] = toOklch(rgb(hex))
  return fromOklch([Math.min(max, Math.max(min, L)), C, H])
}

const CSS = readFileSync(new URL('../styles.css', import.meta.url), 'utf8')

/**
 * The Paper theme declares no overrides at all: its colours are the defaults in styles.css.
 * Read them from that file rather than restating them here -- a copy would have let the
 * muted ink go back to its old value with every test still green.
 */
function cssToken(name: string): string {
  const found = CSS.match(new RegExp(`\\${name}\\s*:\\s*(#[0-9a-fA-F]{3,8})`))
  if (!found) throw new Error(`${name} is not declared in styles.css`)
  return found[1]!
}
const DEFAULTS = {
  paper: cssToken('--color-paper'), surface: cssToken('--color-surface'), ink: cssToken('--color-ink'),
  ink2: cssToken('--color-ink-2'), ink3: cssToken('--color-ink-3'), panel: cssToken('--color-panel'),
}
const DEFAULT_ACCENT_MAX = Number(CSS.match(/--accent-l-max:\s*([\d.]+)/)![1])

/** Each theme as the browser sees it: its own overrides on top of the styles.css defaults. */
const themeColours = THEMES.map((t) => ({
  id: t.id,
  dark: t.dark ?? false,
  surface: t.vars['--color-surface'] ?? DEFAULTS.surface,
  paper: t.vars['--color-paper'] ?? DEFAULTS.paper,
  panel: t.vars['--color-panel'] ?? DEFAULTS.panel,
  ink: t.vars['--color-ink'] ?? DEFAULTS.ink,
  ink2: t.vars['--color-ink-2'] ?? DEFAULTS.ink2,
  ink3: t.vars['--color-ink-3'] ?? DEFAULTS.ink3,
  // styles.css: light themes cap an accent's lightness, dark ones lift it.
  accentMin: Number(t.vars['--accent-l-min'] ?? 0),
  accentMax: Number(t.vars['--accent-l-max'] ?? DEFAULT_ACCENT_MAX),
}))

describe('every theme', () => {
  it('has all nine themes measured, so a new one cannot be added without a check', () => {
    expect(themeColours).toHaveLength(THEMES.length)
    expect(THEMES.length).toBeGreaterThanOrEqual(9)
  })

  it.each(themeColours)('reads its three inks against surface, paper and panel: $id', (t) => {
    for (const ground of [t.surface, t.paper, t.panel]) {
      for (const [name, ink] of [['ink', t.ink], ['ink-2', t.ink2], ['ink-3', t.ink3]] as const) {
        expect(ratio(rgb(ink), rgb(ground)), `${name} on ${ground} in ${t.id}`).toBeGreaterThanOrEqual(WCAG_AA)
      }
    }
  })

  it.each(themeColours)('reads every subject accent and status colour as text: $id', (t) => {
    const accents = [...SUBJECTS.map((s) => [s.id, s.colour] as const), ...Object.entries(STATUS_COLOUR)]
    for (const [name, colour] of accents) {
      const painted = accentInk(colour, t.accentMin, t.accentMax)
      for (const ground of [t.surface, t.paper, t.panel]) {
        expect(ratio(painted, rgb(ground)), `${name} on ${ground} in ${t.id}`).toBeGreaterThanOrEqual(WCAG_AA)
      }
    }
  })

  /**
   * Contrast cannot see a colour that is merely wrong. The first version of the clamp put
   * --subject-ink on :root, where a custom property substitutes its var()s once, against
   * the root's default accent -- so every subject passed every contrast check wearing the
   * same grey. Keeping the accents distinct is a separate assertion from keeping them legible.
   */
  it.each(themeColours)('keeps the subject accents distinct from one another: $id', (t) => {
    const painted = SUBJECTS.map((s) => accentInk(s.colour, t.accentMin, t.accentMax).map(Math.round).join(','))
    expect(new Set(painted).size, `${t.id} collapsed accents: ${painted.join(' ')}`).toBe(SUBJECTS.length)
  })

  it('lifts accents on the dark themes and caps them on the light ones', () => {
    for (const t of themeColours) {
      if (t.dark) expect(t.accentMin, t.id).toBeGreaterThan(0.5)
      else expect(t.accentMax, t.id).toBeLessThanOrEqual(0.5)
    }
  })
})

describe('the accent tokens', () => {
  const css = CSS

  /** A class, not a :root token -- see the comment on the distinctness test above. */
  it('clamps the subject accent on the element that uses it, not once at the root', () => {
    expect(css).toMatch(/\.accent-ink\s*{\s*color:\s*oklch\(from var\(--subject\)/)
    expect(css).not.toMatch(/--subject-ink\s*:/)
  })

  it('keeps a fallback for a browser without relative colour syntax', () => {
    expect(css).toContain('@supports (color: oklch(from red l c h))')
    expect(css).toMatch(/\.accent-ink\s*{\s*color:\s*var\(--subject\)/)
  })

  /**
   * Painting the accent straight into a `style` attribute skips the clamp. That is how the
   * status chip, the glossary filter and six subject labels stayed unreadable after the
   * token existed.
   */
  it('is not bypassed by an inline colour anywhere in the app', () => {
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) { walk(path); continue }
        if (!entry.name.endsWith('.tsx') || entry.name.includes('.test.')) continue
        // Diagrams are drawn on a pinned white canvas and keep the authored colour there.
        if (path.includes('/diagrams/') || path.includes('/charts/')) continue
        const source = readFileSync(path, 'utf8')
        for (const line of source.split('\n')) {
          if (/\bcolor:\s*(STATUS_COLOUR|[A-Za-z_$][\w$?.]*\.colour|hit\.record\.subjectColour)/.test(line)) {
            offenders.push(`${path}: ${line.trim().slice(0, 100)}`)
          }
        }
      }
    }
    walk(new URL('..', import.meta.url).pathname)
    expect(offenders, offenders.join('\n')).toEqual([])
  })
})
