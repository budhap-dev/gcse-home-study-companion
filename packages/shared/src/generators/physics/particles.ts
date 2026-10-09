import { clearOfHalf, fixed, grouped, roundTo, show } from '../format.ts'
import { draw, int, pick, type Rng } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Draft, Generator } from '../types.ts'
import { dpTolerance, sci, sigFigs } from './format.ts'

/**
 * The particle model of matter (AQA 8463, topic 3): density and changes of state, thermal
 * physics (specific heat capacity and latent heat), behaviour of gases.
 *
 * Every generator here writes exact figures (a mass to one decimal place times a specific
 * heat capacity that is a multiple of ten) so the answer is a whole number marked exactly,
 * except the temperature rise of q5, which the written question asks for to 1 decimal place.
 */
const THERMAL = 'thermal-physics'
const GASES = 'behaviour-of-gases'
const DENSITY = 'density-and-changes-of-state'

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(a))
/** A small figure with its binary residue removed: 0.1 × 3 as 0.3. */
const clean = (x: number) => Number(show(x))
/**
 * A figure that is a whole number by construction (a mass in tenths times a latent heat in
 * thousands), with the residue of the product removed: 2.2 × 205 000 came out 451000.0000000001.
 */
function whole(x: number): number {
  const n = Math.round(x)
  if (Math.abs(x - n) > 1e-6 * Math.max(1, Math.abs(n))) throw new Error(`${x} is not a whole number`)
  return n
}
const an = (noun: string) => `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** A number inside $…$: thousands as 10\,000 from five digits, decimals as show prints them. */
function tex(x: number): string {
  const [whole, dec] = show(x).split('.')
  const w = Math.abs(x) >= 10000 ? whole!.replace(/\B(?=(\d{3})+(?!\d))/g, '\\,') : whole!
  return dec ? `${w}.${dec}` : w
}

/** Standard form with no more figures than the number has: 8 \times 10^{-6}, 2.7 \times 10^{-5}. */
function sciShort(x: number): string {
  for (let n = 1; n < 6; n++) if (near(sigFigs(x, n), x)) return sci(x, n)
  return sci(x, 6)
}

/**
 * The answer as the box prints it, for the end of a solution. The working groups thousands
 * with a thin space (252\,000); the release check wants the number as String(answer) prints
 * it, so an answer of five digits or more is also given plain.
 */
const boxed = (answer: number, unit: string) => `**${show(answer)}${unit ? ` ${unit}` : ''}**`

/* ------------------------------------------------------------------------------------------ */
/* Specific heat capacity                                                                      */
/* ------------------------------------------------------------------------------------------ */

const C_WATER = 4200
/** Specific heat capacities as the content gives them, J/kg°C: the written q5 takes copper as 385. */
export const METALS: { name: string; c: number }[] = [
  { name: 'copper', c: 385 },
  { name: 'aluminium', c: 900 },
  { name: 'iron', c: 450 },
  { name: 'lead', c: 130 },
]
/**
 * Where water is heated, and how much of it there is: a kettle holds 0.5–2 kg, a bath
 * 100–200 kg. `rise` is the warming the holder's water really gets and `fall` the most it
 * can lose to a room: a bath cannot cool by 40 °C.
 */
export const WATER_HOLDERS: { holder: string; mass: [number, number]; step: number; rise: [number, number]; fall: number }[] = [
  { holder: 'kettle', mass: [5, 20], step: 0.1, rise: [5, 80], fall: 80 },
  { holder: 'saucepan', mass: [5, 30], step: 0.1, rise: [5, 80], fall: 80 },
  { holder: 'bucket', mass: [40, 100], step: 0.1, rise: [5, 60], fall: 60 },
  { holder: 'bath', mass: [10, 20], step: 10, rise: [10, 40], fall: 25 },
  { holder: 'hot-water tank', mass: [5, 15], step: 10, rise: [10, 50], fall: 40 },
]
/** The temperature change a holder's water can have, warming or cooling; a metal block 5–80 °C. */
function changeRange(holder: string | undefined, cooling: boolean): [number, number] {
  const h = WATER_HOLDERS.find((x) => x.holder === holder)
  return h ? [h.rise[0], cooling ? h.fall : h.rise[1]] : [5, 80]
}

interface Heated { substance: string; label: string; holder?: string; m: number; c: number; article: string }

/**
 * A block's mass in tenths of a kilogram, in even tenths when c is not a multiple of ten so
 * mcΔθ stays a whole number: 385 × 0.2 = 77.
 */
const blockMass = (r: Rng, c: number) => (c % 10 === 0 ? clean(int(r, 2, 50) / 10) : clean(int(r, 1, 25) / 5))

/** Water in one of its holders, or a block of one of the metals, with its mass. */
function heated(r: Rng, kind: 'water' | 'metal'): Heated {
  if (kind === 'water') {
    const h = pick(r, WATER_HOLDERS)
    const m = clean(int(r, ...h.mass) * h.step)
    return { substance: 'water', label: 'water', holder: h.holder, m, c: C_WATER, article: `${show(m)} kg of water` }
  }
  const metal = pick(r, METALS)
  const m = blockMass(r, metal.c)
  return { substance: metal.name, label: `block of ${metal.name}`, m, c: metal.c, article: `${show(m)} kg block of ${metal.name}` }
}

/**
 * ΔE = mcΔθ for the energy: written as q2 (2 kg of water by 30 °C, 2 marks) and q12 (0.5 kg
 * of water from 20 °C to 100 °C, 3 marks, the first mark for Δθ = 80 and not 100). Water in
 * a kettle, pan, bucket, bath or tank, or a block of metal; heated or cooling.
 */
export const specificHeatEnergy: Generator = {
  id: 'specific-heat-energy',
  subjectId: 'physics',
  topicId: THERMAL,
  replaces: ['q2', 'q12'],
  build(r, slot, turn): Draft {
    const twoTemps = slot.id === 'q12'
    const kind = turn % 2 === 0 ? 'water' : 'metal'
    const s = heated(r, kind)
    const cooling = r() < 0.3
    const rise = changeRange(s.holder, cooling)
    // Two temperatures: heating starts at room temperature and never passes 100 °C; cooling
    // starts hot and ends near the room.
    const { d, t1, t2 } = draw(
      r,
      (r) => {
        if (!twoTemps) return { d: int(r, ...rise), t1: 0, t2: 0 }
        if (cooling) {
          const hot = kind === 'water' ? int(r, rise[1] === 80 ? 60 : 35, rise[1] === 80 ? 100 : 60) : int(r, 60, 100)
          const cold = int(r, 15, 30)
          return { d: hot - cold, t1: hot, t2: cold }
        }
        const start = int(r, 10, 25)
        const d = int(r, ...rise)
        return { d, t1: start, t2: start + d }
      },
      ({ d, t2 }) => d >= rise[0] && d <= rise[1] && t2 <= 100,
    )
    const E = whole(s.m * s.c * d)
    const take = kind === 'water' ? `Take c = ${C_WATER} J/kg°C.` : `Take c = ${s.c} J/kg°C for ${s.substance}.`
    const inJ = 'Give your answer in J.'
    const forms = twoTemps
      ? kind === 'water'
        ? cooling
          ? [
              `The ${s.article} in a ${s.holder} cools from ${t1} °C to ${t2} °C. How much energy does the water transfer to its surroundings? ${take} ${inJ}`,
              `${cap(s.article)} cools from ${t1} °C to ${t2} °C. How much energy does it release? ${take} ${inJ}`,
            ]
          : [
              `How much energy raises ${s.article} from ${t1} °C to ${t2} °C? ${take} ${inJ}`,
              `A ${s.holder} holds ${s.article} at ${t1} °C. How much energy is needed to heat the water to ${t2} °C? ${take} ${inJ}`,
              `Calculate the energy needed to heat the ${s.article} in a ${s.holder} from ${t1} °C to ${t2} °C. ${take} ${inJ}`,
            ]
        : cooling
          ? [
              `A ${s.article} cools from ${t1} °C to ${t2} °C. How much energy does it transfer to its surroundings? ${take} ${inJ}`,
              `A ${s.article} is taken out of hot water at ${t1} °C and cools to ${t2} °C. How much energy does it release? ${take} ${inJ}`,
            ]
          : [
              `A ${s.article} is heated from ${t1} °C to ${t2} °C. How much energy does it gain? ${take} ${inJ}`,
              `How much energy is needed to heat a ${s.article} from ${t1} °C to ${t2} °C? ${take} ${inJ}`,
            ]
      : kind === 'water'
        ? cooling
          ? [
              `The ${s.article} in a ${s.holder} cools by ${d} °C. How much energy does the water transfer to its surroundings? ${take} ${inJ}`,
              `${cap(s.article)} cools by ${d} °C. How much energy does it release? ${take} ${inJ}`,
            ]
          : [
              `How much energy is needed to raise ${s.article} by ${d} °C? ${take} ${inJ}`,
              `A ${s.holder} holds ${s.article}. How much energy is needed to warm the water by ${d} °C? ${take} ${inJ}`,
              `Calculate the energy needed to heat the ${s.article} in a ${s.holder} by ${d} °C. ${take} ${inJ}`,
            ]
        : cooling
          ? [`A ${s.article} cools by ${d} °C. How much energy does it transfer to its surroundings? ${take} ${inJ}`]
          : [
              `How much energy is needed to raise the temperature of a ${s.article} by ${d} °C? ${take} ${inJ}`,
              `A ${s.article} is heated and its temperature rises by ${d} °C. Calculate the energy transferred to the block. ${take} ${inJ}`,
            ]
    const what = cooling ? 'energy released' : 'energy needed'
    const product = `${tex(s.m)} \\times ${tex(s.c)} \\times ${d} = ${tex(E)}`
    const solution = twoTemps
      ? `$\\Delta\\theta$ is the change, not a temperature: $${Math.max(t1, t2)} - ${Math.min(t1, t2)} = ${d}$ °C. Then $\\Delta E = mc\\Delta\\theta = ${product}$ J, so the ${what} is ${boxed(E, 'J')}.`
      : `$\\Delta E = mc\\Delta\\theta = ${product}$ J, so the ${what} is ${boxed(E, 'J')}.`
    const method = twoTemps ? [`Δθ = ${d}, not ${Math.max(t1, t2)}`, 'substitutes into mcΔθ'] : ['substitutes into mcΔθ']
    // Second route: back from the energy to the temperature change, and to the mass.
    return {
      question: { type: 'numeric', prompt: pick(r, forms), solution, markScheme: scheme(slot, method, show(E)), answer: E, tolerance: 0, units: 'J' },
      check: { agrees: near(E / (s.m * s.c), d) && near(E / (s.c * d), s.m) && Number.isInteger(E), detail: `${tex(E)} ÷ (${show(s.m)} × ${s.c}) = ${show(E / (s.m * s.c))}` },
      values: { substance: s.substance, ...(s.holder ? { holder: s.holder } : {}), m: s.m, c: s.c, d, direction: cooling ? 'cooling' : 'heating', ...(twoTemps ? { t1, t2 } : {}) },
    }
  },
}

/* ------------------------------------------------------------------------------------------ */
/* Latent heat                                                                                 */
/* ------------------------------------------------------------------------------------------ */

const L_FUSION_WATER = 334000
const L_VAPOUR_WATER = 2260000
/** Specific latent heats of fusion, J/kg, with the melting point where the prompt states it. */
export const FUSION: { solid: string; liquid: string; L: number; at: string }[] = [
  { solid: 'ice', liquid: 'water', L: L_FUSION_WATER, at: '0 °C' },
  { solid: 'lead', liquid: 'lead', L: 23000, at: 'its melting point of 327 °C' },
  { solid: 'aluminium', liquid: 'aluminium', L: 397000, at: 'its melting point of 660 °C' },
  { solid: 'copper', liquid: 'copper', L: 205000, at: 'its melting point of 1085 °C' },
]
/** Specific latent heats of vaporisation, J/kg. */
export const VAPORISATION: { liquid: string; L: number; at: string }[] = [
  { liquid: 'water', L: L_VAPOUR_WATER, at: '100 °C' },
  { liquid: 'ethanol', L: 840000, at: 'its boiling point of 78 °C' },
]

/**
 * E = mL: written as q4 (melting 0.25 kg of ice, 2 marks, core) and q7 (boiling away 0.1 kg
 * of water, 2 marks, higher). q4 keeps to fusion and q7 to vaporisation; each also runs the
 * other way, freezing or condensing, with the energy released.
 */
export const latentHeatEnergy: Generator = {
  id: 'latent-heat-energy',
  subjectId: 'physics',
  topicId: THERMAL,
  replaces: ['q4', 'q7'],
  build(r, slot, turn): Draft {
    const fusion = slot.id === 'q4'
    const reverse = turn % 3 === 2
    // Water in the familiar amounts; a metal in a foundry's.
    let prompts: string[], L: number, m: number, name: string, change: string
    if (fusion) {
      const f = pick(r, FUSION)
      const water = f.solid === 'ice'
      m = water ? clean(int(r, 1, 40) * 0.05) : clean(int(r, 2, 50) / 10)
      L = f.L
      name = f.solid
      change = reverse ? 'freezing' : 'melting'
      const takeWater = `Take the latent heat of fusion as ${grouped(L)} J/kg.`
      const takeMetal = `Take the specific latent heat of fusion of ${f.solid} as ${grouped(L)} J/kg.`
      prompts = water
        ? reverse
          ? [
              `How much energy must be removed from ${show(m)} kg of water at 0 °C to freeze it? ${takeWater} Give your answer in J.`,
              `An ice-cube tray holds ${show(m)} kg of water at 0 °C. How much energy does the water release as it freezes? ${takeWater} Give your answer in J.`,
            ]
          : [
              `How much energy is needed to melt ${show(m)} kg of ice at 0 °C? ${takeWater} Give your answer in J.`,
              `A block of ice of mass ${show(m)} kg is at 0 °C. Calculate the energy needed to melt it completely. ${takeWater} Give your answer in J.`,
            ]
        : reverse
          ? [`${show(m)} kg of molten ${f.liquid} at ${f.at} solidifies. How much energy does it release? ${takeMetal} Give your answer in J.`]
          : [
              `A block of ${f.solid} of mass ${show(m)} kg is at ${f.at}. How much energy is needed to melt it completely? ${takeMetal} Give your answer in J.`,
              `How much energy is needed to melt ${show(m)} kg of ${f.solid} that is already at ${f.at}? ${takeMetal} Give your answer in J.`,
            ]
    } else {
      const v = pick(r, VAPORISATION)
      const water = v.liquid === 'water'
      m = clean(int(r, 1, 40) * 0.05)
      L = v.L
      name = v.liquid
      change = reverse ? 'condensing' : 'boiling'
      const take = water ? `Take L = ${grouped(L)} J/kg.` : `Take the specific latent heat of vaporisation of ethanol as ${grouped(L)} J/kg.`
      prompts = water
        ? reverse
          ? [
              `${show(m)} kg of steam at 100 °C condenses to water at 100 °C. How much energy does it release? ${take} Give your answer in J.`,
              `How much energy is released when ${show(m)} kg of steam at 100 °C condenses? ${take} Give your answer in J.`,
            ]
          : [
              `How much energy is needed to boil away ${show(m)} kg of water at 100 °C? ${take} Give your answer in J.`,
              `A pan holds ${show(m)} kg of water at 100 °C. How much energy is needed to turn all of it into steam? ${take} Give your answer in J.`,
            ]
        : reverse
          ? [`${show(m)} kg of ethanol vapour at ${v.at} condenses. How much energy does it release? ${take} Give your answer in J.`]
          : [`How much energy is needed to boil away ${show(m)} kg of ethanol at ${v.at}? ${take} Give your answer in J.`]
    }
    const E = whole(m * L)
    const solution = `A change of state happens at one temperature, so there is no $\\Delta\\theta$: $E = mL = ${tex(m)} \\times ${tex(L)} = ${tex(E)}$ J. The energy ${reverse ? 'released' : 'needed'} is ${boxed(E, 'J')}.`
    return {
      question: { type: 'numeric', prompt: pick(r, prompts), solution, markScheme: scheme(slot, ['uses E = mL'], show(E)), answer: E, tolerance: 0, units: 'J' },
      // Second route: the energy back over the latent heat gives the mass.
      check: { agrees: near(E / L, m) && Number.isInteger(E), detail: `${tex(E)} ÷ ${tex(L)} = ${show(E / L)} kg` },
      values: { substance: name, m, L, change },
    }
  },
}

/* ------------------------------------------------------------------------------------------ */
/* Rearranging ΔE = mcΔθ                                                                       */
/* ------------------------------------------------------------------------------------------ */

/** Specific heat capacities an unnamed block or liquid can have, all realistic. */
const UNNAMED_METAL_C = [130, 240, 380, 390, 450, 500, 900]
const UNNAMED_LIQUID_C = [2000, 2400, 4200]

/**
 * ΔE = mcΔθ rearranged: written as q5 (a 0.5 kg block of copper given 21 000 J, the rise to
 * 1 decimal place, 3 marks) and q11 (a 2 kg block given 36 000 J rises 20 °C, find c, 3
 * marks). q5 keeps the temperature change and q11 the specific heat capacity; in q11 the
 * block is a named metal, whose c comes out, or an unnamed one, as written.
 */
export const specificHeatRearranged: Generator = {
  id: 'specific-heat-rearranged',
  subjectId: 'physics',
  topicId: THERMAL,
  replaces: ['q5', 'q11'],
  build(r, slot, turn): Draft {
    const cooling = r() < 0.3
    if (slot.id === 'q5') {
      const kind = turn % 2 === 0 ? 'metal' : 'water'
      const s = heated(r, kind)
      // Energy in round hundreds or thousands, at least 1000 J, giving a change the holder's
      // water (or a block) really has, not a whole number, and rounding cleanly. The energy is
      // drawn as the round number itself: rounding mc × Δθ to the unit gave a whole Δθ back
      // whenever mc was a multiple of it.
      const [lo, hi] = changeRange(s.holder, cooling)
      const mc = clean(s.m * s.c)
      const unit = mc * hi >= 100000 ? 1000 : 100
      const { E, d } = draw(
        r,
        (r) => {
          const E = int(r, Math.max(Math.ceil((lo * mc) / unit), Math.ceil(1000 / unit)), Math.floor((hi * mc) / unit)) * unit
          return { E, d: E / mc }
        },
        ({ E, d }) => d >= lo && d <= hi && !Number.isInteger(roundTo(d, 1)) && clearOfHalf(d, 1) && E >= 1000,
      )
      const answer = roundTo(d, 1)
      const take = kind === 'water' ? `Take c = ${C_WATER} J/kg°C.` : `Take c = ${s.c} J/kg°C for ${s.substance}.`
      const toDp = 'Give your answer in °C to 1 decimal place.'
      const prompts = kind === 'water'
        ? cooling
          ? [`The ${s.article} in a ${s.holder} transfers ${grouped(E)} J to the room as it cools. By how much does its temperature fall? ${take} ${toDp}`]
          : [
              `A ${s.holder} holds ${s.article}. The water is given ${grouped(E)} J. By how much does its temperature rise? ${take} ${toDp}`,
              `An electric heater transfers ${grouped(E)} J to the ${s.article} in a ${s.holder}. Calculate the rise in temperature of the water. ${take} ${toDp}`,
            ]
        : cooling
          ? [`A ${s.article} transfers ${grouped(E)} J to its surroundings as it cools. By how much does its temperature fall? ${take} ${toDp}`]
          : [
              `A ${s.article} is given ${grouped(E)} J. By how much does its temperature rise? ${take} ${toDp}`,
              `An electric heater transfers ${grouped(E)} J to a ${s.article}. Calculate the rise in temperature of the block. ${take} ${toDp}`,
            ]
      const solution = `Rearrange $\\Delta E = mc\\Delta\\theta$: $\\Delta\\theta = \\dfrac{\\Delta E}{mc} = \\dfrac{${tex(E)}}{${tex(s.m)} \\times ${tex(s.c)}} = \\dfrac{${tex(E)}}{${tex(mc)}} = ${fixed(d, 3)}$, so **${fixed(d, 1)} °C** to 1 decimal place.`
      // Second route: the rounded answer put back gives the energy to within the rounding.
      const back = s.m * s.c * answer
      return {
        question: { type: 'numeric', prompt: pick(r, prompts), solution, markScheme: scheme(slot, ['rearranges for Δθ', `denominator of ${grouped(mc)}`], fixed(d, 1)), answer, tolerance: 0.05, units: '°C' },
        check: { agrees: Math.abs(back - E) <= mc * 0.05 + 1e-9 && near(E / s.m / s.c, d), detail: `${show(s.m)} × ${s.c} × ${answer} = ${show(back)}, against ${E}` },
        values: { task: 'rise', substance: s.substance, ...(s.holder ? { holder: s.holder } : {}), m: s.m, c: s.c, E, direction: cooling ? 'cooling' : 'heating' },
      }
    }
    // q11: the specific heat capacity, of a named metal, of water, or of an unnamed block or liquid.
    const kind = (['named', 'unnamed-metal', 'water', 'unnamed-liquid'] as const)[turn % 4]!
    const water = kind === 'water' ? heated(r, 'water') : undefined
    const d = int(r, ...changeRange(water?.holder, cooling))
    const metal = kind === 'named' ? pick(r, METALS) : undefined
    const c = metal ? metal.c : water ? C_WATER : kind === 'unnamed-metal' ? pick(r, UNNAMED_METAL_C) : pick(r, UNNAMED_LIQUID_C)
    const m = water ? water.m : kind === 'unnamed-liquid' ? clean(int(r, 5, 30) / 10) : blockMass(r, c)
    const name = metal ? metal.name : water ? 'water' : kind === 'unnamed-metal' ? 'a block' : 'a liquid'
    const E = whole(m * c * d)
    const prompts = metal
      ? cooling
        ? [`A ${show(m)} kg block of ${name} cools by ${d} °C and transfers ${grouped(E)} J to its surroundings. Calculate the specific heat capacity of ${name}, in J/kg°C.`]
        : [
            `A student heats a ${show(m)} kg block of ${name} with an electric heater. The heater transfers ${grouped(E)} J and the temperature of the block rises by ${d} °C. Calculate the specific heat capacity of ${name}, in J/kg°C.`,
            `A ${show(m)} kg block of ${name} is given ${grouped(E)} J and its temperature rises by ${d} °C. What is the specific heat capacity of ${name}, in J/kg°C?`,
          ]
      : water
        ? cooling
          ? [`The ${water.article} in a ${water.holder} cools by ${d} °C and releases ${grouped(E)} J. Calculate the specific heat capacity of water, in J/kg°C.`]
          : [
              `A ${water.holder} holds ${water.article}. The water is given ${grouped(E)} J and its temperature rises by ${d} °C. Calculate the specific heat capacity of water, in J/kg°C.`,
              `A heater transfers ${grouped(E)} J to ${water.article} and its temperature rises by ${d} °C. What is the specific heat capacity of water, in J/kg°C?`,
            ]
        : kind === 'unnamed-metal'
          ? cooling
            ? [`A ${show(m)} kg block cools by ${d} °C and transfers ${grouped(E)} J to its surroundings. What is its specific heat capacity, in J/kg°C?`]
            : [
                `A ${show(m)} kg block is given ${grouped(E)} J and rises by ${d} °C. What is its specific heat capacity, in J/kg°C?`,
                `A heater transfers ${grouped(E)} J to a metal block of mass ${show(m)} kg, and its temperature rises by ${d} °C. Calculate the specific heat capacity of the metal, in J/kg°C.`,
              ]
          : cooling
            ? [`${show(m)} kg of a liquid cools by ${d} °C and releases ${grouped(E)} J. What is the specific heat capacity of the liquid, in J/kg°C?`]
            : [
                `${show(m)} kg of a liquid is given ${grouped(E)} J and its temperature rises by ${d} °C. What is the specific heat capacity of the liquid, in J/kg°C?`,
                `A heater transfers ${grouped(E)} J to ${show(m)} kg of a liquid in a beaker. The temperature rises by ${d} °C. Calculate the specific heat capacity of the liquid, in J/kg°C.`,
              ]
    const md = clean(m * d)
    const solution = `Rearrange $\\Delta E = mc\\Delta\\theta$: $c = \\dfrac{\\Delta E}{m\\Delta\\theta} = \\dfrac{${tex(E)}}{${tex(m)} \\times ${d}} = \\dfrac{${tex(E)}}{${tex(md)}} = ${c}$ J/kg°C.`
    return {
      question: { type: 'numeric', prompt: pick(r, prompts), solution, markScheme: scheme(slot, ['rearranges for c', `denominator of ${show(md)}`], String(c)), answer: c, tolerance: 0, units: 'J/kg°C' },
      // Second route: the answer put back into mcΔθ gives the energy exactly.
      check: { agrees: near(m * c * d, E) && near(E / md, c), detail: `${show(m)} × ${c} × ${d} = ${show(m * c * d)}` },
      values: { task: 'c', substance: name, m, c, d, E, direction: cooling ? 'cooling' : 'heating' },
    }
  },
}

/* ------------------------------------------------------------------------------------------ */
/* Δθ                                                                                          */
/* ------------------------------------------------------------------------------------------ */

const CHANGES: { text: (from: string, to: string) => string; from: [number, number]; to: [number, number] }[] = [
  { text: (a, b) => `A substance rises from ${a} to ${b}.`, from: [5, 40], to: [45, 100] },
  { text: (a, b) => `A metal block is heated from ${a} to ${b}.`, from: [10, 30], to: [40, 100] },
  { text: (a, b) => `The water in a kettle is heated from ${a} to ${b}.`, from: [8, 25], to: [60, 100] },
  { text: (a, b) => `A cup of tea cools from ${a} to ${b}.`, from: [70, 95], to: [30, 55] },
  { text: (a, b) => `The water in a bath cools from ${a} to ${b}.`, from: [38, 45], to: [20, 30] },
  { text: (a, b) => `A substance cools from ${a} to ${b}.`, from: [45, 100], to: [5, 40] },
  { text: (a, b) => `Water in a freezer cools from ${a} to ${b}.`, from: [4, 15], to: [-20, -5] },
  { text: (a, b) => `Overnight the air cools from ${a} to ${b}.`, from: [2, 9], to: [-8, -1] },
]

/**
 * The temperature change from two temperatures: written as q9 (20 °C to 65 °C, 1 mark). A
 * rise or a fall, and a change through 0 °C, where the slip of reading off one temperature
 * is furthest from the change.
 */
export const thermalTemperatureChange: Generator = {
  id: 'thermal-temperature-change',
  subjectId: 'physics',
  topicId: THERMAL,
  replaces: ['q9'],
  build(r, slot): Draft {
    const c = pick(r, CHANGES)
    const t1 = int(r, ...c.from)
    const t2 = int(r, ...c.to)
    const d = Math.abs(t2 - t1)
    const deg = (t: number) => (t < 0 ? `$${t}$ °C` : `${t} °C`)
    const hot = Math.max(t1, t2)
    const cold = Math.min(t1, t2)
    const sub = cold < 0 ? `${hot} - (${cold})` : `${hot} - ${cold}`
    return {
      question: {
        type: 'numeric',
        prompt: `${c.text(deg(t1), deg(t2))} What is $\\Delta\\theta$, in °C?`,
        solution: `$\\Delta\\theta$ is a **change**: $${sub} = ${d}$ °C, not ${hot}.${cold < 0 ? ' Count through 0 °C: the two temperatures are on opposite sides of it.' : ''}`,
        markScheme: scheme(slot, [], String(d)),
        answer: d,
        tolerance: 0,
        units: '°C',
      },
      // Second route: the change added to the lower temperature gives the higher.
      check: { agrees: cold + d === hot && d > 0, detail: `${cold} + ${d} = ${cold + d}` },
      values: { t1, t2, direction: t2 > t1 ? 'rise' : 'fall' },
    }
  },
}

/* ------------------------------------------------------------------------------------------ */
/* Two stages                                                                                  */
/* ------------------------------------------------------------------------------------------ */

const C_ICE = 2100
type Stages = 'steam' | 'condense' | 'melt-warm' | 'warm-ice-melt'
const STAGES: Stages[] = ['steam', 'condense', 'melt-warm', 'warm-ice-melt']

/**
 * Heating through a change of state: written as q13 (0.5 kg of water at 20 °C to steam, 3
 * marks: heating stage, boiling stage, total). Also steam condensing then cooling, ice at
 * 0 °C melting then warming, and ice below 0 °C warming then melting.
 */
export const heatingTwoStages: Generator = {
  id: 'heating-two-stages',
  subjectId: 'physics',
  topicId: THERMAL,
  replaces: ['q13'],
  build(r, slot, turn): Draft {
    const kind = STAGES[turn % 4]!
    const m = clean(int(r, 1, 20) / 10)
    let t: number, c: number, L: number, d: number, prompt: string, first: string, second: string, heatFirst: boolean, released: boolean
    if (kind === 'steam') {
      t = int(r, 10, 40)
      c = C_WATER
      L = L_VAPOUR_WATER
      d = 100 - t
      heatFirst = true
      released = false
      first = 'heating'
      second = 'boiling'
      prompt = pick(r, [
        `How much energy in total turns ${show(m)} kg of water at ${t} °C completely into steam at 100 °C? Take c = 4200 J/kg°C and L = 2 260 000 J/kg. Give your answer in J.`,
        `A pan holds ${show(m)} kg of water at ${t} °C. How much energy is needed to heat the water to 100 °C and then boil all of it away? Take c = 4200 J/kg°C and L = 2 260 000 J/kg. Give your answer in J.`,
      ])
    } else if (kind === 'condense') {
      t = int(r, 20, 60)
      c = C_WATER
      L = L_VAPOUR_WATER
      d = 100 - t
      heatFirst = false
      released = true
      first = 'condensing'
      second = 'cooling'
      prompt = pick(r, [
        `How much energy in total is released when ${show(m)} kg of steam at 100 °C condenses and the water then cools to ${t} °C? Take c = 4200 J/kg°C and L = 2 260 000 J/kg. Give your answer in J.`,
        `${show(m)} kg of steam at 100 °C condenses, and the water formed cools to ${t} °C. Calculate the total energy released. Take c = 4200 J/kg°C and L = 2 260 000 J/kg. Give your answer in J.`,
      ])
    } else if (kind === 'melt-warm') {
      t = int(r, 10, 60)
      c = C_WATER
      L = L_FUSION_WATER
      d = t
      heatFirst = false
      released = false
      first = 'melting'
      second = 'heating'
      prompt = pick(r, [
        `How much energy in total turns ${show(m)} kg of ice at 0 °C into water at ${t} °C? Take c = 4200 J/kg°C for water and L = 334 000 J/kg. Give your answer in J.`,
        `${show(m)} kg of ice at 0 °C melts and the water then warms to ${t} °C. Calculate the total energy needed. Take c = 4200 J/kg°C for water and L = 334 000 J/kg. Give your answer in J.`,
      ])
    } else {
      t = -int(r, 5, 30)
      c = C_ICE
      L = L_FUSION_WATER
      d = -t
      heatFirst = true
      released = false
      first = 'heating'
      second = 'melting'
      prompt = pick(r, [
        `How much energy in total turns ${show(m)} kg of ice at $${t}$ °C into water at 0 °C? Take c = 2100 J/kg°C for ice and L = 334 000 J/kg. Give your answer in J.`,
        `A block of ice of mass ${show(m)} kg is at $${t}$ °C. Calculate the total energy needed to warm it to 0 °C and then melt it. Take c = 2100 J/kg°C for ice and L = 334 000 J/kg. Give your answer in J.`,
      ])
    }
    const E1 = whole(m * c * d)
    const E2 = whole(m * L)
    const E = E1 + E2
    const heat = `${cap(heatFirst ? first : second)}: $\\Delta E = mc\\Delta\\theta = ${tex(m)} \\times ${tex(c)} \\times ${d} = ${tex(E1)}$ J.`
    const change = `${cap(heatFirst ? second : first)}: $E = mL = ${tex(m)} \\times ${tex(L)} = ${tex(E2)}$ J.`
    const solution = `${heatFirst ? `${heat} ${change}` : `${change} ${heat}`} Total $${tex(heatFirst ? E1 : E2)} + ${tex(heatFirst ? E2 : E1)} = ${tex(E)}$ J, so the energy ${released ? 'released' : 'needed'} is ${boxed(E, 'J')}.`
    const method = heatFirst ? [`${first} stage ${grouped(E1)} J`, `${second} stage ${grouped(E2)} J`] : [`${first} stage ${grouped(E2)} J`, `${second} stage ${grouped(E1)} J`]
    // Second route: the mass times the energy per kilogram of both stages together.
    const perKg = c * d + L
    return {
      question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, method, show(E)), answer: E, tolerance: 0, units: 'J' },
      check: { agrees: near(m * perKg, E) && Number.isInteger(E), detail: `${show(m)} × (${c} × ${d} + ${L}) = ${show(m * perKg)}` },
      values: { kind, m, t, c, L, E1, E2 },
    }
  },
}

/* ------------------------------------------------------------------------------------------ */
/* Power and time                                                                              */
/* ------------------------------------------------------------------------------------------ */

/** Heaters and the powers they come in, W, in steps of 100. */
export const HEATERS: { name: string; power: [number, number] }[] = [
  { name: 'kettle', power: [15, 30] },
  { name: 'immersion heater', power: [10, 30] },
  { name: 'electric heater', power: [5, 20] },
  { name: 'hob ring', power: [10, 20] },
  { name: 'travel kettle', power: [8, 12] },
]

/**
 * t = E/P: written as q14 (a 2000 W kettle supplying 168 000 J, 2 marks). A heater named
 * with its power and the energy it supplies, the time a whole number of seconds.
 */
export const heaterTime: Generator = {
  id: 'heater-time-from-energy',
  subjectId: 'physics',
  topicId: THERMAL,
  replaces: ['q14'],
  build(r, slot): Draft {
    const h = pick(r, HEATERS)
    const P = int(r, ...h.power) * 100
    const t = int(r, 20, 600)
    const E = P * t
    // "Rated at 800 W" rather than "a 800 W kettle": the article before a number read aloud
    // ("an eight-hundred-watt") cannot be chosen from its digits.
    const prompt = pick(r, [
      `${cap(an(h.name))} rated at ${P} W supplies ${grouped(E)} J. How long does it take, in seconds?`,
      `${cap(an(h.name))} with a power of ${P} W transfers ${grouped(E)} J. How long does this take, in seconds?`,
      `How long does ${an(h.name)} rated at ${P} W take to supply ${grouped(E)} J? Give your answer in seconds.`,
      `${cap(an(h.name))} is rated at ${P} W. How long does it take to transfer ${grouped(E)} J, in seconds?`,
    ])
    return {
      question: {
        type: 'numeric',
        prompt,
        solution: `$E = Pt$, so $t = \\dfrac{E}{P} = \\dfrac{${tex(E)}}{${tex(P)}} = ${t}$ s.`,
        markScheme: scheme(slot, ['rearranges E = Pt'], String(t)),
        answer: t,
        tolerance: 0,
        units: 's',
      },
      // Second route: power times the time gives the energy back.
      check: { agrees: P * t === E && E / P === t, detail: `${P} × ${t} = ${P * t}` },
      values: { heater: h.name, P, E },
    }
  },
}

/**
 * E = mL then t = E/P: written as q16 (a 2000 W kettle boiling away 0.5 kg of water, 3
 * marks: the energy, the division, the time). Boiling water away or melting ice.
 */
export const latentHeatHeaterTime: Generator = {
  id: 'latent-heat-heater-time',
  subjectId: 'physics',
  topicId: THERMAL,
  replaces: ['q16'],
  build(r, slot, turn): Draft {
    const melting = turn % 2 === 1
    const L = melting ? L_FUSION_WATER : L_VAPOUR_WATER
    const h = pick(r, melting ? HEATERS.filter((x) => x.name !== 'kettle' && x.name !== 'travel kettle') : HEATERS.filter((x) => x.name !== 'immersion heater'))
    const { m, P, E, t } = draw(
      r,
      (r) => {
        const m = melting ? clean(int(r, 1, 40) * 0.05) : clean(int(r, 1, 20) / 10)
        const P = int(r, ...h.power) * 100
        const E = whole(m * L)
        return { m, P, E, t: E / P }
      },
      ({ t }) => Number.isInteger(t) && t >= 30 && t <= 1500,
    )
    const rated = `${cap(an(h.name))} rated at ${P} W`
    const prompt = melting
      ? pick(r, [
          `${rated} is used to melt ${show(m)} kg of ice at 0 °C. How long does it take, in seconds? Take L = ${grouped(L)} J/kg.`,
          `${show(m)} kg of ice at 0 °C is melted by ${an(h.name)} rated at ${P} W. How long does this take, in seconds? Take the latent heat of fusion as ${grouped(L)} J/kg.`,
        ])
      : h.name === 'hob ring'
        ? `A pan on a hob ring rated at ${P} W holds ${show(m)} kg of water at 100 °C. How long does it take to boil all of it away, in seconds? Take L = ${grouped(L)} J/kg.`
        : pick(r, [
            `${rated} boils away ${show(m)} kg of water at 100 °C. How long does it take, in seconds? Take L = ${grouped(L)} J/kg.`,
            `${cap(an(h.name))} has a power of ${P} W. How long does it take to boil away ${show(m)} kg of water that is already at 100 °C, in seconds? Take L = ${grouped(L)} J/kg.`,
          ])
    return {
      question: {
        type: 'numeric',
        prompt,
        solution: `$E = mL = ${tex(m)} \\times ${tex(L)} = ${tex(E)}$ J, so $t = \\dfrac{E}{P} = \\dfrac{${tex(E)}}{${tex(P)}} = ${t}$ s.`,
        markScheme: scheme(slot, [`energy of ${grouped(E)} J`, `divides by ${P}`], String(t)),
        answer: t,
        tolerance: 0,
        units: 's',
      },
      // Second route: the heater's energy in that time is the latent heat of the mass.
      check: { agrees: P * t === E && near(E / L, m), detail: `${P} × ${t} = ${P * t}; ${show(m)} × ${L} = ${E}` },
      values: { change: melting ? 'melting' : 'boiling', heater: h.name, m, P, L },
    }
  },
}

/**
 * A substance at its flat section on a heating graph, with its latent heat (J/kg) and the
 * mass a beaker or kettle of it can hold, so the energy supplied is the energy for a real
 * amount: 1.8 MJ into stearic acid would melt 9 kg of it.
 */
export const FLAT_SECTIONS: { substance: string; change: 'boils' | 'melts'; at: number; L: number; mass: [number, number] }[] = [
  { substance: 'water', change: 'boils', at: 100, L: L_VAPOUR_WATER, mass: [0.1, 2] },
  { substance: 'ice', change: 'melts', at: 0, L: L_FUSION_WATER, mass: [0.1, 1] },
  { substance: 'ethanol', change: 'boils', at: 78, L: 840000, mass: [0.05, 0.5] },
  { substance: 'stearic acid', change: 'melts', at: 69, L: 199000, mass: [0.05, 0.5] },
  { substance: 'naphthalene', change: 'melts', at: 80, L: 148000, mass: [0.05, 0.5] },
  { substance: 'candle wax', change: 'melts', at: 55, L: 200000, mass: [0.05, 0.5] },
]

/**
 * E = Pt during a flat section of a heating graph: written as q20 (water boiling for 1130 s
 * on a 1000 W heater, 2 marks). The written question carries no unit on its answer box.
 */
export const heatingGraphEnergy: Generator = {
  id: 'heating-graph-energy',
  subjectId: 'physics',
  topicId: THERMAL,
  replaces: ['q20'],
  build(r, slot): Draft {
    const f = pick(r, FLAT_SECTIONS)
    // The time is drawn from the mass the heater could change in it, in tens of seconds from
    // a minute: 1.8 MJ into stearic acid would melt 9 kg of it.
    const { P, t } = draw(
      r,
      (r) => {
        const P = int(r, 5, 30) * 100
        const lo = Math.max(6, Math.ceil((f.mass[0] * f.L) / P / 10))
        const hi = Math.min(200, Math.floor((f.mass[1] * f.L) / P / 10))
        return { P, t: lo <= hi ? int(r, lo, hi) * 10 : 0 }
      },
      ({ P, t }) => t >= 60 && (P * t) / f.L >= f.mass[0] && (P * t) / f.L <= f.mass[1],
    )
    const E = P * t
    const noun = f.change === 'boils' ? 'boiling' : 'melting'
    const prompt = pick(r, [
      `On a heating graph, ${f.substance} ${f.change} at ${f.at} °C for ${t} s while a heater rated at ${P} W supplies energy. Calculate the energy supplied during ${noun}, in J.`,
      `A heater rated at ${P} W warms a beaker of ${f.substance}. The heating graph is flat at ${f.at} °C for ${t} s while the ${f.substance} ${f.change}. How much energy does the heater supply during the flat section, in J?`,
      `${cap(f.substance)} is heated by a heater with a power of ${P} W. Its temperature stays at ${f.at} °C for ${t} s while it ${f.change}. Calculate the energy supplied in that time, in J.`,
    ])
    return {
      question: {
        type: 'numeric',
        prompt,
        solution: `$E = Pt = ${tex(P)} \\times ${t} = ${tex(E)}$ J, so the energy supplied is ${boxed(E, 'J')}. The temperature does not change, so that is the energy for the change of state: it equals $mL$.`,
        markScheme: scheme(slot, [`${P} × ${t}`], show(E)),
        answer: E,
        tolerance: 0,
      },
      // Second route: the energy over the time gives the power back.
      check: { agrees: E / t === P && E / P === t, detail: `${E} ÷ ${t} = ${E / t}` },
      values: { substance: f.substance, change: f.change, at: f.at, P, t },
    }
  },
}

/* ------------------------------------------------------------------------------------------ */
/* Behaviour of gases                                                                          */
/* ------------------------------------------------------------------------------------------ */

/**
 * Containers of gas: the volumes they hold (cm³, in steps), what moves to change the volume,
 * and the highest pressure that is believable in them. A gas syringe is 20–200 cm³ and leaks
 * past its plunger long before 1000 kPa.
 */
export const CONTAINERS: { name: string; mover?: string; volume: [number, number]; step: number; maxP: number }[] = [
  { name: 'gas syringe', mover: 'plunger', volume: [4, 40], step: 5, maxP: 400 },
  { name: 'bicycle pump', mover: 'plunger', volume: [10, 50], step: 10, maxP: 800 },
  { name: 'cylinder fitted with a piston', mover: 'piston', volume: [20, 200], step: 10, maxP: 1000 },
  { name: 'gas', volume: [10, 200], step: 10, maxP: 1000 },
]
/** A pump is a compressor: it starts at atmospheric pressure or above and is only ever pushed in. */
const PUMP = 'bicycle pump'

/** A starting pressure in tens of kPa up to `hi` tens, or atmospheric (101): never below 100 kPa in a pump. */
const startPressure = (r: Rng, c: { name: string; maxP: number }, hi: number) =>
  r() < 0.15 ? 101 : int(r, c.name === PUMP ? 10 : 5, Math.min(hi, c.maxP / 10)) * 10

/**
 * pV = constant: written as q3 (150 kPa and 400 cm³ to 200 cm³, 2 marks), q5, q11 and q14
 * (new pressure, 3 marks) and q7 (new volume, 3 marks). Each slot keeps what it asks for;
 * consecutive turns alternate between a compression and an expansion, so a sheet with two
 * of these has one of each.
 */
export const boylesLaw: Generator = {
  id: 'boyles-law',
  subjectId: 'physics',
  topicId: GASES,
  replaces: ['q3', 'q5', 'q7', 'q11', 'q14'],
  build(r, slot, turn): Draft {
    const task = slot.id === 'q7' ? 'volume' : 'pressure'
    const compress = turn % 2 === 0
    const pool = compress ? CONTAINERS : CONTAINERS.filter((x) => x.name !== PUMP)
    const c = slot.id === 'q11' ? pick(r, pool.filter((x) => x.mover)) : pick(r, pool)
    // Volumes in the container's steps, pressures in tens of kPa (or atmospheric, 101), and
    // the unknown a whole number. The known pressure and volume both change by at least a
    // fifth, so the new pair is plainly different, and the new pressure is never the old
    // volume's figure (80 cm³ at 180 kPa becoming 180 cm³ at 80 kPa reads as a swap).
    // A container with a plunger or piston cannot grow past its own size; a bare gas can double.
    const top = c.volume[1] * c.step * (c.mover ? 1 : 2)
    const { p1, V1, p2, V2 } = draw(
      r,
      (r) => {
        const p1 = startPressure(r, c, 30)
        const V1 = int(r, ...c.volume) * c.step
        if (task === 'pressure') {
          const V2 = compress ? int(r, 1, V1 / c.step - 1) * c.step : int(r, V1 / c.step + 1, top / c.step) * c.step
          return { p1, V1, V2, p2: (p1 * V1) / V2 }
        }
        const p2 = compress ? int(r, Math.ceil(p1 / 10) + 1, c.maxP / 10) * 10 : int(r, 2, Math.ceil(p1 / 10) - 1) * 10
        return { p1, V1, p2, V2: (p1 * V1) / p2 }
      },
      ({ p1, V1, p2, V2 }) =>
        Number.isInteger(p2) && Number.isInteger(V2) && p2 >= 20 && p2 <= c.maxP && V2 >= 10 && V2 <= top && Math.abs(p2 - p1) >= p1 / 5 && Math.abs(V2 - V1) >= V1 / 5 && p2 !== V1 && p1 !== V2,
    )
    const k = p1 * V1
    const ratio = compress ? V1 / V2 : V2 / V1
    const why = Number.isInteger(ratio)
      ? compress
        ? `The volume is divided by ${ratio}, so the pressure is multiplied by ${ratio}.`
        : `The volume is multiplied by ${ratio}, so the pressure is divided by ${ratio}.`
      : compress
        ? 'Smaller volume, higher pressure.'
        : 'Larger volume, lower pressure.'
    let prompt: string, solution: string, method: string[], answer: number, units: string
    if (task === 'pressure') {
      const moved = compress ? 'pushed in slowly' : 'pulled out slowly'
      prompt = c.mover
        ? pick(r, [
            `${cap(an(c.name))} holds ${V1} cm³ of air at ${p1} kPa. The ${c.mover} is ${moved} until the air occupies ${V2} cm³. What is the new pressure, in kPa?`,
            `The air in ${an(c.name)} occupies ${V1} cm³ at ${p1} kPa. The ${c.mover} is ${moved}, keeping the temperature constant, until the volume is ${V2} cm³. Calculate the new pressure, in kPa.`,
          ])
        : pick(r, [
            `A gas at ${p1} kPa fills ${V1} cm³. It ${compress ? 'is compressed' : 'expands'} to ${V2} cm³ at the same temperature. What is the new pressure, in kPa?`,
            `A fixed mass of gas occupies ${V1} cm³ at ${p1} kPa. At constant temperature its volume ${compress ? 'is squeezed down' : 'grows'} to ${V2} cm³. What is the pressure now, in kPa?`,
          ])
      solution = `$pV = ${tex(p1)} \\times ${V1} = ${tex(k)}$, so $p_2 = \\dfrac{${tex(k)}}{${V2}} = ${p2}$ kPa. ${why}`
      method = [slot.marks === 2 ? `finds the constant, ${grouped(k)}` : `constant of ${grouped(k)}`, `divides by ${V2}`]
      answer = p2
      units = 'kPa'
    } else {
      const to = compress ? 'rises' : 'falls'
      prompt = c.mover
        ? pick(r, [
            `${cap(an(c.name))} holds ${V1} cm³ of air at ${p1} kPa. The ${c.mover} is ${compress ? 'pushed in slowly' : 'pulled out slowly'} until the pressure is ${p2} kPa. What volume does the air occupy now, in cm³?`,
            `The air in ${an(c.name)} occupies ${V1} cm³ at ${p1} kPa. At constant temperature the pressure ${to} to ${p2} kPa. Calculate the new volume, in cm³.`,
          ])
        : pick(r, [
            `A gas at ${p1} kPa occupies ${V1} cm³. The pressure ${to} to ${p2} kPa at constant temperature. What is the new volume, in cm³?`,
            `A fixed mass of gas fills ${V1} cm³ at ${p1} kPa. Its pressure ${to} to ${p2} kPa while the temperature stays the same. What volume does it fill now, in cm³?`,
          ])
      solution = `$pV = ${tex(p1)} \\times ${V1} = ${tex(k)}$, so $V_2 = \\dfrac{${tex(k)}}{${p2}} = ${V2}$ cm³. ${compress ? 'Higher pressure, smaller volume.' : 'Lower pressure, larger volume.'}`
      method = [slot.marks === 2 ? `finds the constant, ${grouped(k)}` : `constant of ${grouped(k)}`, `divides by ${p2}`]
      answer = V2
      units = 'cm³'
    }
    return {
      question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, method, String(answer)), answer, tolerance: 0, units },
      // Second route: the new pair multiplied gives the same constant.
      check: { agrees: p2 * V2 === k && (compress ? p2 > p1 && V2 < V1 : p2 < p1 && V2 > V1), detail: `${p2} × ${V2} = ${p2 * V2}; ${p1} × ${V1} = ${k}` },
      values: { task, direction: compress ? 'compress' : 'expand', container: c.name, p1, V1, p2, V2 },
    }
  },
}

/** The value of pV: written as q9 (800 cm³ at 250 kPa, 1 mark, no unit on the answer box). */
export const gasPvProduct: Generator = {
  id: 'gas-pv-product',
  subjectId: 'physics',
  topicId: GASES,
  replaces: ['q9'],
  build(r, slot): Draft {
    const c = pick(r, CONTAINERS)
    const p = startPressure(r, c, 40)
    const V = int(r, ...c.volume) * c.step
    const k = p * V
    const prompt = c.mover
      ? pick(r, [
          `${cap(an(c.name))} holds ${V} cm³ of air at ${p} kPa. Calculate pV for the air, in kPa cm³.`,
          `The air in ${an(c.name)} occupies ${V} cm³ at a pressure of ${p} kPa. What is the value of pV, in kPa cm³?`,
        ])
      : pick(r, [
          `A gas occupies ${V} cm³ at ${p} kPa. What is the value of pV, in kPa cm³?`,
          `The pressure of a fixed mass of gas is ${p} kPa and its volume is ${V} cm³. Work out the value of the constant pV, in kPa cm³.`,
        ])
    return {
      question: {
        type: 'numeric',
        prompt,
        solution: `$pV = ${tex(p)} \\times ${V} = ${tex(k)}$ kPa cm³, so the constant is ${boxed(k, 'kPa cm³')}. It stays the same while the temperature does.`,
        markScheme: scheme(slot, [], show(k)),
        answer: k,
        tolerance: 0,
      },
      // Second route: the constant over the pressure gives the volume back.
      check: { agrees: k / p === V && k / V === p, detail: `${k} ÷ ${p} = ${k / p}` },
      values: { container: c.name, p, V },
    }
  },
}

/** The volume from the constant: written as q16 (pV = 48 000 kPa cm³ at 160 kPa, 2 marks). */
export const gasVolumeFromPv: Generator = {
  id: 'gas-volume-from-pv',
  subjectId: 'physics',
  topicId: GASES,
  replaces: ['q16'],
  build(r, slot): Draft {
    const c = pick(r, CONTAINERS)
    const p = startPressure(r, c, 50)
    const V = int(r, ...c.volume) * c.step
    const k = p * V
    const prompt = c.mover
      ? pick(r, [
          `The constant pV for the air in ${an(c.name)} is ${grouped(k)} kPa cm³. What volume does the air occupy when its pressure is ${p} kPa, in cm³?`,
          `For the air trapped in ${an(c.name)}, pV = ${grouped(k)} kPa cm³ at constant temperature. Calculate the volume of the air when the pressure is ${p} kPa, in cm³.`,
        ])
      : pick(r, [
          `A fixed mass of gas has pV = ${grouped(k)} kPa cm³. What volume does it occupy at ${p} kPa, in cm³?`,
          `For a fixed mass of gas at constant temperature, pV = ${grouped(k)} kPa cm³. What is its volume when the pressure is ${p} kPa? Give your answer in cm³.`,
        ])
    return {
      question: {
        type: 'numeric',
        prompt,
        solution: `$pV = ${tex(k)}$, so $V = \\dfrac{${tex(k)}}{${tex(p)}} = ${V}$ cm³.`,
        markScheme: scheme(slot, ['divides the constant by the pressure'], String(V)),
        answer: V,
        tolerance: 0,
        units: 'cm³',
      },
      // Second route: pressure times the volume gives the constant back.
      check: { agrees: p * V === k, detail: `${p} × ${V} = ${p * V}` },
      values: { container: c.name, p, k },
    }
  },
}

/* ------------------------------------------------------------------------------------------ */
/* Density                                                                                     */
/* ------------------------------------------------------------------------------------------ */

/** Densities as the content gives them, kg/m³, every one a multiple of 100 so a mass prints short. */
export const SOLIDS: { name: string; rho: number; thing: string }[] = [
  { name: 'aluminium', rho: 2700, thing: 'block' },
  { name: 'iron', rho: 7900, thing: 'block' },
  { name: 'steel', rho: 7800, thing: 'bar' },
  { name: 'copper', rho: 8900, thing: 'block' },
  { name: 'brass', rho: 8500, thing: 'block' },
  { name: 'lead', rho: 11300, thing: 'block' },
  { name: 'oak', rho: 700, thing: 'block' },
  { name: 'pine', rho: 500, thing: 'plank' },
  { name: 'glass', rho: 2500, thing: 'block' },
  { name: 'concrete', rho: 2400, thing: 'block' },
  { name: 'brick', rho: 1900, thing: 'block' },
  { name: 'gold', rho: 19300, thing: 'bar' },
]
export const RHO_WATER = 1000
export const RHO_AIR = 1.2

/**
 * ρ = m/V with the volume in m³: written as q1 (2.4 kg and 0.0003 m³, 2 marks). A block of a
 * named material, a block left unnamed as written, a volume of water, or the air in a room.
 */
export const densityFromMassAndVolume: Generator = {
  id: 'density-from-mass-and-volume',
  subjectId: 'physics',
  topicId: DENSITY,
  replaces: ['q1'],
  build(r, slot, turn): Draft {
    const kind = (['named', 'unnamed', 'water', 'named', 'air', 'named'] as const)[turn % 6]!
    let rho: number, V: number, prompt: string, substance: string
    if (kind === 'air') {
      rho = RHO_AIR
      V = int(r, 10, 60)
      substance = 'air'
      const m = clean(rho * V)
      prompt = pick(r, [
        `The air in a room has a volume of ${V} m³ and a mass of ${show(m)} kg. What is the density of the air, in kg/m³?`,
        `A room holds ${V} m³ of air, with a mass of ${show(m)} kg. Calculate the density of air, in kg/m³.`,
      ])
    } else if (kind === 'water') {
      rho = RHO_WATER
      V = clean(int(r, 1, 50) / 10000)
      substance = 'water'
      const m = clean(rho * V)
      prompt = pick(r, [
        `A container holds ${show(V)} m³ of water, which has a mass of ${show(m)} kg. What is the density of water, in kg/m³?`,
        `${show(m)} kg of water fills a volume of ${show(V)} m³. Calculate the density of water, in kg/m³.`,
      ])
    } else {
      const s = pick(r, SOLIDS)
      rho = s.rho
      V = clean(int(r, 1, 50) / 10000)
      substance = kind === 'named' ? s.name : 'unnamed'
      const m = clean(rho * V)
      prompt = kind === 'named'
        ? pick(r, [
            `A ${s.thing} of ${s.name} has a mass of ${show(m)} kg and a volume of ${show(V)} m³. Calculate its density, in kg/m³.`,
            `${cap(an(`${s.name} ${s.thing}`))} of mass ${show(m)} kg has a volume of ${show(V)} m³. What is the density of ${s.name}, in kg/m³?`,
          ])
        : pick(r, [
            `A block has a mass of ${show(m)} kg and a volume of ${show(V)} m³. What is its density, in kg/m³?`,
            `An object of mass ${show(m)} kg has a volume of ${show(V)} m³. Calculate its density, in kg/m³.`,
          ])
    }
    const m = clean(rho * V)
    return {
      question: {
        type: 'numeric',
        prompt,
        solution: `$\\rho = \\dfrac{m}{V} = \\dfrac{${show(m)}}{${show(V)}} = ${tex(rho)}$ kg/m³, so the density is ${boxed(rho, 'kg/m³')}.`,
        markScheme: scheme(slot, ['mass over volume'], show(rho)),
        answer: rho,
        tolerance: dpTolerance(rho),
        units: 'kg/m³',
      },
      // Second route: the density times the volume gives the mass back.
      check: { agrees: near(rho * V, m) && near(m / V, rho), detail: `${show(rho)} × ${show(V)} = ${show(rho * V)}` },
      values: { kind, substance, rho, V, m },
    }
  },
}

/** Sides a cube or cuboid can have, m: whole centimetres up to 10 cm. */
const SIDES = [0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.08, 0.1]

/**
 * Density from the dimensions: written as q5 (a cube of side 0.02 m and mass 0.064 kg, 3
 * marks: the volume by cubing, the division, the answer). A cube or a cuboid, named or not.
 */
export const densityOfACube: Generator = {
  id: 'density-of-a-cube',
  subjectId: 'physics',
  topicId: DENSITY,
  replaces: ['q5'],
  build(r, slot, turn): Draft {
    const cuboid = turn % 2 === 1
    const s = pick(r, SOLIDS)
    const named = r() < 0.6
    const { dims, V } = draw(
      r,
      (r) => {
        const dims = cuboid ? [pick(r, SIDES), pick(r, SIDES), pick(r, SIDES)] : [pick(r, SIDES)]
        return { dims, V: clean(cuboid ? dims.reduce((a, b) => a * b, 1) : dims[0]! ** 3) }
      },
      ({ dims, V }) => (cuboid ? new Set(dims).size === 3 : true) && V >= 1e-6 && V <= 1e-3,
    )
    const m = clean(s.rho * V)
    const object = cuboid ? 'cuboid' : 'cube'
    const size = cuboid ? `measuring ${show(dims[0]!)} m by ${show(dims[1]!)} m by ${show(dims[2]!)} m` : pick(r, [`of side ${show(dims[0]!)} m`, `with sides of ${show(dims[0]!)} m`])
    const prompt = named
      ? pick(r, [
          `A ${object} of ${s.name} ${size} has a mass of ${show(m)} kg. What is the density of ${s.name}, in kg/m³?`,
          `${cap(an(`${s.name} ${object}`))} ${size} has a mass of ${show(m)} kg. Calculate its density, in kg/m³.`,
        ])
      : pick(r, [
          `A ${object} ${size} has a mass of ${show(m)} kg. What is its density, in kg/m³?`,
          `A solid ${object} ${size} has a mass of ${show(m)} kg. Calculate its density, in kg/m³.`,
        ])
    const volume = cuboid ? `${dims.map(show).join(' \\times ')}` : `${show(dims[0]!)}^3`
    const solution = `Volume $= ${volume} = ${sciShort(V)}$ m³, which is ${show(V)} m³. Then $\\rho = \\dfrac{m}{V} = \\dfrac{${show(m)}}{${show(V)}} = ${tex(s.rho)}$ kg/m³, so the density is ${boxed(s.rho, 'kg/m³')}.`
    const method = [cuboid ? 'multiplies the three sides to find the volume' : 'cubes the side to find the volume', 'divides']
    // Second route: in grams and cubic centimetres, then back to kg/m³.
    const gPerCm3 = (m * 1000) / (V * 1e6)
    return {
      question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, method, show(s.rho)), answer: s.rho, tolerance: 0, units: 'kg/m³' },
      check: { agrees: near(gPerCm3 * 1000, s.rho) && near(s.rho * V, m), detail: `${show(m * 1000)} g ÷ ${show(V * 1e6)} cm³ = ${show(gPerCm3)} g/cm³` },
      values: { shape: object, substance: named ? s.name : 'unnamed', rho: s.rho, dims: dims.map(show).join('×'), V, m },
    }
  },
}

/** Objects that go into a measuring cylinder, with the material they are made of where that matters. */
export const SUBMERGED: { object: string; material: string; rho: number }[] = [
  { object: 'steel bolt', material: 'steel', rho: 7800 },
  { object: 'brass weight', material: 'brass', rho: 8500 },
  { object: 'aluminium block', material: 'aluminium', rho: 2700 },
  { object: 'copper ingot', material: 'copper', rho: 8900 },
  { object: 'glass stopper', material: 'glass', rho: 2500 },
  { object: 'lead sinker', material: 'lead', rho: 11300 },
  { object: 'iron nut', material: 'iron', rho: 7900 },
  { object: 'granite pebble', material: 'granite', rho: 2700 },
  { object: 'marble chip', material: 'marble', rho: 2700 },
]
const LOOSE_OBJECTS = ['stone', 'pebble', 'key', 'marble', 'small toy', 'lump of modelling clay', 'piece of rock', 'metal nut']

/** Volume by displacement: written as q7 (50 cm³ to 68 cm³, 2 marks). */
export const displacementVolume: Generator = {
  id: 'displacement-volume',
  subjectId: 'physics',
  topicId: DENSITY,
  replaces: ['q7'],
  build(r, slot): Draft {
    const object = r() < 0.5 ? pick(r, LOOSE_OBJECTS) : pick(r, SUBMERGED).object
    const before = int(r, 6, 30) * 5
    const V = int(r, 5, 60)
    const after = before + V
    const prompt = pick(r, [
      `An object raises the water in a measuring cylinder from ${before} cm³ to ${after} cm³. What is its volume, in cm³?`,
      `A measuring cylinder contains ${before} cm³ of water. When ${an(object)} is lowered into it, the level rises to ${after} cm³. What is the volume of the ${object}, in cm³?`,
      `${cap(an(object))} is placed in a measuring cylinder of water. The reading rises from ${before} cm³ to ${after} cm³. What is the volume of the ${object}, in cm³?`,
    ])
    return {
      question: {
        type: 'numeric',
        prompt,
        solution: `It displaces its own volume of water: $${after} - ${before} = ${V}$ cm³.`,
        markScheme: scheme(slot, ['subtracts the readings'], String(V)),
        answer: V,
        tolerance: 0,
        units: 'cm³',
      },
      // Second route: the volume added to the first reading gives the second.
      check: { agrees: before + V === after && V > 0, detail: `${before} + ${V} = ${before + V}` },
      values: { object, before, after },
    }
  },
}

/**
 * Density by displacement: written as q11 (0.078 kg raising the level from 40 cm³ to 50 cm³,
 * 3 marks: the volume, the conversion to m³, the answer). An object of a named material,
 * whose density comes out, or an unnamed object as written.
 */
export const displacementDensity: Generator = {
  id: 'displacement-density',
  subjectId: 'physics',
  topicId: DENSITY,
  replaces: ['q11'],
  build(r, slot, turn): Draft {
    const named = turn % 3 !== 2
    const s = pick(r, SUBMERGED)
    const before = int(r, 6, 30) * 5
    const V = int(r, 5, 60)
    const after = before + V
    const Vm3 = clean(V / 1e6)
    const m = clean((s.rho * V) / 1e6)
    const prompt = named
      ? pick(r, [
          `${cap(an(s.object))} of mass ${show(m)} kg is lowered into a measuring cylinder. The water level rises from ${before} cm³ to ${after} cm³. Calculate the density of ${s.material}, in kg/m³.`,
          `A measuring cylinder reads ${before} cm³. When ${an(s.object)} of mass ${show(m)} kg is put in, it reads ${after} cm³. What is the density of ${s.material}, in kg/m³?`,
        ])
      : pick(r, [
          `An object of mass ${show(m)} kg raises the water level from ${before} cm³ to ${after} cm³. What is its density, in kg/m³?`,
          `An object of mass ${show(m)} kg is lowered into a measuring cylinder, and the water level rises from ${before} cm³ to ${after} cm³. Calculate the density of the object, in kg/m³.`,
        ])
    const solution = `Volume $= ${after} - ${before} = ${V}$ cm³ $= ${sciShort(Vm3)}$ m³, dividing by $1\\,000\\,000$. Then $\\rho = \\dfrac{m}{V} = \\dfrac{${show(m)}}{${show(Vm3)}} = ${tex(s.rho)}$ kg/m³, so the density is ${boxed(s.rho, 'kg/m³')}.`
    // Second route: grams over cubic centimetres, then times 1000.
    const gPerCm3 = (m * 1000) / V
    return {
      question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, ['finds the volume by displacement', 'converts cm³ to m³'], show(s.rho)), answer: s.rho, tolerance: 0, units: 'kg/m³' },
      check: { agrees: near(gPerCm3 * 1000, s.rho) && near(s.rho * Vm3, m), detail: `${show(m * 1000)} g ÷ ${V} cm³ = ${show(gPerCm3)} g/cm³` },
      values: { substance: named ? s.material : 'unnamed', rho: s.rho, before, after, m },
    }
  },
}

export const particleGenerators: Generator[] = [
  specificHeatEnergy,
  latentHeatEnergy,
  specificHeatRearranged,
  thermalTemperatureChange,
  heatingTwoStages,
  heaterTime,
  latentHeatHeaterTime,
  heatingGraphEnergy,
  boylesLaw,
  gasPvProduct,
  gasVolumeFromPv,
  densityFromMassAndVolume,
  densityOfACube,
  displacementVolume,
  displacementDensity,
]
