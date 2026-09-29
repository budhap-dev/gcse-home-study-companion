import katex from 'katex'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SHORT_SIDE, drawnLength, keepFormulaTogether, keepSidesTogether, keepSumsTogether } from './formulaLine.ts'


const DIR = join(import.meta.dirname, '../../../../../supabase/seed/resources')

/** Every string a sheet can put on screen as running text, with where it is. */
function prose(value: unknown, path: string, out: { where: string; text: string }[] = []): { where: string; text: string }[] {
  if (typeof value === 'string') { if (value.includes('$')) out.push({ where: path, text: value }) }
  else if (Array.isArray(value)) value.forEach((v, i) => prose(v, `${path}[${i}]`, out))
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) if (k !== 'formula' && k !== 'url') prose(v, `${path}.${k}`, out)
  return out
}
const running = readdirSync(DIR).filter((f) => f.endsWith('.json')).flatMap((f) => prose(JSON.parse(readFileSync(join(DIR, f), 'utf8')), f))

/** Every formula on every sheet. */
const formulae: { where: string; formula: string }[] = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => {
    const file = JSON.parse(readFileSync(join(DIR, f), 'utf8')) as { subjectId: string; resources: { id: string; blocks: { kind: string; groups?: { items: { name: string; formula: string }[] }[] }[] }[] }
    return file.resources.flatMap((r) => r.blocks.flatMap((b) => (b.groups ?? []).flatMap((g) => g.items.map((i) => ({ where: `${file.subjectId}/${r.id}: ${i.name}`, formula: i.formula })))))
  })

/** What KaTeX puts on screen for a maths span, as text, and where it lets the line break. */
const drawn = (tex: string) => {
  const html = katex.renderToString(tex, { throwOnError: true, output: 'html' })
  // KaTeX sets each stretch it will not break in a box of its own, and breaks between boxes.
  return { text: html.replace(/<[^>]+>/g, ''), pieces: html.match(/class="katex-base"/g)?.length ?? 0 }
}
const spans = (source: string) => [...source.matchAll(/\$([^$\n]+?)\$/g)].map((m) => m[1]!)

describe('where a formula may break', () => {
  it('keeps a bracket in one piece', () => {
    expect(keepSidesTogether('f(a) = 0 \\iff (x - a)')).toBe('f(a) = 0 \\iff {(x - a)}')
    expect(drawn(keepSidesTogether('f(a) = 0 \\iff (x - a)')).pieces).toBe(3)
  })

  it('breaks after an equals sign, not after a plus or a minus', () => {
    const tex = 'P(A \\text{ or } B) = P(A) + P(B) - P(A \\text{ and } B)'
    expect(drawn(tex).pieces).toBe(4)
    expect(drawn(keepSidesTogether(tex)).pieces).toBe(2)
  })

  it('still breaks between two formulae that share a line', () => {
    const tex = 'a^0 = 1,\\ \\ a^{-n} = \\dfrac{1}{a^n}'
    expect(keepSidesTogether(tex)).toBe(tex)
  })

  it('leaves a side with nothing to break at as it was written', () => {
    expect(keepSidesTogether('E_k = \\tfrac{1}{2}\\,m\\,v^2')).toBe('E_k = \\tfrac{1}{2}\\,m\\,v^2')
  })

  /** A matrix holds `&` and `\\` at brace depth 0: splitting there would break the source. */
  it('does not reach inside a matrix, a \\left bracket or a fraction', () => {
    const matrix = 'I = \\begin{pmatrix} 1 & 0 \\\\ 0 & -1 \\end{pmatrix}'
    expect(keepSidesTogether(matrix)).toBe(matrix)
    const bracket = 'P\\left(1 + \\dfrac{r}{100}\\right)^n'
    expect(keepSidesTogether(bracket)).toBe(bracket)
    expect(keepSidesTogether('x = \\dfrac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}')).toBe('x = \\dfrac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}')
  })

  it('touches only the maths in a formula written with words', () => {
    expect(keepFormulaTogether('$\\dfrac{dy}{dx} > 0$ increasing, $m_1 \\times m_2 = -1$')).toBe('$\\dfrac{dy}{dx} > 0$ increasing, ${m_1 \\times m_2} = -1$')
  })

  /**
   * The point of doing it to the source: braces draw nothing. Every formula in the pack
   * must put the same characters on screen as it did, and never gain a place to break.
   */
  it('changes no formula on any sheet, only where it may break', () => {
    expect(formulae.length).toBeGreaterThan(100)
    let tightened = 0
    for (const { where, formula } of formulae) {
      const before = spans(formula)
      const after = spans(keepFormulaTogether(formula))
      expect(after.length, where).toBe(before.length)
      before.forEach((tex, i) => {
        const was = drawn(tex), now = drawn(after[i]!)
        expect(now.text, where).toBe(was.text)
        expect(now.pieces, where).toBeLessThanOrEqual(was.pieces)
        if (now.pieces < was.pieces) tightened++
      })
    }
    // A floor, so that a rule which matched nothing could not pass as one that changed nothing.
    expect(tightened).toBeGreaterThan(15)
  })
})

describe('a sum in running text', () => {
  it('counts what a piece of source draws, not what it is written with', () => {
    expect(drawnLength('\\dfrac{20}{80} \\times 100')).toBe(9)
    expect(drawnLength('\\text{useful output energy}')).toBe(18)
    expect(drawnLength('x^{2} + 5x - 2')).toBe(7)
  })

  /** "has fallen by 20/80 ×" ended the line, and "100 = 25%" began the next. */
  it('holds a short side together, so a line never ends on its times sign', () => {
    const text = 'has fallen by $\\dfrac{20}{80} \\times 100 = 25\\%$. Dividing'
    expect(keepSumsTogether(text)).toBe('has fallen by ${\\dfrac{20}{80} \\times 100} = 25\\%$. Dividing')
    expect(drawn('{\\dfrac{20}{80} \\times 100} = 25\\%').pieces).toBe(2)
  })

  it('leaves a long side free to wrap, since nothing sets running text again if it does not fit', () => {
    const long = '$\\text{total repayment} - \\text{borrowed amount} + \\text{interest} = 100$'
    expect(keepSumsTogether(long)).toBe(long)
    expect(keepFormulaTogether(long)).not.toBe(long)
  })

  it('leaves display maths and a price in dollars alone', () => {
    const display = 'So\n\n$$a + b = c + d$$\n\nand $a + b = c$'
    expect(keepSumsTogether(display)).toBe('So\n\n$$a + b = c + d$$\n\nand ${a + b} = c$')
    expect(keepSumsTogether('costs \\$12 000 and $x + 1$ more, or \\$5')).toBe('costs \\$12 000 and ${x + 1}$ more, or \\$5')
  })

  it('changes no word of any running text on any sheet, only where a line may end', () => {
    expect(running.length).toBeGreaterThan(150)
    let held = 0
    for (const { where, text } of running) {
      const before = spans(text.replace(/\$\$[\s\S]+?\$\$/g, ''))
      const after = spans(keepSumsTogether(text).replace(/\$\$[\s\S]+?\$\$/g, ''))
      expect(after.length, where).toBe(before.length)
      before.forEach((tex, i) => {
        const was = drawn(tex), now = drawn(after[i]!)
        expect(now.text, where).toBe(was.text)
        expect(now.pieces, where).toBeLessThanOrEqual(was.pieces)
        if (now.pieces < was.pieces) held++
        // Nothing held is longer than the limit, so nothing held can be wider than a phone's line.
        for (const [, side] of after[i]!.matchAll(/(?:^|[=,]|\\[a-z]+)\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\s*(?=$|[=,]|\\(?:approx|to|rightarrow|le|ge|ne)\b)/g)) {
          if (/[+\-]|\\times|\\div/.test(side!)) expect(drawnLength(side!), `${where}: ${side}`).toBeLessThanOrEqual(SHORT_SIDE)
        }
      })
    }
    // A floor, so that a rule which matched nothing could not pass as one that changed nothing.
    expect(held).toBeGreaterThan(40)
  })
})
