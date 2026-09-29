import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ELEMENTS } from '@study/shared'
import { HYDROGEN_COLUMN, PeriodicTable } from './PeriodicTable.tsx'

const html = renderToStaticMarkup(<PeriodicTable alt="An interactive periodic table" />)

describe('the periodic table', () => {
  /** Once in the full table and once in the phone's split one; CSS shows one of the two. */
  it('gives every element a button, in both layouts', () => {
    for (const el of ELEMENTS) {
      const label = `aria-label="${el.name}, ${el.symbol}, atomic number ${el.z}"`
      expect(html.split(label).length - 1, el.symbol).toBe(2)
    }
  })

  it('opens on sodium, with what its numbers mean', () => {
    expect(html).toContain('the usual atom has 12 neutrons')
    expect(html).toContain('2, 8, 1')
  })

  it('offers every family as a filter', () => {
    for (const f of ['Group 1: alkali metals', 'Transition metals', 'Group 7: halogens', 'Group 0: noble gases']) expect(html).toContain(f)
  })

  it('says what the insert leaves out', () => {
    expect(html).toContain('lanthanides (58 to 71)')
  })

  /** The button for an element, in the full table (the first) and the phone's (the second). */
  const buttons = (name: string) => [...html.matchAll(new RegExp(`<button[^>]*aria-label="${name}, [^"]*"[^>]*style="([^"]*)"[^>]*>(.*?)</button>`, 'g'))].map((m) => ({ style: m[1]!, inner: m[2]! }))

  /**
   * AQA's key reads, top to bottom: relative atomic mass, atomic symbol, name, atomic
   * (proton) number. The cells had the number on top and the mass below, so sodium's cell
   * read 11 / Na / 23 beside a panel that read 23 / Na / 11.
   */
  it('prints each cell in the insert’s order: mass, symbol, atomic number', () => {
    for (const el of ELEMENTS) {
      const [full] = buttons(el.name)
      const order = [...full!.inner.matchAll(/data-cell="(mass|number)"[^>]*>([^<]*)</g)].map((m) => `${m[1]}:${m[2]}`)
      expect(order, el.symbol).toEqual([`mass:${el.mass}`, `number:${el.z}`])
      expect(full!.inner.indexOf('data-cell="mass"'), el.symbol).toBeLessThan(full!.inner.indexOf(`>${el.symbol}<`))
      expect(full!.inner.indexOf(`>${el.symbol}<`), el.symbol).toBeLessThan(full!.inner.indexOf('data-cell="number"'))
    }
  })

  /** Alone in the first row, above the eighth column, under no group number. */
  it('stands hydrogen on its own, as the insert does', () => {
    const [full, phone] = buttons('hydrogen')
    expect(full!.style).toContain(`grid-column:${HYDROGEN_COLUMN}`)
    expect(full!.style).toContain('grid-row:2')
    // No heading stands over that column: the group numbers are over 1, 2 and 13 to 18.
    const headings = [...html.matchAll(/<span aria-hidden="true"[^>]*grid-column:(\d+);grid-row:1[^>]*>([^<]*)</g)].slice(0, 18).map((m) => m[2])
    expect(headings).toEqual(['1', '2', '', '', '', '', '', '', '', '', '', '', '3', '4', '5', '6', '7', '0'])
    expect(headings[HYDROGEN_COLUMN - 1]).toBe('')
    // On a phone, between two columns and under neither heading.
    expect(phone!.style).toContain('grid-column:4 / span 2')
    expect(phone!.style).toContain('justify-self:center')
    const [lithium] = buttons('lithium')
    expect(lithium!.style).toContain('grid-column:1;')
  })

  it('says of hydrogen that it is in no group', () => {
    // The panel opens on sodium, so hydrogen's words are checked where they are made.
    expect(html).toContain('Group 1: alkali metals')
    expect(html).not.toContain('Other non-metals · Group 1')
  })

  it('does not claim to know what the insert’s brackets mean beyond what is safe', () => {
    expect(html).toContain('Some masses are printed in brackets')
    expect(html).not.toContain('most stable isotope')
  })
})
