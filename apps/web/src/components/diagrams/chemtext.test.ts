import { describe, expect, it } from 'vitest'
import { chemText } from './chemText.ts'

describe('molecular formulae in captions', () => {
  it('sets the counts as subscripts', () => {
    expect(chemText('ethane, C2H6 (saturated)')).toBe('ethane, C₂H₆ (saturated)')
    expect(chemText('ethanoic acid, CH3COOH')).toBe('ethanoic acid, CH₃COOH')
    expect(chemText('CO2 and H2O')).toBe('CO₂ and H₂O')
    expect(chemText('Al2(SO4)3')).toBe('Al₂(SO₄)₃')
  })

  it('leaves the number of molecules in front at full height', () => {
    expect(chemText('2H2O')).toBe('2H₂O')
  })

  it('leaves everything that is not a count alone', () => {
    for (const plain of ['Hydrogen adds across the double bond: nickel, 150 °C', 'Step 2 of 3', 'Fe2+ and Cu2+', 'C=C', 'Every bond drawn, including the O-H', 'ethene']) {
      expect(chemText(plain)).toBe(plain)
    }
  })

  it('keeps the length, which the drawing budgets its width from', () => {
    const label = 'propanoic acid, C2H5COOH'
    expect(chemText(label)).toHaveLength(label.length)
  })
})
