import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import { HEALTH, healthGenerators } from './health.ts'

/**
 * Structural tests for the health and disease generators. Each reads the prompt's own figures
 * back, works the answer again from them alone with plain arithmetic, and checks every printed
 * step: the height squared before the division, the mass at a BMI of 25 before the subtraction,
 * the limit times the hips, both rates before their ratio, the rate per 1000 before the fall, both
 * radii halved from the diameters, the share to vaccinate before the subtraction. Across builds
 * they check every context turns up, every figure is real for what is named, and that no answer or
 * input fills a context. Some builds are checked as literal text, never rebuilt with the
 * generator's own helpers.
 */
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/biology')
const bankOf = (topic: string) => Question.array().parse(JSON.parse(readFileSync(join(ROOT, `${topic}.json`), 'utf8')).questions)

function build(generatorId: string, slotId: string, count = 300, prefix = 'structure'): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  const slot = bankOf(g.topicId).find((q) => q.id === slotId)!
  return Array.from({ length: count }, (_, i) => generate(g, slot, `${prefix}-${i}`))
}
function one(generatorId: string, slotId: string, seed: string): Generated {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  return generate(g, bankOf(g.topicId).find((q) => q.id === slotId)!, seed)
}

/** A figure as plain arithmetic prints it, free of binary residue. */
const c = (x: number) => Number(x.toPrecision(12))
const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const tolerance = (b: Generated) => (b.question.type === 'numeric' ? b.question.tolerance : NaN)
const method = (b: Generated) => b.question.markScheme.slice(0, -1).map((l) => l.description)
const last = (b: Generated) => b.question.markScheme.at(-1)!.description
const contexts = (built: Generated[]) => new Set(built.map((b) => b.values.context)).size
const sigFigures = (x: number) => String(c(x)).replace('.', '').replace(/^0+/, '').replace(/0+$/, '').length
const decimals = (x: number) => (String(c(x)).split('.')[1] ?? '').length
/** A number from the prompt, read with its spaced thousands: "14 000" is 14000. */
const num = (re: RegExp, s: string) => {
  const m = re.exec(s)
  if (!m) throw new Error(`${re} not in: ${s}`)
  return Number(m[1]!.replace(/ /g, ''))
}
const within = (x: number, lo: number, hi: number) => x >= lo - 1e-9 && x <= hi + 1e-9
const isPowerOfTen = (x: number) => Math.abs(Math.log10(Math.abs(x)) - Math.round(Math.log10(Math.abs(x)))) < 1e-9
/** In maths, from five digits a thin space between thousands: 14\\,000. */
const texed = (x: number) => (x >= 10000 ? String(x).replace(/\B(?=(\d{3})+(?!\d))/g, '\\,') : String(x))
/** In prose, from five digits a space between thousands: 14 000. */
const spaced = (x: number) => (x >= 10000 ? String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : String(x))
/** The written answer box takes this: the answer to three significant figures. */
const threeSf = (x: number) => Number(x.toPrecision(3))
/** Half a unit in the third significant figure. */
const sfHalf = (x: number) => 0.5 * 10 ** (Math.floor(Math.log10(Math.abs(x))) - 2)
/** An answer worked from the prompt: itself when it ends within 4 places with 3 figures at most, else its 3-figure rounding. */
const three = (x: number) => (decimals(x) <= 4 && sigFigures(x) <= 3 ? c(x) : threeSf(x))
/** The tolerance an exact answer gets: half a unit in its last place (capped at 1.9%), none for a whole number. */
const exactTol = (x: number) => (decimals(x) ? c(Math.min(0.5 * 10 ** -decimals(x), Math.abs(x) * 0.019)) : 0)
/** The tolerance a worked figure gets: exact, or rounded to three figures. */
const tolOf = (exact: number, ans: number) => (c(exact) === ans ? exactTol(ans) : sfHalf(ans))

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

/** Exact answers a student has no reason to round: a difference of two masses, a count of people. */
const EXACT = ['mass-to-lose-for-a-bmi-of-25', 'herd-immunity-more-to-vaccinate']

const SLOTS = [
  ...['q2', 'q5', 'q10', 'q14', 'q26', 'q27'].map((q) => `non-communicable-disease-and-lifestyle/${q}`),
  ...['q21', 'q27', 'q28'].map((q) => `pathogens-and-how-disease-spreads/${q}`),
  ...['q24', 'q25'].map((q) => `how-the-body-fights-infection/${q}`),
  ...['q19', 'q27', 'q28'].map((q) => `the-immune-system-and-immunisation/${q}`),
  ...['q4', 'q7', 'q11', 'q21', 'q27', 'q28'].map((q) => `antibiotics-medicines-and-monoclonal-antibodies/${q}`),
]

describe('every health build', () => {
  it('has a generator for each of the twenty numeric written slots in the five topics', () => {
    const claimed = healthGenerators.flatMap((g) => g.replaces.map((id) => `${g.topicId}/${id}`)).sort()
    expect(claimed).toEqual([...SLOTS].sort())
  })

  it('prints no article before a figure, keeps the written units, reaches its answer, and is marked right with it and its three-figure rounding', () => {
    for (const g of healthGenerators) {
      for (const id of g.replaces) {
        const slot = bankOf(g.topicId).find((q) => q.id === id)!
        const built = build(g.id, id, 150)
        for (const b of built) {
          expect(b.question.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
          expect(b.question.type === 'numeric' && b.question.units, `${g.id} ${id}`).toBe(slot.type === 'numeric' && slot.units)
          expect(b.question.solution, b.seed).toContain(String(answer(b)))
          expect(mark(b.question, String(answer(b))).correct, b.seed).toBe(true)
          // A calculated answer's 3-figure rounding is right; one asked to 1 decimal place or the
          // nearest whole number, or an exact count, is marked as asked.
          if (!/decimal place|nearest whole number/.test(b.question.prompt) && !EXACT.includes(g.id))
            expect(mark(b.question, String(threeSf(answer(b)))).correct, `${b.seed} ${answer(b)}`).toBe(true)
          expect(tolerance(b), b.seed).toBeLessThanOrEqual(Math.abs(answer(b)) * 0.02)
          expect(b.check.agrees, b.seed).toBe(true)
        }
        expect(new Set(build(g.id, id, 400, 'variety').map((b) => b.question.prompt)).size, `${g.id} ${id}`).toBeGreaterThan(100)
      }
    }
  })

  it('never fails to draw, over 3000 seeds per slot', () => {
    for (const g of healthGenerators) {
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
// BMI
// =============================================================================================

const CATEGORY = (x: number) => (x < 18.5 ? 'underweight' : x < 25 ? 'healthy' : x < 30 ? 'overweight' : 'obese')

describe('BMI', () => {
  it('q2: height squared, then mass ÷ height², in the category the exact value falls in', () => {
    const built = build('lifestyle-bmi-from-mass-and-height', 'q2')
    for (const b of built) {
      const p = b.question.prompt
      const ctx = HEALTH.BMI_PEOPLE.find((x) => x.name === b.values.context)!
      const m = num(/mass of (\d+) kg/, p)
      const H = /(\d\.\d\d) m\b/.exec(p)![1]!
      const h2 = c(Number(H) * Number(H))
      const exact = m / h2
      expect(within(Number(H) * 100, ...ctx.heights)).toBe(true)
      expect(within(exact, ...ctx.bmi), b.seed).toBe(true)
      expect(answer(b), b.seed).toBe(three(exact))
      expect(tolerance(b), b.seed).toBe(tolOf(exact, answer(b)))
      expect(p.startsWith(`${ctx.noun} `)).toBe(true)
      expect(p).toContain(` ${ctx.pos} `)
      expect(b.question.solution).toContain(`Height² $= ${H}^2 = ${h2}$. BMI $= ${m} \\div ${h2} = `)
      if (c(exact) === answer(b)) expect(b.question.solution).toContain(`= ${answer(b)}$.`)
      else expect(b.question.solution).toContain(`, which is ${answer(b)} to 3 significant figures.`)
      // The category of the exact BMI, which its rounding shows too.
      expect(CATEGORY(exact)).toBe(CATEGORY(answer(b)))
      expect(b.question.solution).toContain(`That is in the ${CATEGORY(exact)} range`)
      expect(b.question.solution.includes('BMI cannot tell muscle from fat')).toBe(ctx.name === 'rugby player')
      expect(method(b)).toEqual([`squares the height and divides: ${m} ÷ ${H}²`])
      expect(last(b)).toBe(String(answer(b)))
      // Dividing by the height, not its square, is marked wrong.
      expect(mark(b.question, String(c(m / Number(H)))).correct).toBe(false)
    }
    expect(contexts(built)).toBe(3)
    spread('lifestyle-bmi-from-mass-and-height', 'q2', ['k', 'm'])
  })

  it('q10: mass = BMI × height², from a whole BMI', () => {
    const built = build('mass-from-bmi-and-height', 'q10')
    for (const b of built) {
      const p = b.question.prompt
      const ctx = HEALTH.MASS_PEOPLE.find((x) => x.name === b.values.context)!
      const bmi = num(/BMI of (\d+)\./, p)
      const H = /(\d\.\d\d) m\b/.exec(p)![1]!
      const h2 = c(Number(H) * Number(H))
      const exact = c(bmi * h2)
      expect(within(bmi, ...ctx.bmi)).toBe(true)
      expect(within(Number(H) * 100, ...ctx.heights)).toBe(true)
      expect(answer(b), b.seed).toBe(three(exact))
      expect(tolerance(b), b.seed).toBe(tolOf(exact, answer(b)))
      expect(b.question.solution).toContain(`$= ${bmi} \\times ${H}^2 = ${bmi} \\times ${h2} = ${exact}$ kg`)
      expect(method(b)).toEqual([`rearranges to mass = BMI × height² and substitutes: ${bmi} × ${H}²`])
      expect(last(b)).toBe(`${answer(b)} kg`)
      expect(mark(b.question, String(c(bmi * Number(H)))).correct).toBe(false)
    }
    expect(contexts(built)).toBe(2)
    spread('mass-from-bmi-and-height', 'q10', ['k', 'b'])
  })

  it('q14: 25 × height², taken from the mass, for someone overweight or obese', () => {
    const built = build('mass-to-lose-for-a-bmi-of-25', 'q14')
    for (const b of built) {
      const p = b.question.prompt
      const ctx = HEALTH.LOSS_PEOPLE.find((x) => x.name === b.values.context)!
      const m = num(/mass of (\d+) kg/, p)
      const H = /(\d\.\d\d) m\b/.exec(p)![1]!
      const h2 = c(Number(H) * Number(H))
      const target = c(25 * h2)
      const loss = c(m - target)
      // An even height, so the target ends within two places.
      expect(Math.round(Number(H) * 100) % 2).toBe(0)
      expect(decimals(target)).toBeLessThanOrEqual(2)
      expect(within(m / h2, 26, 35), b.seed).toBe(true)
      expect(within(loss, 2, 30)).toBe(true)
      expect(answer(b)).toBe(loss)
      expect(tolerance(b), b.seed).toBe(exactTol(loss))
      expect(b.question.solution).toContain(`Mass at a BMI of 25 $= 25 \\times ${H}^2 = 25 \\times ${h2} = ${target}$ kg.`)
      expect(b.question.solution).toContain(`would need to lose $${m} - ${target} = ${loss}$ kg.`)
      expect(b.question.solution).toContain(`BMI now is $${m} \\div ${h2} `)
      expect(b.question.solution).toContain(`in the ${CATEGORY(m / h2)} range.)`)
      expect(method(b)).toEqual([`squares the height: ${H}² = ${h2}`, `finds the mass at a BMI of 25: 25 × ${h2} = ${target} kg`])
      expect(p).toContain(` ${ctx.sub} `)
      // The target mass, a student's stopping point, is marked wrong.
      expect(mark(b.question, String(target)).correct).toBe(false)
      // Never the target BMI of 25, nor a given, with or without the point moved, doubled or halved.
      for (const g of [m, target, 25]) for (const x of [g, 2 * g, g / 2]) expect(isPowerOfTen(loss / x), b.seed).toBe(false)
      // An exact difference: its 3-figure rounding is wrong when it has four figures.
      if (sigFigures(loss) > 3) expect(mark(b.question, String(threeSf(loss))).correct, b.seed).toBe(false)
    }
    expect(contexts(built)).toBe(2)
    spread('mass-to-lose-for-a-bmi-of-25', 'q14', ['k', 'm'])
  })

  it('q2, q10 and q14: literal builds, as a reader works them', () => {
    const a = one('lifestyle-bmi-from-mass-and-height', 'q2', 'review-b')
    expect(a.question.prompt).toBe('A rugby player is 1.89 m tall and has a mass of 110 kg. Using BMI = mass ÷ height², calculate their body mass index (BMI).')
    expect(a.question.solution).toBe(
      'Height² $= 1.89^2 = 3.5721$. BMI $= 110 \\div 3.5721 = 30.7942\\ldots$, which is 30.8 to 3 significant figures. That is in the obese range, but a rugby player carries a lot of muscle, and BMI cannot tell muscle from fat. Under 18.5 is underweight, 18.5 to 24.9 healthy, 25 to 29.9 overweight and 30 or more obese.',
    )
    expect(answer(a)).toBe(30.8)
    expect(tolerance(a)).toBe(0.05)
    const l = one('mass-to-lose-for-a-bmi-of-25', 'q14', 'review-c')
    expect(l.question.prompt).toBe(
      'A woman is 1.80 m tall and has a mass of 108 kg. A BMI of 25 is the top of the healthy range. Using BMI = mass ÷ height², calculate the mass in kg she would need to lose to bring her BMI down to 25.',
    )
    expect(l.question.solution).toBe(
      'Mass at a BMI of 25 $= 25 \\times 1.80^2 = 25 \\times 3.24 = 81$ kg. She would need to lose $108 - 81 = 27$ kg. (Her BMI now is $108 \\div 3.24 \\approx 33.3$, in the obese range.)',
    )
    expect(answer(l)).toBe(27)
    expect(tolerance(l)).toBe(0)
  })
})

// =============================================================================================
// Waist-to-hip ratio
// =============================================================================================

describe('waist-to-hip ratio', () => {
  it('q5: waist ÷ hips, marked to 2 decimal places as the written slot is, against the limit for the sex named', () => {
    const built = build('lifestyle-waist-to-hip-ratio', 'q5')
    for (const b of built) {
      const p = b.question.prompt
      const ctx = HEALTH.BODIES.find((x) => x.name === b.values.context)!
      const w = num(/waist(?: measurement of| measures) (\d+) cm/, p)
      const h = num(/hip(?:s| measurement of) (\d+) cm/, p)
      const exact = w / h
      expect(within(w, 60, 130) && within(h, 85, 140)).toBe(true)
      expect(within(w, ...ctx.waists) && within(h, ...ctx.hips) && within(exact, ...ctx.ratios)).toBe(true)
      expect(answer(b), b.seed).toBe(three(exact))
      expect(tolerance(b)).toBe(0.005)
      // Its 2-place rounding is right, and the hips over the waist is wrong.
      expect(mark(b.question, (Math.round(exact * 100) / 100).toFixed(2)).correct, b.seed).toBe(true)
      expect(mark(b.question, String(threeSf(h / w))).correct).toBe(false)
      expect(b.question.solution).toContain(`Ratio = waist ÷ hips $= ${w} \\div ${h} = `)
      expect(b.question.solution).toContain('Both are in cm, so the units cancel and the ratio has none.')
      const limit = ctx.name === 'woman' ? '0.85' : '0.90'
      expect(b.question.solution).toContain(`Doctors use ${limit} as the upper limit of the lower-risk range for ${ctx.name === 'woman' ? 'women' : 'men'}, so this ratio is ${exact > Number(limit) ? 'above' : 'below'} it`)
      expect(Math.abs(exact - Number(limit))).toBeGreaterThanOrEqual(0.01)
      expect(method(b)).toEqual([`divides the waist by the hips: ${w} ÷ ${h}`])
    }
    expect(contexts(built)).toBe(2)
    spread('lifestyle-waist-to-hip-ratio', 'q5', ['w', 'h'])
  })

  it('q27: the limit times the hips, taken from the waist', () => {
    const built = build('waist-decrease-for-a-ratio', 'q27')
    let women = 0
    for (const b of built) {
      const p = b.question.prompt
      const ctx = HEALTH.BODIES.find((x) => x.name === b.values.context)!
      const w = num(/waist(?: of| measures) (\d+) cm/, p)
      const h = num(/hips(?: of)? (\d+) cm/, p)
      const L = ctx.name === 'woman' ? 0.85 : 0.9
      const Ltext = L.toFixed(2)
      const target = c(L * h)
      const decrease = c(w - target)
      expect(p).toContain(`${Ltext}`)
      expect(p.toLowerCase()).toContain(`for ${ctx.name === 'woman' ? 'women' : 'men'}`)
      expect(w / h, b.seed).toBeGreaterThan(L)
      expect(within(w / h, ...HEALTH.SHRINK[ctx.name]!.now)).toBe(true)
      expect(within(w, 60, 130) && within(h, 85, 140)).toBe(true)
      expect(isPowerOfTen(h)).toBe(false)
      if (ctx.name === 'woman') {
        women++
        expect(h % 2).toBe(0)
      }
      expect(answer(b)).toBe(decrease)
      expect(decimals(decrease)).toBeLessThanOrEqual(1)
      expect(tolerance(b)).toBe(exactTol(decrease))
      expect(b.question.solution).toContain(`the waist must be $${Ltext} \\times ${h} = ${target}$ cm. Decrease needed $= ${w} - ${target} = ${decrease}$ cm.`)
      expect(b.question.solution).toMatch(new RegExp(`ratio now is \\$\\\\dfrac\\{${w}\\}\\{${h}\\} (=|\\\\approx) ${(w / h).toFixed(3).replace(/0+$/, '').replace('.', '\\.')}`))
      expect(method(b)).toEqual([`rearranges: waist = ${Ltext} × ${h} = ${target} cm`, `subtracts from the present waist: ${w} − ${target}`])
      // Stopping at the target waist is wrong.
      expect(mark(b.question, String(target)).correct).toBe(false)
      for (const g of [w, h, target]) expect(isPowerOfTen(decrease / g), b.seed).toBe(false)
      // Never the limit with the point moved, doubled or halved: 9 cm beside 0.90, 4.5 or 18 cm.
      for (const x of [L, 2 * L, L / 2]) expect(isPowerOfTen(decrease / x), `${b.seed} ${decrease}`).toBe(false)
    }
    expect(women / built.length).toBeGreaterThan(0.3)
    spread('waist-decrease-for-a-ratio', 'q27', ['w', 'h'])
  })

  it('q27: a literal build, as a reader works it', () => {
    const b = one('waist-decrease-for-a-ratio', 'q27', 'review-c')
    expect(b.question.prompt).toBe(
      'A man has a waist of 108 cm and hips of 109 cm. For men, a waist-to-hip ratio (waist ÷ hips) above 0.90 is linked to a higher risk of cardiovascular disease and type 2 diabetes. If his hips stay the same, by how many centimetres would his waist need to decrease for his ratio to fall to 0.90?',
    )
    expect(answer(b)).toBe(9.9)
    expect(tolerance(b)).toBe(0.05)
    expect(b.question.solution.startsWith('His ratio now is $\\dfrac{108}{109} \\approx 0.991$, above the limit of 0.90. For a ratio of 0.90 with hips of 109 cm, the waist must be $0.90 \\times 109 = 98.1$ cm. Decrease needed $= 108 - 98.1 = 9.9$ cm.')).toBe(true)
  })
})

// =============================================================================================
// Deaths and cases: percentage changes
// =============================================================================================

describe('percentage changes in deaths and cases', () => {
  it('q26 (lifestyle): the rise over the earlier figure, for three non-communicable diseases', () => {
    const built = build('non-communicable-deaths-increase', 'q26')
    for (const b of built) {
      const p = b.question.prompt
      const ctx = HEALTH.DEATHS.find((x) => x.name === b.values.context)!
      const nums = [...p.matchAll(/(\d{1,3}(?: \d{3})+|\d{4,5})(?= (?:people|women|in))/g)].map((m) => Number(m[1]!.replace(/ /g, '')))
      const years = [...p.matchAll(/\b(20\d\d)\b/g)].map((m) => Number(m[1]))
      const old = b.values.old as number
      const now = b.values.now as number
      expect(p).toContain(spaced(old))
      expect(p).toContain(spaced(now))
      expect(nums.length).toBeGreaterThan(0)
      expect(years[1]! - years[0]!).toBe(10)
      expect(p.indexOf(spaced(old))).toBeLessThan(p.indexOf(spaced(now)))
      const pct = c(((now - old) / old) * 100)
      expect(answer(b)).toBe(pct)
      expect(within(old, ...ctx.old) && within(pct, ...ctx.rise)).toBe(true)
      expect(decimals(pct)).toBeLessThanOrEqual(1)
      expect(tolerance(b)).toBe(exactTol(pct))
      expect(b.question.solution).toContain(`Increase $= ${texed(now)} - ${texed(old)} = ${texed(now - old)}$. Percentage increase $= \\dfrac{${texed(now - old)}}{${texed(old)}} \\times 100 = ${pct}\\%$.`)
      expect(b.question.solution).toContain(ctx.why)
      expect(method(b)).toEqual([`finds the increase, ${spaced(now - old)}, and divides it by the original ${spaced(old)} (× 100)`])
      // Dividing by the new figure is wrong; the change itself is no answer either.
      expect(mark(b.question, String(c(((now - old) / now) * 100))).correct).toBe(false)
      for (const g of [old, now, now - old]) for (const x of [g, 2 * g, g / 2]) expect(isPowerOfTen(pct / x), b.seed).toBe(false)
    }
    expect(contexts(built)).toBe(3)
    spread('non-communicable-deaths-increase', 'q26', ['old'])
  })

  it('q24 (fights infection): the fall over the original, for five vaccinated diseases', () => {
    const built = build('vaccine-cases-percentage-decrease', 'q24')
    for (const b of built) {
      const p = b.question.prompt
      const ctx = HEALTH.VACCINATED.find((x) => x.name === b.values.context)!
      const before = num(/(?:recorded|recorded) ([\d ]+) cases of/, p)
      const after = num(/(?:recorded|and) ([\d ]+) cases in a year/, p)
      const pct = c(((before - after) / before) * 100)
      expect(p).toContain(ctx.disease)
      expect(answer(b)).toBe(pct)
      expect(within(before, ctx.before[0], ctx.before[1]) && within(pct, ...ctx.fall)).toBe(true)
      expect(decimals(pct)).toBeLessThanOrEqual(1)
      expect(tolerance(b)).toBe(exactTol(pct))
      expect(b.question.solution).toContain(`The decrease is $${texed(before)} - ${texed(after)} = ${texed(before - after)}$ cases. So $\\dfrac{${texed(before - after)}}{${texed(before)}} \\times 100 = ${pct}\\%$.`)
      expect(b.question.solution).toContain(`Dividing by the new figure, ${spaced(after)}, instead of the original would be wrong`)
      expect(b.question.solution).toContain(`Only ${c(100 - pct)}% of the former cases remain.`)
      expect(method(b)).toEqual([`finds the decrease of ${spaced(before - after)} and divides by the original ${spaced(before)}`])
      // The share left, and the fall over the new figure, are wrong.
      expect(mark(b.question, String(c(100 - pct))).correct).toBe(false)
      for (const g of [before, after, before - after]) for (const x of [g, 2 * g, g / 2]) expect(isPowerOfTen(pct / x), b.seed).toBe(false)
    }
    expect(contexts(built)).toBe(5)
    spread('vaccine-cases-percentage-decrease', 'q24', ['before'])
  })

  it('q28 (pathogens): both years per 1000, then the fall over the first', () => {
    const built = build('malaria-control-percentage-decrease', 'q28')
    for (const b of built) {
      const p = b.question.prompt
      const ctx = HEALTH.CONTROLS.find((x) => x.name === b.values.context)!
      const N = num(/(?:has|of) ([\d ]+) people/, p)
      const r1 = num(/ (\d+) cases (?:of malaria for every|were recorded per) 1000/, p)
      const c2 = num(/ ([\d ]+) cases (?:of malaria were recorded in|in) the whole/, p)
      const L = N / 1000
      const r2 = c2 / L
      const pct = c(((r1 - r2) / r1) * 100)
      expect(Number.isInteger(L) && Number.isInteger(r2)).toBe(true)
      expect(p).toContain(ctx.measure)
      expect(p).toContain(N <= 9000 ? 'village' : 'town')
      expect(within(r1, 30, 300)).toBe(true)
      expect(answer(b)).toBe(pct)
      expect(Number.isInteger(pct) && within(pct, ...ctx.cut)).toBe(true)
      expect(tolerance(b)).toBe(0)
      expect(b.question.solution).toContain(`$${texed(N)} \\div 1000 = ${L}$ lots of 1000 people, so the second year's rate is $\\dfrac{${texed(c2)}}{${L}} = ${r2}$ cases per 1000.`)
      expect(b.question.solution).toContain(`The fall is $${r1} - ${r2} = ${r1 - r2}$ per 1000, and $\\dfrac{${r1 - r2}}{${r1}} \\times 100 = ${pct}$%.`)
      expect(b.question.solution).toContain(`$${r1} \\times ${L} = ${texed(r1 * L)}$ cases, and $\\dfrac{${texed(r1 * L)} - ${texed(c2)}}{${texed(r1 * L)}} \\times 100 = ${pct}$%.)`)
      expect(method(b)[1]).toBe(`divides the fall by the original figure: ${r1 - r2}/${r1} or ${spaced(r1 * L - c2)}/${spaced(r1 * L)}`)
      // The written slot's coincidence (40 per 1000 falling by 40%) never recurs, nor the fall per 1000 as the answer.
      for (const g of [r1, r2, r1 - r2, L]) for (const x of [g, 2 * g, g / 2]) expect(isPowerOfTen(pct / x), b.seed).toBe(false)
      expect(mark(b.question, String(r1 - r2)).correct).toBe(false)
    }
    expect(contexts(built)).toBe(3)
    spread('malaria-control-percentage-decrease', 'q28', ['r1', 'N'])
  })
})

// =============================================================================================
// Pathogens: relative risk and screening
// =============================================================================================

describe('pathogens', () => {
  it('q21: two rates, then their ratio, in the range WHO reports for HIV and tuberculosis', () => {
    const built = build('hiv-tuberculosis-relative-risk', 'q21')
    for (const b of built) {
      const p = b.question.prompt
      const [a, n1] = [b.values.a as number, b.values.n1 as number]
      const [bb, n2] = [b.values.b as number, b.values.n2 as number]
      expect(p).toContain(`${spaced(n1)} people living with HIV`)
      expect(p).toContain(`${spaced(n2)} people without HIV`)
      expect(p).toMatch(new RegExp(`${a} of ${spaced(n1)} people|with HIV, ${a} developed`))
      expect(p).toMatch(new RegExp(`${bb} of ${spaced(n2)} people|without HIV, ${bb} did`))
      expect(p).toContain('made-up study')
      const r1 = c((a / n1) * 100)
      const r2 = c((bb / n2) * 100)
      const k = c(r1 / r2)
      expect(within(r1, 1, 8) && within(r2, 0.05, 0.6) && within(k, 11, 30)).toBe(true)
      expect(decimals(r2)).toBeLessThanOrEqual(2)
      // Dividing by 0.5 doubles, by 0.1 or 0.05 moves the point.
      expect([0.5, 0.1, 0.05]).not.toContain(r2)
      expect([b.values.r1, b.values.r2]).toEqual([r1, r2])
      expect(answer(b)).toBe(k)
      expect(tolerance(b)).toBe(exactTol(k))
      expect(b.question.solution).toContain(`With HIV: $\\dfrac{${a}}{${texed(n1)}} \\times 100 = ${r1}\\%$. Without HIV: $\\dfrac{${bb}}{${texed(n2)}} \\times 100 = ${r2}\\%$. So $${r1} \\div ${r2} = ${k}$ times more likely.`)
      expect(method(b)).toEqual([`finds the rate with HIV, ${r1}% or ${c(r1 / 100)}`, `finds the rate without HIV, ${r2}% or ${c(r2 / 100)}`])
      // The cases alone, or the groups alone, never give the answer with the point moved.
      expect(isPowerOfTen(k / (a / bb))).toBe(false)
      expect(isPowerOfTen(n2 / n1)).toBe(false)
      expect(mark(b.question, String(c(a / bb))).correct).toBe(false)
    }
    spread('hiv-tuberculosis-relative-risk', 'q21', ['n1', 'n2', 'r1', 'r2'])
    // No rate without HIV in more than a tenth of builds.
    expect(worstShare(build('hiv-tuberculosis-relative-risk', 'q21', 2000, 'spread'), (b) => b.values.r2).worst).toBeLessThanOrEqual(0.1)
  })

  it('q27: positives over those tested, at the real positivity of each infection', () => {
    const built = build('screening-percentage-infected', 'q27')
    for (const b of built) {
      const p = b.question.prompt
      const ctx = HEALTH.INFECTIONS.find((x) => x.name === b.values.context)!
      const n = num(/(?:tested|Of the) ([\d ]+) (?:young people|who were)/, p)
      const pos = num(/(?:and|tested,) (\d+) (?:of them )?tested positive/, p)
      const pct = c((pos / n) * 100)
      expect(p.startsWith(ctx.intro)).toBe(true)
      expect(answer(b)).toBe(pct)
      expect(within(pct, ctx.pct[0], ctx.pct[1])).toBe(true)
      expect(sigFigures(pct)).toBeLessThanOrEqual(3)
      expect(tolerance(b)).toBe(exactTol(pct))
      expect(b.question.solution).toContain(`Percentage infected $= \\dfrac{${pos}}{${texed(n)}} \\times 100 = ${pct}$%.`)
      expect(b.question.solution).toContain(`these ${pos} people`)
      expect(method(b)).toEqual([`divides ${pos} by ${spaced(n)} and multiplies by 100`])
      for (const g of [n, pos]) for (const x of [g, 2 * g, g / 2]) expect(isPowerOfTen(pct / x), b.seed).toBe(false)
    }
    expect(contexts(built)).toBe(2)
    spread('screening-percentage-infected', 'q27', ['n'])
  })
})

// =============================================================================================
// Clear zones
// =============================================================================================

const ring = (d: number, D: number) => Math.PI * ((D / 2) ** 2 - (d / 2) ** 2)

/**
 * The room for π = 3.14: the gap to the 3.14 value plus half a unit for each rounding a student's
 * working may take (one for a circle, two for a ring, whose areas may each be rounded first), never
 * under half a unit. The π answer and every 3.14 answer, rounded either way at a half-way case,
 * are marked right.
 */
function expectPi314(b: Generated, raws: number[], roundings: number) {
  const ans = answer(b)
  const room = Math.max(0.05, ...raws.map((raw) => Math.abs(ans - raw) + 0.05 * roundings))
  expect(tolerance(b)).toBeCloseTo(room, 9)
  expect(tolerance(b)).toBeLessThanOrEqual(ans * 0.019)
  for (const raw of raws) {
    for (const v of [Math.floor(raw * 10) / 10, Math.ceil(raw * 10) / 10]) if (Math.abs(raw - v) <= 0.05 + 1e-9) expect(mark(b.question, v.toFixed(1)).correct, `${b.seed} ${v}`).toBe(true)
  }
  expect(mark(b.question, ans.toFixed(1)).correct).toBe(true)
}
const r1dp = (x: number) => Math.round(x * 10) / 10

describe('clear zones around antibiotic discs', () => {
  it('q4: π r² from a radius, to 1 decimal place', () => {
    const built = build('clear-zone-area-from-radius', 'q4')
    for (const b of built) {
      const rad = num(/radius of ([\d.]+) mm/, b.question.prompt)
      expect(within(rad * 2, 8, 30)).toBe(true)
      expect(HEALTH.DRUGS).toContain(b.values.context)
      expect(b.question.prompt).toContain(b.values.context as string)
      expect(b.question.prompt).toMatch(/Give your answer to 1 decimal place\.$/)
      const exact = Math.PI * rad * rad
      expect(answer(b)).toBe(r1dp(exact))
      expect(Number.isInteger(answer(b))).toBe(false)
      expectPi314(b, [314 * rad * rad / 100], 1)
      expect(b.question.solution).toContain(`Area $= \\pi r^2 = \\pi \\times ${rad}^2 = \\pi \\times ${c(rad * rad)} = `)
      expect(b.question.solution).toContain(`, which is ${answer(b).toFixed(1)} mm² to 1 decimal place.`)
      expect(method(b)).toEqual([`substitutes into πr²: π × ${rad}²`])
      expect(last(b)).toBe(`${answer(b)} mm² (accept ${(Math.round(3.14 * rad * rad * 10) / 10).toFixed(1)} from π = 3.14)`)
      // The diameter squared is wrong.
      expect(mark(b.question, String(r1dp(Math.PI * 4 * rad * rad))).correct).toBe(false)
    }
    expect(contexts(built)).toBe(HEALTH.DRUGS.length)
    spread('clear-zone-area-from-radius', 'q4', ['radius'])
    const five = build('clear-zone-area-from-radius', 'q4', 3000, 'literal').find((b) => b.values.radius === 5)!
    expect(answer(five)).toBe(78.5)
    expect(five.question.solution).toBe('Area $= \\pi r^2 = \\pi \\times 5^2 = \\pi \\times 25 = 78.5398\\ldots$, which is 78.5 mm² to 1 decimal place.')
  })

  it('q7: the diameter halved first', () => {
    const built = build('clear-zone-area-from-diameter', 'q7')
    for (const b of built) {
      const D = num(/(?:diameter of|measures) (\d+) mm/, b.question.prompt)
      expect(within(D, ...HEALTH.ZONE)).toBe(true)
      const rad = D / 2
      expect(answer(b)).toBe(r1dp(Math.PI * rad * rad))
      expectPi314(b, [(314 * rad * rad) / 100], 1)
      expect(last(b)).toMatch(/ mm² \(accept \d+\.\d from π = 3\.14\)$/)
      expect(b.question.solution).toContain(`Halve the diameter first: $r = ${D} \\div 2 = ${rad}$ mm. Area $= \\pi \\times ${rad}^2 = \\pi \\times ${c(rad * rad)} = `)
      expect(method(b)).toEqual([`r = ${rad} and π × ${rad}²`])
      expect(mark(b.question, String(r1dp(Math.PI * D * D))).correct).toBe(false)
    }
    expect(contexts(built)).toBe(HEALTH.DRUGS.length)
    spread('clear-zone-area-from-diameter', 'q7', ['D'])
    const fourteen = build('clear-zone-area-from-diameter', 'q7', 3000, 'literal').find((b) => b.values.D === 14)!
    expect(answer(fourteen)).toBe(153.9)
    expect(fourteen.question.solution.startsWith('Halve the diameter first: $r = 14 \\div 2 = 7$ mm. Area $= \\pi \\times 7^2 = \\pi \\times 49 = 153.938\\ldots$, which is 153.9 mm² to 1 decimal place.')).toBe(true)
  })

  it('q11, q27 (antibiotics) and q25 (fights infection): the ring between zone and disc', () => {
    for (const [id, slot, dp] of [['clear-zone-ring-area', 'q11', 1], ['clear-zone-ring-area', 'q27', 1], ['clear-zone-ring-nearest-whole', 'q25', 0]] as const) {
      const built = build(id, slot)
      for (const b of built) {
        const p = b.question.prompt
        const [d, D] = [b.values.d as number, b.values.D as number]
        // The disc's diameter first, then the zone's, each as the prompt states it.
        expect(p).toMatch(new RegExp(`disc (?:of diameter |has a diameter of )?${d} mm`))
        expect(p).toMatch(new RegExp(`zone(?: of diameter| \\d+ mm across| measured straight across, including the disc, is|, measured across and including the disc, has a diameter of|, measured straight across the disc, has a diameter of)? ${D} mm|zone ${D} mm across`))
        expect(HEALTH.DISCS).toContain(d)
        expect(within(D, ...HEALTH.ZONE) && D >= d + 4).toBe(true)
        const exact = ring(d, D)
        const zone = r1dp(Math.PI * (D / 2) ** 2)
        const disc = r1dp(Math.PI * (d / 2) ** 2)
        expect(answer(b), `${b.seed} ${d} ${D}`).toBe(dp ? r1dp(exact) : Math.round(exact))
        const raw314 = (314 * ((D / 2) ** 2 - (d / 2) ** 2)) / 100
        if (dp) {
          expectPi314(b, [raw314], 2)
          // The π areas rounded to 1 place first, and the 3.14 areas rounded first, are right too.
          expect(mark(b.question, String(c(zone - disc))).correct, b.seed).toBe(true)
          expect(mark(b.question, String(c(r1dp(3.14 * (D / 2) ** 2) - r1dp(3.14 * (d / 2) ** 2)))).correct, b.seed).toBe(true)
        } else {
          expect(tolerance(b)).toBe(0.5)
          // π and 3.14 give the same whole number, whichever way the 3.14 working rounds.
          expect(Math.round(raw314), `${d} ${D}`).toBe(answer(b))
          expect(Math.round(r1dp(3.14 * (D / 2) ** 2) - r1dp(3.14 * (d / 2) ** 2)), `${d} ${D}`).toBe(answer(b))
          expect(Math.abs(raw314 - answer(b)) + 0.1).toBeLessThan(0.5)
          expect(last(b)).toBe(`${answer(b)} mm² (accept ${answer(b)} from π = 3.14)`)
        }
        if (dp) expect(last(b)).toMatch(new RegExp(`^${answer(b)} mm² \\(accept \\d+\\.\\d(?: or \\d+\\.\\d)? from π = 3\\.14\\)$`))
        // The two printed areas subtract to the printed ring.
        expect(c(zone - disc)).toBe(r1dp(exact))
        const R = D / 2
        const r = d / 2
        expect(b.question.solution).toContain(`\\pi \\times (${c(R * R)} - ${c(r * r)}) = \\pi \\times ${c(R * R - r * r)}`)
        if (slot === 'q11') expect(method(b)).toEqual([`radii ${R} and ${r}`, `π × ${R}² − π × ${r}²`])
        if (slot === 'q27') expect(method(b)).toEqual([`halves both diameters and finds both areas: ${zone.toFixed(1)} mm² and ${disc.toFixed(1)} mm²`])
        if (slot === 'q25') {
          expect(method(b)).toEqual([`halves both diameters to radii of ${R} mm and ${r} mm`, `subtracts the disc area from the clear-zone area: π × ${R}² − π × ${r}²`])
          expect(b.question.solution).toContain(`$${zone.toFixed(1)} - ${disc.toFixed(1)} = ${r1dp(exact).toFixed(1)}$, which is $${answer(b)}\\ \\text{mm}^2$ to the nearest whole number.`)
          expect(b.question.solution).toContain(`forget the disc, which gives ${Math.round(Math.PI * R * R)}. Using π = 3.14 gives ${answer(b)} as well.`)
          expect(p).toContain('did not grow')
          expect(p).not.toContain('killed')
        }
        // Forgetting the disc, or using the diameters as radii, is wrong.
        expect(mark(b.question, String(dp ? r1dp(Math.PI * R * R) : Math.round(Math.PI * R * R))).correct).toBe(false)
        expect(mark(b.question, String(dp ? r1dp(4 * exact) : Math.round(4 * exact))).correct).toBe(false)
      }
      expect(contexts(built)).toBe(HEALTH.DRUGS.length)
      spread(id, slot, ['d', 'D'])
    }
  })

  it('q11, q27 and q25: the written 6 mm disc in a 20 mm zone, literally', () => {
    const find = (id: string, slot: string) => build(id, slot, 3000, 'literal').find((b) => b.values.d === 6 && b.values.D === 20)!
    const q11 = find('clear-zone-ring-area', 'q11')
    expect(answer(q11)).toBe(285.9)
    expect(q11.question.solution).toBe(
      'Clear agar = area of the zone − area of the disc $= \\pi \\times 10^2 - \\pi \\times 3^2 = \\pi \\times (100 - 9) = \\pi \\times 91 = 285.9$ mm² to 1 decimal place. Both radii are half the diameters: $20 \\div 2 = 10$ mm and $6 \\div 2 = 3$ mm.',
    )
    const q27 = find('clear-zone-ring-area', 'q27')
    // The written mark scheme's own line.
    expect(last(q27)).toBe('285.9 mm² (accept 285.7 from π = 3.14)')
    expect(mark(q27.question, '285.7').correct).toBe(true)
    expect(q27.question.solution.startsWith('Halve each diameter first. Clear zone including the disc: $r = 10$ mm, area $= \\pi \\times 10^2 = 314.2$ mm². Disc: $r = 3$ mm, area $= \\pi \\times 3^2 = 28.3$ mm². Clear agar around the disc $= 314.2 - 28.3 = 285.9$ mm²')).toBe(true)
    const q25 = find('clear-zone-ring-nearest-whole', 'q25')
    expect(answer(q25)).toBe(286)
    expect(last(q25)).toBe('286 mm² (accept 286 from π = 3.14)')
    expect(q25.question.solution).toContain('The agar where the bacteria did not grow is the ring between them: $314.2 - 28.3 = 285.9$, which is $286\\ \\text{mm}^2$ to the nearest whole number. The same answer comes from $\\pi \\times (100 - 9) = \\pi \\times 91$.')
  })

  it('q21: the mean of two diameters at right angles, halved', () => {
    const built = build('clear-zone-area-from-two-diameters', 'q21')
    let smallFirst = 0
    for (const b of built) {
      const m = /(\d+) mm and (\d+) mm|(\d+) mm, and at right angles to that (\d+) mm/.exec(b.question.prompt)!
      const [a, bb] = (m[1] ? [m[1], m[2]] : [m[3], m[4]]).map(Number) as [number, number]
      if (a < bb) smallFirst++
      expect(a).not.toBe(bb)
      expect(Math.abs(a - bb)).toBeLessThanOrEqual(4)
      const mean = (a + bb) / 2
      expect(Math.abs(a - bb) / mean).toBeLessThanOrEqual(0.25)
      expect(within(a, ...HEALTH.ZONE) && within(bb, ...HEALTH.ZONE)).toBe(true)
      const rad = mean / 2
      expect(answer(b)).toBe(r1dp(Math.PI * rad * rad))
      expectPi314(b, [(314 * rad * rad) / 100], 1)
      expect(b.question.solution).toContain(`Mean diameter $= (${a} + ${bb}) \\div 2 = ${mean}$ mm, so $r = ${mean} \\div 2 = ${rad}$ mm. Area $= \\pi \\times ${rad}^2 = \\pi \\times ${c(rad * rad)} = `)
      expect(method(b)).toEqual([`mean diameter ${mean} mm, so r = ${rad}`, `π × ${rad}²`])
      // The mean as the radius, or one diameter alone, is wrong.
      expect(mark(b.question, String(r1dp(Math.PI * mean * mean))).correct).toBe(false)
      expect(mark(b.question, String(r1dp(Math.PI * (a / 2) ** 2))).correct).toBe(false)
    }
    expect(smallFirst / built.length).toBeGreaterThan(0.35)
    expect(smallFirst / built.length).toBeLessThan(0.65)
    expect(contexts(built)).toBe(HEALTH.DRUGS.length)
    spread('clear-zone-area-from-two-diameters', 'q21', ['D1', 'D2'])
  })

  it('q28: the zone over a 90 mm plate, π cancelling', () => {
    const built = build('clear-zone-share-of-the-plate', 'q28')
    for (const b of built) {
      const p = b.question.prompt
      expect(p).toContain('90 mm')
      const D = num(/(?:clear zone of diameter|the disc is) (\d+) mm/, p)
      expect(within(D, ...HEALTH.ZONE)).toBe(true)
      const exact = (D / 90) ** 2 * 100
      expect(answer(b)).toBe(three(exact))
      expect(tolerance(b)).toBe(tolOf(exact, answer(b)))
      // The same 3-figure answer from the two areas rounded to 1 place.
      const fromAreas = (r1dp(Math.PI * (D / 2) ** 2) / r1dp(Math.PI * 45 * 45)) * 100
      expect(threeSf(fromAreas), b.seed).toBe(answer(b))
      expect(b.question.solution).toContain('Area of agar $= \\pi \\times 45^2 = 6361.7$ mm².')
      expect(b.question.solution).toContain(`Since π cancels, the exact value is $\\dfrac{${c((D / 2) ** 2)}}{2025} \\times 100 `)
      // The ratio of the diameters, not squared, is wrong.
      expect(mark(b.question, String(threeSf((D / 90) * 100))).correct).toBe(false)
    }
    expect(contexts(built)).toBe(HEALTH.DRUGS.length)
    spread('clear-zone-share-of-the-plate', 'q28', ['D'])
    const written = build('clear-zone-share-of-the-plate', 'q28', 2000, 'literal').find((b) => b.values.D === 18)!
    expect(answer(written)).toBe(4)
    expect(written.question.solution).toContain('Percentage clear $= \\dfrac{254.5}{6361.7} \\times 100$. Since π cancels, the exact value is $\\dfrac{81}{2025} \\times 100 = 4$%.')
  })
})

// =============================================================================================
// Immunity
// =============================================================================================

describe('the immune system and immunisation', () => {
  it('q19: the second peak over the first, with real days to each peak', () => {
    const built = build('antibody-peak-ratio', 'q19')
    for (const b of built) {
      const p = b.question.prompt
      const ctx = HEALTH.EXPOSURES.find((x) => x.name === b.values.context)!
      const [p1, p2] = [...p.matchAll(/(\d+) arbitrary units/g)].map((m) => Number(m[1]))
      const [d1, d2] = [...p.matchAll(/day (\d+)/g)].map((m) => Number(m[1]))
      expect(p.startsWith(ctx.first)).toBe(true)
      expect(within(d1!, ...ctx.d1) && within(d2!, ...ctx.d2)).toBe(true)
      const k = c(p2! / p1!)
      expect(within(k, 3, 30) && !isPowerOfTen(k)).toBe(true)
      expect(answer(b)).toBe(k)
      expect(tolerance(b)).toBe(exactTol(k))
      expect(b.question.solution).toContain(`$${p2} \\div ${p1} = ${k}$ times higher. The second response also peaked ${d1! - d2!} days sooner.`)
      expect(b.question.solution).toContain('**memory lymphocytes**')
      expect(method(b)).toEqual([`divides ${p2} by ${p1}`])
      expect(d1!).toBeGreaterThan(d2!)
      for (const g of [p1!, p2!]) expect(isPowerOfTen(k / g), b.seed).toBe(false)
      // Never a day number or the gap, doubled or halved, with or without the point moved.
      for (const g of [d1!, d2!, d1! - d2!]) for (const x of [g, 2 * g, g / 2]) expect(isPowerOfTen(k / x), `${b.seed} ${k} ${g}`).toBe(false)
      if (ctx.name === 'booster') expect(p).toContain('some years later')
    }
    expect(contexts(built)).toBe(2)
    spread('antibody-peak-ratio', 'q19', ['p1'])
  })

  it('q27: immune over vaccinated, at the real response rate of each vaccine', () => {
    const built = build('vaccine-trial-percentage-immune', 'q27')
    for (const b of built) {
      const p = b.question.prompt
      const ctx = HEALTH.TRIALS.find((x) => x.name === b.values.context)!
      const n = num(/([\d ]+) children (?:were given|in a trial)/, p)
      const m = num(/(?:that|found that) ([\d ]+) of (?:them|the children)/, p)
      const pct = c((m / n) * 100)
      expect(p).toContain(ctx.disease)
      expect(answer(b)).toBe(pct)
      expect(within(pct, ...ctx.immune)).toBe(true)
      expect(tolerance(b)).toBe(exactTol(pct))
      expect(b.question.solution).toContain(`$\\dfrac{${texed(m)}}{${texed(n)}} \\times 100 = ${pct}$%. The other ${c(100 - pct)}%, ${spaced(n - m)} children, did not become immune`)
      expect(method(b)).toEqual([`divides ${spaced(m)} by ${spaced(n)} and multiplies by 100`])
      expect(mark(b.question, String(c(100 - pct))).correct).toBe(false)
      for (const g of [n, m, n - m]) for (const x of [g, 2 * g, g / 2]) expect(isPowerOfTen(pct / x), b.seed).toBe(false)
    }
    expect(contexts(built)).toBe(4)
    spread('vaccine-trial-percentage-immune', 'q27', ['n'])
  })

  it('q28: the threshold from the disease’s real R₀, over the vaccine’s efficacy, of the town, less those vaccinated', () => {
    const built = build('herd-immunity-more-to-vaccinate', 'q28')
    for (const b of built) {
      const p = b.question.prompt
      const ctx = HEALTH.HERDS.find((x) => x.name === b.values.context)!
      const E = num(/to (\d+)% of the people vaccinated/, p)
      const H = num(/at least (\d+)% of a population/, p)
      const N = num(/(?:has|of) ([\d ]+) people/, p)
      const V = num(/([\d ]+) have been vaccinated/, p)
      // The threshold lies inside 1 − 1/R₀ for the disease's real R₀, and the efficacy is the vaccine's.
      expect(H).toBeGreaterThanOrEqual(100 * (1 - 1 / ctx.r0[0]))
      expect(H).toBeLessThanOrEqual(100 * (1 - 1 / ctx.r0[1]))
      expect(within(E, ...ctx.efficacy)).toBe(true)
      expect(p).toContain(ctx.disease)
      const needed = c((H / E) * N)
      expect(Number.isInteger(needed)).toBe(true)
      expect(V).toBeGreaterThanOrEqual(0.75 * N)
      expect(V).toBeLessThan(needed)
      expect(answer(b)).toBe(needed - V)
      expect(tolerance(b)).toBe(0)
      const mustBe = c((H / 100) * N)
      const are = c((E / 100) * V)
      expect(Number.isInteger(mustBe) && Number.isInteger(are)).toBe(true)
      expect(b.question.solution).toContain(`$${texed(needed)} - ${texed(V)} = ${needed - V}$ more people must be vaccinated.`)
      expect(b.question.solution).toContain(`$${c(H / 100)} \\times ${texed(N)} = ${texed(mustBe)}$ must be immune and $${c(E / 100)} \\times ${texed(V)} = ${texed(are)}$ already are, so ${spaced(c(mustBe - are))} more immune people are needed, and $${texed(c(mustBe - are))} \\div ${c(E / 100)} = ${texed(needed - V)}$.`)
      expect(b.question.solution).toContain(`infects ${ctx.r0[0]} to ${ctx.r0[1]} others`)
      expect(b.question.solution).toContain(`the ${100 - E}% in whom the vaccine did not work`)
      expect(method(b)[1]).toBe(`subtracts the ${spaced(V)} already vaccinated from ${spaced(needed)}, or divides the shortfall of ${spaced(c(mustBe - are))} by ${c(E / 100)}`)
      // Ignoring the efficacy, or stopping at the immune shortfall, is wrong.
      expect(mark(b.question, String(mustBe - V)).correct).toBe(false)
      expect(mark(b.question, String(c(mustBe - are))).correct).toBe(false)
    }
    expect(contexts(built)).toBe(5)
    // Not the threshold: rubella and diphtheria (R₀ 6 to 7) allow only 84% and 85%.
    spread('herd-immunity-more-to-vaccinate', 'q28', ['E', 'N'])
  })

  it('q28: the written figures rebuilt literally', () => {
    // 84% over 96% of 60 000, less 48 000: 4500.
    expect((84 / 96) * 60000 - 48000).toBe(4500)
    const b = one('herd-immunity-more-to-vaccinate', 'q28', 'review-c')
    expect(b.question.prompt).toBe(
      'Herd immunity against rubella needs at least 84% of a population to be immune. The MMR vaccine gives immunity to 97% of the people vaccinated. In a town of 19 400 people, 15 100 have been vaccinated. How many more people must be vaccinated for the town to reach herd immunity?',
    )
    expect(answer(b)).toBe(1700)
    expect(b.question.solution.startsWith('Only 97% of those vaccinated become immune, so to make 84% of the population immune, the number vaccinated must be $\\dfrac{84}{97} \\times 19\\,400 = 16\\,800$. The town has 15 100, so $16\\,800 - 15\\,100 = 1700$ more people must be vaccinated. (Another route: $0.84 \\times 19\\,400 = 16\\,296$ must be immune and $0.97 \\times 15\\,100 = 14\\,647$ already are, so 1649 more immune people are needed, and $1649 \\div 0.97 = 1700$.)')).toBe(true)
  })
})
