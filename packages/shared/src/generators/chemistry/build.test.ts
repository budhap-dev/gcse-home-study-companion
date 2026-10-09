import { describe, expect, it } from 'vitest'
import { rng } from '../random.ts'
import {
  AR,
  arLine,
  atoms,
  balanced,
  clean,
  clearOf,
  coef,
  distinct,
  equation,
  equationTex,
  evenly,
  mathrm,
  mr,
  mrWorking,
  noOnes,
  places,
  powerOfTen,
  range,
  sub,
  tenfold,
  toPlaces,
  written,
} from './build.ts'
import { COMPOUNDS, ORES, factual, nameOf } from './compounds.ts'

describe('Chemistry build helpers', () => {
  it('takes relative atomic masses from the AQA insert', () => {
    expect(AR.Cl).toBe(35.5)
    expect(AR.Cu).toBe(63.5)
    expect(AR.Ca).toBe(40)
    expect(AR.Fr).toBeUndefined()
  })

  it('works out Mr as the written questions do', () => {
    expect(mr('H2O')).toBe(18)
    expect(mr('CaCO3')).toBe(100)
    expect(mr('Mg(OH)2')).toBe(58)
    expect(mr('CuCl2')).toBe(134.5)
    expect(mr('Al2(SO4)3')).toBe(342)
    expect(mr('HCl')).toBe(36.5)
  })

  it('multiplies brackets out when counting atoms', () => {
    expect(atoms('Ca(OH)2')).toEqual({ Ca: 1, O: 2, H: 2 })
    expect(atoms('Al2(SO4)3')).toEqual({ Al: 2, S: 3, O: 12 })
    expect(atoms('CH3COOH')).toEqual({ C: 2, H: 4, O: 2 })
  })

  it('prints the working in the written style', () => {
    expect(mrWorking('H2O')).toBe('(2 \\times 1) + 16')
    expect(mrWorking('CaCO3')).toBe('40 + 12 + (3 \\times 16)')
    expect(mrWorking('Mg(OH)2')).toBe('24 + 2 \\times (16 + 1)')
    expect(mrWorking('Al2(SO4)3')).toBe('(2 \\times 27) + 3 \\times (32 + (4 \\times 16))')
  })

  it('prints formulae and the Ar sentence', () => {
    expect(sub('Al2(SO4)3')).toBe('Al₂(SO₄)₃')
    expect(mathrm('H2SO4')).toBe('\\mathrm{H_2SO_4}')
    expect(mathrm('C8H18')).toBe('\\mathrm{C_8H_{18}}')
    expect(arLine('CaCO3', 'CaO')).toBe('Relative atomic masses: Ca 40, C 12, O 16.')
  })

  it('refuses a formula it cannot read', () => {
    expect(() => mr('Xx2')).toThrow()
    expect(() => mr('Ca(OH2')).toThrow()
    expect(() => mr('CaOH)2')).toThrow()
  })
})

describe('figure checks', () => {
  it('cleans residue and steps a range', () => {
    expect(clean(0.1 + 0.2)).toBe(0.3)
    expect(range(0.02, 0.05, 0.01)).toEqual([0.02, 0.03, 0.04, 0.05])
    expect(range(2, 5)).toEqual([2, 3, 4, 5])
    expect(range(0.005, 0.02, 0.005)).toEqual([0.005, 0.01, 0.015, 0.02])
  })

  it('sees the same digits with the point moved, at any power of ten', () => {
    expect(tenfold(500, 0.005)).toBe(true)
    expect(tenfold(26, 0.26)).toBe(true)
    expect(tenfold(4.4, 44)).toBe(true)
    expect(tenfold(500, 0.006)).toBe(false)
    expect(powerOfTen(0.1)).toBe(true)
    expect(powerOfTen(1)).toBe(true)
    expect(powerOfTen(0.2)).toBe(false)
    expect(distinct(2, 3, 0.4)).toBe(true)
    expect(distinct(2, 3, 0.2)).toBe(false)
  })

  it('refuses an answer that is a given moved, doubled or halved', () => {
    expect(clearOf(40, 4)).toBe(false)
    expect(clearOf(8, 4)).toBe(false)
    expect(clearOf(2, 4)).toBe(false)
    expect(clearOf(3, 4, 7)).toBe(true)
    expect(noOnes(2, 0.5)).toBe(true)
    expect(noOnes(2, 1)).toBe(false)
  })

  it('counts printed places and takes the tolerance from the places it is given', () => {
    expect(places(0.25)).toBe(2)
    expect(places(40)).toBe(0)
    expect(places(0.1 + 0.2)).toBe(1)
    // 0.80 prints as 0.8: half a unit in the readings' second place, not the answer's first.
    expect(toPlaces(0.8, 2)).toBe(0.005)
    expect(toPlaces(0.8, 1)).toBeCloseTo(0.0152)
    expect(toPlaces(40, 0)).toBe(0)
    expect(toPlaces(0.015, 3)).toBeCloseTo(0.000285)
  })

  it('draws every answer about as often, whichever has most candidates', () => {
    const r = rng('evenly')
    // 1 has nine candidates and 2 has one: an even draw still gives each about half.
    const items = [...Array.from({ length: 9 }, () => 1), 2]
    let ones = 0
    for (let i = 0; i < 2000; i++) if (evenly(r, 'build-test:uneven', () => items, (x) => x) === 1) ones++
    expect(ones / 2000).toBeGreaterThan(0.4)
    expect(ones / 2000).toBeLessThan(0.6)
    expect(() => evenly(r, 'build-test:empty', () => [] as number[], (x) => x)).toThrow()
  })
})

describe('equations', () => {
  it('reads, balances and prints an equation', () => {
    const eq = equation('CaCO3 + 2HCl -> CaCl2 + H2O + CO2')
    expect(balanced(eq)).toBe(true)
    expect(coef(eq, 'HCl')).toBe(2)
    expect(written(eq)).toBe('CaCO₃ + 2HCl → CaCl₂ + H₂O + CO₂')
    expect(equationTex(eq)).toBe('\\mathrm{CaCO_3} + 2\\mathrm{HCl} \\rightarrow \\mathrm{CaCl_2} + \\mathrm{H_2O} + \\mathrm{CO_2}')
    expect(equationTex(equation('2H2O2 -> 2H2O + O2'))).toBe('2\\mathrm{H_2O_2} \\rightarrow 2\\mathrm{H_2O} + \\mathrm{O_2}')
  })

  it('refuses one that does not balance', () => {
    expect(() => equation('H2 + O2 -> H2O')).toThrow()
    expect(() => coef(equation('2H2 + O2 -> 2H2O'), 'CO2')).toThrow()
  })
})

describe('the one table of names', () => {
  it('holds formulae that all parse, and a fact only where it is a sentence', () => {
    for (const [f, c] of [...Object.entries(COMPOUNDS), ...Object.entries(ORES)]) {
      expect(() => mr(f), f).not.toThrow()
      expect(c.name, f).toMatch(/^[a-z]/)
      if (c.fact) expect(c.fact, f).toMatch(/^[a-z].*[^.]$/)
    }
  })

  it('gives no two formulae the same name, and no formula two names', () => {
    const byName = new Map<string, string>()
    for (const [f, c] of Object.entries(COMPOUNDS)) {
      expect(byName.get(c.name), `${c.name}: ${byName.get(c.name)} and ${f}`).toBeUndefined()
      byName.set(c.name, f)
    }
    // Each formula is one key, written one way: no Mg(OH)2 beside a differently bracketed copy.
    const keys = Object.keys(COMPOUNDS).map((f) => JSON.stringify(Object.entries(atoms(f)).sort()) + f.replace(/\d/g, ''))
    expect(new Set(keys).size).toBe(keys.length)
    // A mineral name is never a compound's name: zinc blende and zinc sulfide are both ZnS on purpose.
    for (const o of Object.values(ORES)) expect(byName.has(o.name), o.name).toBe(false)
  })

  it('names a transition-metal compound with its Roman numeral, as every file prints it', () => {
    expect(nameOf('FeCO3')).toBe('iron(II) carbonate')
    expect(nameOf('CuO')).toBe('copper(II) oxide')
    expect(nameOf('CuSO4')).toBe('copper(II) sulfate')
    expect(nameOf('Fe2O3')).toBe('iron(III) oxide')
    expect(nameOf('HCl')).toBe('hydrochloric acid')
    expect(() => nameOf('XeF4')).toThrow()
    expect(factual('CaCO3').fact).toBe('is the main compound in limestone')
    expect(() => factual('CuO')).toThrow()
  })
})
