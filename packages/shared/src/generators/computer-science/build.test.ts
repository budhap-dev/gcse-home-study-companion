import { describe, expect, it } from 'vitest'
import { an, bin, count, hex, perUnit, texCount } from './build.ts'

describe('Computer Science printing', () => {
  it('prints binary padded to its bits, as the written questions do', () => {
    expect(bin(45)).toBe('00101101')
    expect(bin(13)).toBe('00001101')
    expect(bin(5, 4)).toBe('0101')
    expect(() => bin(256)).toThrow()
    expect(() => bin(-1)).toThrow()
  })

  it('prints hexadecimal in capitals', () => {
    expect(hex(180)).toBe('B4')
    expect(hex(10)).toBe('0A')
    expect(hex(255)).toBe('FF')
    expect(() => hex(256)).toThrow()
  })

  it('groups counts from five digits, as the written questions do', () => {
    expect(count(2000)).toBe('2000')
    expect(count(160000)).toBe('160 000')
    expect(count(3000000000)).toBe('3 000 000 000')
    expect(texCount(640000)).toBe('640\\,000')
  })

  it('chooses the article by sound for words and figures', () => {
    expect(an('8-bit')).toBe('an')
    expect(an('80')).toBe('an')
    expect(an('11-character')).toBe('an')
    expect(an('18')).toBe('an')
    expect(an('7-bit')).toBe('a')
    expect(an('16-bit')).toBe('a')
    expect(an('1100')).toBe('a')
    expect(an('image')).toBe('an')
    expect(an('unit')).toBe('a')
    expect(an('uncompressed')).toBe('an')
    expect(an('byte')).toBe('a')
  })

  it('converts between decimal prefixes', () => {
    expect(perUnit('G', 'M')).toBe(1000)
    expect(perUnit('T', 'M')).toBe(1_000_000)
    expect(perUnit('k', '')).toBe(1000)
    expect(perUnit('M', 'G')).toBe(0.001)
  })
})
