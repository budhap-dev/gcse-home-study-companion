import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { fixed, show } from '../format.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import { CONTAINERS, FLAT_SECTIONS, METALS, WATER_HOLDERS } from './particles.ts'

/**
 * Structural tests for the particle-model generators: specific heat capacity and latent
 * heat, gases, density. Each reads the drawn values back against the prompt and the working
 * and checks the route, not only the answer (generator-helpers-need-structural-tests), and
 * looks across a run of builds for a rotation that never turns.
 */
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/physics')
const bank = (topicId: string) => Question.array().parse(JSON.parse(readFileSync(join(ROOT, `${topicId}.json`), 'utf8')).questions)

function build(generatorId: string, slotId: string, count = 300): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  const slot = bank(g.topicId).find((q) => q.id === slotId)!
  return Array.from({ length: count }, (_, i) => generate(g, slot, `structure-${i}`))
}

const clean = (x: number) => Number(x.toPrecision(12))
const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const units = (b: Generated) => (b.question.type === 'numeric' ? b.question.units : 'not numeric')
const tolerance = (b: Generated) => (b.question.type === 'numeric' ? b.question.tolerance : NaN)
const last = (b: Generated) => b.question.markScheme.at(-1)!.description
const values = (b: Generated) => b.values as Record<string, number>
/** Thousands in prose as the generators print them: 334 000 from five digits. */
const grouped = (x: number) => (Math.abs(x) >= 10000 ? String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : String(x))
/** The same inside maths: 334\,000. */
const tex = (x: number) => (Math.abs(x) >= 10000 ? String(x).replace(/\B(?=(\d{3})+(?!\d))/g, '\\,') : show(x))
const kinds = (built: Generated[], key: string) => new Set(built.map((b) => b.values[key]))

describe('specific heat capacity and latent heat', () => {
  it('multiplies mass, c and the change, finding the change from two temperatures in q12', () => {
    for (const slotId of ['q2', 'q12']) {
      const built = build('specific-heat-energy', slotId)
      for (const b of built) {
        const { m, c, d, t1, t2 } = values(b)
        expect(answer(b), b.seed).toBe(clean(m! * c! * d!))
        expect(b.question.prompt).toContain(`Take c = ${c} J/kg°C`)
        expect(b.question.solution).toContain(`${show(m!)} \\times ${tex(c!)} \\times ${d} = ${tex(answer(b))}$ J`)
        if (slotId === 'q12') {
          expect(b.question.prompt).toContain(`${t1} °C`)
          expect(b.question.prompt).toContain(`${t2} °C`)
          expect(Math.abs(t2! - t1!)).toBe(d)
          expect(b.question.solution).toContain(`$${Math.max(t1!, t2!)} - ${Math.min(t1!, t2!)} = ${d}$ °C`)
          if (b.values.substance === 'water') expect(Math.max(t1!, t2!)).toBeLessThanOrEqual(100)
        } else {
          expect(b.question.prompt).toContain(`by ${d} °C`)
        }
        // The change is one the holder's water really has: a bath never loses 40 °C to a room.
        if (b.values.substance === 'water') {
          const holder = WATER_HOLDERS.find((h) => h.holder === b.values.holder)!
          expect(d, b.seed).toBeLessThanOrEqual(b.values.direction === 'cooling' ? holder.fall : holder.rise[1])
        }
        // Copper's 385 still gives a whole number of joules.
        expect(Number.isInteger(answer(b))).toBe(true)
        expect(units(b)).toBe('J')
      }
      expect(kinds(built, 'substance').has('water')).toBe(true)
      expect(kinds(built, 'substance').size).toBeGreaterThanOrEqual(3)
      expect(kinds(built, 'direction')).toEqual(new Set(['heating', 'cooling']))
    }
  })

  it('multiplies the mass by the latent heat the prompt states: fusion in q4, vaporisation in q7', () => {
    for (const [slotId, changes] of [['q4', ['melting', 'freezing']], ['q7', ['boiling', 'condensing']]] as const) {
      const built = build('latent-heat-energy', slotId)
      for (const b of built) {
        const { m, L } = values(b)
        expect(answer(b), b.seed).toBe(clean(m! * L!))
        expect(b.question.prompt).toContain(`${show(m!)} kg`)
        expect(b.question.prompt).toContain(`${grouped(L!)} J/kg`)
        expect(changes).toContain(b.values.change)
        expect(b.question.solution).toContain(`${show(m!)} \\times ${tex(L!)} = ${tex(answer(b))}$ J`)
        expect(units(b)).toBe('J')
      }
      expect(kinds(built, 'change')).toEqual(new Set(changes))
      expect(kinds(built, 'substance').size).toBeGreaterThanOrEqual(2)
    }
  })

  it('rearranges for the change in q5, to one decimal place that is not a whole number', () => {
    const built = build('specific-heat-rearranged', 'q5')
    for (const b of built) {
      const { m, c, E } = values(b)
      const d = E! / (m! * c!)
      expect(answer(b), b.seed).toBe(Number(d.toFixed(1)))
      expect(Number.isInteger(answer(b))).toBe(false)
      expect(d).toBeGreaterThanOrEqual(5)
      expect(d).toBeLessThanOrEqual(80)
      expect(tolerance(b)).toBe(0.05)
      expect(b.question.prompt).toContain(`${grouped(E!)} J`)
      expect(b.question.prompt).toContain('1 decimal place')
      // The unrounded value is shown before the rounding the mark is for.
      expect(b.question.solution).toContain(`\\dfrac{${tex(E!)}}{${tex(clean(m! * c!))}} = ${fixed(d, 3)}$, so **${answer(b).toFixed(1)} °C**`)
      expect(b.question.markScheme[1]!.description).toBe(`denominator of ${grouped(clean(m! * c!))}`)
      if (b.values.substance === 'water') {
        const holder = WATER_HOLDERS.find((h) => h.holder === b.values.holder)!
        expect(d, b.seed).toBeLessThanOrEqual(b.values.direction === 'cooling' ? holder.fall : holder.rise[1])
      }
      expect(units(b)).toBe('°C')
    }
    expect(kinds(built, 'substance').has('water')).toBe(true)
    expect(kinds(built, 'substance').size).toBeGreaterThanOrEqual(3)
  })

  it('rearranges for c in q11, which is a specific heat capacity the content gives', () => {
    const known = new Set([...METALS.map((x) => x.c), 130, 240, 380, 390, 450, 500, 900, 2000, 2400, 4200])
    const built = build('specific-heat-rearranged', 'q11')
    for (const b of built) {
      const { m, c, d, E } = values(b)
      expect(E, b.seed).toBe(clean(m! * c! * d!))
      expect(answer(b)).toBe(c)
      expect(known.has(c!)).toBe(true)
      expect(b.question.prompt).toContain(`${grouped(E!)} J`)
      expect(b.question.prompt).toContain(`${d} °C`)
      expect(b.question.solution).toContain(`\\dfrac{${tex(E!)}}{${tex(clean(m! * d!))}} = ${c}$ J/kg°C`)
      expect(units(b)).toBe('J/kg°C')
    }
    expect(kinds(built, 'substance').size).toBeGreaterThanOrEqual(5)
  })

  it('takes the difference of two temperatures, rising, falling and through zero', () => {
    const built = build('thermal-temperature-change', 'q9')
    for (const b of built) {
      const { t1, t2 } = values(b)
      expect(answer(b), b.seed).toBe(Math.abs(t2! - t1!))
      expect(answer(b)).toBeGreaterThan(0)
      expect(units(b)).toBe('°C')
    }
    expect(kinds(built, 'direction')).toEqual(new Set(['rise', 'fall']))
    expect(built.filter((b) => values(b).t2! < 0).length).toBeGreaterThan(20)
  })

  it('adds the heating stage to the change-of-state stage, each in the mark scheme', () => {
    const built = build('heating-two-stages', 'q13')
    for (const b of built) {
      const { m, t, c, L, E1, E2 } = values(b)
      const d = b.values.kind === 'melt-warm' ? t! : Math.abs(b.values.kind === 'warm-ice-melt' ? t! : 100 - t!)
      expect(E1, b.seed).toBe(clean(m! * c! * d))
      expect(E2).toBe(clean(m! * L!))
      expect(answer(b)).toBe(E1! + E2!)
      expect(b.question.markScheme.map((l) => l.description).join(' ')).toContain(`${grouped(E1!)} J`)
      expect(b.question.markScheme.map((l) => l.description).join(' ')).toContain(`${grouped(E2!)} J`)
      expect(b.question.solution).toContain(`= ${tex(answer(b))}$ J`)
      expect(units(b)).toBe('J')
    }
    expect(kinds(built, 'kind')).toEqual(new Set(['steam', 'condense', 'melt-warm', 'warm-ice-melt']))
  })

  it('divides the energy by the power to a whole number of seconds', () => {
    for (const b of build('heater-time-from-energy', 'q14')) {
      const { P, E } = values(b)
      expect(answer(b), b.seed).toBe(E! / P!)
      expect(Number.isInteger(answer(b))).toBe(true)
      expect(b.question.prompt).toContain(`${P} W`)
      expect(b.question.prompt).toContain(`${grouped(E!)} J`)
      expect(b.question.prompt).not.toMatch(/\ba \d/)
      expect(units(b)).toBe('s')
    }
    const built = build('latent-heat-heater-time', 'q16')
    for (const b of built) {
      const { m, P, L } = values(b)
      const E = clean(m! * L!)
      expect(answer(b), b.seed).toBe(E / P!)
      expect(Number.isInteger(answer(b))).toBe(true)
      expect(answer(b)).toBeGreaterThanOrEqual(30)
      expect(answer(b)).toBeLessThanOrEqual(1500)
      expect(b.question.prompt).toContain(`${grouped(L!)} J/kg`)
      expect(b.question.solution).toContain(`${show(m!)} \\times ${tex(L!)} = ${tex(E)}$ J`)
      expect(units(b)).toBe('s')
    }
    expect(kinds(built, 'change')).toEqual(new Set(['boiling', 'melting']))
  })

  it('multiplies power by the flat section, for an amount the heater could really change', () => {
    for (const b of build('heating-graph-energy', 'q20')) {
      const { P, t } = values(b)
      const f = FLAT_SECTIONS.find((x) => x.substance === b.values.substance)!
      expect(answer(b), b.seed).toBe(P! * t!)
      const mass = answer(b) / f.L
      expect(mass).toBeGreaterThanOrEqual(f.mass[0])
      expect(mass).toBeLessThanOrEqual(f.mass[1])
      expect(b.question.prompt).toContain(`${f.at} °C`)
      expect(b.question.prompt).toContain(`${t} s`)
      expect(units(b)).toBeUndefined()
    }
  })
})

describe('behaviour of gases', () => {
  it('keeps pV constant, in a container that can hold the gas at that pressure', () => {
    for (const slotId of ['q3', 'q5', 'q7', 'q11', 'q14']) {
      const built = build('boyles-law', slotId)
      for (const b of built) {
        const { p1, V1, p2, V2 } = values(b)
        expect(p1! * V1!, b.seed).toBe(p2! * V2!)
        const c = CONTAINERS.find((x) => x.name === b.values.container)!
        expect(p2).toBeLessThanOrEqual(c.maxP)
        if (c.mover) expect(V2).toBeLessThanOrEqual(c.volume[1] * c.step)
        // A pump compresses from atmospheric pressure or above; it is never pulled out.
        if (c.name === 'bicycle pump') {
          expect(b.values.direction).toBe('compress')
          expect(p1).toBeGreaterThanOrEqual(100)
        }
        // Never a swap of the two figures.
        expect(p2).not.toBe(V1)
        expect(p1).not.toBe(V2)
        if (b.values.direction === 'compress') {
          expect(p2).toBeGreaterThan(p1!)
          expect(V2).toBeLessThan(V1!)
        } else {
          expect(p2).toBeLessThan(p1!)
          expect(V2).toBeGreaterThan(V1!)
        }
        expect(b.question.solution).toContain(`$pV = ${tex(p1!)} \\times ${V1} = ${tex(p1! * V1!)}$`)
        if (slotId === 'q7') {
          expect(b.values.task).toBe('volume')
          expect(answer(b)).toBe(V2)
          expect(units(b)).toBe('cm³')
          expect(b.question.prompt).toContain(`${p2} kPa`)
        } else {
          expect(b.values.task).toBe('pressure')
          expect(answer(b)).toBe(p2)
          expect(units(b)).toBe('kPa')
          expect(b.question.prompt).toContain(`${V2} cm³`)
        }
        expect(b.question.markScheme).toHaveLength(slotId === 'q3' ? 2 : 3)
      }
      expect(kinds(built, 'direction')).toEqual(new Set(['compress', 'expand']))
      if (slotId === 'q11') expect(kinds(built, 'container').has('gas')).toBe(false)
    }
  })

  it('multiplies for the constant and divides it by the pressure for the volume', () => {
    for (const b of build('gas-pv-product', 'q9')) {
      const { p, V } = values(b)
      expect(answer(b), b.seed).toBe(p! * V!)
      expect(p).toBeLessThanOrEqual(CONTAINERS.find((x) => x.name === b.values.container)!.maxP)
      if (b.values.container === 'bicycle pump') expect(p).toBeGreaterThanOrEqual(100)
      expect(b.question.prompt).toContain(`${V} cm³`)
      expect(b.question.prompt).toContain(`${p} kPa`)
      expect(units(b)).toBeUndefined()
      expect(last(b)).toBe(String(answer(b)))
    }
    for (const b of build('gas-volume-from-pv', 'q16')) {
      const { p, k } = values(b)
      expect(answer(b), b.seed).toBe(k! / p!)
      expect(Number.isInteger(answer(b))).toBe(true)
      expect(p).toBeLessThanOrEqual(CONTAINERS.find((x) => x.name === b.values.container)!.maxP)
      expect(b.question.prompt).toContain(`${grouped(k!)} kPa cm³`)
      expect(b.question.solution).toContain(`\\dfrac{${tex(k!)}}{${tex(p!)}} = ${answer(b)}$ cm³`)
      expect(units(b)).toBe('cm³')
    }
  })
})

describe('density', () => {
  it('divides the mass by the volume, rotating through air, water, named and unnamed solids', () => {
    const built = build('density-from-mass-and-volume', 'q1')
    for (const b of built) {
      const { rho, V, m } = values(b)
      expect(m, b.seed).toBe(clean(rho! * V!))
      expect(answer(b)).toBe(rho)
      expect(b.question.prompt).toContain(`${show(m!)} kg`)
      expect(b.question.prompt).toContain(`${show(V!)} m³`)
      expect(b.question.solution).toContain(`\\dfrac{${show(m!)}}{${show(V!)}} = ${tex(rho!)}$ kg/m³`)
      expect(units(b)).toBe('kg/m³')
    }
    expect(kinds(built, 'kind')).toEqual(new Set(['air', 'water', 'named', 'unnamed']))
    expect(built.filter((b) => b.values.kind === 'named').length).toBeGreaterThan(100)
  })

  it('cubes the side, or multiplies three different sides, before dividing', () => {
    const built = build('density-of-a-cube', 'q5')
    for (const b of built) {
      const { rho, V, m } = values(b)
      const dims = String(b.values.dims).split('×').map(Number)
      expect(dims, b.seed).toHaveLength(b.values.shape === 'cube' ? 1 : 3)
      if (b.values.shape === 'cuboid') expect(new Set(dims).size).toBe(3)
      const volume = b.values.shape === 'cube' ? dims[0]! ** 3 : dims.reduce((a, x) => a * x, 1)
      expect(clean(volume)).toBe(V)
      expect(m).toBe(clean(rho! * V!))
      expect(answer(b)).toBe(rho)
      for (const side of dims) expect(b.question.prompt).toContain(`${show(side)} m`)
      expect(b.question.solution).toContain(`which is ${show(V!)} m³`)
      expect(b.question.solution).toContain(`\\dfrac{${show(m!)}}{${show(V!)}} = ${tex(rho!)}$ kg/m³`)
      expect(units(b)).toBe('kg/m³')
    }
    expect(kinds(built, 'shape')).toEqual(new Set(['cube', 'cuboid']))
  })

  it('reads the volume off the cylinder as the rise, then converts to m³ for a density', () => {
    for (const b of build('displacement-volume', 'q7')) {
      const { before, after } = values(b)
      expect(answer(b), b.seed).toBe(after! - before!)
      expect(b.question.prompt).toContain(`${before} cm³`)
      expect(b.question.prompt).toContain(`${after} cm³`)
      expect(b.question.solution).toContain(`$${after} - ${before} = ${answer(b)}$ cm³`)
      expect(units(b)).toBe('cm³')
    }
    const built = build('displacement-density', 'q11')
    for (const b of built) {
      const { before, after, m, rho } = values(b)
      const V = after! - before!
      expect(m, b.seed).toBe(clean((rho! * V) / 1e6))
      expect(answer(b)).toBe(rho)
      expect(b.question.prompt).toContain(`${show(m!)} kg`)
      expect(b.question.solution).toContain(`Volume $= ${after} - ${before} = ${V}$ cm³`)
      expect(b.question.solution).toContain(`\\dfrac{${show(m!)}}{${show(V / 1e6)}} = ${tex(rho!)}$ kg/m³`)
      expect(units(b)).toBe('kg/m³')
    }
    expect(kinds(built, 'substance').has('unnamed')).toBe(true)
    expect(kinds(built, 'substance').size).toBeGreaterThanOrEqual(5)
  })
})
