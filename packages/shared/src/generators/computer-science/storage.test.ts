import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate, sheetQuestions } from '../index.ts'
import type { Generated } from '../types.ts'
import { storageGenerators } from './storage.ts'

/**
 * Structural tests for the storage-units-and-binary generators. Each reads the prompt's figures
 * back with its own parsing (parseInt for binary and hex, the prefixes written out here), works
 * the answer again, checks literal lines of the working, that the named wrong routes are marked
 * wrong, that each context stays in scale, and the spread over builds.
 */
const TOPIC = 'storage-units-and-binary'
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/computer-science')
const file = JSON.parse(readFileSync(join(ROOT, `${TOPIC}.json`), 'utf8'))
const bank = Question.array().parse(file.questions)
const written = (id: string) => bank.find((q) => q.id === id)!

const SLOTS: Record<string, string> = {
  q3: 'cs-binary-to-decimal',
  q7: 'cs-hex-to-decimal',
  q8: 'cs-files-that-fit',
  q14: 'cs-files-that-fit',
  q21: 'cs-files-that-fit',
}

const gen = (id: string) => GENERATORS.find((x) => x.id === id)!
function build(slotId: string, n = 300, prefix = 'structure'): Generated[] {
  return Array.from({ length: n }, (_, i) => generate(gen(SLOTS[slotId]!), written(slotId), `${prefix}-${i}`))
}
const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const lines = (b: Generated) => b.question.markScheme.map((l) => `${l.code} ${l.description}`)
const spaced = (x: number) => (x >= 10000 ? String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : String(x))
const commas = (x: number) => String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
const thin = (x: number) => (x >= 10000 ? spaced(x).replace(/ /g, '\\,') : String(x))

function share<T>(built: Generated[], key: (b: Generated) => T) {
  const counts = new Map<T, number>()
  for (const b of built) counts.set(key(b), (counts.get(key(b)) ?? 0) + 1)
  return { worst: Math.max(...counts.values()) / built.length, distinct: counts.size }
}
function marksTyped(b: Generated) {
  const a = answer(b)
  for (const t of [String(a), spaced(a), commas(a)]) expect(mark(b.question, t).correct, `${b.seed}: ${t}`).toBe(true)
}
function refuses(b: Generated, wrong: number[]) {
  for (const w of wrong) {
    for (const t of [w, Math.round(w)]) {
      expect(t, `${b.seed}: wrong route ${w}`).not.toBe(answer(b))
      expect(mark(b.question, String(t)).correct, `${b.seed}: ${t}`).toBe(false)
    }
  }
}

describe('every storage-units-and-binary build', () => {
  it('has a generator for each numeric slot but the two facts to recall', () => {
    expect(storageGenerators.flatMap((g) => g.replaces).sort()).toEqual(Object.keys(SLOTS).sort())
    expect(bank.filter((q) => q.type === 'numeric').map((q) => q.id).sort()).toEqual([...Object.keys(SLOTS), 'q1', 'q4'].sort())
    for (const g of storageGenerators) {
      expect(g.subjectId).toBe('computer-science')
      expect(g.topicId).toBe(TOPIC)
      for (const id of g.replaces) expect(SLOTS[id]).toBe(g.id)
    }
  })

  it('keeps no units, exact tolerance and the written codes, puts the right article before a figure, and never fails to draw over 3000 seeds', () => {
    for (const id of Object.keys(SLOTS)) {
      const slot = written(id)
      for (let i = 0; i < 3000; i++) {
        const b = generate(gen(SLOTS[id]!), slot, `throw-${i}`)
        if (i >= 300) continue
        const q = b.question
        if (q.type !== 'numeric') throw new Error('not numeric')
        expect(q.units).toBeUndefined()
        expect(q.tolerance).toBe(0)
        expect(Number.isInteger(q.answer), b.seed).toBe(true)
        expect(q.answer).toBeGreaterThan(0)
        expect(q.prompt, b.seed).not.toMatch(/\ba 8|\ban [1-79]/i)
        expect(q.markScheme.map((l) => l.code)).toEqual(slot.markScheme.map((l) => l.code))
        expect(b.check.agrees, b.seed).toBe(true)
        expect(mark(q, String(q.answer + 1)).correct).toBe(false)
        marksTyped(b)
      }
    }
  })

  it('repeats no prompt in a tenth of 1000 builds and the written one in at most a twentieth', () => {
    for (const id of Object.keys(SLOTS)) {
      const counts = new Map<string, number>()
      for (const b of build(id, 1000, 'release')) counts.set(b.question.prompt, (counts.get(b.question.prompt) ?? 0) + 1)
      expect(counts.size, id).toBeGreaterThan(100)
      expect(Math.max(...counts.values()), id).toBeLessThanOrEqual(50)
      expect(counts.get(written(id).prompt) ?? 0, id).toBeLessThanOrEqual(10)
    }
  })
})

describe('q3: binary to decimal', () => {
  const built = build('q3')
  const binaryOf = (b: Generated) => /\b([01]{8})\b/.exec(b.question.prompt)![1]!

  it('answers the 8 bits the prompt prints, read by parseInt', () => {
    for (const b of built) expect(answer(b), b.seed).toBe(parseInt(binaryOf(b), 2))
  })

  it('lists the place values under the 1s, and they add to the answer', () => {
    for (const b of built) {
      const bits = binaryOf(b)
      const under = [...bits].map((c, i) => (c === '1' ? 2 ** (7 - i) : 0)).filter((x) => x > 0)
      const m = /^The 1s are under (.+), so \$(.+) = \$ \*\*(\d+)\*\*\.$/.exec(b.question.solution)
      expect(m, b.seed).not.toBeNull()
      expect(m![1]!.split(/, | and /).map(Number)).toEqual(under)
      expect(m![2]!.split(' + ').map(Number)).toEqual(under)
      expect(Number(m![3])).toBe(answer(b))
      expect(lines(b)[0]).toBe(`M1 uses the place values: ${under.join(' + ')}`)
    }
  })

  it('prints literal working', () => {
    const b = Array.from({ length: 3000 }, (_, i) => generate(gen('cs-binary-to-decimal'), written('q3'), `lit-${i}`)).find((x) => x.values.binary === '11001111')!
    expect(b.question.solution).toBe('The 1s are under 128, 64, 8, 4, 2 and 1, so $128 + 64 + 8 + 4 + 2 + 1 = $ **207**.')
    expect(lines(b)).toEqual(['M1 uses the place values: 128 + 64 + 8 + 4 + 2 + 1', 'A1 207'])
  })

  it('refuses place values counted from 1, the bits read backwards, and never prints a value the other sheets use', () => {
    for (const b of built) {
      const bits = binaryOf(b)
      refuses(b, [2 * answer(b), parseInt([...bits].reverse().join(''), 2)])
      expect([156, 218, 200, 63, 255, 90]).not.toContain(answer(b))
      expect(String(answer(b)), b.seed).not.toMatch(/^[01]+$/)
      const ones = bits.replace(/0/g, '').length
      expect(ones).toBeGreaterThanOrEqual(3)
      expect(ones).toBeLessThanOrEqual(6)
    }
  })

  it('spreads its answers and its count of 1s', () => {
    expect(share(built, answer).worst).toBeLessThan(0.05)
    expect(share(built, answer).distinct).toBeGreaterThan(100)
    expect(share(built, (b) => binaryOf(b).replace(/0/g, '').length).distinct).toBe(4)
  })
})

describe('q7: hexadecimal to decimal', () => {
  const built = build('q7')
  const hexOf = (b: Generated) => /\b([0-9A-F]{2})\b/.exec(b.question.prompt)![1]!
  const digit = (c: string) => '0123456789ABCDEF'.indexOf(c)

  it('answers the hex the prompt prints, read by parseInt', () => {
    for (const b of built) expect(answer(b), b.seed).toBe(parseInt(hexOf(b), 16))
  })

  it('has a letter digit, a first digit of 2 or more, no 0 and no repeated digit', () => {
    for (const b of built) {
      const [x, y] = hexOf(b)
      expect(/[A-F]/.test(hexOf(b)), b.seed).toBe(true)
      expect(digit(x!)).toBeGreaterThanOrEqual(2)
      expect(y).not.toBe('0')
      expect(x).not.toBe(y)
    }
  })

  it('works the sixteens, then checks in binary, each line evaluating as printed', () => {
    for (const b of built) {
      const h = hexOf(b)
      const [a, c] = [digit(h[0]!), digit(h[1]!)]
      const s = b.question.solution
      expect(s, b.seed).toContain(`$${a} \\times 16 = ${a * 16}$, and $${a * 16} + ${c} = $ **${a * 16 + c}**`)
      const m = /`([01]{4}) ([01]{4})` = \$(.+) = (\d+)\$ ✓$/.exec(s)!
      expect(m[1]! + m[2]!, b.seed).toBe(answer(b).toString(2).padStart(8, '0'))
      expect(m[3]!.split(' + ').map(Number).reduce((p, q) => p + q, 0)).toBe(answer(b))
      expect(Number(m[4])).toBe(answer(b))
      expect(lines(b)[0]).toBe(a >= 10 ? `M1 ${h[0]} = ${a}, so ${a} × 16` : `M1 ${a} × 16, with ${h[1]} = ${c}`)
    }
  })

  it('prints literal working', () => {
    const find = (h: string) => Array.from({ length: 3000 }, (_, i) => generate(gen('cs-hex-to-decimal'), written('q7'), `lit-${i}`)).find((x) => x.values.hex === h)!
    expect(find('B4').question.solution).toBe(written('q7').solution)
    expect(lines(find('B4'))).toEqual(['M1 B = 11, so 11 × 16', 'A1 180'])
    expect(find('7D').question.solution).toBe('D is 13. The 7 is in the sixteens column, so $7 \\times 16 = 112$, and $112 + 13 = $ **125**. Or in binary: `0111 1101` = $64 + 32 + 16 + 8 + 4 + 1 = 125$ ✓')
    expect(find('CA').question.solution).toBe('C is 12 and A is 10, so $12 \\times 16 = 192$, and $192 + 10 = $ **202**. Or in binary: `1100 1010` = $128 + 64 + 8 + 2 = 202$ ✓')
  })

  it('refuses letters read as 1, letters off by one, ×10 for ×16 and the digits swapped', () => {
    for (const b of built) {
      const [a, c] = [...hexOf(b)].map(digit) as [number, number]
      const face = (d: number) => (d >= 10 ? 1 : d)
      const up = (d: number) => (d >= 10 ? d + 1 : d)
      const down = (d: number) => (d >= 10 ? d - 1 : d)
      refuses(b, [face(a) * 16 + face(c), up(a) * 16 + up(c), down(a) * 16 + down(c), a * 10 + c, c * 16 + a])
      expect([156, 218, 200, 63, 255, 90]).not.toContain(answer(b))
    }
  })

  it('spreads its answers, and letters turn up first, second and both', () => {
    expect(share(built, answer).worst).toBeLessThan(0.05)
    expect(share(built, answer).distinct).toBeGreaterThan(80)
    const where = share(built, (b) => [...hexOf(b)].map((c) => (/[A-F]/.test(c) ? 'L' : 'd')).join(''))
    expect(where.distinct).toBe(3)
    expect(where.worst).toBeLessThan(0.5)
  })
})

describe('q8, q14, q21: files that fit', () => {
  const MB = { GB: 1000, TB: 1_000_000 } as const
  interface Read { capacity: number; unit: 'GB' | 'TB'; size: number; noun: string }
  const read = (b: Generated): Read => {
    const p = b.question.prompt
    const cap = /(\d+) (GB|TB)/.exec(p)!
    const size = /(\d+) MB/.exec(p)!
    const noun = /(video files|photos|songs|e-books)/.exec(p)![1]!
    return { capacity: Number(cap[1]), unit: cap[2] as 'GB' | 'TB', size: Number(size[1]), noun }
  }
  const SIZES: Record<string, [number, number]> = { 'video files': [100, 4000], photos: [2, 12], songs: [3, 10], 'e-books': [1, 5] }

  for (const [id, unit, caps] of [
    ['q8', 'GB', [8, 512]],
    ['q14', 'GB', [250, 960]],
    ['q21', 'TB', [2, 8]],
  ] as const) {
    describe(id, () => {
      const built = build(id)

      it(`reads a ${unit} capacity and an MB size back and divides them`, () => {
        for (const b of built) {
          const r = read(b)
          expect(r.unit, b.seed).toBe(unit)
          expect(answer(b), b.seed).toBe((r.capacity * MB[r.unit]) / r.size)
          expect(r.capacity).toBeGreaterThanOrEqual(caps[0])
          expect(r.capacity).toBeLessThanOrEqual(caps[1])
          const [lo, hi] = SIZES[r.noun]!
          expect(r.size, `${b.seed} ${r.noun}`).toBeGreaterThanOrEqual(lo)
          expect(r.size, `${b.seed} ${r.noun}`).toBeLessThanOrEqual(hi)
          if (r.noun === 'video files' && r.size < 1000) expect([100, 125, 200, 250, 400, 500, 800], `${b.seed}`).toContain(r.size)
          if (r.noun === 'video files' && r.size >= 1000) expect(r.size % 100).toBe(0)
          expect([r.capacity, r.size, r.capacity * 1000, r.capacity * MB[r.unit]]).not.toContain(answer(b))
          expect(r.capacity).not.toBe(r.size)
          expect(r.capacity * 1000).not.toBe(r.size)
        }
      })

      it('works each conversion step and the division as printed', () => {
        for (const b of built) {
          const r = read(b)
          const s = b.question.solution
          const mb = r.capacity * MB[r.unit]
          if (unit === 'GB') {
            expect(s, b.seed).toContain(`${r.capacity} GB is $${r.capacity} \\times 1000 = ${thin(mb)}$ MB.`)
          } else {
            const gb = r.capacity * 1000
            expect(s, b.seed).toContain(`${r.capacity} TB is $${r.capacity} \\times 1000 = ${thin(gb)}$ GB, and ${spaced(gb)} GB is $${thin(gb)} \\times 1000 = ${thin(mb)}$ MB.`)
          }
          expect(s, b.seed).toContain(`$${thin(mb)} \\div ${r.size} = $ **${spaced(answer(b))}**`)
          expect(lines(b)).toEqual([`M1 converts ${r.capacity} ${unit} to ${spaced(mb)} MB`, `A1 ${spaced(answer(b))}`])
        }
      })

      it('refuses 1024 for 1000, no conversion, and (for TB) only one prefix step', () => {
        for (const b of built) {
          const r = read(b)
          const wrong = unit === 'GB'
            ? [(r.capacity * 1024) / r.size, r.capacity / r.size, (r.capacity * 1_000_000) / r.size]
            : [(r.capacity * 1024 * 1024) / r.size, (r.capacity * 1000) / r.size, (r.capacity * 1000 * 1024) / r.size]
          refuses(b, wrong.filter((w) => w >= 1))
        }
      })

      it('spreads answers, capacities and sizes', () => {
        // The givens are drawn evenly first, so a count several pairs give (2 TB of 4 MB = 4 TB of 8 MB) runs a little high.
        expect(share(built, answer).worst).toBeLessThan(0.2)
        // Cards come in powers of two and the sizes that divide them are 2, 4, 5, 8 and 10 MB: 16 counts.
        expect(share(built, answer).distinct).toBeGreaterThanOrEqual(id === 'q8' ? 16 : 40)
        expect(share(built, (b) => read(b).capacity).distinct).toBeGreaterThanOrEqual(6)
        expect(share(built, (b) => read(b).size).distinct).toBeGreaterThanOrEqual(id === 'q8' ? 5 : 10)
        expect(share(built, (b) => read(b).noun).distinct).toBe(3)
        // The printed givens spread too: no capacity or size in more than a sixth (q8 has five sizes).
        // Seven card sizes and six TB drives: about a seventh and a sixth each, so the cap is looser there.
        expect(share(built, (b) => read(b).capacity).worst).toBeLessThan(id === 'q14' ? 1 / 6 : 0.25)
        expect(share(built, (b) => `${read(b).noun}/${read(b).size}`).worst).toBeLessThan(id === 'q8' ? 0.2 : 1 / 6)
      })
    })
  }

  it('prints the written working for 2 TB of 500 MB video files', () => {
    const b = Array.from({ length: 5000 }, (_, i) => generate(gen('cs-files-that-fit'), written('q21'), `lit-${i}`)).find((x) => x.values.capacityTB === 2 && x.values.sizeMB === 500 && x.values.item === 'video')!
    expect(b.question.solution).toBe(
      'TB and MB are two prefixes apart, so convert one step at a time: 2 TB is $2 \\times 1000 = 2000$ GB, and 2000 GB is $2000 \\times 1000 = 2\\,000\\,000$ MB. Then $2\\,000\\,000 \\div 500 = $ **4000** files. Converting only one step, to 2000 GB, and dividing that by 500 would give an answer a thousand times too small.',
    )
    expect(lines(b)).toEqual(['M1 converts 2 TB to 2 000 000 MB', 'A1 4000'])
  })

  it('prints literal working for a memory card', () => {
    const b = Array.from({ length: 5000 }, (_, i) => generate(gen('cs-files-that-fit'), written('q8'), `lit-${i}`)).find((x) => x.values.capacityGB === 64 && x.values.sizeMB === 4 && x.values.item === 'song')!
    expect(b.question.solution).toBe('Put both in the same unit: 64 GB is $64 \\times 1000 = 64\\,000$ MB. Then $64\\,000 \\div 4 = $ **16 000** songs.')
  })

  it('never puts 5 MB photos or 4 MB songs on a drive (the advanced sheet\'s q18), and q14 and q21 on one sheet hold different kinds of file', () => {
    for (const id of ['q14', 'q21']) {
      for (const b of build(id)) {
        const r = read(b)
        expect(r.noun === 'photos' && r.size === 5, b.seed).toBe(false)
        expect(r.noun === 'songs' && r.size === 4, b.seed).toBe(false)
        expect(b.question.prompt).not.toMatch(/phone/)
      }
    }
    const sheet = file.worksheets.advanced.questionIds.map((id: string) => written(id))
    for (let i = 0; i < 300; i++) {
      const got = sheetQuestions('computer-science', TOPIC, sheet, `sheet-${i}`)
      const items = got.filter((s) => s.generated?.generatorId === 'cs-files-that-fit').map((s) => s.generated!.values.item)
      expect(items).toHaveLength(2)
      expect(items[0]).not.toBe(items[1])
    }
  })
})
