import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BeamMoments } from './BeamMoments.tsx'
import { EnergyStores } from './EnergyStores.tsx'
import { EnergyTransferBars } from './EnergyTransferBars.tsx'
import { SpringLoad } from './SpringLoad.tsx'

const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content')
function findProps(comp: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  for (const sub of readdirSync(ROOT).filter((d) => statSync(join(ROOT, d)).isDirectory())) {
    for (const f of readdirSync(join(ROOT, sub)).filter((x) => x.endsWith('.json'))) {
      const doc = JSON.parse(readFileSync(join(ROOT, sub, f), 'utf8'))
      for (const step of doc.lesson?.steps ?? []) {
        for (const v of step.visuals ?? []) if (v.component === comp) out.push(v.props ?? {})
      }
      for (const ex of doc.why?.examples ?? []) {
        if (ex.visual?.component === comp) out.push(ex.visual.props ?? {})
      }
    }
  }
  return out
}

/**
 * Every text's estimated extent — x ± 0.6 × font size × its character count, read by its
 * own text-anchor — has to land inside the viewBox, and the viewBox itself at most 296
 * wide. A text with no font-size attribute (a component that sets it through a CSS
 * shorthand instead) is assumed to render at the SVG default of 16px.
 */
function check(markup: string, label: string) {
  const m = /viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/.exec(markup)!
  const minx = Number(m[1]), w = Number(m[3])
  expect(w, label).toBeLessThanOrEqual(296)
  for (const t of markup.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
    const attrs = t[1]!
    const x = Number(/\bx="(-?[\d.]+)"/.exec(attrs)![1])
    const size = Number(/font-size="([\d.]+)"/.exec(attrs)?.[1] ?? '16')
    const anchor = /text-anchor="(\w+)"/.exec(attrs)?.[1] ?? 'start'
    const text = t[2]!.replace(/<[^>]+>/g, '')
    if (!text.trim()) continue
    const half = text.length * 0.6 * size
    const left = anchor === 'end' ? x - half : anchor === 'middle' ? x - half / 2 : x
    const right = anchor === 'end' ? x : anchor === 'middle' ? x + half / 2 : x + half
    if (left < minx - 0.5 || right > minx + w + 0.5) {
      throw new Error(`${label}: "${text}" [${left.toFixed(1)},${right.toFixed(1)}] outside [${minx},${minx + w}]`)
    }
  }
}

/**
 * These diagrams scrolled sideways on a phone: a beam drawn at a fixed 100 units per metre,
 * springs spaced 90 units apart however many there were, and the two energy diagrams wider
 * than they needed to be. Each is checked here against every prop set the content uses.
 */
describe('diagrams that fit a phone', () => {

  it('beam-moments', () => {
    const props = findProps('beam-moments')
    expect(props.length).toBeGreaterThan(0)
    for (const p of props) check(renderToStaticMarkup(<BeamMoments props={p} alt="x" />), JSON.stringify(p).slice(0, 60))
  })

  it('spring-load', () => {
    const props = findProps('spring-load')
    expect(props.length).toBeGreaterThan(0)
    for (const p of props) check(renderToStaticMarkup(<SpringLoad props={p} alt="x" />), JSON.stringify(p).slice(0, 60))
  })

  it('energy-stores', () => {
    const props = findProps('energy-stores')
    expect(props.length).toBeGreaterThan(0)
    for (const p of props) check(renderToStaticMarkup(<EnergyStores props={p} alt="x" />), JSON.stringify(p).slice(0, 60))
  })

  it('energy-transfer-bars', () => {
    const props = findProps('energy-transfer-bars')
    expect(props.length).toBeGreaterThan(0)
    for (const p of props) check(renderToStaticMarkup(<EnergyTransferBars props={p} alt="x" />), JSON.stringify(p).slice(0, 60))
  })
})
