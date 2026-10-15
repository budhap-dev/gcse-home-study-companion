import { describe, expect, it } from 'vitest'
import { compareSpecPoints, stepNumber, topicNumber } from './spec-number.ts'

const of = (...specPoints: string[]) => topicNumber({ specPoints })

describe('topicNumber', () => {
  it('uses the section code where the topic is a whole section', () => {
    expect(topicNumber({ specCode: '1.4', specPoints: ['1.4.1', '1.4.2', '1.4.3', '1.4.4'] })).toBe('1.4')
  })

  it('lists one or two points as they are', () => {
    expect(of('4.3.5')).toBe('4.3.5')
    expect(of('4.7.3.1', '4.7.3.2')).toBe('4.7.3.1, 4.7.3.2')
  })

  it('writes three or more points in sequence as a range', () => {
    expect(of('4.5.6.1.1', '4.5.6.1.2', '4.5.6.1.3', '4.5.6.1.4', '4.5.6.1.5')).toBe('4.5.6.1.1–4.5.6.1.5')
  })

  /** A range is read as "all of these", so a gap in the topic's own list must break it. */
  it('breaks a range at a point the topic does not list', () => {
    expect(of('4.1.1.1', '4.1.1.4', '4.1.1.5', '4.1.1.6', '4.1.1.7')).toBe('4.1.1.1, 4.1.1.4–4.1.1.7')
    expect(of('6.9', '6.10', '6.12', '6.13')).toBe('6.9, 6.10, 6.12, 6.13')
  })

  it('never runs a range across two sections', () => {
    expect(of('4.2.3.1', '4.2.3.2', '4.2.3.3', '4.2.4.1', '4.2.4.2')).toBe('4.2.3.1–4.2.3.3, 4.2.4.1, 4.2.4.2')
  })

  it('sorts by number, not by text, and drops repeats', () => {
    expect(of('2.14', '2.9', '2.9')).toBe('2.9, 2.14')
    expect(of('3.2.11', '3.1.1', '3.2.2')).toBe('3.1.1, 3.2.2, 3.2.11')
    expect(of('3.6.2.2', '3.6.2', '3.6.1')).toBe('3.6.1, 3.6.2, 3.6.2.2')
  })

  it("keeps Edexcel Biology's separate-science B and still sees the sequence", () => {
    expect(of('9.12', '9.13', '9.14', '9.15', '9.17B', '9.18B', '9.19B')).toBe('9.12–9.15, 9.17B–9.19B')
    expect(of('3.17B', '3.18B', '3.21')).toBe('3.17B, 3.18B, 3.21')
  })

  it('orders Maths strands as the specification does: N, A, R, G, P, S', () => {
    expect(of('R1', 'G14', 'N14', 'N13')).toBe('N13, N14, R1, G14')
    expect(of('R3', 'R4', 'R5', 'R6', 'N11')).toBe('N11, R3–R6')
  })

  it('has no number for a topic whose references are prose', () => {
    expect(of('Year 9 bridging: chromosomes, DNA, genes')).toBeUndefined()
    expect(of('Paper 1 Section A: Question 3 (AO2, 8 marks)')).toBeUndefined()
    expect(of('My neighbourhood')).toBeUndefined()
    expect(of('Fusions')).toBeUndefined()
    // Half a number would read as the whole of the topic's coverage.
    expect(of('4.2.2', 'Year 9 recap of circuits')).toBeUndefined()
  })
})

describe('stepNumber', () => {
  it('shows one point, a short list, or a range', () => {
    expect(stepNumber({})).toBeUndefined()
    expect(stepNumber({ specPoint: '1.4.2' })).toBe('1.4.2')
    expect(stepNumber({ specPoint: ['7.15', '7.16'] })).toBe('7.15, 7.16')
    expect(stepNumber({ specPoint: ['4.8.2.1', '4.8.2.2', '4.8.2.3', '4.8.2.4'] })).toBe('4.8.2.1–4.8.2.4')
  })
})

describe('compareSpecPoints', () => {
  it('sorts in specification order', () => {
    expect(['N13', 'G14', 'A4'].sort(compareSpecPoints)).toEqual(['N13', 'A4', 'G14'])
    expect(['4.1.1.10', '4.1.1.2', '3.6.2.2', '3.6.2'].sort(compareSpecPoints)).toEqual(['3.6.2', '3.6.2.2', '4.1.1.2', '4.1.1.10'])
  })
})
