import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { averageRateOfReturn, breakEven, readsOff, gbp, interestPercent, marketShare, num, numericDraft, percentChange, staffTurnover, steps, styleOf, texGbp, texNum, texPounds } from './build.ts'

const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/business')
const written = (topic: string, id: string) =>
  Question.array().parse(JSON.parse(readFileSync(join(ROOT, `${topic}.json`), 'utf8')).questions).find((q) => q.id === id)!

describe('Business printing', () => {
  it('groups thousands as the written questions do', () => {
    expect(num(1500, 'space')).toBe('1500')
    expect(num(26000, 'space')).toBe('26 000')
    expect(num(2000000, 'space')).toBe('2 000 000')
    expect(num(1600, 'comma')).toBe('1,600')
    expect(num(3500000, 'comma')).toBe('3,500,000')
    expect(num(-2000, 'space')).toBe('-2000')
  })
  it('prints pounds, pence and negatives as the written questions do', () => {
    expect(gbp(26000, 'space')).toBe('£26 000')
    expect(gbp(24000, 'comma')).toBe('£24,000')
    expect(gbp(-500, 'space')).toBe('-£500')
    expect(gbp(8, 'space', true)).toBe('£8.00')
    expect(gbp(4.36, 'space')).toBe('£4.36')
    expect(gbp(0.8, 'comma')).toBe('£0.80')
    expect(gbp(1.75, 'comma')).toBe('£1.75')
  })
  it('reads each written question\'s own style, not its theme\'s', () => {
    expect(styleOf(written('putting-a-business-idea-into-practice', 'q9'))).toBe('space')
    expect(styleOf(written('growing-the-business', 'q6'))).toBe('comma')
    // Theme 2, but printed with spaces: "£500 000".
    expect(styleOf(written('growing-the-business', 'q25'))).toBe('space')
  })
})

describe('Business printing inside maths', () => {
  it('uses maths-mode separators, so a comma does not read as punctuation', () => {
    expect(texNum(26000, 'space')).toBe('26\\,000')
    expect(texNum(24000, 'comma')).toBe('24{,}000')
    expect(texNum(1500, 'space')).toBe('1500')
    expect(texNum(1500, 'comma')).toBe('1{,}500')
    expect(texNum(0.045, 'space')).toBe('0.045')
    expect(texNum(-12000, 'space')).toBe('-12\\,000')
  })
  it('prints money with pence kept, in either style', () => {
    expect(texGbp(17100, 'space')).toBe('£17\\,100')
    expect(texGbp(1600, 'comma')).toBe('£1{,}600')
    expect(texGbp(-500, 'space')).toBe('-£500')
    expect(texGbp(8, 'comma', true)).toBe('£8.00')
    expect(texPounds(2.7, 'space')).toBe('2.70')
    expect(texPounds(-12000, 'space')).toBe('-12\\,000')
  })
  it('steps without binary residue', () => expect(steps(0.1, 0.5, 0.1)).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]))
})

describe('readsOff', () => {
  it('sees the answer in a printed figure with the point moved either way', () => {
    expect(readsOff(7.5, [75000])).toBe(true)
    expect(readsOff(46000, [46])).toBe(true)
    expect(readsOff(24, [2400])).toBe(true)
    expect(readsOff(23, [46, 2300.5])).toBe(false)
  })
})

describe('numericDraft', () => {
  const slot = written('putting-a-business-idea-into-practice', 'q9')
  const body = { prompt: 'p', solution: 's -£500', method: ['opening $+$ net cash flow', '$1500 - 2000$'], answer: -500 }
  it('keeps the written units and tolerance, and prints the answer line in the written style', () => {
    const d = numericDraft(slot, body, { agrees: true, detail: '' }, {})
    expect(d.question.type === 'numeric' && d.question.units).toBe('£')
    expect(d.question.type === 'numeric' && d.question.tolerance).toBe(0)
    expect(d.question.markScheme.at(-1)!.description).toBe('−£500')
  })
  it('takes a tolerance only when given one', () => {
    const d = numericDraft(slot, { ...body, tolerance: 0.01 }, { agrees: true, detail: '' }, {})
    expect(d.question.type === 'numeric' && d.question.tolerance).toBe(0.01)
  })
})

describe('Business formulae give the written answers', () => {
  it('break-even, interest, market share and percentage change', () => {
    expect(breakEven(6000, 25, 10)).toBe(400)
    expect(breakEven(6000, 30, 10)).toBe(300)
    expect(interestPercent(10000, 11500)).toBeCloseTo(15)
    expect(interestPercent(15000, 36 * 475)).toBeCloseTo(14)
    expect(marketShare(60000, 800000)).toBeCloseTo(7.5)
    expect(percentChange(5000, 6200)).toBeCloseTo(24)
  })
  it('average rate of return counts profit net of the cost', () => {
    expect(averageRateOfReturn(50000, 90000, 3)).toBeCloseTo(60)
    expect(averageRateOfReturn(20000, 4 * 8000 - 20000, 4)).toBeCloseTo(15)
    expect(averageRateOfReturn(25000, 4000 + 7000 + 10000, 3)).toBeCloseTo(28)
  })
  it('staff turnover', () => expect(staffTurnover(30, 120)).toBe(25))
})
