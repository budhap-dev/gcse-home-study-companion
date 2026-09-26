import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DisplayedFormula, DisplayedFormulaStack } from './DisplayedFormula.tsx'

const CONTENT = join(import.meta.dirname, '../../../../../supabase/seed/content')

/** Every distinct props object a "displayed-formula" use in the content pack passes. */
function everyDisplayedFormulaProps(): Record<string, unknown>[] {
  const seen = new Map<string, Record<string, unknown>>()
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (node && typeof node === 'object') {
      const o = node as Record<string, unknown>
      if (o.component === 'displayed-formula' && o.props) {
        const p = o.props as Record<string, unknown>
        seen.set(JSON.stringify(p), p)
      }
      for (const v of Object.values(o)) walk(v)
    }
  }
  for (const subject of readdirSync(CONTENT)) {
    const dir = join(CONTENT, subject)
    if (!statSync(dir).isDirectory()) continue
    for (const f of readdirSync(dir)) {
      if (f.endsWith('.json')) walk(JSON.parse(readFileSync(join(dir, f), 'utf8')))
    }
  }
  return [...seen.values()]
}

const svg = (props: Record<string, unknown>) => renderToStaticMarkup(<DisplayedFormula props={props} alt="a displayed formula" />)

/** The molecular formula implied by the atoms the picture actually draws. */
function drawn(props: Record<string, unknown>): string {
  const letters = [...svg(props).matchAll(/font-weight:600">([CHON])</g)].map((m) => m[1]!)
  const count = (l: string) => letters.filter((x) => x === l).length
  return (['C', 'H', 'N', 'O'] as const).map((l) => (count(l) === 0 ? '' : count(l) === 1 ? l : `${l}${count(l)}`)).join('')
}

/**
 * A fully displayed formula is marked on the hydrogens: a carbon with three or five
 * bonds is the error. Here they are filled in by valency rather than given, so the test
 * that matters is that the atoms in the drawing add up to the molecular formula.
 */
describe('displayed formula', () => {
  it('counts what it draws', () => {
    // The self-test: if the extraction broke, every case below would pass vacuously.
    expect(drawn({ molecules: [{ carbons: 1 }] })).toBe('CH4')
  })

  it('draws the alkanes as CnH2n+2', () => {
    for (const n of [1, 2, 3, 4]) expect(drawn({ molecules: [{ carbons: n }] })).toBe(`C${n === 1 ? '' : n}H${2 * n + 2}`)
  })

  it('draws the alkenes as CnH2n, two hydrogens fewer than the alkane', () => {
    for (const n of [2, 3, 4, 5]) expect(drawn({ molecules: [{ carbons: n, double: 1 }] })).toBe(`C${n}H${2 * n}`)
  })

  it('puts the double bond where it is asked for, and draws it as two lines', () => {
    const markup = svg({ molecules: [{ carbons: 4, double: 2 }] })
    // Four carbons, three carbon-carbon bonds, one of them doubled: seven horizontal lines
    // along the chain rather than six.
    const chain = [...markup.matchAll(/<line x1="([\d.]+)" y1="0" x2="([\d.]+)" y2="0"/g)]
    expect(chain).toHaveLength(4)
    expect(drawn({ molecules: [{ carbons: 4, double: 2 }] })).toBe('C4H8')
  })

  it('draws the alcohols with an -O-H, giving CnH2n+2O', () => {
    expect(drawn({ molecules: [{ carbons: 1, group: 'oh' }] })).toBe('CH4O')
    expect(drawn({ molecules: [{ carbons: 2, group: 'oh' }] })).toBe('C2H6O')
    expect(drawn({ molecules: [{ carbons: 4, group: 'oh' }] })).toBe('C4H10O')
  })

  it('draws the carboxylic acids with =O and -O-H, giving CnH2nO2', () => {
    expect(drawn({ molecules: [{ carbons: 1, group: 'cooh' }] })).toBe('CH2O2')
    expect(drawn({ molecules: [{ carbons: 2, group: 'cooh' }] })).toBe('C2H4O2')
    expect(drawn({ molecules: [{ carbons: 4, group: 'cooh' }] })).toBe('C4H8O2')
  })

  it('gives a repeating unit open ends, so it has the same atoms as its monomer', () => {
    // This is the whole point of addition polymerisation: no other molecule is formed,
    // so the repeating unit and the monomer have the same atoms.
    expect(drawn({ molecules: [{ carbons: 2, double: 1 }] })).toBe('C2H4')
    expect(drawn({ molecules: [{ carbons: 2, repeat: true }] })).toBe('C2H4')
    expect(drawn({ molecules: [{ carbons: 3, double: 1 }] })).toBe('C3H6')
    expect(drawn({ molecules: [{ carbons: 3, repeat: true }] })).toBe('C3H6')
  })

  it('draws a reaction with its joiners between the molecules', () => {
    const markup = svg({
      molecules: [{ carbons: 2, double: 1, label: 'ethene' }, { carbons: 2, group: 'oh', label: 'ethanol' }],
      joiners: ['+ steam →'],
    })
    expect(markup).toContain('+ steam →')
    expect(markup).toContain('>ethene<')
    expect(markup).toContain('>ethanol<')
  })

  it('falls back to the alt text when given nothing to draw', () => {
    expect(svg({ molecules: [] })).toContain('a displayed formula')
  })
})

describe('displayed formula captions', () => {
  it('gives a molecule at least the width of its own caption', () => {
    // Ethane and ethene side by side ran their captions into each other, because each was
    // centred under a structure narrower than the words beneath it.
    const markup = renderToStaticMarkup(
      <DisplayedFormula
        props={{
          molecules: [
            { carbons: 2, label: 'ethane, C2H6 (saturated)' },
            { carbons: 2, double: 1, label: 'ethene, C2H4 (unsaturated)' },
          ],
        }}
        alt="two molecules"
      />,
    )
    const labels = [...markup.matchAll(/<text x="([\d.]+)"[^>]*>(ethane[^<]*|ethene[^<]*)</g)].map((m) => ({
      x: Number(m[1]),
      text: m[2]!,
    }))
    expect(labels).toHaveLength(2)
    const [a, b] = labels
    // Centres far enough apart that the two captions cannot overlap at ~6.4px a character.
    expect(b!.x - a!.x).toBeGreaterThan(((a!.text.length + b!.text.length) / 2) * 6.4)
  })
})

describe('displayed formula joiners', () => {
  it('leaves room for the joiner text between the molecules it separates', () => {
    // "+ H₂O →" was drawn straight through the ethene on its left and the ethanol on its
    // right, because the gap was a constant whatever the joiner said.
    const joiner = '+ H₂O, phosphoric acid →'
    const markup = renderToStaticMarkup(
      <DisplayedFormula
        props={{ molecules: [{ carbons: 2, double: 1 }, { carbons: 2, group: 'oh' }], joiners: [joiner] }}
        alt="a reaction"
      />,
    )
    const joinerX = Number(markup.match(/<text x="([\d.]+)"[^>]*>\+ H₂O/)![1])
    const atoms = [...markup.matchAll(/<circle cx="([\d.]+)"/g)].map((m) => Number(m[1]))
    const nearest = Math.min(...atoms.map((x) => Math.abs(x - joinerX)))
    // Half the joiner's width, plus a little clearance, must fit before the nearest atom.
    expect(nearest).toBeGreaterThan((joiner.length / 2) * 7.6)
  })
})

describe('displayed formula repeating units', () => {
  const chainLines = (markup: string) =>
    [...markup.matchAll(/<line x1="([-\d.]+)" y1="0" x2="([-\d.]+)" y2="0"/g)].map((m) => [Number(m[1]), Number(m[2])] as const)

  it('draws a bond continuing out of each end of a repeating unit', () => {
    // "Draw a bond out of each end" is one of the four marked steps, and the first
    // version of this component left the valency free but never drew the line.
    const markup = svg({ molecules: [{ carbons: 2, repeat: true }] })
    const atoms = [...markup.matchAll(/<circle cx="([\d.]+)" cy="0"/g)].map((m) => Number(m[1]))
    const leftmost = Math.min(...atoms), rightmost = Math.max(...atoms)
    const ends = chainLines(markup).flat()
    // A bond runs out past the outermost atom at each side, and ends at nothing — that
    // open end is what says the chain continues. A plain molecule's outermost bonds end
    // at a hydrogen instead, so every one of its endpoints has an atom on it.
    expect(ends.some((x) => x < leftmost - 10)).toBe(true)
    expect(ends.some((x) => x > rightmost + 10)).toBe(true)
    const plainMarkup = svg({ molecules: [{ carbons: 2 }] })
    const plainAtoms = [...plainMarkup.matchAll(/<circle cx="([\d.]+)" cy="0"/g)].map((m) => Number(m[1]))
    for (const x of chainLines(plainMarkup).flat()) {
      expect(plainAtoms.some((a) => Math.abs(a - x) < 0.5)).toBe(true)
    }
  })

  it('still counts the same atoms as its monomer once the ends are drawn', () => {
    expect(drawn({ molecules: [{ carbons: 2, repeat: true }] })).toBe('C2H4')
    expect(drawn({ molecules: [{ carbons: 3, repeat: true }] })).toBe('C3H6')
  })
})

describe('displayed formula layout', () => {
  /** Every atom the picture draws, as a position. */
  const positions = (props: Record<string, unknown>) =>
    [...renderToStaticMarkup(<DisplayedFormula props={props} alt="x" />).matchAll(/<circle cx="([-\d.]+)" cy="([-\d.]+)"/g)].map(
      (m) => [Number(m[1]), Number(m[2])] as const,
    )

  it('never draws two atoms in the same place', () => {
    // Methanoic acid put its hydrogen exactly where the double-bonded oxygen goes, so
    // the drawing showed a carbon with what looked like three bonds upwards. The atom
    // count was still right, which is why the formula tests did not catch it.
    for (const molecule of [
      { carbons: 1, group: 'cooh' },
      { carbons: 2, group: 'cooh' },
      { carbons: 4, group: 'cooh' },
      { carbons: 1, group: 'oh' },
      { carbons: 1 },
      { carbons: 2, double: 1 },
      { carbons: 3, repeat: true },
    ]) {
      const seen = new Set<string>()
      for (const [x, y] of positions({ molecules: [molecule] })) {
        const key = `${x.toFixed(1)},${y.toFixed(1)}`
        expect(seen.has(key), `${JSON.stringify(molecule)} draws two atoms at ${key}`).toBe(false)
        seen.add(key)
      }
    }
  })

  it('keeps methanoic acid a carbon with four bonds, drawn apart', () => {
    expect(drawn({ molecules: [{ carbons: 1, group: 'cooh' }] })).toBe('CH2O2')
    const markup = svg({ molecules: [{ carbons: 1, group: 'cooh' }] })
    // The oxygen is above the carbon, so the hydrogen on that carbon is not.
    const oxygenAbove = [...markup.matchAll(/<circle cx="([-\d.]+)" cy="(-\d+)"/g)]
    expect(oxygenAbove.length).toBe(1)
  })

  it('leaves air between two molecules even with no joiner between them', () => {
    const markup = svg({
      molecules: [{ carbons: 1, group: 'cooh', label: 'methanoic acid, HCOOH' }, { carbons: 2, group: 'cooh', label: 'ethanoic acid, CH3COOH' }],
    })
    const labels = [...markup.matchAll(/<text x="([\d.]+)"[^>]*>(methanoic[^<]*|ethanoic[^<]*)</g)].map((m) => ({ x: Number(m[1]), text: m[2]! }))
    expect(labels).toHaveLength(2)
    const [a, b] = labels
    expect(b!.x - a!.x).toBeGreaterThan(((a!.text.length + b!.text.length) / 2) * 6.4)
  })
})

/**
 * Side by side, several molecules can run past 500 units wide — "butane → ethane + ethene"
 * reached 474 — and a diagram stops shrinking at its natural width, so every multi-molecule
 * equation in the pack scrolled sideways on a phone, by as much as 347px on the census. At
 * a phone's available width the molecules stack one per row instead: `DisplayedFormulaStack`
 * is called directly (as `useAvailableWidth` measures nothing in this environment) with the
 * 298 a phone's figure actually gives it, for every props object the content pack uses.
 */
describe('displayed formula fits a phone for every use in the content pack', () => {
  const uses = everyDisplayedFormulaProps()

  it('found them', () => {
    expect(uses.length).toBeGreaterThanOrEqual(15)
  })

  const stackSvg = (props: Record<string, unknown>) =>
    renderToStaticMarkup(
      <DisplayedFormulaStack
        molecules={(props.molecules as never) ?? []}
        joiners={(props.joiners as string[] | undefined) ?? []}
        title={typeof props.title === 'string' ? props.title : undefined}
        width={298}
        alt="a displayed formula"
        svgRef={{ current: null }}
      />,
    )

  it('keeps the viewBox within the phone width for every use', () => {
    for (const props of uses) {
      const markup = stackSvg(props)
      const [width] = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(markup)!.slice(1).map(Number)
      expect(width, JSON.stringify(props)).toBeLessThanOrEqual(296)
    }
  })

  it('never lowers a fontSize below 11', () => {
    for (const props of uses) {
      // The atom symbols and the "n" of a repeat unit use `style="font-size:...px"`,
      // not the `font-size="..."` attribute; both are read here.
      const markup = stackSvg(props)
      const sizes = [
        ...[...markup.matchAll(/font-size="([\d.]+)"/g)].map((m) => Number(m[1])),
        ...[...markup.matchAll(/font-size:(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1])),
      ]
      for (const s of sizes) expect(s, JSON.stringify(props)).toBeGreaterThanOrEqual(11)
    }
  })

  /**
   * Every `<text>`'s position in the final, rendered coordinate space — each molecule is
   * drawn inside its own `<g transform="translate(x y)">` row, so a label's own `x`/`y`
   * attributes are local to that row and have to be added to the row's offset before they
   * mean anything against the viewBox.
   */
  function absoluteTexts(markup: string) {
    const out: { x: number; y: number; text: string; attrs: string }[] = []
    const stack: [number, number][] = [[0, 0]]
    const tokens = markup.matchAll(/<g\b[^>]*>|<\/g>|<text\b[^>]*>[^<]*<\/text>/g)
    for (const tok of tokens) {
      const t = tok[0]
      if (t === '</g>') {
        stack.pop()
      } else if (t.startsWith('<g')) {
        const m = /translate\(([-\d.]+)[ ,]([-\d.]+)\)/.exec(t)
        const [px, py] = stack[stack.length - 1]!
        stack.push(m ? [px + Number(m[1]), py + Number(m[2])] : [px, py])
      } else {
        const tm = /<text x="([-\d.]+)" y="([-\d.]+)"([^>]*)>([^<]*)<\/text>/.exec(t)!
        const [ox, oy] = stack[stack.length - 1]!
        out.push({ x: Number(tm[1]) + ox, y: Number(tm[2]) + oy, attrs: tm[3]!, text: tm[4]! })
      }
    }
    return out
  }

  /** x ± 0.6 × fontSize × characters, by text-anchor, must lie inside the viewBox. */
  it('keeps every label inside the viewBox', () => {
    const escaped: string[] = []
    for (const props of uses) {
      const markup = stackSvg(props)
      const [width, height] = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(markup)!.slice(1).map(Number) as [number, number]
      for (const { x, y, attrs, text } of absoluteTexts(markup)) {
        if (!text.trim()) continue
        const fontSize = Number(/font-size="([\d.]+)"/.exec(attrs)?.[1] ?? /font-size:(\d+(?:\.\d+)?)px/.exec(attrs)?.[1] ?? 11)
        const anchor = /text-anchor="(\w+)"/.exec(attrs)?.[1] ?? 'start'
        const w = 0.6 * fontSize * text.length
        const left = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x
        const right = left + w
        if (left < -0.5 || right > width + 0.5 || y < 0 || y > height + 0.5) {
          escaped.push(`${JSON.stringify(props)}: "${text}" left ${left.toFixed(1)} right ${right.toFixed(1)} y ${y} (canvas ${width}x${height})`)
        }
      }
    }
    expect(escaped).toEqual([])
  })

  it('is only over budget in the wide row for a reason the stack above actually fixes', () => {
    // Unmeasured (this environment), DisplayedFormula always renders its wide row — real
    // phones switch to the stack, checked above, once it would not fit. A row over 296
    // here has to be over it because of more than one molecule, or a title too long for
    // one line — the two things the stack (and its title wrap) exist to fix — and never
    // for some other reason the stack would not actually help with.
    for (const props of uses) {
      const markup = renderToStaticMarkup(<DisplayedFormula props={props} alt="a displayed formula" />)
      const [width] = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(markup)!.slice(1).map(Number)
      if (width! > 296) {
        const many = (props.molecules as unknown[]).length > 1
        const title = typeof props.title === 'string' ? props.title : undefined
        expect(many || !!title, JSON.stringify(props)).toBe(true)
      }
    }
  })
})
