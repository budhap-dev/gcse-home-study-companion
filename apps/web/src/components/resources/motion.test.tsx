import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { RESOURCES } from '../../content/resources.ts'
import { Resources, stagger } from '../../routes/student/Resources.tsx'
import { ResourcePage } from '../../routes/student/ResourcePage.tsx'
import { DRAW_STEP, EmSpectrum } from '../diagrams/EmSpectrum.tsx'
import { HeartDiagram } from '../diagrams/HeartDiagram.tsx'
import { PhScale } from '../diagrams/PhScale.tsx'

const SRC = join(import.meta.dirname, '../..')
const css = readFileSync(join(SRC, 'styles.css'), 'utf8')

/** Every file of the app's own source, tests aside. */
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sources(path)
    return /\.tsx?$/.test(entry.name) && !entry.name.includes('.test.') ? [path] : []
  })
}

const page = (url: string) =>
  renderToStaticMarkup(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/resources" element={<Resources />} />
        <Route path="/resources/:subjectId/:resourceId" element={<ResourcePage />} />
      </Routes>
    </MemoryRouter>,
  )
/** Every entrance on a page: how long it waits, in seconds. */
const waits = (html: string) => [...html.matchAll(/class="[^"]*\banim-(?:rise|sq)\b[^"]*"[^>]*style="[^"]*--d:([\d.]+)s/g)].map((m) => Number(m[1]))

describe('the motion switch', () => {
  /**
   * Settings has a switch for animations, and it works by naming each animated class. A
   * class added without a line there would go on moving for the student who turned
   * motion off.
   */
  it('reaches every animated class the app uses', () => {
    const used = new Set(sources(SRC).flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/\banim-[a-z-]+\b/g)].map((m) => m[0])))
    // Not an animation: where a shape in a drawing turns about.
    used.delete('anim-self')
    expect(used.size).toBeGreaterThan(8)
    const off = [...used].filter((name) => !new RegExp(`\\[data-motion="off"\\] \\.${name}\\b`).test(css))
    expect(off).toEqual([])
  })

  it('takes the travelling dashes away, not only their travel: still, they would read as a fault', () => {
    expect(css).toMatch(/\[data-motion="off"\] \.anim-flow \{[^}]*display: none/)
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{ \.anim-flow \{ display: none; \} \}/)
  })

  /** An entrance caught before it began would print as a blank. */
  it('prints every animated thing in place', () => {
    const print = [...css.matchAll(/@media print \{([\s\S]*?)\n\}/g)].map((m) => m[1]).join('\n')
    for (const name of ['anim-rise', 'anim-sq', 'anim-fade-up', 'anim-pop']) expect(print, name).toMatch(new RegExp(`\\.${name}\\b[^{]*\\{[^}]*animation: none !important`))
    expect(print).toMatch(/\.anim-draw \{[^}]*stroke-dasharray: none !important/)
    expect(print).toMatch(/\.anim-flow \{ display: none !important/)
  })
})

describe('the loops a designer tunes', () => {
  const LOOPS = ['flow', 'drift', 'here', 'banner', 'flame', 'streak']

  /** A loop that wrote its own time or "infinite" would ignore the controls in styles.css. */
  it('takes every loop\'s time and number of plays from the tokens', () => {
    const root = /:root \{\n  --flow-time[\s\S]*?\n\}/.exec(css)![0]
    for (const name of LOOPS) {
      expect(root, name).toMatch(new RegExp(`--${name}-time: [\\d.]+s;`))
      expect(root, name).toMatch(new RegExp(`--${name}-plays: infinite;`))
      expect(css, name).toMatch(new RegExp(`animation: [a-z-]+ var\\(--${name}-time\\)[^;]*var\\(--${name}-plays\\);`))
    }
    // Only the line shown while a screen loads loops on its own terms: it must last as long as the wait.
    const fixed = [...css.matchAll(/animation:[^;]*\binfinite\b[^;]*;/g)].map((m) => m[0])
    expect(fixed).toEqual(['animation: screen-opening 0.7s ease-in-out infinite alternate;'])
  })

  it('fades the blood\'s dashes when a counted run of plays ends', () => {
    expect(css).toMatch(/\.anim-flow\.flow-done \{ opacity: 0; \}/)
    expect(readFileSync(join(SRC, 'components/diagrams/HeartDiagram.tsx'), 'utf8')).toMatch(/onAnimationEnd=\{\(e\) => e\.currentTarget\.classList\.add\('flow-done'\)\}/)
  })
})

describe('how long a page takes to arrive', () => {
  it('steps each wait up to a cap, and no further', () => {
    expect(stagger(0)).toBe('0.00s')
    expect(stagger(3)).toBe('0.15s')
    expect(stagger(40)).toBe('0.60s')
    expect(stagger(2, 0.07, 0.2)).toBe('0.34s')
    expect(stagger(9, 0.06, 0.05, 0.35)).toBe('0.35s')
  })

  /**
   * The browser checks look at a page 2.2 seconds after it loads, and a reader should not
   * wait longer than that either. An entrance lasts 0.6 seconds at most.
   */
  it('has the list in place within a second and a quarter', () => {
    const list = waits(page('/resources'))
    expect(list.length).toBeGreaterThan(RESOURCES.length)
    expect(Math.max(...list) + 0.6).toBeLessThanOrEqual(1.25)
    // And it is a stagger: not everything at once.
    expect(new Set(list).size).toBeGreaterThan(5)
  })

  it('has every sheet in place within a second and a half', () => {
    for (const r of RESOURCES) {
      const found = waits(page(`/resources/${r.subjectId}/${r.id}`))
      if (found.length) expect(Math.max(...found) + 0.6, `${r.subjectId}/${r.id}`).toBeLessThanOrEqual(1.5)
    }
  })

  it('lifts the link inside a tile, and raises the tile round it', () => {
    const html = page('/resources')
    // An entrance holds its last frame, so the two must not share an element.
    expect(html).not.toMatch(/class="[^"]*\banim-rise\b[^"]*\blift\b|class="[^"]*\blift\b[^"]*\banim-rise\b/)
    expect(html.match(/<li class="anim-rise"/g)!.length).toBe(RESOURCES.length)
  })
})

describe('drawings that move to show something', () => {
  const dash = (html: string) => [...html.matchAll(/<path d="([^"]+)"[^>]*pathLength="1"[^>]*class="anim-draw"[^>]*style="([^"]*)"/g)].map((m) => ({ d: m[1]!, wait: Number(/--d:([\d.]+)s/.exec(m[2]!)![1]), lasts: Number(/animation-duration:([\d.]+)s/.exec(m[2]!)![1]) }))

  /** One wave, drawn from the long end to the short: each band starts as the one before it finishes. */
  it('draws the spectrum’s wave in one unbroken sweep', () => {
    const waves = dash(renderToStaticMarkup(<EmSpectrum props={{ layout: 'across' }} alt="The spectrum" />))
    expect(waves).toHaveLength(7)
    for (let i = 1; i < waves.length; i++) expect(waves[i]!.wait, `band ${i}`).toBeCloseTo(waves[i - 1]!.wait + waves[i - 1]!.lasts, 2)
    for (const w of waves) expect(w.lasts).toBe(DRAW_STEP)
    expect(waves.at(-1)!.wait + DRAW_STEP).toBeLessThan(2.2)
  })

  it('draws each wave of the narrow spectrum in turn', () => {
    const waves = dash(renderToStaticMarkup(<EmSpectrum props={{}} alt="The spectrum" />))
    expect(waves).toHaveLength(7)
    for (let i = 1; i < waves.length; i++) expect(waves[i]!.wait).toBeGreaterThan(waves[i - 1]!.wait)
    expect(waves.at(-1)!.wait + waves.at(-1)!.lasts).toBeLessThan(2.2)
  })

  /**
   * The dashes travel from a path's first point to its last, so each vessel must be drawn
   * from where the blood leaves to where it arrives.
   */
  it('sends the blood the way it flows, along all four vessels', () => {
    const html = renderToStaticMarkup(<HeartDiagram props={{}} alt="The heart" />)
    const flows = [...html.matchAll(/<path d="(M[^"]+)" class="anim-flow"/g)].map((m) => [...m[1]!.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map((p) => [Number(p[1]), Number(p[2])] as const))
    expect(flows).toHaveLength(4)
    // The lungs are the box at the top, the body the box at the bottom, the chambers between.
    const place = ([, y]: readonly [number, number]) => (y < 60 ? 'lungs' : y > 290 ? 'body' : 'heart')
    expect(flows.map((f) => `${place(f[0]!)} to ${place(f.at(-1)!)}`)).toEqual(['body to heart', 'heart to lungs', 'lungs to heart', 'heart to body'])
    // Each runs along its vessel, exactly.
    for (const [, d] of html.matchAll(/<path d="(M[^"]+)" class="anim-flow"/g)) expect(html).toContain(`<path d="${d}" fill="none" stroke="#`)
    // And a screen reader is not told about dashes.
    expect(html.match(/class="anim-flow"[^>]*aria-hidden="true"/g)).toHaveLength(4)
  })

  it('brings the pH colours in from acid to alkali, each about its own middle', () => {
    const html = renderToStaticMarkup(<PhScale props={{}} alt="The pH scale" />)
    const cells = [...html.matchAll(/<rect[^>]*class="anim-sq anim-self"[^>]*style="--d:([\d.]+)s"/g)].map((m) => Number(m[1]))
    expect(cells).toHaveLength(15)
    for (let i = 1; i < cells.length; i++) expect(cells[i]).toBeGreaterThan(cells[i - 1]!)
    expect(cells.at(-1)! + 0.4).toBeLessThan(1.5)
    expect(css).toMatch(/\.anim-self \{[^}]*transform-box: fill-box[^}]*transform-origin: center/)
  })
})
