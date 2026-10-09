import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import { BODY, bodyGenerators } from './body.ts'

/**
 * Structural tests for the human body generators. Each reads the prompt's own figures back, works
 * the answer again from them alone with plain arithmetic, and checks every printed step: the height
 * squared before the division, the two masses before the loss, both cardiac outputs before their
 * ratio, the change before the percentage, each neurone's time in ms before the total, the radii
 * before the areas, the grams before the energy, both rates in one unit before the ratio. Across
 * builds they check every context turns up, every figure is real for what is named, and that no
 * answer or input fills a context. Some lines are checked as literal text, never rebuilt with the
 * generator's own helpers.
 */
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/biology')
const bankOf = (topic: string) => Question.array().parse(JSON.parse(readFileSync(join(ROOT, `${topic}.json`), 'utf8')).questions)

function build(generatorId: string, slotId: string, count = 300, prefix = 'structure'): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  const slot = bankOf(g.topicId).find((q) => q.id === slotId)!
  return Array.from({ length: count }, (_, i) => generate(g, slot, `${prefix}-${i}`))
}

/** A figure as plain arithmetic prints it, free of binary residue. */
const c = (x: number) => Number(x.toPrecision(12))
const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const tolerance = (b: Generated) => (b.question.type === 'numeric' ? b.question.tolerance : NaN)
const method = (b: Generated) => b.question.markScheme.slice(0, -1).map((l) => l.description)
const last = (b: Generated) => b.question.markScheme.at(-1)!.description
const contexts = (built: Generated[]) => new Set(built.map((b) => b.values.context)).size
const decimals = (x: number) => (String(c(x)).split('.')[1] ?? '').length
const round = (x: number, dp: number) => Math.round(c(x * 10 ** dp)) / 10 ** dp
const threeSf = (x: number) => Number(x.toPrecision(3))
/** A number from the prompt, read with its thin-space thousands: "14 000" is 14000. */
const num = (re: RegExp, s: string) => {
  const m = re.exec(s)
  if (!m) throw new Error(`${re} not in: ${s}`)
  return Number(m[1]!.replace(/ /g, ''))
}
const nums = (re: RegExp, s: string) => [...s.matchAll(re)].map((m) => Number(m[1]!.replace(/ /g, '')))
const within = (x: number, lo: number, hi: number) => x >= lo - 1e-9 && x <= hi + 1e-9
const isPowerOfTen = (x: number) => Math.abs(Math.log10(Math.abs(x)) - Math.round(Math.log10(Math.abs(x)))) < 1e-9
/** In maths, from five digits a thin space between thousands: 14\\,000. */
const texed = (x: number) => (x >= 10000 ? String(x).replace(/\B(?=(\d{3})+(?!\d))/g, '\\,') : String(x))
const right = (b: Generated, x: number) => mark(b.question, String(c(x))).correct
/** Significant figures a printed figure carries, trailing zeros after the point included: "5.30" has three. */
const printedFigures = (t: string) => t.replace('.', '').replace(/^0+/, '').length
/** The figure printed as "which is X to 3 significant figures" or "= X% to 3 significant figures", if any. */
const threeFigureText = (sol: string) => /(?:which is|=) ([\d.]+)(?:\\%\$)? to 3 significant figures/.exec(sol)?.[1]
/** A resting adult pumps 4000 to 7000 cm³ a minute. */
const RESTING = [4000, 7000] as const

function worstShare(built: Generated[], key: (b: Generated) => unknown) {
  const by = new Map<unknown, Generated[]>()
  for (const b of built) by.set(b.values.context, [...(by.get(b.values.context) ?? []), b])
  let worst = 0
  let fewest = Infinity
  for (const group of by.values()) {
    const counts = new Map<unknown, number>()
    for (const b of group) counts.set(key(b), (counts.get(key(b)) ?? 0) + 1)
    worst = Math.max(worst, Math.max(...counts.values()) / group.length)
    fewest = Math.min(fewest, counts.size)
  }
  return { worst, fewest }
}
function spread(id: string, slot: string, keys: string[], fewest = 10) {
  const many = build(id, slot, 2000, 'spread')
  const a = worstShare(many, answer)
  expect(a.worst, `${id} ${slot} answer`).toBeLessThanOrEqual(0.4)
  expect(a.fewest, `${id} ${slot} answers per context`).toBeGreaterThanOrEqual(fewest)
  for (const k of keys) expect(worstShare(many, (b) => b.values[k]).worst, `${id} ${slot} ${k}`).toBeLessThanOrEqual(0.4)
}

describe('every body build', () => {
  it('has a generator for each numeric written slot in the nine topics but the two read from the reaction-time table', () => {
    const claimed = bodyGenerators.flatMap((g) => g.replaces.map((id) => `${g.topicId}/${id}`)).sort()
    expect(claimed).toEqual(
      [
        ...['q10', 'q11', 'q12', 'q25', 'q26'].map((q) => `blood-glucose-control-and-diabetes/${q}`),
        ...['q5', 'q12', 'q19', 'q25', 'q26'].map((q) => `the-heart-blood-vessels-and-blood/${q}`),
        ...['q20', 'q28', 'q29'].map((q) => `hormones-and-the-endocrine-system/${q}`),
        ...['q28', 'q29'].map((q) => `the-nervous-system-and-the-brain/${q}`),
        ...['q24', 'q25'].map((q) => `senses-nerves-and-reaction-time/${q}`),
        ...['q25', 'q26'].map((q) => `the-eye-and-its-defects/${q}`),
        ...['q24', 'q25'].map((q) => `thermoregulation/${q}`),
        ...['q26', 'q27'].map((q) => `osmoregulation-and-the-kidneys/${q}`),
        ...['q28', 'q29'].map((q) => `the-menstrual-cycle-and-fertility/${q}`),
      ].sort(),
    )
    // The two left written read the table in their diagram.
    const senses = bankOf('senses-nerves-and-reaction-time')
    for (const id of ['q4', 'q12']) expect(senses.find((q) => q.id === id)!.visual).toBeDefined()
  })

  it('prints no article before a figure, keeps the written units, and is marked right with its own answer and its three-figure rounding', () => {
    for (const g of bodyGenerators) {
      for (const id of g.replaces) {
        const slot = bankOf(g.topicId).find((q) => q.id === id)!
        for (const b of build(g.id, id, 150)) {
          expect(b.question.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
          expect(b.question.type === 'numeric' && b.question.units, `${g.id} ${id}`).toBe(slot.type === 'numeric' && slot.units)
          expect(b.question.solution, b.seed).toContain(String(answer(b)))
          expect(mark(b.question, String(answer(b))).correct, b.seed).toBe(true)
          // An exact whole product (q5's 19 224 cm³/min) keeps the written tolerance of 0, as a count does.
          if (g.id !== 'cardiac-output') expect(mark(b.question, String(threeSf(answer(b)))).correct, `${g.id} ${b.seed} ${answer(b)}`).toBe(true)
          expect(tolerance(b), b.seed).toBeLessThanOrEqual(Math.abs(answer(b)) * 0.02)
          expect(b.check.agrees, `${g.id} ${b.seed}`).toBe(true)
        }
      }
    }
  })

  it('never fails to draw, over 3000 seeds per slot', () => {
    for (const g of bodyGenerators) {
      for (const s of g.replaces) {
        const slot = bankOf(g.topicId).find((q) => q.id === s)!
        expect(() => {
          for (let i = 0; i < 3000; i++) generate(g, slot, `throw-${i}`)
        }, `${g.id} ${s}`).not.toThrow()
      }
    }
  }, 120_000)
})

// =============================================================================================
// Blood glucose control and diabetes
// =============================================================================================

describe('BMI and the waist to hip ratio', () => {
  it('q10, q11: the height squared, then the mass divided by it, to 1 decimal place', () => {
    for (const slot of ['q10', 'q11']) {
      const built = build('bmi-from-mass-and-height', slot)
      for (const b of built) {
        const p = b.question.prompt
        const m = num(/mass of (\d+) kg/, p)
        const h = num(/(?:height of|is) (\d\.\d\d) m/, p)
        const band = BODY.BANDS.find((x) => x.name === b.values.context)!
        const h2 = c(h * h)
        const bmi = round(m / h2, 1)
        expect(answer(b), b.seed).toBe(bmi)
        expect(within(bmi, band.lo, band.hi), b.seed).toBe(true)
        expect(within(h, 1.45, 2) && within(m, 40, 150)).toBe(true)
        expect(p).toMatch(/to 1 decimal place[.?]$/)
        const noun = /^(?:At a health check, a|A) (woman|man|person) /.exec(p)![1]!
        const adult = BODY.ADULTS.find((a) => a.noun === noun)!
        expect(within(h, adult.lo, adult.hi), `${noun} ${h}`).toBe(true)
        expect(p).toContain(` ${adult.his} `)
        expect(b.question.solution).toContain(`$${h.toFixed(2)}^2 = ${h2}$, and $${m} \\div ${h2} = `)
        expect(b.question.solution).toContain(`which is **${bmi.toFixed(1)}** to 1 decimal place. A BMI of ${bmi.toFixed(1)} is ${band.says}.`)
        expect(method(b)).toEqual([`squares the height: ${h.toFixed(2)}² = ${h2}`, `divides the mass by ${h2}`])
        expect(tolerance(b)).toBe(0.05)
        // Forgetting to square, or rounding the wrong way at the half, is marked wrong.
        expect(right(b, m / h)).toBe(false)
        expect(right(b, bmi + 0.1)).toBe(false)
        // The unrounded value is marked right.
        expect(right(b, m / h2)).toBe(true)
      }
      expect(contexts(built)).toBe(BODY.BANDS.length)
      spread('bmi-from-mass-and-height', slot, ['m', 'h'])
    }
    // The bands as the NHS gives them.
    const says = Object.fromEntries(BODY.BANDS.map((x) => [x.name, x.says]))
    expect(says).toEqual({
      healthy: 'in the healthy range, 18.5 to 24.9',
      overweight: 'in the overweight range, 25 to 29.9',
      underweight: 'below 18.5, which is classed as underweight',
      obese: '30 or more, which is classed as obese',
    })
  })

  it('q12: waist ÷ hips to 2 decimal places, and the risk line follows the ratio', () => {
    const built = build('waist-to-hip-ratio', 'q12')
    for (const b of built) {
      const p = b.question.prompt
      const w = num(/waist (?:of|measures) (\d+) cm/, p)
      const h = num(/hips (?:of|measure) (\d+) cm/, p)
      const s = BODY.SHAPES.find((x) => x.name === b.values.context)!
      const ratio = round(w / h, 2)
      expect(answer(b)).toBe(ratio)
      expect(within(ratio, ...s.ratio) && within(w, ...s.waist) && within(h, ...s.hips)).toBe(true)
      expect(w).not.toBe(h)
      expect(h).not.toBe(100)
      expect(p).toMatch(new RegExp(`^A ${s.name}('s)? `))
      expect(p).toMatch(/to 2 decimal places\.?\??$/)
      expect(b.question.solution).toContain(`$${w} \\div ${h} = `)
      expect(b.question.solution).toContain(`which is **${ratio.toFixed(2)}** to 2 decimal places. Both are in cm, so the ratio has no units.`)
      // The WHO cut-off includes the threshold: 0.85 for a woman is at risk.
      const risk = s.name === 'woman' ? '0.85' : '0.90'
      expect(b.question.solution).toContain(`For a ${s.name}, a ratio of ${risk} or more means`)
      expect(b.question.solution).toContain(`${ratio.toFixed(2)} is ${ratio >= Number(risk) - 1e-9 ? 'at or above' : 'below'} that.`)
      expect(method(b)).toEqual(['divides the waist by the hip measurement'])
      expect(tolerance(b)).toBe(0.005)
      // Hips ÷ waist is marked wrong.
      expect(right(b, h / w)).toBe(false)
    }
    expect(contexts(built)).toBe(2)
    // Above the line and below it both turn up for each, and no ratio rounds to the line itself (0.849 is 0.85 but below it).
    for (const name of ['woman', 'man']) expect(new Set(built.filter((b) => b.values.context === name).map((b) => b.values.above)).size).toBe(2)
    for (const b of build('waist-to-hip-ratio', 'q12', 2000, 'at')) expect(answer(b), b.seed).not.toBe(b.values.context === 'woman' ? 0.85 : 0.9)
    spread('waist-to-hip-ratio', 'q12', ['w', 'p'])
  })

  it('q25: the fall divided by the starting value, to 3 s.f., and the unrounded value is marked right', () => {
    const built = build('blood-glucose-percentage-fall', 'q25')
    for (const b of built) {
      const p = b.question.prompt
      const units = [...p.matchAll(/\d+\.\d (mmol per litre|mmol\/dm³)/g)].map((m) => m[1])
      expect(new Set(units).size, b.seed).toBe(1)
      const [before, after] = nums(/(\d+\.\d) mmol/g, p) as [number, number]
      const f = BODY.FALLS.find((x) => x.name === b.values.context)!
      expect(within(before, ...f.before) && within(after, ...f.after)).toBe(true)
      expect(within(before, 4, 10) && within(after, 4, 10)).toBe(true)
      const d = c(before - after)
      expect(d).toBeGreaterThanOrEqual(1)
      const exact = (d / before) * 100
      expect(answer(b)).toBe(threeSf(exact))
      expect(right(b, exact)).toBe(true)
      expect(b.question.solution).toContain(`Decrease $= ${before.toFixed(1)} - ${after.toFixed(1)} = ${d.toFixed(1)}$ ${units[0]}.`)
      expect(b.question.solution).toContain(`$\\dfrac{${d.toFixed(1)}}{${before.toFixed(1)}} \\times 100 = `)
      expect(b.question.solution).toContain(`Divide by the value before the fall, ${before.toFixed(1)}, not the value after it.`)
      // "33.0", never "33", when the answer is said to be to 3 significant figures.
      const shown = threeFigureText(b.question.solution)
      if (shown) expect(printedFigures(shown), b.seed).toBe(3)
      if (shown) expect(Number(shown)).toBe(answer(b))
      expect(method(b)).toEqual([`finds the decrease, ${d.toFixed(1)}, and divides it by the starting value of ${before.toFixed(1)}`])
      // Dividing by the later value, or giving the percentage left, is marked wrong.
      expect(right(b, (d / after) * 100)).toBe(false)
      expect(right(b, (after / before) * 100)).toBe(false)
      for (const g of [before, after, d]) expect(isPowerOfTen(answer(b) / g), b.seed).toBe(false)
    }
    expect(contexts(built)).toBe(BODY.FALLS.length)
    expect(built.some((b) => b.question.solution.includes('type 1 diabetes makes little or no insulin'))).toBe(true)
    expect(build('blood-glucose-percentage-fall', 'q25', 2000, 'zero').some((b) => /= \d+\.0\\%\$ to 3 significant figures/.test(b.question.solution))).toBe(true)
    spread('blood-glucose-percentage-fall', 'q25', ['b', 'a'])
  })

  it('q26: the two masses at BMI × height², rounded as a scale shows them, and their difference', () => {
    const built = build('bmi-mass-to-lose', 'q26')
    for (const b of built) {
      const p = b.question.prompt
      const b1 = num(/BMI of (\d+\.\d) and/, p)
      const h = num(/height of (\d\.\d\d) m/, p)
      const to = num(/down to (\d+\.\d)/, p)
      const t = BODY.TARGETS.find((x) => x.name === b.values.context)!
      expect(to).toBe(t.to)
      expect(within(b1, ...t.from)).toBe(true)
      const h2 = c(h * h)
      const [m1, m2] = [round(b1 * h2, 1), round(to * h2, 1)]
      const loss = c(m1 - m2)
      expect(answer(b), b.seed).toBe(loss)
      expect(loss).toBe(round((b1 - to) * h2, 1))
      expect(within(loss, 10, 40)).toBe(true)
      // He or she, never it, agreeing with the noun.
      const noun = /^A (man|woman) /.exec(p)![1]!
      expect(p).toContain(noun === 'man' ? 'He wants to bring his BMI down' : 'She wants to bring her BMI down')
      expect(p).toContain(noun === 'man' ? 'the mass he must lose' : 'the mass she must lose')
      expect(b.question.solution).toContain(`Height squared: $${h.toFixed(2)}^2 = ${h2}$.`)
      expect(b.question.solution).toContain(`Mass to lose: $${m1.toFixed(1)} - ${m2.toFixed(1)} = ${loss}$ kg.`)
      expect(b.question.solution).toContain(`(The shortcut: a fall of ${c(b1 - to).toFixed(1)} in BMI $\\times ${h2} = `)
      expect(method(b)).toEqual([`squares the height, ${h2}, and rearranges to mass = BMI × height²`, `finds ${m1.toFixed(1)} kg and ${m2.toFixed(1)} kg (or ${c(b1 - to).toFixed(1)} × ${h2})`])
      expect(tolerance(b)).toBe(0.05)
      expect(right(b, (b1 - to) * h2)).toBe(true)
      // Forgetting to square the height is marked wrong.
      expect(right(b, (b1 - to) * h)).toBe(false)
      // Never the BMI, the target, the fall or the height with the point moved, doubled or halved: 18.9 kg at 1.89 m.
      for (const g of [b1, to, h, c(b1 - to)]) for (const y of [g, 2 * g, g / 2]) expect(isPowerOfTen(loss / y), `${b.seed} ${loss} ${g}`).toBe(false)
    }
    expect(contexts(built)).toBe(2)
    expect(new Set(built.map((b) => /^A (man|woman)/.exec(b.question.prompt)![1])).size).toBe(2)
    spread('bmi-mass-to-lose', 'q26', ['b1', 'h', 'd'])
  })
})

// =============================================================================================
// The heart
// =============================================================================================

describe('cardiac output', () => {
  it('q5: stroke volume × heart rate, real for rest, a trained heart and exercise', () => {
    const built = build('cardiac-output', 'q5')
    for (const b of built) {
      const p = b.question.prompt
      const sv = num(/stroke volume (?:of|is) (\d+) cm³/, p)
      const hr = num(/heart rate (?:of|is) (\d+) beats per minute/, p)
      const o = BODY.OUTPUTS.find((x) => x.name === b.values.context)!
      expect(within(sv, ...o.sv) && within(hr, ...o.hr)).toBe(true)
      expect(sv).not.toBe(hr)
      if (o.name !== 'exercise') expect(within(sv * hr, ...RESTING), `${o.name} ${sv} × ${hr}`).toBe(true)
      expect(answer(b)).toBe(sv * hr)
      // An exact product, as the written tolerance of 0 has it.
      expect(tolerance(b)).toBe(0)
      expect(b.question.solution).toContain(sv * hr < 10000 ? `$${sv} \\times ${hr} = ${sv * hr}$ cm³/min.` : `$${sv} \\times ${hr}$, which is **${sv * hr} cm³/min**`)
      expect(b.question.solution).toContain('The beats cancel, leaving cubic centimetres per minute.')
      expect(method(b)).toEqual(['multiplies stroke volume by heart rate'])
      expect(right(b, sv + hr)).toBe(false)
    }
    expect(contexts(built)).toBe(BODY.OUTPUTS.length)
    // A resting heart beats 50 to 100 times a minute and an exercising one at most 190, pumping 60 to 120 cm³.
    for (const o of BODY.OUTPUTS) expect(o.sv[0] >= 60 && o.sv[1] <= 120 && o.hr[0] >= 50 && o.hr[1] <= 190).toBe(true)
    spread('cardiac-output', 'q5', ['sv', 'hr'])
  })

  it('q12: cardiac output ÷ heart rate is the exercising stroke volume, less the resting one', () => {
    const built = build('stroke-volume-increase', 'q12')
    for (const b of built) {
      const p = b.question.prompt
      const rest = num(/stroke volume (?:of|at rest is) (\d+) cm³/, p)
      const co = num(/cardiac output is ([\d ]+) cm³\/min/, p)
      const hr = num(/heart rate (?:of|is) (\d+) beats per minute/, p)
      const e = BODY.EFFORTS.find((x) => x.name === b.values.context)!
      expect(within(hr, ...e.hr)).toBe(true)
      const ex = co / hr
      expect(Number.isInteger(ex), b.seed).toBe(true)
      expect(within(rest, 60, 95) && ex <= 120 && ex > rest).toBe(true)
      // The stroke volume rises by at most half: never 61 to 95 cm³.
      expect(ex / rest, b.seed).toBeLessThanOrEqual(1.5)
      expect(answer(b)).toBe(ex - rest)
      expect(b.question.solution).toContain(`Stroke volume during exercise $= \\dfrac{${texed(co)}}{${hr}} = ${ex}$ cm³ per beat.`)
      expect(b.question.solution).toContain(`The increase is $${ex} - ${rest} = ${ex - rest}$ cm³`)
      expect(method(b)).toEqual([`divides cardiac output by heart rate to get ${ex} cm³`])
      // Stopping at the exercising stroke volume is marked wrong.
      expect(right(b, ex)).toBe(false)
    }
    expect(contexts(built)).toBe(BODY.EFFORTS.length)
    spread('stroke-volume-increase', 'q12', ['rest', 'hr'])
  })

  it('q19: cardiac output ÷ stroke volume', () => {
    const built = build('heart-rate-from-cardiac-output', 'q19')
    for (const b of built) {
      const p = b.question.prompt
      const co = num(/cardiac output of ([\d ]+) cm³\/min/, p)
      const sv = num(/stroke volume of (\d+) cm³/, p)
      const x = BODY.RATINGS.find((y) => y.name === b.values.context)!
      const hr = co / sv
      expect(Number.isInteger(hr)).toBe(true)
      expect(within(hr, ...x.hr) && within(sv, ...x.sv)).toBe(true)
      if (x.name !== 'exercise') expect(within(co, ...RESTING), `${co}`).toBe(true)
      expect(answer(b)).toBe(hr)
      expect(b.question.solution).toContain(`= \\dfrac{${texed(co)}}{${sv}} = ${hr}$ beats per minute.`)
      expect(last(b)).toBe(`${hr} beats per minute`)
      expect(right(b, sv)).toBe(false)
    }
    expect(contexts(built)).toBe(BODY.RATINGS.length)
    spread('heart-rate-from-cardiac-output', 'q19', ['sv'])
  })

  it('q25: the increase divided by the resting output, never the new over the old', () => {
    const built = build('cardiac-output-percentage-increase', 'q25')
    for (const b of built) {
      const p = b.question.prompt
      const a = num(/cardiac output is ([\d ]+) cm³\/min/, p)
      const e = num(/rises to ([\d ]+) cm³\/min/, p)
      const x = BODY.RISES.find((y) => y.name === b.values.context)!
      expect(a % 100).toBe(0)
      expect(e % 10).toBe(0)
      expect(within(a, 4200, 7200) && e <= 22800).toBe(true)
      const pc = c(((e - a) / a) * 100)
      expect(Number.isInteger(pc)).toBe(true)
      expect(within(pc, ...x.p)).toBe(true)
      expect(answer(b)).toBe(pc)
      expect(p).toContain(x.during)
      expect(b.question.solution).toContain(`Increase $= ${texed(e)} - ${texed(a)} = ${texed(e - a)}$ cm³/min.`)
      expect(b.question.solution).toContain(`The output has become ${c(e / a)} times what it was, which is an increase of ${pc} %, not ${pc + 100} %`)
      expect(method(b)).toEqual([`increase of ${String(e - a).replace(/\B(?=(\d{3})+(?!\d))/g, (e - a >= 10000 ? ' ' : ''))} divided by the resting ${a}, × 100`])
      expect(right(b, (e / a) * 100)).toBe(false)
    }
    expect(contexts(built)).toBe(BODY.RISES.length)
    spread('cardiac-output-percentage-increase', 'q25', ['rest'])
  })

  it('q26: both outputs, then their ratio, which is never the heart rate’s factor the student gives', () => {
    const built = build('cardiac-output-ratio', 'q26')
    for (const b of built) {
      const p = b.question.prompt
      const [hr1, sv1] = [num(/heart rate of (\d+) beats per minute and a stroke volume/, p), num(/a stroke volume of (\d+) cm³/, p)]
      const [hr2, sv2] = [num(/rises to (\d+) beats per minute/, p), num(/stroke volume to (\d+) cm³/, p)]
      const s = BODY.SESSIONS.find((x) => x.name === b.values.context)!
      expect(within(hr2, ...s.hr) && within(hr1, 55, 90)).toBe(true)
      expect(within(hr1 * sv1, 4000, 7000) && sv2 <= 120 && sv2 / sv1 <= 1.5 && sv2 > sv1).toBe(true)
      const [co1, co2] = [sv1 * hr1, sv2 * hr2]
      const k = c(hr2 / hr1)
      expect(answer(b)).toBe(c(co2 / co1))
      expect(decimals(answer(b))).toBeLessThanOrEqual(2)
      expect(p).toContain(k === 2 ? 'the cardiac output has doubled, because the heart rate has doubled' : `the cardiac output is ${k} times as great, because the heart rate is ${k} times as great`)
      expect(b.question.solution).toContain(`Rest: cardiac output $= ${sv1} \\times ${hr1} = ${texed(co1)}$ cm³/min. Exercise: $${sv2} \\times ${hr2} = ${texed(co2)}$ cm³/min.`)
      expect(b.question.solution).toContain(`($${sv2} \\div ${sv1} = ${c(sv2 / sv1)}$)`)
      expect(method(b)[0]).toBe(`both cardiac outputs: ${co1 >= 10000 ? texed(co1).replace('\\,', ' ') : co1} and ${co2 >= 10000 ? texed(co2).replace('\\,', ' ') : co2} cm³/min`)
      // The student's answer, and the stroke volume's factor alone, are marked wrong.
      expect(right(b, k)).toBe(false)
      expect(right(b, sv2 / sv1)).toBe(false)
    }
    expect(contexts(built)).toBe(BODY.SESSIONS.length)
    spread('cardiac-output-ratio', 'q26', ['hr1', 'sv1', 'hr2', 'sv2'])
    expect(worstShare(build('cardiac-output-ratio', 'q26', 2000, 'skew'), (b) => b.values.sv1).worst).toBeLessThanOrEqual(0.25)
  })
})

// =============================================================================================
// Hormones: adrenalin
// =============================================================================================

describe('adrenalin', () => {
  it('q20: the table rests, peaks after the event and falls back, and the percentage is read from the two readings asked', () => {
    const built = build('adrenalin-heart-rate-table', 'q20')
    for (const b of built) {
      const p = b.question.prompt
      expect(p).toContain('| Time (min) | Heart rate (beats/min) | Blood glucose (mg per 100 cm³) |\n|---|---|---|\n')
      expect(p).toContain('The figures are illustrative.')
      const rows = [...p.matchAll(/^\| (\d+) \| (\d+) \| (\d+) \|$/gm)].map((m) => [Number(m[1]), Number(m[2]), Number(m[3])] as const)
      expect(rows.map((r) => r[0])).toEqual([0, 5, 10, 15, 20, 25])
      const at = num(/at (\d+) minutes, and adrenalin/, p)
      const [t0, t1] = /readings at (\d+) minutes and (\d+) minutes/.exec(p)!.slice(1).map(Number) as [number, number]
      expect(t1 - t0).toBe(5)
      expect(at > t0 && at < t1).toBe(true)
      const i = t0 / 5
      const [h0, h1] = [rows[i]![1], rows[i + 1]![1]]
      const hr = rows.map((r) => r[1])
      const gl = rows.map((r) => r[2])
      // Resting readings within 2 beats of the last, not all the same; the peak first after the event, then a fall that stays above rest.
      for (const h of hr.slice(0, i)) expect(Math.abs(h - h0)).toBeLessThanOrEqual(2)
      expect(new Set(hr.slice(0, i + 1)).size).toBeGreaterThan(1)
      for (let j = i + 2; j < 6; j++) expect(hr[j]! < hr[j - 1]! && hr[j]! > h0 + 3, b.seed).toBe(true)
      // Glucose rises after the event and peaks a reading later.
      expect(gl[i + 1]! - gl[i]!).toBeGreaterThanOrEqual(18)
      if (i + 2 < 6) expect(gl[i + 2]!).toBe(Math.max(...gl))
      const exact = ((h1 - h0) / h0) * 100
      const pc = threeSf(exact)
      expect(answer(b)).toBe(pc)
      expect(right(b, exact)).toBe(true)
      expect(within(exact, 25, 65)).toBe(true)
      for (const v of [...hr, ...gl]) expect(isPowerOfTen(pc / v), b.seed).toBe(false)
      expect(b.question.solution).toContain(`Increase $= ${h1} - ${h0} = ${h1 - h0}$ beats/min. $\\dfrac{${h1 - h0}}{${h0}} \\times 100 = `)
      expect(b.question.solution).toContain('Divide by the **starting** value')
      const shown = threeFigureText(b.question.solution)
      if (shown) expect(printedFigures(shown)).toBe(3)
      expect(method(b)).toEqual([`${h1 - h0} ÷ ${h0} × 100`])
      expect(tolerance(b)).toBe(Number(Math.min(0.5 * 10 ** (Math.floor(Math.log10(pc)) - 2), pc * 0.019).toPrecision(10)))
      expect(right(b, ((h1 - h0) / h1) * 100)).toBe(false)
    }
    expect(contexts(built)).toBe(BODY.SHOCKS.length)
    spread('adrenalin-heart-rate-table', 'q20', ['h0', 'h1', 'minute'])
    // Any resting rate turns up, and no answer is common: 50, 37.5, 62.5 and 25 were half of them.
    const many = build('adrenalin-heart-rate-table', 'q20', 2000, 'rest')
    expect(new Set(many.map((b) => b.values.h0)).size).toBe(21)
    expect(worstShare(many, answer).worst).toBeLessThanOrEqual(0.05)
  })

  it('q28: the count scaled up to a minute', () => {
    const built = build('heart-rate-from-pulse-count', 'q28')
    for (const b of built) {
      const [secs, n] = /for (\d+) seconds and counts (\d+) beats/.exec(b.question.prompt)!.slice(1).map(Number) as [number, number]
      const hr = (n * 60) / secs
      expect(answer(b)).toBe(hr)
      expect(within(hr, 90, 150)).toBe(true)
      const times = 60 / secs
      expect(b.question.solution).toContain(`lots of ${secs} seconds in a minute, so $${n} \\times ${times} = ${hr}$ beats per minute. (Or $\\dfrac{${n}}{${secs}} \\times 60 = ${hr}$.)`)
      expect(method(b)).toEqual([`scales ${secs} seconds up to a minute: multiplies by ${times}`])
      expect(last(b)).toBe(`${hr} beats per minute`)
      expect(right(b, n)).toBe(false)
    }
    expect(new Set(built.map((b) => b.values.context))).toEqual(new Set(BODY.COUNTS.map((x) => `${x.secs} s`)))
    expect(build('heart-rate-from-pulse-count', 'q28', 1)[0]!.question.solution).toMatch(/There are (three|four|six) lots of/)
    spread('heart-rate-from-pulse-count', 'q28', ['n'])
  })

  it('q29: both volumes each minute, then the difference, which is the extra beats times the volume of each', () => {
    const built = build('adrenalin-extra-blood', 'q29')
    for (const b of built) {
      const p = b.question.prompt
      const [hr1, sv] = /beats (\d+) times a minute and each beat pumps (\d+) cm³/.exec(p)!.slice(1).map(Number) as [number, number]
      const hr2 = num(/heart rate to (\d+) beats per minute/, p)
      expect(within(hr1, 55, 85) && within(sv, 60, 100) && hr2 <= 140 && hr2 - hr1 >= 15).toBe(true)
      expect(within(hr1 * sv, ...RESTING), `${hr1} × ${sv}`).toBe(true)
      // Exact, with at most three figures, as the written 2100.
      expect(tolerance(b)).toBe(0)
      expect(String((hr2 - hr1) * sv).replace(/0+$/, '').length).toBeLessThanOrEqual(3)
      expect(hr2).not.toBe(2 * hr1)
      const extra = (hr2 - hr1) * sv
      expect(answer(b)).toBe(extra)
      expect(b.question.solution).toContain(`At rest: $${hr1} \\times ${sv} = ${texed(hr1 * sv)}$ cm³.`)
      expect(b.question.solution).toContain(`$${hr2} \\times ${sv} = ${texed(hr2 * sv)}$ cm³.`)
      expect(b.question.solution).toContain(`which is ${c(extra / 1000)} litres. (The shortcut: ${hr2 - hr1} extra beats $\\times ${sv} = ${texed(extra)}$.)`)
      expect(method(b)[1]).toBe(`subtracts the two volumes (or multiplies the ${hr2 - hr1} extra beats by ${sv})`)
      expect(right(b, hr2 * sv)).toBe(false)
    }
    expect(contexts(built)).toBe(BODY.FRIGHTS.length)
    spread('adrenalin-extra-blood', 'q29', ['hr1', 'hr2', 'sv'])
  })
})

// =============================================================================================
// The nervous system
// =============================================================================================

describe('nerve impulses', () => {
  it('q28: distance ÷ time, at a speed real for the neurone named', () => {
    const built = build('nerve-impulse-speed', 'q28')
    for (const b of built) {
      const p = b.question.prompt
      const d = num(/([\d.]+) m long/, p)
      const t = num(/in ([\d.]+) s\. Calculate/, p)
      const x = BODY.PATHS.find((y) => y.name === b.values.context)!
      const v = c(d / t)
      expect(answer(b)).toBe(v)
      expect(within(d, ...x.d) && within(v, ...x.v)).toBe(true)
      expect(within(v, 1, 120)).toBe(true)
      expect(p).toContain(`${x.neurone} ${d} m long, ${x.route}`)
      if (x.v[1] <= 2) expect(p).toContain('along a sensory neurone without a myelin sheath, ')
      expect(b.question.solution).toContain(`= \\dfrac{${d}}{${t}} = ${v}$ m/s.`)
      expect(b.question.solution).toContain(x.v[1] <= 2 ? 'With no myelin sheath the impulse travels far more slowly' : 'myelin sheath insulates the axon')
      for (const g of [d, t]) for (const y of [g, 2 * g, g / 2]) expect(isPowerOfTen(v / y), b.seed).toBe(false)
      expect(right(b, t / d)).toBe(false)
    }
    expect(contexts(built)).toBe(BODY.PATHS.length)
    spread('nerve-impulse-speed', 'q28', ['d', 't'])
    expect(worstShare(build('nerve-impulse-speed', 'q28', 2000, 'skew'), (b) => b.values.t).worst).toBeLessThanOrEqual(0.25)
  })

  it('q29: each neurone’s time in ms, plus two synapses', () => {
    const built = build('reflex-arc-time', 'q29')
    for (const b of built) {
      const p = b.question.prompt
      const [d1, v1] = /travels ([\d.]+) m along a sensory neurone to the spinal cord at (\d+) m\/s/.exec(p)!.slice(1).map(Number) as [number, number]
      const delay = num(/each take ([\d.]+) ms/, p)
      const m = /travels ([\d.]+) m along a motor neurone to a muscle in the (arm|leg) at (\d+) m\/s/.exec(p)!
      const [d2, v2] = [Number(m[1]), Number(m[3])]
      const a = BODY.ARCS.find((x) => x.name === b.values.context)!
      expect(m[2]).toBe(a.limb)
      expect(within(d1, ...a.sensory) && within(d2, ...a.motor) && within(v1, 40, 80) && within(v2, 50, 100) && within(delay, 0.5, 0.9)).toBe(true)
      expect(d1 === d2 || v1 === v2).toBe(false)
      const [t1, t2] = [c((d1 / v1) * 1000), c((d2 / v2) * 1000)]
      const total = c(t1 + t2 + 2 * delay)
      expect(answer(b)).toBe(total)
      expect(b.question.solution).toContain(`Sensory neurone: $\\dfrac{${d1}}{${v1}} = ${c(t1 / 1000)}$ s $= ${t1}$ ms.`)
      expect(b.question.solution).toContain(`Motor neurone: $\\dfrac{${d2}}{${v2}} = ${c(t2 / 1000)}$ s $= ${t2}$ ms.`)
      expect(b.question.solution).toContain(`The two synapses add $2 \\times ${delay} = ${c(2 * delay)}$ ms.`)
      expect(b.question.solution).toContain(`Total $= ${t1} + ${t2} + ${c(2 * delay)} = ${total}$ ms.`)
      expect(method(b)).toEqual([`converts each neurone's distance and speed to a time: ${t1} ms and ${t2} ms`, `adds the two synapse delays, ${c(2 * delay)} ms`])
      // One synapse, or none, is marked wrong; so is the answer left in seconds.
      expect(right(b, t1 + t2 + delay)).toBe(false)
      expect(right(b, total / 1000)).toBe(false)
    }
    // The written slot's literal working.
    const one = built.find((b) => b.values.delay === 0.5)!
    expect(one.question.solution).toContain('The two synapses add $2 \\times 0.5 = 1$ ms.')
    expect(contexts(built)).toBe(BODY.ARCS.length)
    spread('reflex-arc-time', 'q29', ['d1', 'v1', 'd2', 'v2', 'delay'])
  })
})

// =============================================================================================
// The ruler drop
// =============================================================================================

describe('the ruler drop', () => {
  it('q24: five readings near their mean, added and divided by five', () => {
    const built = build('ruler-drop-mean', 'q24')
    for (const b of built) {
      const p = b.question.prompt
      const rs = nums(/(\d+) cm/g, p.split('Calculate')[0]!)
      expect(rs).toHaveLength(5)
      const total = rs.reduce((s, x) => s + x, 0)
      const mean = c(total / 5)
      const x = BODY.CATCHERS.find((y) => y.name === b.values.context)!
      expect(answer(b)).toBe(mean)
      expect(within(mean, ...x.mean)).toBe(true)
      for (const r of rs) expect(Math.abs(r - mean) / mean, b.seed).toBeLessThanOrEqual(0.15)
      expect(rs).not.toContain(mean)
      expect([...rs].sort((a, b2) => a - b2)[2]).not.toBe(mean)
      expect(Math.max(...rs) - Math.min(...rs)).toBeGreaterThanOrEqual(2)
      expect(p).toContain(x.who)
      expect(b.question.solution).toContain(`Add the five readings: $${rs.join(' + ')} = ${total}$ cm. Divide by the number of readings: $\\dfrac{${total}}{5} = ${mean}$ cm.`)
      expect(b.question.solution).toContain(`A mean of ${mean} cm corresponds to a reaction time of about ${Math.sqrt((2 * mean) / 100 / 9.8).toFixed(2)} s.`)
      expect(method(b)).toEqual([`adds the five readings to ${total} and divides by 5`])
      expect(tolerance(b)).toBe(0)
    }
    expect(contexts(built)).toBe(BODY.CATCHERS.length)
    // The reaction time agrees with the topic's own table: 20 cm is 0.20 s, 10 cm 0.14 s, 30 cm 0.25 s.
    expect([20, 10, 30].map((d) => Math.sqrt((2 * d) / 100 / 9.8).toFixed(2))).toEqual(['0.20', '0.14', '0.25'])
    spread('ruler-drop-mean', 'q24', ['r1', 'r3', 'r5'])
  })

    it('q25: both distances converted to metres before t = √(2d ÷ g), each time to 0.01 s, then the change', () => {
    const built = build('reaction-time-from-fall', 'q25')
    for (const b of built) {
      const p = b.question.prompt
      const [d1, d2] = nums(/fallen ([\d.]+) cm/g, p) as [number, number]
      const x = BODY.CHANGES.find((y) => y.name === b.values.context)!
      const [e1, e2] = [Math.sqrt((2 * d1) / 100 / 10), Math.sqrt((2 * d2) / 100 / 10)]
      const [t1, t2] = [round(e1, 2), round(e2, 2)]
      for (const [t, d] of [[t1, d1], [t2, d2]] as const) {
        expect(within(t, 0.15, 0.35)).toBe(true)
        // Never the fall in metres with the point moved: 20 cm takes 0.2 s.
        expect(isPowerOfTen(t / d), `${t} ${d}`).toBe(false)
      }
      // A ruler reading to the millimetre; a fall of more than 30 cm needs a metre rule.
      for (const d of [d1, d2]) expect(decimals(d)).toBeLessThanOrEqual(1)
      expect(p).toContain(Math.max(d1, d2) > 30 ? 'a dropped metre rule after' : 'a dropped ruler after')
      expect(x.rise ? t2 > t1 : t2 < t1).toBe(true)
      expect(p).toContain(x.rise ? 'Calculate the increase in the' : 'Calculate the decrease in the')
      const dt = c(Math.abs(t2 - t1))
      expect(answer(b)).toBe(dt)
      expect(within(dt, ...x.change)).toBe(true)
      // Both routes are right: each time rounded to 0.01 s first, or every figure kept.
      expect(right(b, Math.abs(e2 - e1))).toBe(true)
      expect(tolerance(b)).toBe(Number(Math.min(0.005, dt * 0.019).toPrecision(10)))
      expect(b.question.solution).toContain(`${d1} cm is ${c(d1 / 100)} m and ${d2} cm is ${c(d2 / 100)} m.`)
      expect(b.question.solution).toContain(`Before: $t = \\sqrt{2 \\times ${c(d1 / 100)} \\div 10} = \\sqrt{${c(d1 / 500)}} = `)
      expect(b.question.solution).toContain(`= ${dt}$ s.`)
      expect(b.question.solution).toContain(`gives about ${(10 * e1).toFixed(1)} s and ${(10 * e2).toFixed(1)} s, far longer than any human reaction time`)
      expect(method(b)).toEqual(['converts both distances to metres and substitutes into the formula', `reaction times of ${t1.toFixed(2)} s and ${t2.toFixed(2)} s`])
      // Leaving the distances in cm is marked wrong.
      expect(right(b, 10 * dt)).toBe(false)
    }
    expect(contexts(built)).toBe(BODY.CHANGES.length)
    // The written slot's literal working: 20 cm would be 0.2 s, the fall in metres, so it never appears.
    expect(built.every((b) => !/fallen 20 cm/.test(b.question.prompt))).toBe(true)
    spread('reaction-time-from-fall', 'q25', ['d1', 'd2', 't1', 't2'])
  })
})

// =============================================================================================
// The eye
// =============================================================================================

describe('the eye', () => {
  it('q25: the count over the number tested, for boys and girls in turn, in a survey about as lopsided as the real one', () => {
    const built = build('colour-blindness-percentage', 'q25')
    for (const b of built) {
      const p = b.question.prompt
      const [nb, ng] = /, (\d+) boys and (\d+) girls were tested/.exec(p)!.slice(1).map(Number) as [number, number]
      const [kb, kg] = /(\d+) of the boys and (\d+) of the girls/.exec(p)!.slice(1).map(Number) as [number, number]
      const asked = /percentage of the (boys|girls)/.exec(p)![1]!
      expect(asked).toBe(b.values.context)
      const [pb, pg] = [c((kb / nb) * 100), c((kg / ng) * 100)]
      expect(answer(b)).toBe(asked === 'boys' ? pb : pg)
      expect(within(pb, 6, 10) && within(pg, 0.2, 0.8) && within(pb / pg, 10, 30)).toBe(true)
      expect(nb).not.toBe(ng)
      expect(isPowerOfTen(nb) || isPowerOfTen(ng)).toBe(false)
      const [k, n] = asked === 'boys' ? [kb, nb] : [kg, ng]
      expect(b.question.solution.startsWith(`$\\dfrac{${k}}{${n}} \\times 100 = ${answer(b)}\\%$ of the ${asked}.`)).toBe(true)
      expect(b.question.solution).toContain('carried on the X chromosome')
      expect(method(b)).toEqual([`divides ${k} by ${n} and multiplies by 100`])
      expect(right(b, asked === 'boys' ? pg : pb)).toBe(false)
    }
    expect(contexts(built)).toBe(2)
    spread('colour-blindness-percentage', 'q25', ['nb', 'ng'])
  })

    it('q26: the radii, the areas, and their ratio to 3 s.f.; dividing the printed areas is marked right, the diameters wrong', () => {
    const built = build('pupil-area-ratio', 'q26')
    for (const b of built) {
      const p = b.question.prompt
      const D = num(/pupil is ([\d.]+) mm in diameter/, p)
      const d = num(/constrict it to ([\d.]+) mm/, p)
      expect(within(D, 4.5, 8) && within(d, 2, 4) && D - d >= 1.5 - 1e-9).toBe(true)
      const exact = (D / d) ** 2
      expect(answer(b)).toBe(threeSf(exact))
      expect(right(b, exact)).toBe(true)
      expect(right(b, D / d)).toBe(false)
      // The areas as the solution prints them, to 3 s.f., divided, with π and with 3.14; and that to 3 s.f.
      for (const pi of [Math.PI, 3.14]) {
        const q = Number((pi * (D / 2) ** 2).toPrecision(3)) / Number((pi * (d / 2) ** 2).toPrecision(3))
        expect(right(b, q), `${b.seed} ${pi} ${q}`).toBe(true)
        expect(right(b, threeSf(q)), `${b.seed} ${pi} ${q}`).toBe(true)
      }
      // About 1% of the answer.
      expect(tolerance(b)).toBe(Number((answer(b) * 0.01).toPrecision(2)))
      const [R, r] = [c(D / 2), c(d / 2)]
      expect(b.question.solution).toContain(`Radius first, not diameter: ${R} mm and ${r} mm. Areas: $\\pi \\times ${R}^2 = ${c(R * R)}\\pi$, about ${(Math.PI * R * R).toPrecision(3)} mm²`)
      expect(method(b)).toEqual([`uses the radii ${R} mm and ${r} mm to find the areas, ${c(R * R)}π and ${c(r * r)}π`, 'divides the larger area by the smaller'])
      // "5.30", never "5.3", when the ratio is said to be to 3 significant figures.
      const shown = threeFigureText(b.question.solution)
      if (shown) expect(printedFigures(shown), b.seed).toBe(3)
      if (shown) expect(Number(shown)).toBe(answer(b))
      expect(b.question.solution).not.toMatch(/\d\.\d{6,}/)
      for (const g of [D, d, R, r]) for (const y of [g, 2 * g, g / 2]) expect(isPowerOfTen(answer(b) / y), b.seed).toBe(false)
    }
    expect(contexts(built)).toBe(BODY.LIGHTS.length)
    expect(build('pupil-area-ratio', 'q26', 2000, 'zero').some((b) => /which is \d+\.\d0 to 3 significant figures/.test(b.question.solution))).toBe(true)
    // The written slot: 8 mm and 2 mm let in 16 times as much light.
    expect((8 / 2) ** 2).toBe(16)
    spread('pupil-area-ratio', 'q26', ['D', 'd'])
  })
})

// =============================================================================================
// Thermoregulation
// =============================================================================================

describe('thermoregulation', () => {
  it('q24: the increase in flow divided by the resting flow', () => {
    const built = build('skin-blood-flow-increase', 'q24')
    for (const b of built) {
      const p = b.question.prompt
      const a = num(/skin is (\d+) cm³ per minute/, p)
      const h = num(/flow to (\d+) cm³ per minute/, p)
      const w = BODY.WARMTHS.find((x) => x.name === b.values.context)!
      expect(within(a, 200, 500) && h <= 3500 && a % 10 === 0 && h % 10 === 0).toBe(true)
      const pc = c(((h - a) / a) * 100)
      expect(Number.isInteger(pc) && within(pc, ...w.p)).toBe(true)
      expect(answer(b)).toBe(pc)
      expect(p).toContain(`${w.where}, vasodilation`)
      expect(b.question.solution).toContain(`Increase $= ${h} - ${a} = ${h - a}$ cm³ per minute.`)
      expect(b.question.solution).toContain(`The flow is ${c(h / a)} times what it was, which is a ${pc}% increase, not ${pc + 100}%`)
      expect(method(b)).toEqual([`finds the increase, ${h - a}, and divides it by the original ${a} (× 100)`])
      expect(right(b, (h / a) * 100)).toBe(false)
    }
    expect(contexts(built)).toBe(BODY.WARMTHS.length)
    spread('skin-blood-flow-increase', 'q24', ['rest', 'hot'])
  })

  it('q25: kg to g, × 2.4 kJ, ÷ the minutes', () => {
    const built = build('sweat-evaporation-rate', 'q25')
    for (const b of built) {
      const p = b.question.prompt
      const kg = num(/lost ([\d.]+) kg of sweat/, p)
      const s = BODY.SWEATS.find((x) => x.name === b.values.context)!
      expect(p).toContain(s.lead)
      expect(p).toContain('takes about 2.4 kJ')
      expect(within(kg, ...s.kg)).toBe(true)
      // At most about 1.5 kg of sweat an hour.
      expect(kg / (s.minutes / 60)).toBeLessThanOrEqual(1.5 + 1e-9)
      const g = c(kg * 1000)
      const e = c(g * 2.4)
      const rate = c(e / s.minutes)
      expect(answer(b)).toBe(rate)
      expect(decimals(rate)).toBeLessThanOrEqual(1)
      expect(b.question.solution).toContain(`Convert the mass to grams: $${kg} \\text{ kg} = ${texed(g)}$ g. Energy removed ${s.span} $= ${texed(g)} \\times 2.4 = ${texed(e)}$ kJ.`)
      expect(b.question.solution).toContain(`\\dfrac{${texed(e)}}{${s.minutes}} = ${rate}$ kJ/min.`)
      if (s.minutes === 150) expect(b.question.solution).toContain('Two and a half hours is 150 minutes, so per minute')
      expect(method(b)[1]).toBe(`divides by ${s.minutes} minutes`)
      // Forgetting the kg to g, or dividing by the hours, is marked wrong.
      expect(right(b, rate / 1000)).toBe(false)
      expect(right(b, e / (s.minutes / 60))).toBe(false)
    }
    expect(contexts(built)).toBe(BODY.SWEATS.length)
    spread('sweat-evaporation-rate', 'q25', ['kg'])
  })
})

// =============================================================================================
// The kidneys
// =============================================================================================

describe('the kidneys', () => {
    it('q26: the volume reabsorbed over the volume filtered, to 3 s.f.', () => {
    const built = build('kidney-percentage-reabsorbed', 'q26')
    for (const b of built) {
      const p = b.question.prompt
      const f = num(/filter (\d+) litres/, p)
      const u = num(/produces? ([\d.]+) litres of urine/, p)
      const d = BODY.DAYS.find((x) => x.name === b.values.context)!
      expect(within(f, 150, 190) && within(u, ...d.urine)).toBe(true)
      const back = c(f - u)
      const exact = (back / f) * 100
      expect(answer(b)).toBe(threeSf(exact))
      expect(right(b, exact)).toBe(true)
      expect(within(exact, 98, 99.7)).toBe(true)
      expect(b.question.solution).toContain(`Reabsorbed $= ${f} - ${u} = ${back}$ litres. Percentage $= \\dfrac{${back}}{${f}} \\times 100 = `)
      expect(b.question.solution).toContain(`Only about ${(100 - exact).toPrecision(2)}% of what is filtered leaves as urine.`)
      const shown = threeFigureText(b.question.solution)
      if (shown) expect(printedFigures(shown)).toBe(3)
      expect(method(b)).toEqual([`subtracts the urine from the filtered volume, ${back} litres, and divides by ${f} (× 100)`])
      expect(right(b, (u / f) * 100)).toBe(false)
    }
    expect(contexts(built)).toBe(BODY.DAYS.length)
    // "they" only after "a person".
    for (const b of built) expect(b.question.prompt).toMatch(/^(In one day, a person's|On a (?:hot )?day when a person)/)
    // About 99% is reabsorbed whatever the day, so a context has few answers to 3 s.f.
    spread('kidney-percentage-reabsorbed', 'q26', ['f', 'u'], 5)
    expect(new Set(build('kidney-percentage-reabsorbed', 'q26', 1000, 'filtrate').map((b) => b.values.f)).size).toBe(41)
  })

    it('q27: both rates in one unit, then one over the other; the per-minute rates rounded to 2 places are marked right', () => {
    const built = build('urine-rate-ratio', 'q27')
    for (const b of built) {
      const p = b.question.prompt
      const rest = num(/rate of (\d+) cm³ per hour/, p)
      const [v, t] = /produces (\d+) cm³ of urine over the next (\d+) minutes/.exec(p)!.slice(1).map(Number) as [number, number]
      const d = BODY.DRINKS.find((x) => x.name === b.values.context)!
      expect(p).toContain(`After drinking ${d.what},`)
      expect(rest).not.toBe(60)
      expect(v <= 0.9 * d.cm3 && v / t <= 12 && within(rest, 30, 90) && v % 5 === 0).toBe(true)
      const perHour = c(v / (t / 60))
      const ratio = c(perHour / rest)
      expect(decimals(perHour)).toBeLessThanOrEqual(1)
      expect(answer(b)).toBe(ratio)
      expect(decimals(ratio)).toBeLessThanOrEqual(1)
      expect(tolerance(b)).toBe(Number(Math.min(0.05, ratio * 0.019).toPrecision(10)))
      const [rm, am] = [round(rest / 60, 2), round(v / t, 2)]
      expect(right(b, am / rm), `${b.seed} ${am} ÷ ${rm}`).toBe(true)
      expect(b.question.solution).toContain(`${t} minutes is ${c(t / 60)} hour`)
      expect(b.question.solution).toContain(`$${v} \\div ${c(t / 60)} = ${perHour}$ cm³ per hour, and $${perHour} \\div ${rest} = ${ratio}$`)
      const clean = decimals(c(rest / 60)) <= 2 && decimals(c(v / t)) <= 2
      expect(method(b)[0]).toBe(
        clean
          ? `converts both rates to the same units: ${c(rest / 60)} and ${c(v / t)} cm³ per minute, or ${rest} and ${perHour} cm³ per hour`
          : `converts both rates to the same units: ${rest} and ${perHour} cm³ per hour, or ${decimals(c(rest / 60)) <= 2 ? c(rest / 60) : `about ${rm.toFixed(2)}`} and ${decimals(c(v / t)) <= 2 ? c(v / t) : `about ${am.toFixed(2)}`} cm³ per minute`,
      )
      // Mixing the units, cm³ per minute over cm³ per hour, is marked wrong.
      expect(right(b, (v / t) / rest)).toBe(false)
    }
    expect(contexts(built)).toBe(BODY.DRINKS.length)
    spread('urine-rate-ratio', 'q27', ['rest', 'v', 't'])
    // No answer, round or not, takes more than about a quarter of a context.
    expect(worstShare(build('urine-rate-ratio', 'q27', 2000, 'round'), answer).worst).toBeLessThanOrEqual(0.25)
  })
})

// =============================================================================================
// The menstrual cycle and fertility
// =============================================================================================

describe('fertility', () => {
    it('q28: those not pregnant over the number of women, at the NHS typical-use rate of the method named', () => {
    const built = build('contraception-effectiveness', 'q28')
    for (const b of built) {
      const p = b.question.prompt
      const n = num(/study, (\d+) women/, p)
      const k = num(/year, (\d+) of them became pregnant/, p)
      const m = BODY.METHODS.find((x) => x.name === b.values.context)!
      expect(within((k / n) * 100, ...m.p)).toBe(true)
      expect(isPowerOfTen(n)).toBe(false)
      const exact = ((n - k) / n) * 100
      expect(answer(b)).toBe(threeSf(exact))
      expect(right(b, exact)).toBe(true)
      expect(b.question.solution).toContain(`Did not become pregnant: $${n} - ${k} = ${n - k}$. Percentage $= \\dfrac{${n - k}}{${n}} \\times 100 = `)
      expect(b.question.solution).toContain('Figures like this describe **typical use**')
      expect(method(b)).toEqual([`subtracts ${k} from ${n} (${n - k}) and divides by ${n} (× 100)`])
      expect(right(b, (k / n) * 100)).toBe(false)
    }
    expect(contexts(built)).toBe(BODY.METHODS.length)
    // Pregnancies in a year of typical use, as the NHS gives them: pill about 9%, injection 6%, male condom 18%, diaphragm 12 to 29%.
    expect(Object.fromEntries(BODY.METHODS.map((m) => [m.name, m.p]))).toEqual({ pill: [7, 11], condom: [15, 21], diaphragm: [12, 29], injection: [4, 8] })
    // The perfect-use figures the NHS gives.
    expect(Object.fromEntries(BODY.METHODS.map((m) => [m.name, /in (over 99%|98%|92 to 96%) of women/.exec(m.perfect)![1]]))).toEqual({ pill: 'over 99%', condom: '98%', diaphragm: '92 to 96%', injection: 'over 99%' })
    spread('contraception-effectiveness', 'q28', ['n', 'k'])
  })

    it('q29: success per cycle for both clinics, then the better over the worse; the one with more births is the worse', () => {
    const built = build('ivf-success-rate-ratio', 'q29')
    for (const b of built) {
      const p = b.question.prompt
      const [nA, bA] = /Clinic A carried out (\d+) cycles.*?and (\d+) of them led/.exec(p)!.slice(1).map(Number) as [number, number]
      const [nB, bB] = /Clinic B carried out (\d+) cycles.*?and (\d+) of them led/.exec(p)!.slice(1).map(Number) as [number, number]
      const worse = /says Clinic (A|B) must be better/.exec(p)![1]!
      const better = /success rate of Clinic (A|B) was/.exec(p)![1]!
      expect(worse).not.toBe(better)
      const [rA, rB] = [(bA / nA) * 100, (bB / nB) * 100]
      const a = BODY.AGES.find((x) => x.name === b.values.context)!
      expect(p).toContain(a.who)
      for (const r of [rA, rB]) expect(within(r, ...a.rate) && within(r, 5, 40)).toBe(true)
      for (const n of [nA, nB]) expect(within(n, 80, 400)).toBe(true)
      const [hi, lo, bHi, bLo, nHi, nLo] = better === 'A' ? [rA, rB, bA, bB, nA, nB] : [rB, rA, bB, bA, nB, nA]
      expect(bLo > bHi && nLo > nHi && hi > lo).toBe(true)
      expect(answer(b)).toBe(threeSf(hi / lo))
      // Every figure kept, or each rate to 3 s.f. first: both are right; the births' or the cycles' ratio is wrong.
      expect(right(b, hi / lo)).toBe(true)
      expect(right(b, threeSf(hi) / threeSf(lo))).toBe(true)
      expect(right(b, bLo / bHi)).toBe(false)
      expect(right(b, nLo / nHi)).toBe(false)
      expect(tolerance(b)).toBe(Number((answer(b) * 0.01).toPrecision(2)))
      expect(b.question.solution).toContain(`Success rates: Clinic A $\\dfrac{${bA}}{${nA}} \\times 100 = `)
      expect(b.question.solution).toContain(`Comparing the raw numbers of births, ${bLo} against ${bHi}, misleads because Clinic ${worse} carried out ${nLo - nHi} more cycles.`)
      expect(method(b)).toEqual([`converts both to a success rate: ${threeSf(rA).toPrecision(3)}% and ${threeSf(rB).toPrecision(3)}%`, 'divides one rate by the other'])
    }
    expect(contexts(built)).toBe(BODY.AGES.length)
    // A student who always picks A is right about half the time.
    const a = built.filter((b) => b.values.better === 'A').length / built.length
    expect(within(a, 0.4, 0.6)).toBe(true)
    spread('ivf-success-rate-ratio', 'q29', ['nHi', 'nLo', 'bHi', 'bLo'])
  })
})
