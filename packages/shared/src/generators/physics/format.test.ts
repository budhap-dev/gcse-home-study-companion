import { describe, expect, it } from 'vitest'
import { clearAtSigFigs, dpTolerance, sci, sfTolerance, sigFigs, sigText } from './format.ts'

describe('significant figures as Physics prints them', () => {
  it('rounds to the figures asked', () => {
    expect(sigFigs(52.915, 3)).toBe(52.9)
    expect(sigFigs(0.24897, 2)).toBe(0.25)
    expect(sigFigs(299792458, 2)).toBe(300000000)
    expect(sigFigs(0, 3)).toBe(0)
  })

  it('keeps the trailing zero and never prints e-notation', () => {
    expect(sigText(0.25, 2)).toBe('0.25')
    expect(sigText(3, 3)).toBe('3.00')
    expect(sigText(52.9, 3)).toBe('52.9')
    expect(sigText(300000, 2)).toBe('300000')
    expect(sigText(1234, 2)).toBe('1200')
    expect(sigText(0.000123, 2)).toBe('0.00012')
    expect(sigText(0, 2)).toBe('0')
  })

  it('leaves half a unit in the last figure, never over 2%', () => {
    expect(sfTolerance(52.9, 3)).toBe(0.05)
    expect(sfTolerance(0.249, 3)).toBe(0.0005)
    // Half a unit of 0.25 at 2 s.f. is exactly 2% of it, so the cap applies.
    expect(sfTolerance(0.25, 2)).toBe(0.00475)
    // Half a unit of 12 at 2 s.f. would be 0.5, over 2% of 12: the cap is 1.9% of it.
    expect(sfTolerance(12, 2)).toBe(0.228)
    expect(sfTolerance(1.4, 2)).toBeLessThanOrEqual(1.4 * 0.02)
    expect(String(sfTolerance(1.4, 2))).not.toMatch(/0{8,}|9{8,}/)
    expect(sfTolerance(0, 2)).toBe(0)
  })

  it('gives a decimal answer half a unit in its last place, and a whole number none', () => {
    expect(dpTolerance(333.2)).toBe(0.05)
    expect(dpTolerance(8.75)).toBe(0.005)
    expect(dpTolerance(0.38)).toBe(0.005)
    expect(dpTolerance(1.2)).toBe(0.0228)
    expect(dpTolerance(196)).toBe(0)
    expect(dpTolerance(0)).toBe(0)
  })

  it('knows a half-way rounding case', () => {
    expect(clearAtSigFigs(52.915, 3)).toBe(true)
    expect(clearAtSigFigs(52.95, 3)).toBe(false)
    expect(clearAtSigFigs(0.125, 2)).toBe(false)
    expect(clearAtSigFigs(0.13, 2)).toBe(true)
  })

  it('writes standard form for TeX', () => {
    expect(sci(300000000, 2)).toBe('3.0 \\times 10^{8}')
    expect(sci(0.00025, 2)).toBe('2.5 \\times 10^{-4}')
    expect(sci(9.96e5, 2)).toBe('1.0 \\times 10^{6}')
    expect(sci(1500, 3)).toBe('1.50 \\times 10^{3}')
  })
})
