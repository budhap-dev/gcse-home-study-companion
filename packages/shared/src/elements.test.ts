import { describe, expect, it } from 'vitest'
import { ELEMENTS, electronShells, groupName, neutrons } from './elements.ts'

const bySymbol = new Map(ELEMENTS.map((e) => [e.symbol, e]))

describe('the periodic table data', () => {
  it('has the 90 elements on the AQA insert, and no lanthanides or actinides', () => {
    expect(ELEMENTS).toHaveLength(90)
    const zs = new Set(ELEMENTS.map((e) => e.z))
    for (let z = 1; z <= 118; z++) expect(zs.has(z), `Z=${z}`).toBe(!((z >= 58 && z <= 71) || (z >= 90 && z <= 103)))
  })

  it('puts every element in its own cell', () => {
    const cells = new Set(ELEMENTS.map((e) => `${e.group},${e.period}`))
    expect(cells.size).toBe(90)
  })

  /** "Relative atomic masses for Cu and Cl have not been rounded to the nearest whole number." */
  it('keeps the insert’s masses, with copper and chlorine unrounded', () => {
    expect(bySymbol.get('Cu')!.mass).toBe('63.5')
    expect(bySymbol.get('Cl')!.mass).toBe('35.5')
    expect(ELEMENTS.filter((e) => e.mass.includes('.')).map((e) => e.symbol).sort()).toEqual(['Cl', 'Cu'])
    for (const [s, m] of [['H', '1'], ['C', '12'], ['O', '16'], ['Na', '23'], ['Fe', '56'], ['Ar', '40'], ['K', '39'], ['Fr', '[223]']]) expect(bySymbol.get(s)!.mass, s).toBe(m)
  })

  it('places elements where the table does', () => {
    expect([bySymbol.get('Na')!.group, bySymbol.get('Na')!.period]).toEqual([1, 3])
    expect([bySymbol.get('La')!.group, bySymbol.get('La')!.period]).toEqual([3, 6])
    expect(groupName(bySymbol.get('Cl')!.group)).toBe('Group 7')
    expect(groupName(bySymbol.get('Ne')!.group)).toBe('Group 0')
    expect(ELEMENTS.filter((e) => e.family === 'halogen').map((e) => e.symbol)).toEqual(['F', 'Cl', 'Br', 'I', 'At', 'Ts'])
    expect(ELEMENTS.filter((e) => e.family === 'alkali-metal').map((e) => e.symbol)).toEqual(['Li', 'Na', 'K', 'Rb', 'Cs', 'Fr'])
  })

  it('gives the electronic structure AQA asks for, up to calcium', () => {
    expect(electronShells(11)).toEqual([2, 8, 1])
    expect(electronShells(20)).toEqual([2, 8, 8, 2])
    expect(electronShells(2)).toEqual([2])
    expect(electronShells(21)).toBeUndefined()
    for (let z = 1; z <= 20; z++) expect(electronShells(z)!.reduce((a, b) => a + b), `Z=${z}`).toBe(z)
  })

  it('counts neutrons only where the mass is a whole number', () => {
    expect(neutrons(bySymbol.get('Na')!)).toBe(12)
    expect(neutrons(bySymbol.get('Cl')!)).toBeUndefined()
    expect(neutrons(bySymbol.get('Fr')!)).toBeUndefined()
  })
})
