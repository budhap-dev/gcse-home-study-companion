import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate, sheetQuestions } from '../index.ts'
import type { Generated } from '../types.ts'
import { OPERATIONS, operationsGenerators } from './operations.ts'

/**
 * Structural tests for the Topic 2.3 generators. Each reads the prompt's own figures back with
 * its own parsing and works the answer from them alone, sharing no code with the generator;
 * checks literal lines of the working and the mark scheme, the routing, the named wrong routes,
 * each context's ranges, the spread over builds, and what each sheet prints beside them.
 */
const TOPIC = 'making-operational-decisions'
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/business')
const json = JSON.parse(readFileSync(join(ROOT, `${TOPIC}.json`), 'utf8'))
const bank = Question.array().parse(json.questions)
const written = (id: string) => bank.find((q) => q.id === id)!
const sheet = (level: string) => (json.worksheets[level].questionIds as string[]).map(written)

function build(generatorId: string, slotId: string, count = 300, prefix = 'structure'): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  return Array.from({ length: count }, (_, i) => generate(g, written(slotId), `${prefix}-${i}`))
}

const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const lines = (b: Generated) => b.question.markScheme.map((l) => `${l.code} ${l.description}`)
const accepts = (b: Generated, typed: string) => mark(b.question, typed).correct
const p2 = (x: number) => x.toFixed(2)
const comma = (x: number) => String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
const texComma = (x: number) => comma(x).replace(/,/g, '{,}')
const money = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(2))
const read = (s: string) => Number(s.replace(/[£,\s]/g, ''))
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']

function share(built: Generated[], key: (b: Generated) => unknown) {
  const counts = new Map<unknown, number>()
  for (const b of built) counts.set(key(b), (counts.get(key(b)) ?? 0) + 1)
  return { worst: Math.max(...counts.values()) / built.length, distinct: counts.size }
}

const c0 = (b: Generated) => OPERATIONS.HOLDINGS.find((x) => x.name === b.values.context)!

const SLOTS: [string, string][] = [
  ['business-productivity-per-worker', 'q4'],
  ['business-stock-buffer', 'q6'],
  ['business-stock-delivery', 'q10'],
  ['business-stock-reorder-level', 'q24'],
  ['business-productivity-increase', 'q25'],
  ['business-flow-unit-cost', 'q26'],
]

describe('every 2.3 build', () => {
  it('cites the specification, with productivity as an Appendix 2 skill and no stock formula claimed', () => {
    const header = readFileSync(join(import.meta.dirname, 'operations.ts'), 'utf8').split('const TOPIC')[0]!
    expect(header).toContain('2.3.1 production processes')
    expect(header).toContain('2.3.2 managing stock, interpretation of bar gate stock graphs')
    expect(header).toContain('output ÷ workers (Appendix 2 "averages"')
    expect(header).toContain('The specification gives no stock formulae')
    expect(header).not.toMatch(/Appendix 3 (?:productivity|stock|buffer|reorder)/)
  })

  it('has one generator for each numeric written slot', () => {
    expect(operationsGenerators.flatMap((g) => g.replaces).sort()).toEqual(bank.filter((q) => q.type === 'numeric').map((q) => q.id).sort())
    for (const [id, slot] of SLOTS) expect(operationsGenerators.find((g) => g.id === id)!.replaces).toEqual([slot])
    for (const g of operationsGenerators) expect(g.subjectId).toBe('business')
  })

  it('keeps each slot\'s units, exact tolerance and mark-scheme codes, prints no article before a figure, and never fails to draw over 3000 seeds', () => {
    for (const [gid, id] of SLOTS) {
      const g = GENERATORS.find((x) => x.id === gid)!
      const slot = written(id)
      for (let i = 0; i < 3000; i++) {
        const b = generate(g, slot, `throw-${i}`)
        if (i >= 300) continue
        const q = b.question
        if (q.type !== 'numeric' || slot.type !== 'numeric') throw new Error('not numeric')
        expect(q.units).toBe(slot.units)
        expect(q.tolerance).toBe(0)
        expect(q.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
        expect(q.markScheme.map((l) => l.code)).toEqual(slot.markScheme.map((l) => l.code))
        expect(b.check.agrees, b.seed).toBe(true)
        expect(accepts(b, String(q.answer + 1))).toBe(false)
      }
    }
  })

  it('repeats no prompt in a tenth of 1000 builds and the written one in at most a twentieth', () => {
    for (const [gid, id] of SLOTS) {
      const built = build(gid, id, 1000, 'release')
      const counts = new Map<string, number>()
      for (const b of built) counts.set(b.question.prompt, (counts.get(b.question.prompt) ?? 0) + 1)
      expect(Math.max(...counts.values()), id).toBeLessThanOrEqual(50)
      expect(counts.get(written(id).prompt) ?? 0).toBeLessThanOrEqual(50)
    }
  })
})

describe('q4: productivity per worker', () => {
  it('reads the team and output back and divides; small enough to do by hand', () => {
    for (const b of build('business-productivity-per-worker', 'q4')) {
      const p = b.question.prompt
      const first = p.split(' ')[0]!.toLowerCase()
      const digits = [...p.matchAll(/\d+/g)].map((m) => Number(m[0]))
      const [w, out] = NUMBER_WORDS.includes(first) ? [NUMBER_WORDS.indexOf(first), digits[0]!] : (digits as [number, number])
      const per = out / w
      expect(answer(b), b.seed).toBe(per)
      expect(Number.isInteger(per)).toBe(true)
      expect(w).not.toBe(per)
      expect([1, 10]).not.toContain(w)
      expect(out).toBeLessThanOrEqual(OPERATIONS.MAX_OUTPUT)
      const t = OPERATIONS.TEAMS.find((x) => x.name === b.values.context)!
      expect(per >= t.each[0] && per <= t.each[1] && w >= t.size[0] && w <= t.size[1]).toBe(true)
      expect(p).toContain(` ${t.verb} ${out} ${t.items}`)
      expect(b.question.solution).toContain(`$${out} \\div ${w} = $ **${per}** ${t.items} per worker per ${t.per}.`)
      expect(lines(b)).toEqual([`M1 divides output by workers: $${out} \\div ${w}$`, `A1 ${per}`])
      // Wrong routes: multiplied; divided the wrong way; the team taken from the output.
      for (const wrong of [out * w, w / out, out - w]) {
        expect(wrong, b.seed).not.toBe(per)
        expect(accepts(b, String(wrong))).toBe(false)
      }
      // The marker strips a trailing unit word up to a hyphen, so "38 T-shirts" is not read: only
      // unhyphenated items are typed with their word here (reported, marking.ts is not this file's).
      for (const typed of [String(per), ...(t.items.includes('-') ? [] : [`${per} ${t.items}`])]) expect(accepts(b, typed), typed).toBe(true)
    }
  })

  it('spreads answers, teams and contexts', () => {
    const many = build('business-productivity-per-worker', 'q4', 1000)
    expect(share(many, answer).worst).toBeLessThanOrEqual(0.1)
    expect(share(many, answer).distinct).toBeGreaterThanOrEqual(30)
    for (const k of ['workers', 'output', 'context']) expect(share(many, (b) => b.values[k]).worst, k).toBeLessThanOrEqual(0.2)
    expect(share(many, (b) => b.values.context).distinct).toBe(OPERATIONS.TEAMS.length)
    // No one calculation over a sixth of builds.
    expect(share(many, (b) => `${b.values.output}/${b.values.workers}`).worst).toBeLessThanOrEqual(1 / 6)
  })
})

describe('bar gate stock', () => {
  it('q6: the buffer is the reorder level less the lead time\'s usage, never the reorder level less one period\'s', () => {
    for (const b of build('business-stock-buffer', 'q6')) {
      const p = b.question.prompt
      const m1 = /reorders at (\d+) [a-z ]+, uses (\d+) a (day|week), and the supplier takes (\d+) (?:days|weeks)\./.exec(p)
      const m2 = /uses (\d+) [a-z ]+ a (day|week)\. It reorders when its stock falls to (\d+) [a-z]+, and each delivery arrives (\d+) (?:days|weeks) after the order\./.exec(p)
      const [R, u, L] = m1 ? [Number(m1[1]), Number(m1[2]), Number(m1[4])] : [Number(m2![3]), Number(m2![1]), Number(m2![4])]
      const B = R - u * L
      expect(answer(b), b.seed).toBe(B)
      expect(B).toBeGreaterThan(0)
      expect(L).toBeGreaterThanOrEqual(2)
      // The written question's coincidences never: buffer equal to usage, to the lead time's usage.
      expect(new Set([u, L, B, u * L]).size).toBe(4)
      const c = OPERATIONS.BUFFERS.find((x) => x.name === b.values.context)!
      expect(u >= c.usage[0] && u <= c.usage[1] && B >= c.buffer[0] && B <= c.buffer[1] && L >= c.lead[0] && L <= c.lead[1]).toBe(true)
      expect(p).not.toMatch(/kilogram/)
      // Tyres arrive within days: a lead time in weeks was out of scale.
      if (c.name === 'tyres') expect(c.per).toBe('day')
      expect(b.question.solution).toContain(`It uses $${u} \\times ${L} = ${u * L}$ ${c.unit} during the lead time, so stock falls from ${R} to **${B}**.`)
      expect(lines(b)).toEqual([`M1 usage × lead time: $${u} \\times ${L} = ${u * L}$`, `A1 ${B}`])
      // Wrong routes: one period's usage; usage added; the lead time's usage itself; half the reorder level.
      for (const wrong of [R - u, R + u * L, u * L, R / 2]) {
        expect(wrong, b.seed).not.toBe(B)
        expect(accepts(b, String(wrong))).toBe(false)
      }
      expect(accepts(b, `${B} ${c.unit}`)).toBe(true)
    }
  })

  it('q10: each delivery is the maximum less the buffer', () => {
    for (const b of build('business-stock-delivery', 'q10')) {
      const p = b.question.prompt
      const m1 = /maximum of (\d+) [a-z ]+ and its buffer stock is (\d+) /.exec(p)
      const m2 = /buffer stock of (\d+) [a-z ]+ and holds at most (\d+) /.exec(p)
      const [M, B] = m1 ? [Number(m1[1]), Number(m1[2])] : [Number(m2![2]), Number(m2![1])]
      const D = M - B
      expect(answer(b), b.seed).toBe(D)
      expect(B >= 0.1 * M && B <= 0.4 * M).toBe(true)
      expect(B % (c0(b).max[2] >= 50 ? 25 : 10)).toBe(0)
      expect(D).not.toBe(B)
      const c = OPERATIONS.HOLDINGS.find((x) => x.name === b.values.context)!
      expect(M >= c.max[0] && M <= c.max[1] && M % c.max[2] === 0).toBe(true)
      expect(b.question.solution).toContain(`$${M} - ${B} = $ **${D}** ${c.unit}.`)
      expect(lines(b)).toEqual([`M1 maximum minus buffer: $${M} - ${B}$`, `A1 ${D}`])
      for (const wrong of [M + B, M, B]) expect(accepts(b, String(wrong))).toBe(false)
    }
  })

  it('q24: the reorder level is the buffer plus the lead time\'s usage, in kilograms', () => {
    for (const b of build('business-stock-reorder-level', 'q24')) {
      const p = b.question.prompt
      const m1 = /uses (\d+) kilograms of [a-z ]+ a (day|week)\. Its supplier takes (\d+) (?:days|weeks) to deliver, and the [a-z ]+ keeps a buffer stock of (\d+) kilograms\./.exec(p)
      const m2 = /keeps a buffer stock of (\d+) kilograms of [a-z ]+ and uses (\d+) kilograms a (day|week)\. Each delivery arrives (\d+) (?:days|weeks) after it is ordered\./.exec(p)
      const [u, L, B] = m1 ? [Number(m1[1]), Number(m1[3]), Number(m1[4])] : [Number(m2![2]), Number(m2![4]), Number(m2![1])]
      const R = B + u * L
      expect(answer(b), b.seed).toBe(R)
      expect(L).toBeGreaterThanOrEqual(2)
      expect(new Set([u, L, B, u * L]).size).toBe(4)
      const c = OPERATIONS.REORDERS.find((x) => x.name === b.values.context)!
      expect(u >= c.usage[0] && u <= c.usage[1] && B >= c.buffer[0] && B <= c.buffer[1]).toBe(true)
      expect(p).toMatch(/Calculate the stock level, in kilograms, at which the [a-z ]+ should reorder\.$/)
      expect(b.question.solution).toContain(`uses $${u} \\times ${L} = ${u * L}$ kg.`)
      expect(b.question.solution).toContain(`$= ${B} + ${u * L} = ${R}$ kg.`)
      expect(lines(b)).toEqual([`M1 $${u} \\times ${L} = ${u * L}$ kg used while waiting for the delivery`, `A1 ${R} kg`])
      // Wrong routes: one period's usage; the lead time's usage alone; buffer and usage added then
      // multiplied; the buffer taken away.
      for (const wrong of [B + u, u * L, (B + u) * L, u * L - B]) {
        expect(wrong, b.seed).not.toBe(R)
        expect(accepts(b, String(wrong))).toBe(false)
      }
      for (const typed of [String(R), `${R} kg`, `${R}kg`]) expect(accepts(b, typed), typed).toBe(true)
    }
  })

  it('spreads each slot\'s answers and inputs', () => {
    for (const [gid, id, keys] of [
      ['business-stock-buffer', 'q6', ['reorder', 'usage', 'lead', 'buffer', 'context']],
      ['business-stock-delivery', 'q10', ['max', 'buffer', 'context', 'delivery']],
      ['business-stock-reorder-level', 'q24', ['usage', 'lead', 'buffer', 'context']],
    ] as const) {
      const many = build(gid, id, 1000)
      expect(share(many, answer).worst, id).toBeLessThanOrEqual(0.1)
      expect(share(many, answer).distinct, id).toBeGreaterThanOrEqual(30)
      for (const k of keys) expect(share(many, (b) => b.values[k]).worst, `${id} ${k}`).toBeLessThanOrEqual(k === 'lead' ? 0.5 : 0.25)
      // The q10 buffer stepped like the maximum sat at 100 (the written's own) in 19% of builds.
      if (id === 'q10') expect(share(many, (b) => b.values.buffer).worst).toBeLessThanOrEqual(0.12)
    }
  })

  it('never prints the same stock twice on the higher sheet: the three lists share nothing', () => {
    const lists = [OPERATIONS.BUFFERS, OPERATIONS.HOLDINGS, OPERATIONS.REORDERS]
    for (const key of ['name', 'thing'] as const) {
      const all = lists.flatMap((l) => l.map((c) => c[key]))
      expect(new Set(all).size, key).toBe(all.length)
    }
    for (const c of OPERATIONS.REORDERS) expect(c.thing).toMatch(/^kilograms of /)
    const higher = sheet('higher')
    for (let i = 0; i < 200; i++) {
      const s = sheetQuestions('business', TOPIC, higher, `sheet-${i}`)
      const stock = ['q6', 'q10', 'q24'].map((id) => s.find((x) => x.question.id === id)!)
      for (const x of stock) expect(x.generated).toBeDefined()
      expect(new Set(stock.map((x) => x.generated!.values.context)).size).toBe(3)
    }
  })
})

describe('q25: percentage increase in productivity', () => {
  it('reads the team and both outputs back, divides the rise per worker by the old', () => {
    for (const b of build('business-productivity-increase', 'q25')) {
      const p = b.question.prompt
      const [w, out1, w2, out2] = [...p.matchAll(/\d+/g)].map((m) => Number(m[0])) as [number, number, number, number]
      expect(w2).toBe(w)
      const b1 = out1 / w
      const b2 = out2 / w
      expect(Number.isInteger(b1) && Number.isInteger(b2)).toBe(true)
      const pct = ((b2 - b1) * 100) / b1
      expect(answer(b), b.seed).toBe(pct)
      expect(OPERATIONS.PRODUCTIVITY_RISES).toContain(pct)
      expect(w).not.toBe(10)
      const u = OPERATIONS.UPGRADES.find((x) => x.name === b.values.context)!
      expect(b1 >= u.each[0] && b1 <= u.each[1] && w >= u.size[0] && w <= u.size[1]).toBe(true)
      expect(p).toContain(`the same ${w} ${u.workers} ${u.do} ${out2} ${u.items}`)
      const s = b.question.solution
      expect(s).toContain(`Before: $${out1} \\div ${w} = ${b1}$ ${u.items} a ${u.per} each. After: $${out2} \\div ${w} = ${b2}$ ${u.items}.`)
      expect(s).toContain(`The increase is $${b2 - b1} \\div ${b1} \\times 100 = ${pct}\\%$.`)
      expect(s).toContain(`$${out2 - out1} \\div ${out1} \\times 100 = ${pct}\\%$`)
      expect(lines(b)).toEqual([`M1 $${out1} \\div ${w} = ${b1}$ and $${out2} \\div ${w} = ${b2}$, or $${out2 - out1} \\div ${out1}$`, `A1 ${pct}%`])
      // Wrong routes, rounded as typed: over the new figure; the new as a percentage of the old;
      // the rise per worker; the rise in output.
      const overNew = ((b2 - b1) / b2) * 100
      for (const wrong of [Math.round(overNew), Math.round(overNew * 10) / 10, (b2 / b1) * 100, b2 - b1, out2 - out1]) {
        expect(wrong, b.seed).not.toBe(pct)
        expect(accepts(b, String(wrong))).toBe(false)
      }
      for (const f of [w, b1, b2, b2 - b1, out1, out2, out2 - out1]) for (const k of [1, 10, 100, 1000]) expect(f / k).not.toBe(pct)
      for (const typed of [String(pct), `${pct}%`]) expect(accepts(b, typed), typed).toBe(true)
    }
  })

  it('spreads answers, teams and contexts', () => {
    const many = build('business-productivity-increase', 'q25', 1000)
    expect(share(many, answer).worst).toBeLessThanOrEqual(0.12)
    expect(share(many, answer).distinct).toBe(OPERATIONS.PRODUCTIVITY_RISES.length)
    for (const k of ['workers', 'before', 'context']) expect(share(many, (b) => b.values[k]).worst, k).toBeLessThanOrEqual(0.2)
    // Output per worker from a filtered list: 75 took 18% of builds before the range was widened.
    expect(share(many, (b) => b.values.perWorker).worst).toBeLessThanOrEqual(0.1)
    expect(share(many, (b) => b.values.context).distinct).toBe(OPERATIONS.UPGRADES.length)
    // A call-centre worker handles at most about 100 calls a day before the software.
    for (const b of many.filter((x) => x.values.context === 'call centre')) expect(Number(b.values.perWorker)).toBeLessThanOrEqual(100)
  })
})

describe('q26: fall in cost per unit with a flow line', () => {
  it('reads output and both sets of costs back and finds each cost per unit to the penny', () => {
    for (const b of build('business-flow-unit-cost', 'q26')) {
      const p = b.question.prompt
      const Q = read(/(?:makes|fills) ([\d,]+) /.exec(p)![1]!)
      const F1 = read(/fixed costs (?:are|of) (£[\d,]+)/.exec(p)![1]!)
      const V1 = read(/variable costs (?:are|of) (£[\d.]+)/.exec(p)![1]!)
      const F2 = read(/raise fixed costs to (£[\d,]+)/.exec(p)![1]!)
      const V2 = read(/cut variable costs to (£[\d.]+)/.exec(p)![1]!)
      const t1 = Math.round(F1 + V1 * Q)
      const t2 = Math.round(F2 + V2 * Q)
      const u1p = (t1 * 100) / Q
      const u2p = (t2 * 100) / Q
      expect(Number.isInteger(u1p) && Number.isInteger(u2p)).toBe(true)
      const fall = (u1p - u2p) / 100
      expect(answer(b), b.seed).toBeCloseTo(fall, 9)
      expect(Math.round(answer(b) * 100)).toBe(u1p - u2p)
      // A real trade-off: fixed costs up 1.2 to 3 times, variable cost cut by 20% to 60%.
      expect(F2 / F1 >= 1.2 && F2 / F1 <= 3 && F1 % 1000 === 0 && F2 % 100 === 0).toBe(true)
      expect(V2 / V1 >= 0.4 - 1e-9 && V2 / V1 <= 0.8 + 1e-9).toBe(true)
      expect(fall).toBeGreaterThanOrEqual(0.03)
      expect(p).not.toMatch(/bakery|loaves|bread/i)
      const c = OPERATIONS.PLANTS.find((x) => x.name === b.values.context)!
      expect(c.outputs).toContain(Q)
      expect(F1 >= c.fixed[0] && F1 <= c.fixed[1] && V1 >= c.variable[0] && V1 <= c.variable[1]).toBe(true)
      const s = b.question.solution
      expect(s).toContain(`Now: $${texComma(F1)} + ${money(V1)} \\times ${texComma(Q)} = £${texComma(t1)}$, so the cost per ${c.item} is $${texComma(t1)} \\div ${texComma(Q)} = £${p2(u1p / 100)}$.`)
      expect(s).toContain(`With the line: $${texComma(F2)} + ${money(V2)} \\times ${texComma(Q)} = £${texComma(t2)}$, so $${texComma(t2)} \\div ${texComma(Q)} = £${p2(u2p / 100)}$.`)
      expect(s).toContain(`The fall is $${p2(u1p / 100)} - ${p2(u2p / 100)} = £${p2(fall)}$ a ${c.item}.`)
      expect(lines(b)).toEqual([
        `M1 $${texComma(F1)} + ${texComma(Math.round(V1 * Q))} = ${texComma(t1)}$, so £${p2(u1p / 100)} a ${c.item}`,
        `M1 $${texComma(F2)} + ${texComma(Math.round(V2 * Q))} = ${texComma(t2)}$, so £${p2(u2p / 100)} a ${c.item}`,
        `A1 £${p2(fall)}`,
      ])
      // Wrong routes: the cut in variable cost alone; the rise in fixed cost per unit; the weekly
      // saving in total cost; either cost per unit.
      for (const wrong of [V1 - V2, (F2 - F1) / Q, t1 - t2, u1p / 100, u2p / 100, V1, V2]) {
        expect(Math.abs(wrong - fall), `${b.seed}: ${wrong}`).toBeGreaterThan(0.005)
        expect(accepts(b, p2(wrong))).toBe(false)
      }
      for (const typed of [String(fall), p2(fall), `£${p2(fall)}`]) expect(accepts(b, typed), typed).toBe(true)
    }
  })

  it('spreads answers, outputs, costs and plants', () => {
    const many = build('business-flow-unit-cost', 'q26', 1000)
    expect(share(many, answer).worst).toBeLessThanOrEqual(0.1)
    expect(share(many, answer).distinct).toBeGreaterThanOrEqual(50)
    for (const k of ['output', 'fixedBefore', 'fixedAfter', 'variableBefore', 'context']) expect(share(many, (b) => b.values[k]).worst, k).toBeLessThanOrEqual(0.25)
    expect(share(many, (b) => b.values.context).distinct).toBe(OPERATIONS.PLANTS.length)
    for (const c of OPERATIONS.PLANTS) {
      const group = many.filter((b) => b.values.context === c.name)
      expect(share(group, answer).distinct, c.name).toBeGreaterThanOrEqual(10)
      // Per plant, no fall in more than about one build in seven (the bottling plant sat at 5p in 28%).
      expect(share(group, answer).worst, c.name).toBeLessThanOrEqual(0.15)
      for (const b of group) {
        const f = Math.round(answer(b) * 100)
        expect(f >= c.fall[0] && f <= c.fall[1], `${c.name} ${f}`).toBe(true)
      }
    }
  })
})
