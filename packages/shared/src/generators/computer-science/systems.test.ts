import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import { systemsGenerators } from './systems.ts'

/**
 * Structural tests for the systems architecture generators: clock cycles (the-cpu-and-memory q5)
 * and copy time (secondary-storage q6). Each reads the prompt's figures back, works the answer
 * with its own arithmetic, checks literal and printed lines, that each device stays at the speeds
 * it really has, that the named wrong routes are marked wrong, and the spread.
 */
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/computer-science')
const bankOf = (topic: string) => Question.array().parse(JSON.parse(readFileSync(join(ROOT, `${topic}.json`), 'utf8')).questions)
const CPU = bankOf('the-cpu-and-memory')
const STORAGE = bankOf('secondary-storage')
const clockSlot = CPU.find((q) => q.id === 'q5')!
const copySlot = STORAGE.find((q) => q.id === 'q6')!

const gen = (id: string) => GENERATORS.find((x) => x.id === id)!
const build = (id: string, slot: Question, n = 300, prefix = 'structure') => Array.from({ length: n }, (_, i) => generate(gen(id), slot, `${prefix}-${i}`))
const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const lines = (b: Generated) => b.question.markScheme.map((l) => `${l.code} ${l.description}`)
const spaced = (x: number) => (x >= 10000 ? String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : String(x))
const commas = (x: number) => String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
const thin = (x: number) => spaced(x).replace(/ /g, '\\,')

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

describe('both systems builds', () => {
  it('stand in for the one numeric slot of each topic', () => {
    expect(systemsGenerators.map((g) => `${g.topicId}/${g.replaces.join(',')}`).sort()).toEqual(['secondary-storage/q6', 'the-cpu-and-memory/q5'])
    expect(CPU.filter((q) => q.type === 'numeric').map((q) => q.id)).toEqual(['q5'])
    expect(STORAGE.filter((q) => q.type === 'numeric').map((q) => q.id)).toEqual(['q6'])
  })

  for (const [id, slot] of [['cs-clock-cycles', clockSlot], ['cs-copy-time', copySlot]] as const) {
    it(`${id}: keeps no units, exact tolerance and the written codes, is marked right typed plain and grouped, and never fails to draw over 3000 seeds`, () => {
      for (let i = 0; i < 3000; i++) {
        const b = generate(gen(id), slot, `throw-${i}`)
        if (i >= 300) continue
        const q = b.question
        if (q.type !== 'numeric') throw new Error('not numeric')
        expect(q.units).toBeUndefined()
        expect(q.tolerance).toBe(0)
        expect(Number.isInteger(q.answer)).toBe(true)
        expect(q.markScheme.map((l) => l.code)).toEqual(slot.markScheme.map((l) => l.code))
        expect(b.check.agrees, b.seed).toBe(true)
        expect(q.prompt, b.seed).not.toMatch(/\ba 8|\ban [1-79]/i)
        for (const t of [String(q.answer), spaced(q.answer), commas(q.answer)]) expect(mark(q, t).correct, `${b.seed}: ${t}`).toBe(true)
        expect(mark(q, String(q.answer + 1)).correct).toBe(false)
      }
    })

    it(`${id}: repeats no prompt in a tenth of 1000 builds, and the written one in at most a twentieth`, () => {
      const counts = new Map<string, number>()
      for (const b of build(id, slot, 1000, 'release')) counts.set(b.question.prompt, (counts.get(b.question.prompt) ?? 0) + 1)
      expect(counts.size).toBeGreaterThan(100)
      expect(Math.max(...counts.values())).toBeLessThanOrEqual(50)
      expect(counts.get(slot.prompt) ?? 0).toBeLessThanOrEqual(10)
    })
  }
})

describe('the-cpu-and-memory q5: clock cycles', () => {
  const built = build('cs-clock-cycles', clockSlot)
  /** Speeds each device really runs at, in GHz. */
  const RANGE: Record<string, [number, number]> = {
    'A processor': [1.1, 5],
    "A laptop's processor": [1.2, 5],
    "A desktop computer's CPU": [2.5, 5],
    "A smartphone's processor": [1.5, 3.5],
    "A tablet's processor": [1.5, 3.5],
    "A games console's processor": [1.6, 3.8],
    'The processor in a home router': [0.4, 0.9],
    'The processor in a digital camera': [0.4, 0.9],
    "An older phone's processor": [0.4, 0.9],
    'The processor in a smart speaker': [0.4, 0.9],
  }
  const read = (b: Generated) => {
    const m = /^(.+?) (?:has|runs at) a clock speed of ([\d.]+) (GHz|MHz)\./.exec(b.question.prompt)!
    return { who: m[1]!, figure: m[2]!, unit: m[3] as 'GHz' | 'MHz', ghz: m[3] === 'GHz' ? Number(m[2]) : Number(m[2]) / 1000 }
  }

  it('answers the speed times a thousand million (GHz) or a million (MHz), each device at a speed it runs at', () => {
    for (const b of built) {
      const r = read(b)
      expect(answer(b), b.seed).toBe(Math.round(Number(r.figure) * (r.unit === 'GHz' ? 1e9 : 1e6)))
      const [lo, hi] = RANGE[r.who]!
      expect(r.ghz, `${b.seed} ${r.who}`).toBeGreaterThanOrEqual(lo)
      expect(r.ghz, `${b.seed} ${r.who}`).toBeLessThanOrEqual(hi)
      expect(r.ghz).not.toBe(1)
      expect(b.question.prompt).toContain('in full')
    }
  })

  it('prints the prefix and the multiplication', () => {
    for (const b of built) {
      const r = read(b)
      const per = r.unit === 'GHz' ? 1e9 : 1e6
      expect(b.question.solution, b.seed).toBe(`${r.unit === 'GHz' ? 'Giga means a thousand million' : 'Mega means a million'}, so $${r.figure} \\times ${thin(per)} = $ **${spaced(answer(b))}** cycles per second.`)
      expect(lines(b)).toEqual([`M1 uses 1 ${r.unit} = ${spaced(per)}`, `A1 ${spaced(answer(b))}`])
    }
  })

  it('prints literal working', () => {
    const all = build('cs-clock-cycles', clockSlot, 3000, 'lit')
    const three = all.find((b) => b.values.speed === '3' && b.values.unit === 'GHz')!
    expect(three.question.solution).toBe(clockSlot.solution)
    expect(lines(three)).toEqual(['M1 uses 1 GHz = 1 000 000 000', 'A1 3 000 000 000'])
    const mhz = all.find((b) => b.values.speed === '650' && b.values.unit === 'MHz')!
    expect(mhz.question.solution).toBe('Mega means a million, so $650 \\times 1\\,000\\,000 = $ **650 000 000** cycles per second.')
  })

  it('refuses the wrong prefix, 1024s, and the speed itself', () => {
    for (const b of built) {
      const r = read(b)
      const x = Number(r.figure)
      refuses(b, r.unit === 'GHz' ? [x * 1e6, x * 1e12, x * 1024 ** 3, x * 1e3, x] : [x * 1e9, x * 1e3, x * 1024 ** 2, x])
    }
  })

  it('spreads speeds, devices and both units', () => {
    expect(share(built, answer).worst).toBeLessThan(0.1)
    expect(share(built, answer).distinct).toBeGreaterThan(40)
    expect(share(built, (b) => read(b).who).distinct).toBe(10)
    const units = built.filter((b) => read(b).unit === 'MHz').length / built.length
    expect(units).toBeGreaterThan(0.15)
    expect(units).toBeLessThan(0.35)
  })
})

describe('secondary-storage q6: copy time', () => {
  const built = build('cs-copy-time', copySlot)
  const RATES: Record<string, [number, number]> = { 'a drive': [20, 400], 'a USB stick': [20, 400], 'an external hard disk': [80, 250], 'an SSD': [200, 3500] }
  const SIZES: Record<string, [number, number]> = { file: [1, 8], video: [1, 4], film: [1, 8], 'backup file': [1, 8], game: [20, 150] }
  const read = (b: Generated) => {
    const p = b.question.prompt
    const g = /([\d.]+) GB (backup file|file|video|film|game)\b/.exec(p)!
    const rate = Number(/(\d+) MB\/s/.exec(p)![1])
    const device = /(a drive|a USB stick|an external hard disk|an SSD)/i.exec(p)![1]!.replace(/^A/, 'a')
    return { gb: Number(g[1]), kind: g[2]!, rate, device }
  }

  it('answers the size in MB over the rate, a whole number of seconds, at rates and sizes the device and file have', () => {
    for (const b of built) {
      const r = read(b)
      expect(answer(b), b.seed).toBe((r.gb * 1000) / r.rate)
      expect(b.question.prompt).toContain('(1 GB = 1000 MB)')
      const [lo, hi] = RATES[r.device]!
      expect(r.rate, `${b.seed} ${r.device}`).toBeGreaterThanOrEqual(lo)
      expect(r.rate, `${b.seed} ${r.device}`).toBeLessThanOrEqual(hi)
      const [a, z] = SIZES[r.kind]!
      expect(r.gb).toBeGreaterThanOrEqual(a)
      expect(r.gb).toBeLessThanOrEqual(z)
      expect((r.gb * 2) % 1).toBe(0)
      expect([r.gb, r.rate, r.gb * 1000, r.gb * 10]).not.toContain(answer(b))
      expect(answer(b)).toBeGreaterThanOrEqual(21)
      expect(answer(b)).toBeLessThanOrEqual(400)
    }
  })

  it('prints the conversion and the division', () => {
    for (const b of built) {
      const r = read(b)
      const mb = r.gb * 1000
      expect(b.question.solution, b.seed).toBe(`$${r.gb} \\times 1000 = ${thin(mb)}$ MB, and $${thin(mb)} \\div ${r.rate} = $ **${answer(b)}** seconds.`)
      expect(lines(b)).toEqual([`M1 converts to ${spaced(mb)} MB`, `A1 ${answer(b)}`])
    }
  })

  it('prints literal working', () => {
    const all = build('cs-copy-time', copySlot, 5000, 'lit')
    const b = all.find((x) => x.values.sizeGB === '3.5' && x.values.rateMBs === 125)!
    expect(b.question.solution).toBe('$3.5 \\times 1000 = 3500$ MB, and $3500 \\div 125 = $ **28** seconds.')
    expect(lines(b)).toEqual(['M1 converts to 3500 MB', 'A1 28'])
    const game = all.find((x) => x.values.sizeGB === '45' && x.values.rateMBs === 1500)!
    expect(game.question.solution).toBe('$45 \\times 1000 = 45\\,000$ MB, and $45\\,000 \\div 1500 = $ **30** seconds.')
    expect(lines(game)).toEqual(['M1 converts to 45 000 MB', 'A1 30'])
  })

  it('refuses 1024 for 1000, no conversion, the wrong prefix and the division the wrong way up', () => {
    for (const b of built) {
      const r = read(b)
      refuses(b, [(r.gb * 1024) / r.rate, r.gb / r.rate, (r.gb * 100) / r.rate, r.rate / r.gb, (r.gb * 1e6) / r.rate].filter((w) => w >= 1))
    }
  })

  it('spreads answers, devices, kinds and rates', () => {
    expect(share(built, answer).worst).toBeLessThan(0.1)
    expect(share(built, answer).distinct).toBeGreaterThan(30)
    expect(share(built, (b) => read(b).device).distinct).toBe(4)
    expect(share(built, (b) => read(b).kind).distinct).toBe(5)
    expect(share(built, (b) => read(b).rate).distinct).toBeGreaterThan(15)
  })

  it('spreads the printed rate within each device, and every SSD rate turns up', () => {
    const many = build('cs-copy-time', copySlot, 2000, 'rates')
    for (const device of Object.keys(RATES)) {
      const mine = many.filter((b) => read(b).device === device)
      expect(share(mine, (b) => read(b).rate).worst, device).toBeLessThan(0.3)
    }
    const ssd = new Set(many.filter((b) => read(b).device === 'an SSD').map((b) => read(b).rate))
    expect([...ssd].sort((a, b) => a - b)).toEqual([200, 250, 400, 500, 800, 1200, 1250, 1500, 2000, 2500, 3000, 3500])
  })
})
