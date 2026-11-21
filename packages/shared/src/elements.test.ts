import { describe, expect, it } from 'vitest'
import { ELEMENTS, FAMILY_FACT, electronShells, factFor, groupName, massNote, neutronWorking, neutrons, placeOf } from './elements.ts'

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

  /**
   * The insert's figure is an average, not a mass number. Up to calcium it rounds to the
   * commonest atom; past it, it often rounds to an atom that does not exist. Bromine's 80
   * gave "45 neutrons", and bromine atoms are bromine-79 and bromine-81.
   */
  it('counts neutrons only for the first 20 elements', () => {
    // The commonest isotope of each, by mass number: the figure the sum must agree with.
    const COMMONEST: Record<string, number> = { H: 1, He: 4, Li: 7, Be: 9, B: 11, C: 12, N: 14, O: 16, F: 19, Ne: 20, Na: 23, Mg: 24, Al: 27, Si: 28, P: 31, S: 32, Ar: 40, K: 39, Ca: 40 }
    const counted = ELEMENTS.filter((e) => neutrons(e) !== undefined)
    expect(counted.map((e) => e.symbol)).toEqual(Object.keys(COMMONEST))
    for (const e of counted) expect(neutrons(e), e.symbol).toBe(COMMONEST[e.symbol]! - e.z)
    for (const symbol of ['Br', 'Ni', 'Zn', 'Ag', 'Fe']) expect(neutrons(bySymbol.get(symbol)!), symbol).toBeUndefined()
  })

  it('says what each kind of mass is', () => {
    expect(massNote(bySymbol.get('Na')!)).toBe('the average mass of its atoms, rounded to a whole number')
    expect(massNote(bySymbol.get('Cl')!)).toContain('not a whole number')
    expect(massNote(bySymbol.get('Br')!)).toContain('rounded to a whole number')
    expect(massNote(bySymbol.get('Fr')!)).toContain('no atom of this element is stable')
    // Nothing claims to be "the most stable isotope": the insert does not say so.
    for (const e of ELEMENTS) expect(massNote(e), e.symbol).not.toContain('most stable')
  })

  /** The neutrons card shows the sum only where `neutrons` allows it, and says why not elsewhere. */
  it('works out the neutrons, or says why it cannot', () => {
    expect(neutronWorking(bySymbol.get('Na')!)).toEqual({ sum: '23 − 11 = 12', words: 'Relative atomic mass take away atomic number: the usual sodium atom has 12 neutrons.' })
    expect(neutronWorking(bySymbol.get('H')!).sum).toBe('1 − 1 = 0')
    expect(neutronWorking(bySymbol.get('Cl')!).words).toContain('two kinds of chlorine atom')
    expect(neutronWorking(bySymbol.get('Cu')!).words).toContain('two kinds of copper atom')
    expect(neutronWorking(bySymbol.get('Br')!).words).toContain('bromine-79 and bromine-81')
    expect(neutronWorking(bySymbol.get('Fr')!).words).toContain('no atom of francium is stable')
    for (const e of ELEMENTS) {
      const w = neutronWorking(e)
      expect(w.sum !== undefined, e.symbol).toBe(neutrons(e) !== undefined)
      if (w.sum === undefined) expect(w.words, e.symbol).toContain('gives you the mass number of the atom it means')
      expect(w.words, e.symbol).not.toContain('most stable')
    }
  })

  /** A row is the number of shells; a column the outer electrons, with Group 0, helium, hydrogen and the transition metals the exceptions. */
  it('says what each element’s row and column mean', () => {
    expect(placeOf(bySymbol.get('Na')!)).toEqual({ row: 'Period 3: its atoms have 3 electron shells (2, 8, 1).', column: 'Group 1: 1 electron in the outer shell.' })
    expect(placeOf(bySymbol.get('Cl')!).column).toBe('Group 7: 7 electrons in the outer shell.')
    expect(placeOf(bySymbol.get('He')!).column).toContain('two electrons')
    expect(placeOf(bySymbol.get('Ne')!).column).toBe('Group 0: a full outer shell, with eight electrons.')
    expect(placeOf(bySymbol.get('H')!)).toEqual({ row: 'Period 1: its atoms have 1 electron shell (1).', column: 'Hydrogen stands on its own, in no group. Its atom has one electron.' })
    expect(placeOf(bySymbol.get('Fe')!)).toEqual({ row: 'Period 4: its atoms have 4 electron shells.', column: 'One of the ten middle columns with no group number: the transition metals.' })
    for (const e of ELEMENTS) {
      const shells = electronShells(e.z)
      // The shells listed agree with the period, and the outer one with the group.
      if (shells) {
        expect(shells.length, e.symbol).toBe(e.period)
        if (e.group !== null && e.group !== 18) expect(placeOf(e).column, e.symbol).toContain(`${shells.at(-1)} electron`)
      }
    }
  })

  /** The insert prints hydrogen alone, under no group number; Group 1 is "the alkali metals". */
  it('puts hydrogen in no group', () => {
    const h = bySymbol.get('H')!
    expect(h.group).toBeNull()
    expect(groupName(h.group)).toBe('on its own, in no group')
    expect(ELEMENTS.filter((e) => e.group === null).map((e) => e.symbol)).toEqual(['H'])
    expect(ELEMENTS.filter((e) => e.group === 1).map((e) => e.symbol)).toEqual(['Li', 'Na', 'K', 'Rb', 'Cs', 'Fr'])
  })

  /** "Non-metals do not form positive ions", shown for hydrogen, contradicted the ions sheet, which lists H⁺ first. */
  it('does not say of hydrogen that it forms no positive ion', () => {
    expect(factFor(bySymbol.get('H')!)).toContain('H⁺')
    expect(factFor(bySymbol.get('H')!)).not.toContain('do not form positive ions')
    expect(factFor(bySymbol.get('C')!)).toBe(FAMILY_FACT['non-metal'])
    expect(factFor(bySymbol.get('Fe')!)).toBe(FAMILY_FACT['transition-metal'])
  })

  /** Mercury is coloured as a transition metal and is a liquid: the line is about typical ones. */
  it('speaks of typical transition metals, not of every one', () => {
    expect(FAMILY_FACT['transition-metal']).toMatch(/^Typical transition metals, such as iron and copper/)
  })
})
