import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ELEMENTS } from '@study/shared'
import { PeriodicTable } from './PeriodicTable.tsx'

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
})
