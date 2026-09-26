import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { everyVisual } from '@study/shared'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Plant } from './Plant.tsx'

const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content')

function jsonFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? jsonFiles(full) : name.endsWith('.json') ? [full] : []
  })
}

/** Every `kind` the content pack actually asks Plant to draw. */
function kindsInUse(): string[] {
  const kinds = new Set<string>()
  for (const file of jsonFiles(ROOT)) {
    const topic = JSON.parse(readFileSync(file, 'utf8'))
    for (const { visual } of everyVisual(topic)) {
      if (visual.type === 'diagram' && visual.component === 'plant') kinds.add(String((visual.props as { kind?: string })?.kind ?? 'leaf-section'))
    }
  }
  return [...kinds]
}

/**
 * Every `<text>`, resolved to one entry per line: a plain text node is one line, and a
 * multi-line label (tspans repeating the parent's own x, the way Plant always writes
 * them) is one entry per tspan. Each entry carries the x its line is actually drawn at,
 * its text-anchor, its font-size and its rendered characters — everything the phone-fit
 * estimate (x ± 0.6 × fontSize × characters) needs.
 */
function textLines(svg: string): { x: number; anchor: string; fontSize: number; text: string }[] {
  const out: { x: number; anchor: string; fontSize: number; text: string }[] = []
  for (const [, attrs, inner] of svg.matchAll(/<text ([^>]*)>((?:(?!<\/text>).)*)<\/text>/gs)) {
    const anchor = /text-anchor="(\w+)"/.exec(attrs!)?.[1] ?? 'start'
    const fontSize = Number(/font-size="(\d+)"/.exec(attrs!)?.[1] ?? '11')
    const tspans = [...inner!.matchAll(/<tspan x="(-?[\d.]+)"[^>]*>([^<]*)<\/tspan>/g)]
    if (tspans.length) {
      for (const [, x, text] of tspans) out.push({ x: Number(x), anchor, fontSize, text: text! })
    } else {
      const x = Number(/(?:^|\s)x="(-?[\d.]+)"/.exec(attrs!)![1])
      out.push({ x, anchor, fontSize, text: inner! })
    }
  }
  return out
}

const render = (kind: string) => renderToStaticMarkup(<Plant alt="" props={{ kind }} />)

describe('plant', () => {
  const kinds = kindsInUse()

  it('finds the kinds the content pack actually uses', () => {
    expect(kinds.length).toBeGreaterThanOrEqual(5)
  })

  it('draws every kind at 296 or narrower', () => {
    for (const kind of kinds) {
      const [, , width] = /viewBox="([^"]+)"/.exec(render(kind))![1]!.split(' ').map(Number)
      expect(width!, kind).toBeLessThanOrEqual(296)
    }
  })

  it('keeps every label, wrapped or not, inside the view for every kind the pack uses', () => {
    for (const kind of kinds) {
      const html = render(kind)
      const [x0, , width] = /viewBox="([^"]+)"/.exec(html)![1]!.split(' ').map(Number)
      const lines = textLines(html)
      expect(lines.length, kind).toBeGreaterThan(0)
      for (const { x, anchor, fontSize, text } of lines) {
        const w = text.length * 0.6 * fontSize
        const left = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x
        expect(left, `${kind}: "${text}"`).toBeGreaterThanOrEqual(x0! - 0.5)
        expect(left + w, `${kind}: "${text}"`).toBeLessThanOrEqual(x0! + width! + 0.5)
      }
    }
  })

  it('keeps every word of every wrapped label, in order', () => {
    // A label passed as string[] must still show every word the original single-line
    // caption had; this is the guard against a line silently losing a word to fit.
    const fullCaptions: Record<string, string[]> = {
      'root-hair': ['water in by osmosis, mineral ions by active transport', 'mitochondria: energy for active transport', 'long hair: large surface area, thin wall'],
      stoma: ['guard cells turgid: water in', 'guard cells flaccid: water out', 'the stoma is the gap between the two guard cells'],
      potometer: ['capillary tube with scale: distance the bubble moves per minute', 'leafy shoot, cut under water', 'a potometer measures water uptake, which follows the rate of transpiration'],
    }
    for (const [kind, captions] of Object.entries(fullCaptions)) {
      const html = render(kind)
      for (const caption of captions) {
        for (const word of caption.split(' ')) expect(html, `${kind}: "${caption}"`).toContain(word)
      }
    }
  })

  it('is still an accessible image with the alt text given to it', () => {
    const html = renderToStaticMarkup(<Plant alt="a stoma opening and closing" props={{ kind: 'stoma' }} />)
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="a stoma opening and closing"')
  })
})
