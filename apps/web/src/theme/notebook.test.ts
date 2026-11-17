import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { THEMES } from './themes.ts'

/**
 * Notebook (backlog section 16): four inks and three highlighters, nothing else. The owner
 * asked for black, blue, red and green; this holds the arithmetic that lets each be read.
 * Every pen is AA on the white paper, and on a highlighter only black and blue are, which is
 * why styles.css writes highlighted words in black.
 */
const CSS = readFileSync(new URL('../styles.css', import.meta.url), 'utf8')
const block = CSS.slice(CSS.indexOf('[data-theme="notebook"] {'))
const token = (name: string) => {
  const m = block.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`))
  if (!m) throw new Error(`--${name} is not declared in the Notebook block`)
  return m[1]!
}
const channel = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
const lum = (hex: string) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); return 0.2126 * channel(r!) + 0.7152 * channel(g!) + 0.0722 * channel(b!) }
const ratio = (a: string, b: string) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi! + 0.05) / (lo! + 0.05) }

const notebook = THEMES.find((t) => t.id === 'notebook')!
const PENS = ['pen-black', 'pen-blue', 'pen-red', 'pen-green']
const HIGHLIGHTERS = ['hl-blue', 'hl-red', 'hl-green']

describe('the Notebook theme', () => {
  it('is white paper, and writes in the black pen', () => {
    expect(notebook.vars['--color-paper']).toBe('#ffffff')
    expect(notebook.vars['--color-surface']).toBe('#ffffff')
    expect(notebook.vars['--color-ink']).toBe(token('pen-black'))
    expect(notebook.vars['--color-ink-2']).toBe(token('pen-blue'))
  })

  it('fetches its handwriting only when it is chosen', () => {
    expect(notebook.fonts).toMatch(/^https:\/\/fonts\.googleapis\.com\/css2\?family=Caveat.*family=Kalam/)
    expect(THEMES.filter((t) => t.fonts)).toEqual([notebook])
    expect(readFileSync(new URL('../../index.html', import.meta.url), 'utf8')).not.toMatch(/Kalam|Caveat/)
  })

  it('has every pen at AA on the paper', () => {
    for (const pen of PENS) expect(ratio(token(pen), '#ffffff'), pen).toBeGreaterThanOrEqual(4.5)
  })

  it('writes on a highlighter only in black or blue, the two pens that stay at AA there', () => {
    for (const hl of HIGHLIGHTERS) {
      for (const pen of ['pen-black', 'pen-blue']) expect(ratio(token(pen), token(hl)), `${pen} on ${hl}`).toBeGreaterThanOrEqual(4.5)
    }
    expect(Math.min(...HIGHLIGHTERS.map((hl) => ratio(token('pen-green'), token(hl))))).toBeLessThan(4.5)
    expect(block).toMatch(/\.rich-text strong:not\(\.hero-gradient \*\) \{ color: var\(--pen-black\); background: var\(--hl-/)
  })

  it('draws the marks in the pens: a red circle and a green underline', () => {
    expect(block).toContain('.hand-circle > .accent-ink { color: var(--pen-red); }')
    expect(block).toContain('.hand-underline > .accent-ink { color: var(--pen-green); }')
  })

  it('keeps diagrams, tables and answer fields in the printed face', () => {
    expect(block).toMatch(/:is\(figure\[data-diagram\], svg, table, input, textarea, select, math-field[^)]*\) \{[^}]*font-family: var\(--font-plain\)/)
  })
})
