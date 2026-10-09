import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { show } from '../format.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import { dpTolerance } from './format.ts'

/**
 * Structural tests for the pressure-in-fluids generators. The release check proves each
 * answer agrees with a second route; these read the prompt's own numbers and the working
 * printed on the way and check each step is the right one (generator-helpers-need-structural-
 * tests), the constants the topic uses (water 1000, sea water 1030, atmosphere 101 000), and
 * across a run of builds that the contexts rotate and no value carries the slot.
 */
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/physics')
const bank = Question.array().parse(JSON.parse(readFileSync(join(ROOT, 'pressure-in-fluids.json'), 'utf8')).questions)

function build(generatorId: string, slotId: string, count = 300): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  expect(g.topicId).toBe('pressure-in-fluids')
  const slot = bank.find((q) => q.id === slotId)!
  return Array.from({ length: count }, (_, i) => generate(g, slot, `structure-${i}`))
}

const clean = (x: number) => Number(x.toPrecision(12))
const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const units = (b: Generated) => (b.question.type === 'numeric' ? b.question.units : 'not numeric')
const tolerance = (b: Generated) => (b.question.type === 'numeric' ? b.question.tolerance : NaN)
const method = (b: Generated, i: number) => b.question.markScheme[i]!.description
const last = (b: Generated) => b.question.markScheme.at(-1)!.description
const values = (b: Generated) => b.values as Record<string, number>
const tex = (x: number) => (Math.abs(x) >= 10000 ? show(x).replace(/\B(?=(\d{3})+(?!\d))/g, '\\,') : show(x))
const prose = (x: number) => (Math.abs(x) >= 10000 ? show(x).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : show(x))
const ends = (expr: string, answer: number, unit: string) => (answer < 10000 ? `${expr} = ${show(answer)}$ ${unit}` : `${expr}$, which is **${answer} ${unit}**`)
const contexts = (built: Generated[]) => new Set(built.map((b) => b.values.context)).size
const powerOfTen = (x: number) => Math.abs(Math.log10(x) - Math.round(Math.log10(x))) < 1e-9
function common(b: Generated, unit: string | undefined) {
  expect(b.question.prompt, b.seed).not.toMatch(/\ba \d/)
  expect(units(b)).toBe(unit)
  expect(tolerance(b)).toBe(dpTolerance(answer(b)))
}
/** The density a prompt states, which must be the one the working uses. */
const stated = (prompt: string) => (/1030\$? kg\/m³/.test(prompt) ? 1030 : /1000\$? kg\/m³/.test(prompt) ? 1000 : NaN)

describe('p = F ÷ A', () => {
  it('divides the force by the area to a whole number of pascals; q1 a force acting, q3 a weight resting', () => {
    for (const slotId of ['q1', 'q3']) {
      const built = build('pressure-from-force-and-area', slotId)
      for (const b of built) {
        const { F, A } = values(b)
        common(b, 'Pa')
        expect(b.question.prompt, b.seed).toContain(`${prose(F!)} N`)
        expect(b.question.prompt).toContain(`${show(A!)} m²`)
        expect(powerOfTen(A!)).toBe(false)
        expect([0.5, 2]).not.toContain(A)
        expect(answer(b)).toBe(clean(F! / A!))
        expect(Number.isInteger(answer(b))).toBe(true)
        expect(powerOfTen(answer(b))).toBe(false)
        expect(answer(b)).not.toBe(F)
        expect(b.question.solution).toContain(ends(`p = \\dfrac{F}{A} = \\dfrac{${tex(F!)}}{${show(A!)}}`, answer(b), 'Pa'))
        expect(method(b, 0)).toBe(`$${tex(F!)} \\div ${show(A!)}$`)
        expect(b.question.prompt.includes('weighing')).toBe(slotId === 'q3')
        if (b.values.context === 'car') expect(answer(b) >= 150000 && answer(b) <= 250000).toBe(true)
      }
      expect(contexts(built)).toBe(slotId === 'q1' ? 5 : 6)
    }
  })

  it('rearranges to F = pA and multiplies', () => {
    const built = build('force-from-pressure-and-area', 'q6')
    for (const b of built) {
      const { p, A } = values(b)
      common(b, 'N')
      expect(b.question.prompt, b.seed).toContain(`${prose(p!)} Pa`)
      expect(b.question.prompt).toContain(`${show(A!)} m²`)
      expect(answer(b)).toBe(clean(p! * A!))
      expect(powerOfTen(answer(b))).toBe(false)
      expect(powerOfTen(p!)).toBe(false)
      expect([0.5, 2]).not.toContain(A)
      expect(Number.isInteger(answer(b))).toBe(true)
      expect(powerOfTen(A!)).toBe(false)
      expect(b.question.solution).toContain('Rearrange $p = \\dfrac{F}{A}$ to ')
      expect(b.question.solution).toContain(ends(`F = p A = ${tex(p!)} \\times ${show(A!)}`, answer(b), 'N'))
      expect(method(b, 0)).toBe('$F = p A$')
      expect(method(b, 1)).toBe(`$${tex(p!)} \\times ${show(A!)}$`)
    }
    expect(contexts(built)).toBe(6)
  })

  it('converts cm² to m² by dividing by 10 000, then divides', () => {
    const built = build('pressure-from-an-area-in-square-centimetres', 'q7')
    for (const b of built) {
      const { A, F } = values(b)
      common(b, 'Pa')
      const Am = clean(A! / 10000)
      expect(b.question.prompt, b.seed).toContain(`${show(A!)} cm²`)
      expect(b.question.prompt).toContain(`${prose(F!)} N`)
      expect(powerOfTen(A!)).toBe(false)
      expect(answer(b)).toBe(clean(F! / Am))
      expect(powerOfTen(answer(b))).toBe(false)
      expect(answer(b)).not.toBe(A)
      expect(Number.isInteger(answer(b))).toBe(true)
      expect(b.question.solution).toContain(`$${show(A!)}$ cm² $= ${show(A!)} \\div 10\\,000 = ${show(Am)}$ m²`)
      expect(b.question.solution).toContain(ends(`p = \\dfrac{${tex(F!)}}{${show(Am)}}`, answer(b), 'Pa'))
      expect(method(b, 0)).toBe(`$${show(A!)}$ cm² $= ${show(Am)}$ m²`)
      expect(method(b, 1)).toBe(`$${tex(F!)} \\div ${show(Am)}$`)
    }
    expect(contexts(built)).toBe(7)
  })
})

describe('p = hρg', () => {
  it('multiplies depth, density and g: fresh water in q5, sea water at 1030 in q10', () => {
    for (const slotId of ['q5', 'q10']) {
      const built = build('pressure-at-a-depth', slotId)
      for (const b of built) {
        const { h, rho } = values(b)
        common(b, 'Pa')
        expect(rho).toBe(slotId === 'q10' ? 1030 : 1000)
        expect(stated(b.question.prompt), b.seed).toBe(rho)
        expect(b.question.prompt).toContain('$g = 9.8$ N/kg')
        expect(b.question.prompt).toContain(` ${show(h!)} m`)
        expect(powerOfTen(h!)).toBe(false)
        expect(answer(b)).toBe(clean(h! * rho! * 9.8))
        expect(Number.isInteger(answer(b))).toBe(true)
        expect(b.question.solution).toContain(ends(`p = h \\rho g = ${show(h!)} \\times ${rho} \\times 9.8`, answer(b), 'Pa'))
        expect(method(b, 1)).toBe(`$${show(h!)} \\times ${rho} \\times 9.8$`)
        if (b.values.context === 'lake' || b.values.context === 'scuba diver') expect(h).toBeLessThanOrEqual(40)
      }
      expect(contexts(built)).toBe(slotId === 'q5' ? 6 : 5)
    }
  })

  it('divides the pressure by ρg for the depth', () => {
    const built = build('depth-from-pressure', 'q9')
    for (const b of built) {
      const { p, rho } = values(b)
      common(b, 'm')
      expect(stated(b.question.prompt), b.seed).toBe(rho)
      expect(b.question.prompt).toContain(`${prose(p!)} Pa`)
      const rg = clean(rho! * 9.8)
      expect(answer(b)).toBe(clean(p! / rg))
      expect(powerOfTen(answer(b))).toBe(false)
      expect(b.question.solution).toContain(`\\dfrac{${tex(p!)}}{${rho} \\times 9.8} = \\dfrac{${tex(p!)}}{${tex(rg)}} = ${show(answer(b))}$ m`)
      expect(method(b, 0)).toBe('$h = p \\div (\\rho g)$')
      expect(method(b, 1)).toBe(`$${tex(p!)} \\div ${tex(rg)}$`)
    }
    expect(contexts(built)).toBe(5)
    expect(new Set(built.map((b) => values(b).rho))).toEqual(new Set([1000, 1030]))
  })

  it('adds 101 000 Pa of atmosphere to the pressure due to the water', () => {
    const built = build('total-pressure-with-the-atmosphere', 'q11')
    for (const b of built) {
      const { h, rho } = values(b)
      common(b, 'Pa')
      expect(b.question.prompt, b.seed).toContain('101 000 Pa')
      expect(stated(b.question.prompt)).toBe(rho)
      expect(b.question.prompt).toContain(` ${show(h!)} m`)
      expect(powerOfTen(h!)).toBe(false)
      const water = clean(h! * rho! * 9.8)
      expect(answer(b)).toBe(water + 101000)
      expect(b.question.solution).toContain(`$h \\rho g = ${show(h!)} \\times ${rho} \\times 9.8 = ${tex(water)}$ Pa`)
      expect(b.question.solution).toContain(`101\\,000 + ${tex(water)}`)
      expect(b.question.markScheme.map((l) => l.description)).toEqual([`$${show(h!)} \\times ${rho} \\times 9.8$`, `$${tex(water)}$ Pa from the water`, 'atmospheric pressure added', `${prose(answer(b))} Pa`])
      expect(b.question.prompt).not.toMatch(/on the hull of a submarine\./)
    }
    expect(contexts(built)).toBe(5)
  })

  it('takes the shallower depth from the deeper and multiplies by ρg, going down or up', () => {
    const built = build('pressure-change-between-depths', 'q14')
    for (const b of built) {
      const { from, to, rho } = values(b)
      common(b, 'Pa')
      expect(b.question.prompt, b.seed).toContain(`from ${from} m to ${to} m`)
      expect(stated(b.question.prompt)).toBe(rho)
      const [shallow, deep] = [Math.min(from!, to!), Math.max(from!, to!)]
      const dh = deep - shallow
      expect(powerOfTen(dh)).toBe(false)
      expect(deep).not.toBe(2 * shallow)
      expect(b.question.prompt.includes('increase')).toBe(to! > from!)
      expect(b.question.prompt).toMatch(/Use density of (sea )?water \$= 10[03]0\$ kg\/m³ and \$g = 9\.8\$ N\/kg\./)
      expect(answer(b)).toBe(clean(dh * rho! * 9.8))
      expect(b.question.solution).toContain(`$\\Delta h = ${deep} - ${shallow} = ${dh}$ m`)
      expect(b.question.solution).toContain('cancels')
      expect(method(b, 0)).toBe(`$\\Delta h = ${dh}$ m`)
      expect(method(b, 1)).toBe(`$${dh} \\times ${rho} \\times 9.8$`)
    }
    expect(contexts(built)).toBe(5)
    expect(new Set(built.map((b) => b.values.direction))).toEqual(new Set(['increase', 'decrease']))
  })
})

describe('upthrust, floating and comparing', () => {
  it('finds the pressure on the top and bottom faces, their difference, and multiplies by the face area', () => {
    const built = build('upthrust-from-a-pressure-difference', 'q12')
    for (const b of built) {
      const { L, W, H, d } = values(b)
      common(b, 'N')
      expect(b.question.prompt, b.seed).toContain(`${show(d!)} m below the surface`)
      expect(b.question.prompt).toContain(`${show(H!)} m`)
      expect(stated(b.question.prompt)).toBe(1000)
      expect(H).not.toBe(0.1)
      expect(d).not.toBe(H)
      expect(d).not.toBe(L)
      expect(d).not.toBe(W)
      if (b.values.context === 'concrete block') expect(Math.min(L!, W!, H!)).toBeGreaterThanOrEqual(0.3)
      expect(powerOfTen(d!)).toBe(false)
      const A = clean(L! * W!)
      expect(powerOfTen(A)).toBe(false)
      const top = clean(d! * 9800)
      const bottom = clean(clean(d! + H!) * 9800)
      const diff = clean(bottom - top)
      expect(answer(b)).toBe(clean(diff * A))
      expect(powerOfTen(answer(b) / 9.8)).toBe(false)
      expect(b.question.solution).toContain(`${show(d!)} \\times 1000 \\times 9.8 = ${tex(top)}$ Pa`)
      expect(b.question.solution).toContain(`= ${tex(bottom)}$ Pa`)
      expect(b.question.solution).toContain(`The difference, $${tex(diff)}$ Pa`)
      expect(b.question.solution).toContain(`F = ${tex(diff)} \\times ${show(A)} = ${show(answer(b))}$ N upwards`)
      expect(b.question.markScheme.map((l) => l.description)).toEqual([`pressure at the top, ${prose(top)} Pa, and at the bottom, ${prose(bottom)} Pa`, `difference ${prose(diff)} Pa`, `$F = p A$ with $A = ${show(A)}$ m²`, `${show(answer(b))} N`])
    }
    expect(contexts(built)).toBe(4)
  })

  it('takes the smaller of weight and upthrust from the larger and gives the direction', () => {
    const built = build('resultant-of-weight-and-upthrust', 'q13')
    for (const b of built) {
      const { W, U } = values(b)
      const direction = String(b.values.direction)
      common(b, 'N')
      expect(b.question.prompt, b.seed).toContain(`${show(W!)} N`)
      expect(b.question.prompt).toContain(`${show(U!)} N`)
      expect(direction).toBe(U! > W! ? 'upwards' : 'downwards')
      expect(answer(b)).toBe(clean(Math.abs(W! - U!)))
      expect(answer(b)).not.toBe(U)
      expect(answer(b)).not.toBe(W)
      expect(powerOfTen(U!)).toBe(false)
      expect(b.question.solution).toContain(`Resultant $= ${show(Math.max(W!, U!))} - ${show(Math.min(W!, U!))} = ${show(answer(b))}$ N ${direction}`)
      expect(method(b, 1)).toBe(`$${show(Math.max(W!, U!))} - ${show(Math.min(W!, U!))}$`)
      expect(last(b)).toBe(`${show(answer(b))} N ${direction}`)
      // Steel weighs about 7.8 times the water it displaces.
      if (b.values.context === 'steel') expect(W! / U!).toBeGreaterThanOrEqual(7.6)
      expect(b.question.prompt.includes('let go') || b.question.prompt.includes('released')).toBe(direction === 'upwards')
    }
    expect(contexts(built)).toBe(8)
    expect(new Set(built.map((b) => b.values.direction))).toEqual(new Set(['upwards', 'downwards']))
  })

  it('works out each pressure from the total area, then their ratio, a whole number', () => {
    const built = build('comparing-pressures', 'q15')
    for (const b of built) {
      const { Wlo, alo, Whi, ahi } = values(b)
      const [nlo, nhi] = String(b.values.parts).split('/').map((w) => (w === 'two' ? 2 : 4))
      common(b, undefined)
      expect(b.question.prompt, b.seed).toContain(`${prose(Wlo!)} N`)
      expect(b.question.prompt).toContain(`${prose(Whi!)} N`)
      expect(b.question.prompt).toContain(`${show(alo!)} m²`)
      expect(b.question.prompt).toContain(`${show(ahi!)} m²`)
      expect(Wlo).not.toBe(Whi)
      const tlo = clean(nlo! * alo!)
      const thi = clean(nhi! * ahi!)
      const plo = clean(Wlo! / tlo)
      const phi = clean(Whi! / thi)
      expect(Number.isInteger(plo) && Number.isInteger(phi)).toBe(true)
      expect(answer(b)).toBe(clean(phi / plo))
      expect(Number.isInteger(answer(b))).toBe(true)
      expect(answer(b)).toBeGreaterThanOrEqual(2)
      expect(powerOfTen(answer(b))).toBe(false)
      expect(b.question.solution).toContain(`$${nlo} \\times ${show(alo!)} = ${show(tlo)}$ m², so $p = ${tex(Wlo!)} \\div ${show(tlo)} = ${tex(plo)}$ Pa`)
      expect(b.question.solution).toContain(`Ratio $= ${tex(phi)} \\div ${tex(plo)} = ${answer(b)}$.`)
      expect(method(b, 2)).toBe('ratio of the two pressures')
      expect(last(b)).toBe(show(answer(b)))
    }
    expect(contexts(built)).toBe(5)
  })

  it('weight equals upthrust, so the displaced mass is the object’s, divided by the stated density', () => {
    const built = build('displaced-volume-when-floating', 'q18')
    for (const b of built) {
      const { m, rho } = values(b)
      common(b, 'm³')
      expect(b.question.prompt, b.seed).toContain(`${prose(m!)} kg`)
      expect(stated(b.question.prompt)).toBe(rho)
      expect(answer(b)).toBe(clean(m! / rho!))
      expect(powerOfTen(answer(b))).toBe(false)
      const W = clean(m! * 9.8)
      expect(b.question.solution).toContain(`Weight $= ${tex(m!)} \\times 9.8 = ${tex(W)}$ N`)
      expect(b.question.solution).toContain(`$= ${tex(m!)} \\div ${rho} = ${show(answer(b))}$ m³`)
      expect(method(b, 0)).toBe('floating means upthrust $=$ weight')
      expect(method(b, 1)).toContain(`weight $= ${tex(m!)} \\times 9.8 = ${tex(W)}$ N, so ${prose(m!)} kg`)
      expect(method(b, 2)).toBe('volume $=$ mass $\\div$ density')
      if (b.values.context === 'canoe') expect(b.question.prompt).toContain('they displace')
    }
    expect(contexts(built)).toBe(7)
    expect(new Set(built.map((b) => values(b).rho))).toEqual(new Set([1000, 1030]))
  })
})

describe('spread across builds', () => {
  const share = (built: Generated[], key: (b: Generated) => unknown) => {
    const counts = new Map<unknown, number>()
    for (const b of built) counts.set(key(b), (counts.get(key(b)) ?? 0) + 1)
    return Math.max(...counts.values()) / built.length
  }
  const cases: [string, string, (b: Generated) => unknown][] = [
    ['pressure-from-force-and-area', 'q1', answer],
    ['pressure-from-force-and-area', 'q1', (b) => values(b).A],
    ['pressure-from-force-and-area', 'q3', answer],
    ['pressure-from-force-and-area', 'q3', (b) => values(b).A],
    ['force-from-pressure-and-area', 'q6', answer],
    ['pressure-from-an-area-in-square-centimetres', 'q7', answer],
    ['pressure-from-an-area-in-square-centimetres', 'q7', (b) => values(b).A],
    ['pressure-at-a-depth', 'q5', answer],
    ['pressure-at-a-depth', 'q10', answer],
    ['depth-from-pressure', 'q9', answer],
    ['total-pressure-with-the-atmosphere', 'q11', answer],
    ['pressure-change-between-depths', 'q14', answer],
    ['upthrust-from-a-pressure-difference', 'q12', answer],
    ['upthrust-from-a-pressure-difference', 'q12', (b) => values(b).H],
    ['resultant-of-weight-and-upthrust', 'q13', answer],
    ['comparing-pressures', 'q15', answer],
    ['displaced-volume-when-floating', 'q18', answer],
  ]
  for (const [id, slot, key] of cases) {
    it(`${id} ${slot}: no value is more than 40% of the draws`, () => {
      expect(share(build(id, slot), key)).toBeLessThanOrEqual(0.4)
    })
  }
  // Four cube answers were 54% of q12 while no single one passed 40%: look inside each context.
  it('upthrust-from-a-pressure-difference q12: each context offers many answers, none above 15%', () => {
    const built = build('upthrust-from-a-pressure-difference', 'q12', 1200)
    for (const name of new Set(built.map((b) => b.values.context))) {
      const mine = built.filter((b) => b.values.context === name)
      expect(new Set(mine.map(answer)).size, String(name)).toBeGreaterThanOrEqual(10)
      expect(share(mine, answer), String(name)).toBeLessThanOrEqual(0.15)
    }
  })

  it('pressure-change-between-depths q14: no change in depth is more than 15% of any context', () => {
    const built = build('pressure-change-between-depths', 'q14', 1000)
    for (const name of new Set(built.map((b) => b.values.context))) {
      const mine = built.filter((b) => b.values.context === name)
      expect(share(mine, (b) => Math.abs(values(b).to! - values(b).from!)), String(name)).toBeLessThanOrEqual(0.15)
    }
  })
})
