import { describe, expect, it } from 'vitest'
import { newSheetCode, sheetParam, sheetPath } from './sheetCode.ts'

describe('a worksheet code', () => {
  it('is six characters that cannot be misread off paper', () => {
    for (let i = 0; i < 200; i++) expect(newSheetCode()).toMatch(/^[a-hj-km-np-z2-9]{6}$/)
  })

  it('is read from a link, and anything else in its place is ignored', () => {
    expect(sheetParam(new URLSearchParams('sheet=k7m2qp'))).toBe('k7m2qp')
    expect(sheetParam(new URLSearchParams('sheet=K7M2QP'))).toBe('k7m2qp')
    // An attempt id, the seed of the first retries.
    expect(sheetParam(new URLSearchParams('sheet=3f2a9c1e-77b0-4c1e-9a52-0d8d6f3b2a10'))).toBe('3f2a9c1e-77b0-4c1e-9a52-0d8d6f3b2a10')
    expect(sheetParam(new URLSearchParams(''))).toBeUndefined()
    expect(sheetParam(new URLSearchParams('sheet=<script>'))).toBeUndefined()
    expect(sheetParam(new URLSearchParams('sheet=ab'))).toBeUndefined()
  })

  it('makes the on-screen and print links', () => {
    expect(sheetPath('maths', 'surds', 'higher', 'k7m2qp')).toBe('/subjects/maths/topics/surds/worksheet/higher?sheet=k7m2qp')
    expect(sheetPath('maths', 'surds', 'higher', 'k7m2qp', true, true)).toBe('/subjects/maths/topics/surds/worksheet/higher/print?sheet=k7m2qp&answers=1')
  })
})
