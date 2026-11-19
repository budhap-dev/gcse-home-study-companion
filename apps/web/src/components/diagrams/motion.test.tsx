import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DIAGRAMS } from './index.tsx'
import { FIGURE_MAX_SECONDS, move, type Move } from './motion.ts'
import { Visual } from '../Visual.tsx'

/**
 * Figures that move (section 15 Part B). The rules are the plan's: the still drawing is the
 * last frame, every movement ends, and it ends soon. Held here against every figure of the
 * moving kinds that the content pack draws, not a hand-picked sample.
 */

/** The diagram kinds that move, and the ones of those allowed to stay still in some drawing. */
const MOVING = [
  'circuit-diagram', 'beam-moments', 'free-body', 'fluid-column', 'collision', 'lens-diagram', 'ray-diagram', 'magnet-field', 'electric-field', 'generator-output',
  'electrolysis-cell', 'dot-and-cross', 'reaction-profile', 'plant', 'heart-diagram', 'ph-scale', 'em-spectrum', 'circuit-symbols',
  'line-graph', 'curve-graph', 'probability-tree', 'frequency-tree', 'vector-figure', 'vector-triangle', 'circle-theorem',
  'logic-circuit', 'flowchart', 'huffman-tree',
] as const
/** A circuit with a switch draws it open, so no current flows round it. */
const mayBeStill = (component: string, props: Record<string, unknown>) =>
  (component === 'circuit-diagram' && ((props.parts as { kind: string; closed?: boolean }[] | undefined) ?? []).some((p) => p.kind === 'switch' && p.closed !== true)) ||
  // A circle with nothing marked on it has no angle to draw.
  (component === 'circle-theorem' && !(props.angles as unknown[] | undefined)?.length && !props.arc)

const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content')
function uses(): { component: string; props: Record<string, unknown>; where: string }[] {
  const out: { component: string; props: Record<string, unknown>; where: string }[] = []
  const walk = (o: unknown, where: string) => {
    if (Array.isArray(o)) for (const x of o) walk(x, where)
    else if (o && typeof o === 'object') {
      const v = o as Record<string, unknown>
      if (v.type === 'diagram' && typeof v.component === 'string') out.push({ component: v.component, props: (v.props as Record<string, unknown>) ?? {}, where })
      for (const x of Object.values(v)) walk(x, where)
    }
  }
  for (const sub of readdirSync(ROOT).filter((d) => statSync(join(ROOT, d)).isDirectory())) {
    for (const f of readdirSync(join(ROOT, sub)).filter((x) => x.endsWith('.json'))) walk(JSON.parse(readFileSync(join(ROOT, sub, f), 'utf8')), `${sub}/${f}`)
  }
  return out
}

const render = (component: string, props: Record<string, unknown>) => {
  const D = DIAGRAMS[component]!
  return renderToStaticMarkup(<D props={props} alt="a figure" />)
}
/** Each moving element's opening tag. */
const moving = (markup: string) => [...markup.matchAll(/<(\w+)\b([^>]*\bclass="fa [^"]*"[^>]*)>/g)].map((m) => ({ tag: m[1]!, attrs: m[2]! }))

describe('figures that move', () => {
  const all = uses().filter((u) => (MOVING as readonly string[]).includes(u.component))

  // Drawn on the Resources pages rather than in lessons: checked from their own default drawing.
  const SHEETS = new Set(['heart-diagram', 'ph-scale', 'em-spectrum', 'circuit-symbols'])
  for (const c of SHEETS) all.push({ component: c, props: {}, where: 'resources' })
  all.push({ component: 'em-spectrum', props: { layout: 'across' }, where: 'resources' })

  it('finds every moving kind in the content pack', () => {
    for (const c of MOVING) expect(all.some((u) => u.component === c && (SHEETS.has(c) || u.where !== 'resources')), c).toBe(true)
    expect(all.length).toBeGreaterThan(300)
  })

  it.each(MOVING.map((c) => [c]))('%s: every figure moves, ends within the limit, and never loops', (component) => {
    for (const u of all.filter((x) => x.component === component)) {
      const parts = moving(render(u.component, u.props))
      const label = `${u.where} ${JSON.stringify(u.props).slice(0, 80)}`
      if (!mayBeStill(u.component, u.props)) expect(parts.length, label).toBeGreaterThan(0)
      for (const { tag, attrs } of parts) {
        const end = Number(/data-fa-end="([\d.]+)"/.exec(attrs)?.[1])
        expect(end, label).toBeGreaterThan(0)
        expect(end, label).toBeLessThanOrEqual(FIGURE_MAX_SECONDS)
        expect(attrs, label).not.toMatch(/infinite/)
        // A transform attribute would be replaced by the keyframes' transform while moving.
        expect(attrs, label).not.toMatch(/\btransform="/)
        // Drawing needs pathLength, which only a path takes everywhere.
        if (/\bfa-draw\b/.test(attrs)) expect(tag, label).toBe('path')
        // Invisible when still: only the dots of a current, which the still drawing never had.
        if (/\bfa-only\b/.test(attrs)) expect(attrs, label).toMatch(/\bfa-flow\b/)
      }
    }
  })

  it('leaves a circuit with an open switch still, and lets current round a closed one', () => {
    for (const u of all.filter((x) => x.component === 'circuit-diagram' && mayBeStill(x.component, x.props))) expect(moving(render(u.component, u.props)), u.where).toHaveLength(0)
    const parts = (closed: boolean) => [{ kind: 'switch', closed }, { kind: 'lamp' }]
    const open = render('circuit-diagram', { supply: { pd: 6 }, parts: parts(false) })
    const shut = render('circuit-diagram', { supply: { pd: 6 }, parts: parts(true) })
    expect(open).toContain('data-switch="open"')
    expect(moving(open)).toHaveLength(0)
    expect(shut).toContain('data-switch="closed"')
    expect(shut).toMatch(/class="fa fa-flow fa-only"/)
  })

  // Every switch the content draws is closed: each figure shows a loop that conducts, and
  // "a closed loop" was captioned under an open switch until 19 November 2026.
  it('draws every content switch closed', () => {
    for (const u of all.filter((x) => x.component === 'circuit-diagram')) {
      for (const part of (u.props.parts as { kind: string; closed?: boolean }[]) ?? []) if (part.kind === 'switch') expect(part.closed, u.where).toBe(true)
    }
  })
})

describe('the current in a circuit', () => {
  const flows = (markup: string) => [...markup.matchAll(/<path d="([^"]+)"[^>]*stroke-dasharray="0.1 ([\d.]+)"/g)].map((m) => ({ d: m[1]!, spacing: Number(m[2]) }))

  it('leaves the long plate, the positive terminal, and comes back to the short one', () => {
    const markup = render('circuit-diagram', { supply: { pd: 6 }, arrangement: 'series', parts: [{ kind: 'resistor', resistance: 3 }] })
    const [flow] = flows(markup)
    // The cell's plates: the long thin one is drawn first, above the short thick one.
    const plates = [...markup.matchAll(/<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)" stroke="#1e2330" stroke-width="(1.6|4)"/g)]
    const longY = Number(plates.find((p) => p[5] === '1.6')![2]), shortY = Number(plates.find((p) => p[5] === '4')![2])
    const pts = [...flow!.d.matchAll(/[ML] ([\d.]+) ([\d.]+)/g)].map((m) => Number(m[2]))
    // Starts just past the long plate, heads away from it, and ends just past the short one.
    expect(Math.abs(pts[0]! - longY)).toBeLessThan(Math.abs(pts[0]! - shortY))
    expect(Math.abs(pts.at(-1)! - shortY)).toBeLessThan(Math.abs(pts.at(-1)! - longY))
    expect(pts[1]!).toBeLessThan(pts[0]!)
  })

  it('in parallel, spaces each branch\'s dots by its current, so the bigger current is busier', () => {
    // 6 V across 2 Ω and 6 Ω: 3 A and 1 A.
    const markup = render('circuit-diagram', { supply: { pd: 6 }, arrangement: 'parallel', parts: [{ kind: 'resistor', resistance: 2 }, { kind: 'resistor', resistance: 6 }] })
    const [a, b] = flows(markup)
    expect(b!.spacing / a!.spacing).toBeCloseTo(3, 5)
  })
})

describe('chemistry and biology', () => {
  it('sends the transferred electrons across from the atom that loses them', () => {
    const markup = render('dot-and-cross', { kind: 'ionic', atoms: [{ symbol: 'Na', outer: 1, mark: 'cross' }, { symbol: 'Cl', outer: 7, mark: 'dot' }], transfer: 1 })
    // The group holding the gained electrons starts one atom-spacing to the left: on the sodium.
    expect(markup).toMatch(/class="fa fa-slide" style="--d:0.50s;--t:1.30s;[^"]*--dx:-160px"/)
  })

  it('moves the potometer bubble towards the shoot, and points its arrow that way', () => {
    const markup = render('plant', { kind: 'potometer' })
    const stem = Number(/<path d="M([\d.]+) 150 V 60" stroke="#2e8b57"/.exec(markup)![1])
    const [, x1, x2] = /<path d="M([\d.]+) 156 H ([\d.]+)" stroke="#d25b3b"/.exec(markup)!.map(Number)
    const bubble = Number(/<rect x="([\d.]+)" y="147"/.exec(markup)![1])
    expect(bubble).toBeGreaterThan(stem)
    expect(x2!).toBeLessThan(x1!)          // pointing left, towards the shoot
    expect(markup).toMatch(/y="147"[^>]*class="fa fa-slide"[^>]*--dx:40px/)  // arrives from the right
  })
})

describe('computer science', () => {
  it('builds a Huffman tree in merge order: the smallest total first', () => {
    // a 5, b 2, c 1, d 1: c+d (2) first, then that with b (4), then the root (9).
    const tree = { weight: 9, left: { char: 'a', weight: 5 }, right: { weight: 4, left: { char: 'b', weight: 2 }, right: { weight: 2, left: { char: 'c', weight: 1 }, right: { char: 'd', weight: 1 } } } }
    const markup = render('huffman-tree', { tree })
    const formed = [...markup.matchAll(/<g class="fa fa-grow" style="--d:([\d.]+)s;[^"]*"[^>]*><circle[^>]*><\/circle><text[^>]*>(\d+)<\/text>/g)].map((m) => ({ at: Number(m[1]), weight: Number(m[2]) }))
    expect(formed.map((f) => f.weight).sort((a, b) => a - b)).toEqual([2, 4, 9])
    const at = (w: number) => formed.find((f) => f.weight === w)!.at
    expect(at(2)).toBeLessThan(at(4))
    expect(at(4)).toBeLessThan(at(9))
  })

  it('sends the signal through a gate level at a time, then out to Q', () => {
    const markup = render('logic-circuit', { expression: { op: 'OR', inputs: ['A', { op: 'AND', inputs: ['B', 'C'] }] }, show: 'circuit' })
    const starts = [...markup.matchAll(/class="fa fa-flow fa-only" style="--d:([\d.]+)s/g)].map((m) => Number(m[1]))
    // Into AND (level 1), into OR (level 2), and out.
    expect(new Set(starts)).toEqual(new Set([0.2, 0.9, 1.6]))
  })
})

describe('a beam on a pivot', () => {
  it('tips and settles only when the moments balance', () => {
    const balanced = render('beam-moments', { length: 4, pivot: 2, forces: [{ at: 1, force: 6 }, { at: 4, force: 3 }] })
    const unbalanced = render('beam-moments', { length: 1, pivot: 0, forces: [{ at: 0.1, force: 20 }, { at: 0.8, force: 20 }] })
    expect(balanced).toMatch(/data-beam="" class="fa fa-tip"/)
    expect(unbalanced).not.toMatch(/fa-tip/)
  })

  it('tips first the way the first side turns it', () => {
    // 6 N one metre left of the pivot turns it anticlockwise: a negative angle on screen.
    const markup = render('beam-moments', { length: 4, pivot: 2, forces: [{ at: 1, force: 6 }, { at: 4, force: 3 }] })
    expect(markup).toMatch(/--tilt:-7deg/)
  })
})

describe('move', () => {
  it('marks a flow as invisible when still, and a draw with its path length', () => {
    expect(move('flow', 0, 1).className).toBe('fa fa-flow fa-only')
    expect(move('draw', 0, 1).pathLength).toBe(1)
    expect(move('fade', 0, 1).pathLength).toBeUndefined()
  })

  it('records when it stops, counting every play', () => {
    expect(move('spin-y', 0.3, 1.4, { plays: 2 })['data-fa-end']).toBe('3.10')
  })
})

describe('the styles', () => {
  const css = readFileSync(join(import.meta.dirname, '../../styles.css'), 'utf8')
  const kinds: Move[] = ['draw', 'fade', 'grow', 'grow-x', 'grow-y', 'tip', 'spin-y', 'flow', 'wipe', 'slide']

  it('has keyframes for every kind, switched on only under data-anim', () => {
    for (const k of kinds) {
      expect(css, k).toContain(`@keyframes fa-${k} `)
      expect(css, k).toMatch(new RegExp(`\\[data-anim\\] \\.fa-${k} \\{[^}]*animation-name: fa-${k};`))
    }
    // Nothing outside data-anim gives a moving part an animation.
    for (const m of css.matchAll(/^([^@\n{]*\.fa(?:-[\w-]+)?\b[^{]*)\{([^}]*)\}/gm)) {
      if (/animation(-name)?:\s*fa-/.test(m[2]!)) expect(m[1], m[0]).toMatch(/\[data-anim\]/)
    }
  })

  it('moves the flow\'s dashes in px, which the browser interpolates', () => {
    // Bare numbers through var() and calc() were not interpolated in Chrome: the dots stood
    // still, then jumped once at the halfway mark. Every offset in the flow is a length.
    const flow = /@keyframes fa-flow \{([\s\S]*?)\n\}/.exec(css)![1]!
    const offsets = [...flow.matchAll(/stroke-dashoffset: ([^;]+);/g)].map((m) => m[1]!)
    expect(offsets).toHaveLength(2)
    for (const o of offsets) expect(o).toMatch(/\* 1px\)$/)
  })

  it('never plays a figure forever, and stops it for motion off and for print', () => {
    const block = css.slice(css.indexOf('.fa-only {'), css.indexOf('/* The subject page\'s topic panel'))
    expect(block).not.toMatch(/infinite/)
    expect(css).toMatch(/\[data-motion="off"\] \.fa \{ animation: none !important; \}/)
    expect(block).toMatch(/@media print \{\s*\.fa \{ animation: none !important; \}/)
  })
})

describe('the figure around a drawing', () => {
  it('is still when first drawn: no data-anim, so the server and print see the last frame', () => {
    const markup = renderToStaticMarkup(<Visual visual={{ type: 'diagram', component: 'free-body', props: { object: 'box', forces: [{ direction: 'down', size: 10 }] }, alt: 'a box' } as never} />)
    expect(markup).toContain('data-diagram="free-body"')
    expect(markup).not.toContain('data-anim')
    expect(markup).toMatch(/class="fa fa-grow-y"/)
  })
})
