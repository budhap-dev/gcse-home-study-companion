import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import { arithmeticGenerators } from './arithmetic.ts'

/**
 * Structural tests for the binary-arithmetic shift generators. Each reads the bits, the number of
 * places and the direction back from the prompt, shifts with arithmetic (× and ÷ by powers of two,
 * where the generator moves characters), checks literal lines and every printed step, that the
 * named wrong routes are marked wrong, that no shift loses a 1 where none may be lost, and spread.
 */
const TOPIC = 'binary-arithmetic'
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/computer-science')
const file = JSON.parse(readFileSync(join(ROOT, `${TOPIC}.json`), 'utf8'))
const bank = Question.array().parse(file.questions)
const written = (id: string) => bank.find((q) => q.id === id)!

const SLOTS: Record<string, string> = { q4: 'cs-shift-factor', q7: 'cs-shift-right-loss', q14: 'cs-shift-left-value' }
const gen = (id: string) => GENERATORS.find((x) => x.id === id)!
function build(slotId: string, n = 300, prefix = 'structure'): Generated[] {
  return Array.from({ length: n }, (_, i) => generate(gen(SLOTS[slotId]!), written(slotId), `${prefix}-${i}`))
}
const find = (slotId: string, ok: (b: Generated) => boolean) => build(slotId, 5000, 'lit').find(ok)!
const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const lines = (b: Generated) => b.question.markScheme.map((l) => `${l.code} ${l.description}`)

const NUMBER = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 } as Record<string, number>
interface Read { n: number; bits: string; p: number; dir: 'left' | 'right' }
function read(b: Generated): Read {
  const m = /\b([01]{8})\b.*?\b(one|two|three|four|five|six) places? (?:to the )?(left|right)/.exec(b.question.prompt)
  if (!m) throw new Error(`cannot read ${b.question.prompt}`)
  return { bits: m[1]!, n: parseInt(m[1]!, 2), p: NUMBER[m[2]!]!, dir: m[3] as 'left' | 'right' }
}
const b8 = (x: number) => x.toString(2).padStart(8, '0')
const placeSum = (bits: string) => [...bits].map((c, i) => (c === '1' ? 2 ** (7 - i) : 0)).filter((x) => x > 0)

function share<T>(built: Generated[], key: (b: Generated) => T) {
  const counts = new Map<T, number>()
  for (const b of built) counts.set(key(b), (counts.get(key(b)) ?? 0) + 1)
  return { worst: Math.max(...counts.values()) / built.length, distinct: counts.size }
}
function refuses(b: Generated, wrong: number[]) {
  for (const w of wrong) {
    for (const t of [w, Math.round(w)]) {
      expect(t, `${b.seed}: wrong route ${w}`).not.toBe(answer(b))
      expect(mark(b.question, String(t)).correct, `${b.seed}: ${t}`).toBe(false)
    }
  }
}

describe('every binary-arithmetic shift build', () => {
  it('reads the written q7 and q14 as the generators would build them', () => {
    expect(written('q7').prompt).toContain('00101001')
    expect((written('q7') as { answer?: number }).answer).toBe(20)
    expect(written('q14').prompt).toContain('00010101')
    expect((written('q14') as { answer?: number }).answer).toBe(168)
  })

  it('has one generator for each numeric slot', () => {
    expect(arithmeticGenerators.flatMap((g) => g.replaces).sort()).toEqual(Object.keys(SLOTS).sort())
    expect(bank.filter((q) => q.type === 'numeric').map((q) => q.id).sort()).toEqual(Object.keys(SLOTS).sort())
    for (const g of arithmeticGenerators) {
      expect(g.subjectId).toBe('computer-science')
      expect(g.topicId).toBe(TOPIC)
    }
  })

  it('keeps no units, exact tolerance and the written codes, and never fails to draw over 3000 seeds', () => {
    for (const id of Object.keys(SLOTS)) {
      const slot = written(id)
      for (let i = 0; i < 3000; i++) {
        const b = generate(gen(SLOTS[id]!), slot, `throw-${i}`)
        if (i >= 300) continue
        const q = b.question
        if (q.type !== 'numeric') throw new Error('not numeric')
        expect(q.units).toBeUndefined()
        expect(q.tolerance).toBe(0)
        expect(Number.isInteger(q.answer)).toBe(true)
        // A 1-mark slot is a B1 for the answer (scheme.ts), where the written q4 says A1.
        expect(q.markScheme.map((l) => l.code)).toEqual(slot.marks === 1 ? ['B1'] : slot.markScheme.map((l) => l.code))
        expect(b.check.agrees, b.seed).toBe(true)
        expect(mark(q, String(q.answer)).correct).toBe(true)
        expect(mark(q, ` ${q.answer} `).correct).toBe(true)
        expect(mark(q, String(q.answer + 1)).correct).toBe(false)
      }
    }
  })

  it('repeats no prompt in a tenth of 1000 builds, and the written one in at most a twentieth', () => {
    for (const id of Object.keys(SLOTS)) {
      const counts = new Map<string, number>()
      for (const b of build(id, 1000, 'release')) counts.set(b.question.prompt, (counts.get(b.question.prompt) ?? 0) + 1)
      expect(counts.size, id).toBeGreaterThan(100)
      expect(Math.max(...counts.values()), id).toBeLessThanOrEqual(50)
      expect(counts.get(written(id).prompt) ?? 0, id).toBeLessThanOrEqual(10)
    }
  })
})

describe('q4: the number a shift multiplies or divides by', () => {
  const built = build('q4')

  it('asks for 2 to the number of places, and no 1 falls off', () => {
    for (const b of built) {
      const r = read(b)
      expect(answer(b), b.seed).toBe(2 ** r.p)
      expect(b.question.prompt).toContain(r.dir === 'left' ? 'multiplied' : 'divided')
      if (r.dir === 'left') expect(r.n * 2 ** r.p, b.seed).toBeLessThanOrEqual(255)
      else expect(r.n % 2 ** r.p, b.seed).toBe(0)
      expect(r.p).toBeGreaterThanOrEqual(3)
      expect(r.bits.replace(/0/g, '').length).toBeGreaterThanOrEqual(2)
      expect([58, 22, 80]).not.toContain(r.n)
    }
  })

  it('checks with the values before and after, each as printed', () => {
    for (const b of built) {
      const r = read(b)
      const after = r.dir === 'left' ? r.n * 2 ** r.p : r.n / 2 ** r.p
      const op = r.dir === 'left' ? '\\times' : '\\div'
      expect(b.question.solution, b.seed).toContain(`$2^${r.p} = $ **${2 ** r.p}**. Check: \`${r.bits}\` is ${r.n}, and shifted it is \`${b8(after)}\` = ${after}, which is $${r.n} ${op} ${2 ** r.p}$.`)
      expect(lines(b)).toEqual([`B1 ${2 ** r.p}`])
    }
  })

  it('prints literal working', () => {
    const b = find('q4', (x) => x.values.binary === '00001101' && x.values.places === 3)
    expect(b.question.solution).toBe('Each place left multiplies the value by 2, so three places multiply it by $2^3 = $ **8**. Check: `00001101` is 13, and shifted it is `01101000` = 104, which is $13 \\times 8$.')
    const c = find('q4', (x) => x.values.binary === '11000000' && x.values.places === 6)
    expect(c.question.solution).toBe('Each place right divides the value by 2, so six places divide it by $2^6 = $ **64**. Check: `11000000` is 192, and shifted it is `00000011` = 3, which is $192 \\div 64$. No 1 falls off the right-hand end, so the division is exact.')
  })

  it('refuses the number of places, twice the places, and the shifted value', () => {
    for (const b of built) {
      const r = read(b)
      refuses(b, [r.p, 2 * r.p, r.n, r.dir === 'left' ? r.n * 2 ** r.p : r.n / 2 ** r.p])
    }
  })

  it('spreads the places, both directions and the numbers', () => {
    expect(share(built, answer).worst).toBeLessThan(0.4)
    expect(share(built, answer).distinct).toBe(4)
    const dir = share(built, (b) => read(b).dir)
    expect(dir.distinct).toBe(2)
    expect(dir.worst).toBeLessThan(0.6)
    expect(share(built, (b) => read(b).bits).distinct).toBeGreaterThan(40)
    // A calculation is a number, places and direction: six places has one number each way.
    expect(share(built, (b) => `${read(b).bits}/${read(b).p}/${read(b).dir}`).worst).toBeLessThan(1 / 6)
    expect(share(built, (b) => read(b).p === 6).worst).toBeGreaterThan(0.85)
  })
})

describe('q7: a right shift that loses a 1', () => {
  const built = build('q7')

  it('answers the whole part of the division, a 1 lost in the highest column that falls off', () => {
    for (const b of built) {
      const r = read(b)
      expect(r.dir).toBe('right')
      expect(answer(b), b.seed).toBe(Math.floor(r.n / 2 ** r.p))
      expect(r.n / 2 ** r.p - answer(b), b.seed).toBeGreaterThanOrEqual(0.5)
      expect(answer(b)).toBeGreaterThanOrEqual(3)
      expect([15, 3, 5, 23, 22, 88, 104, 13]).not.toContain(r.n)
      expect([13, 88]).not.toContain(answer(b))
    }
  })

  it('prints the value before, the bits after and the exact division it is not', () => {
    for (const b of built) {
      const r = read(b)
      const after = b8(answer(b))
      const s = b.question.solution
      expect(s, b.seed).toContain(`\`${r.bits}\` is $${placeSum(r.bits).join(' + ')} = ${r.n}$.`)
      expect(s, b.seed).toContain(`gives \`${after}\` = $${placeSum(after).join(' + ')} = $ **${answer(b)}**.`)
      expect(s, b.seed).toContain(`so the answer is ${answer(b)} rather than $${r.n} \\div ${2 ** r.p} = ${r.n / 2 ** r.p}$.`)
      expect(lines(b)).toEqual([`M1 shifts to ${after}`, `A1 ${answer(b)}`])
    }
  })

  it('prints literal working', () => {
    const b = find('q7', (x) => x.values.binary === '10011011' && x.values.places === 1)
    expect(b.question.solution).toBe('`10011011` is $128 + 16 + 8 + 2 + 1 = 155$. Shifting one place right gives `01001101` = $64 + 8 + 4 + 1 = $ **77**. The 1 in the units column falls off the end and is lost, so the answer is 77 rather than $155 \\div 2 = 77.5$.')
    const c = find('q7', (x) => x.values.binary === '10011101' && x.values.places === 3)
    expect(c.question.solution).toBe('`10011101` is $128 + 16 + 8 + 4 + 1 = 157$. Shifting three places right gives `00010011` = $16 + 2 + 1 = $ **19**. The bits `101` in the three right-hand columns fall off the end and are lost, so the answer is 19 rather than $157 \\div 8 = 19.625$.')
  })

  it('refuses exact division (as typed and rounded), a left shift and a place too many or too few', () => {
    for (const b of built) {
      const r = read(b)
      const wrong = [r.n / 2 ** r.p, Math.ceil(r.n / 2 ** r.p), r.n * 2 ** r.p, Math.floor(r.n / 2 ** (r.p + 1)), Math.floor(r.n / 2 ** (r.p - 1))]
      refuses(b, wrong)
      expect(mark(b.question, (r.n / 2 ** r.p).toFixed(1)).correct).toBe(false)
    }
  })

  it('spreads its answers and the places', () => {
    expect(share(built, answer).worst).toBeLessThan(0.1)
    expect(share(built, answer).distinct).toBeGreaterThan(40)
    expect(share(built, (b) => read(b).p).distinct).toBe(3)
  })
})

describe('q14: a left shift that loses nothing', () => {
  const built = build('q14')

  it('answers the number times 2 to the places, inside eight bits', () => {
    for (const b of built) {
      const r = read(b)
      expect(r.dir).toBe('left')
      expect(answer(b), b.seed).toBe(r.n * 2 ** r.p)
      expect(answer(b)).toBeLessThanOrEqual(255)
      expect(r.p).toBeGreaterThanOrEqual(3)
      expect([200, 50, 12, 100]).not.toContain(answer(b))
    }
  })

  it('prints each step, and the binary check reads back to the answer', () => {
    for (const b of built) {
      const r = read(b)
      const f = 2 ** r.p
      const after = b8(answer(b))
      const s = b.question.solution
      expect(s, b.seed).toContain(`\`${r.bits}\` is $${placeSum(r.bits).join(' + ')} = ${r.n}$.`)
      expect(s, b.seed).toContain(`left multiplies by $2^${r.p} = ${f}$, so $${r.n} \\times ${f} = $ **${answer(b)}**.`)
      expect(s, b.seed).toContain(`As binary that is \`${after}\` = $${placeSum(after).join(' + ')} = ${answer(b)}$ ✓`)
      expect(lines(b)).toEqual([`M1 multiplies by ${f}`, `A1 ${answer(b)}`])
    }
  })

  it('prints literal working', () => {
    const b = find('q14', (x) => x.values.binary === '00001101' && x.values.places === 3)
    expect(b.question.solution).toBe('`00001101` is $8 + 4 + 1 = 13$. Three places left multiplies by $2^3 = 8$, so $13 \\times 8 = $ **104**. As binary that is `01101000` = $64 + 32 + 8 = 104$ ✓')
  })

  it('refuses × places, × twice the places, a place too many or too few, and adding 2 to the places', () => {
    for (const b of built) {
      const r = read(b)
      refuses(b, [r.n * r.p, r.n * 2 * r.p, r.n * 2 ** (r.p - 1), r.n * 2 ** (r.p + 1), r.n + 2 ** r.p, r.n])
    }
  })

  it('spreads its answers and keeps every calculation under a sixth', () => {
    expect(share(built, answer).worst).toBeLessThan(1 / 6)
    expect(share(built, answer).distinct).toBeGreaterThan(20)
    expect(share(built, (b) => `${read(b).n}/${read(b).p}`).worst).toBeLessThan(1 / 6)
    expect(share(built, (b) => read(b).p).distinct).toBe(3)
  })
})
