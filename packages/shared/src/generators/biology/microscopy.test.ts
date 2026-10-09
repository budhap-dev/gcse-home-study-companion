import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import { ANIMALS, MAMMALS, MICROSCOPY, PLANTS, duration, microscopyGenerators } from './microscopy.ts'

/**
 * Structural tests for the microscopy, microbe and cell generators. Each reads the prompt's own
 * figures back, works the answer again from them alone, and checks every printed step: the
 * mm → µm conversion and the ×1000 that goes with it, the magnification from image ÷ real, the
 * divisions counted before the power of two, the chromosome sets halved and added. Across builds
 * they check every context turns up, every size is real for what is named, and that no answer or
 * input fills a context. Expected numbers are rebuilt here with plain arithmetic, never with the
 * generator's own helpers, and some lines are checked as literal text.
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
const txt = (x: number) => String(c(x))
const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const tolerance = (b: Generated) => (b.question.type === 'numeric' ? b.question.tolerance : NaN)
const method = (b: Generated) => b.question.markScheme.slice(0, -1).map((l) => l.description)
const last = (b: Generated) => b.question.markScheme.at(-1)!.description
const contexts = (built: Generated[]) => new Set(built.map((b) => b.values.context)).size
const sigFigures = (x: number) => String(c(x)).replace('.', '').replace(/^0+/, '').replace(/0+$/, '').length
const num = (re: RegExp, s: string) => {
  const m = re.exec(s)
  if (!m) throw new Error(`${re} not in: ${s}`)
  return Number(m[1]!.replace(/ /g, ''))
}
const within = (x: number, lo: number, hi: number) => x >= lo - 1e-9 && x <= hi + 1e-9
/** In maths, from five digits a thin space between thousands: 24\\,000. */
const texed = (x: number) => (x >= 10000 ? String(x).replace(/\B(?=(\d{3})+(?!\d))/g, '\\,') : String(x))
const isPowerOfTen = (x: number) => Math.abs(Math.log10(x) - Math.round(Math.log10(x))) < 1e-9

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

const SLOTS: [string, string[]][] = microscopyGenerators.map((g) => [g.id, g.replaces])

describe('every microscopy build', () => {
  it('has a generator for each numeric written slot in the four topics', () => {
    const claimed = microscopyGenerators.flatMap((g) => g.replaces.map((id) => `${g.topicId}/${id}`)).sort()
    expect(claimed).toEqual(
      [
        ...['q2', 'q3', 'q5', 'q6', 'q13', 'q19', 'q21', 'q22', 'q23', 'q24', 'q31', 'q32'].map((q) => `microscopes-magnification-and-scale/${q}`),
        ...['q4', 'q6', 'q12', 'q24', 'q25'].map((q) => `microbes-and-microscopy/${q}`),
        ...['q24', 'q25'].map((q) => `cells-and-how-they-are-specialised/${q}`),
        ...['q26', 'q27'].map((q) => `cells-mitosis-and-growth/${q}`),
      ].sort(),
    )
  })

  it('prints no article before a figure, keeps the written units, and is marked right with its own answer', () => {
    for (const g of microscopyGenerators) {
      for (const id of g.replaces) {
        const slot = bankOf(g.topicId).find((q) => q.id === id)!
        for (const b of build(g.id, id, 150)) {
          expect(b.question.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
          expect(b.question.type === 'numeric' && b.question.units, `${g.id} ${id}`).toBe(slot.type === 'numeric' && slot.units)
          expect(b.question.solution, b.seed).toContain(String(answer(b)))
          expect(mark(b.question, String(answer(b))).correct, b.seed).toBe(true)
          // Every answer is exact: a conversion, a magnification or size drawn with at most three
          // figures, or a count. Its three-figure rounding is itself, so the marker takes it.
          expect(tolerance(b), `${g.id} ${id}`).toBe(0)
          if (!['bacterial-doubling', 'bacterial-growth-from-a-count', 'cell-cycle-doubling'].includes(g.id)) {
            expect(sigFigures(answer(b)), `${g.id} ${id} ${answer(b)}`).toBeLessThanOrEqual(3)
            expect(mark(b.question, String(Number(answer(b).toPrecision(3)))).correct).toBe(true)
          }
        }
      }
    }
  })

  it('never fails to draw, over 3000 seeds per slot', () => {
    for (const [id, slots] of SLOTS) {
      const g = GENERATORS.find((x) => x.id === id)!
      for (const s of slots) {
        const slot = bankOf(g.topicId).find((q) => q.id === s)!
        expect(() => {
          for (let i = 0; i < 3000; i++) generate(g, slot, `throw-${i}`)
        }, `${id} ${s}`).not.toThrow()
      }
    }
  })

  it('says a time as a prompt would', () => {
    expect(duration(100)).toBe('100 minutes')
    expect(duration(120)).toBe('2 hours')
    expect(duration(260)).toBe('4 hours 20 minutes')
    expect(duration(360)).toBe('6 hours')
  })
})

describe('unit conversions', () => {
  it('q2: mm → µm, ×1000, for a real cell of the size named', () => {
    const built = build('mm-to-micrometres', 'q2')
    for (const b of built) {
      const p = b.question.prompt
      const ctx = MICROSCOPY.MM_SIZES.find((x) => x.name === b.values.context)!
      const mm = num(/ (0\.\d+) mm/, p)
      expect(answer(b)).toBe(Math.round(mm * 1000))
      expect(ctx.sizes).toContain(answer(b))
      expect(isPowerOfTen(answer(b))).toBe(false)
      expect(p).toMatch(/micrometres \(µm\)[?.]$/)
      expect(b.question.solution).toBe(
        `$${mm} \\times 1000 = ${answer(b)}$ µm. Milli is $10^{-3}$ and micro is $10^{-6}$, three powers of ten apart, so the step is **×1000**.`,
      )
      expect(b.question.markScheme).toEqual([{ code: 'B1', marks: 1, description: String(answer(b)) }])
      // Dividing by 1000 instead is marked wrong.
      expect(mark(b.question, txt(mm / 1000)).correct).toBe(false)
    }
    expect(contexts(built)).toBe(MICROSCOPY.MM_SIZES.length)
    spread('mm-to-micrometres', 'q2', ['mm'])
  })

  it('q19: nm → µm, ÷1000, for a ribosome or a real virus', () => {
    const built = build('nm-to-micrometres', 'q19')
    const range: Record<string, [number, number]> = { ribosome: [20, 30], 'measles virus': [100, 300], HIV: [90, 140] }
    for (const b of built) {
      const nm = num(/ (\d+) nm/, b.question.prompt)
      expect(answer(b)).toBe(c(nm / 1000))
      expect(within(nm, ...range[b.values.context as string]!)).toBe(true)
      expect(b.question.solution).toContain(`$${nm} \\div 1000 = ${txt(nm / 1000)}$ µm.`)
      expect(b.question.solution).toContain('**÷1000**')
      expect(last(b)).toBe(txt(nm / 1000))
      expect(mark(b.question, String(nm * 1000)).correct).toBe(false)
    }
    expect(contexts(built)).toBe(3)
    spread('nm-to-micrometres', 'q19', ['nm'])
  })

  it('q21: standard form in metres → µm, divided by 10⁻⁶', () => {
    const built = build('standard-form-to-micrometres', 'q21')
    for (const b of built) {
      const m = /\$([\d.]+) \\times 10\^\{(-\d)\}\$ m/.exec(b.question.prompt)!
      const [mant, exp] = [Number(m[1]), Number(m[2])]
      expect(answer(b)).toBe(c(mant * 10 ** (exp + 6)))
      expect(mant > 1 && mant < 10).toBe(true)
      expect([-5, -4]).toContain(exp)
      // A cell from 20 to 400 µm.
      expect(within(answer(b), 20, 400)).toBe(true)
      expect(b.question.solution).toContain(`$${m[1]} \\times 10^{${exp}} \\div 10^{-6} = ${m[1]} \\times 10^{${exp + 6}} = ${answer(b)}$ µm.`)
      expect(last(b)).toBe(`${answer(b)} µm`)
    }
    expect(contexts(built)).toBe(MICROSCOPY.SF_SIZES.length)
    spread('standard-form-to-micrometres', 'q21', ['mantissa'])
  })
})

describe('total magnification', () => {
  for (const [id, slot] of [
    ['total-magnification', 'q3'],
    ['microbe-total-magnification', 'q4'],
  ] as const) {
    it(`${id} ${slot}: eyepiece × objective, with real lenses`, () => {
      const built = build(id, slot)
      for (const b of built) {
        const [e, o] = [...b.question.prompt.matchAll(/×(\d+)/g)].map((m) => Number(m[1]))
        expect([5, 10, 15]).toContain(e)
        expect([4, 10, 40, 100]).toContain(o)
        expect(e).not.toBe(o)
        expect(answer(b)).toBe(e! * o!)
        expect(answer(b)).toBeLessThanOrEqual(1500)
        expect(b.question.solution).toContain(`$${e} \\times ${o} = ${e! * o!}$, so the total magnification is **×${e! * o!}**`)
        expect(b.question.solution).toContain(`adding them would give ${e! + o!}.`)
        // Adding the lenses is marked wrong.
        expect(mark(b.question, String(e! + o!)).correct).toBe(false)
      }
      expect(contexts(built)).toBe(6)
      // The written slot's lenses, word for word.
      const ten4 = build(id, slot, 600).find((b) => b.values.eyepiece === 10 && b.values.objective === 4)!
      expect(ten4.question.solution).toBe(
        'Eyepiece × objective: $10 \\times 4 = 40$, so the total magnification is **×40** (the low power used to find the specimen). The lenses **multiply**: adding them would give 14.',
      )
      spread(id, slot, ['eyepiece', 'objective'])
    })
  }
})

describe('magnification, image size and real size', () => {
  const light = (name: string) => MICROSCOPY.LIGHT.find((s) => s.name === name)!
  const small = (name: string) => [...MICROSCOPY.SMALL, ...MICROSCOPY.SF_SMALL].find((s) => s.name === name)!

  it('q5: real size = drawing ÷ magnification, then ×1000 into µm', () => {
    const built = build('actual-size-from-a-drawing', 'q5')
    for (const b of built) {
      const p = b.question.prompt
      const mm = num(/ ([\d.]+) mm/, p)
      const mag = num(/×(\d+)/, p)
      const s = light(b.values.context as string)
      expect(answer(b)).toBe(c((mm / mag) * 1000))
      expect(s.sizes).toContain(answer(b))
      expect(within(mag, s.mags[0], s.mags[1]) && mag <= 1500 && !isPowerOfTen(mag)).toBe(true)
      expect(within(mm, 10, 150)).toBe(true)
      // The answer is not the drawing, nor it doubled or halved, nor with the point moved.
      for (const x of [mm, mm * 2, mm / 2]) expect(isPowerOfTen(answer(b) / x)).toBe(false)
      expect(p).toContain('in micrometres (µm).')
      expect(b.question.solution).toContain(`$\\dfrac{${mm}}{${mag}} = ${txt(answer(b) / 1000)}$ mm, then $\\times 1000 = ${answer(b)}$ µm.`)
      expect(method(b)).toEqual(['divides image size by magnification'])
      expect(last(b)).toBe(`${answer(b)} µm`)
      // Forgetting the ×1000 is marked wrong.
      expect(mark(b.question, txt(answer(b) / 1000)).correct).toBe(false)
    }
    expect(contexts(built)).toBe(MICROSCOPY.LIGHT.length)
    spread('actual-size-from-a-drawing', 'q5', ['mag', 'mm'])
  })

  it('q31: drawing = magnification × real size, then ÷1000 into mm', () => {
    const built = build('image-size-from-a-real-size', 'q31')
    for (const b of built) {
      const p = b.question.prompt
      const um = num(/ (\d+) µm/, p)
      const mag = num(/×(\d+)/, p)
      const s = light(b.values.context as string)
      expect(s.sizes).toContain(um)
      expect(mag <= 1500 && !isPowerOfTen(mag)).toBe(true)
      expect(answer(b)).toBe(c((um * mag) / 1000))
      expect(within(answer(b), 8, 150)).toBe(true)
      expect(p).toContain('in millimetres (mm)')
      expect(b.question.solution).toContain(`= ${mag} \\times ${um} = `)
      expect(b.question.solution).toContain(` \\div 1000 = ${answer(b)}$ mm.`)
      expect(method(b)).toEqual([`multiplies the magnification by the actual size, ${(um * mag).toLocaleString('en-GB').replace(/,/g, um * mag >= 10000 ? ' ' : '')} µm`])
      expect(last(b)).toBe(`${answer(b)} mm`)
      // The product left in µm is marked wrong.
      expect(mark(b.question, String(um * mag)).correct).toBe(false)
    }
    expect(contexts(built)).toBe(MICROSCOPY.LIGHT.length)
    spread('image-size-from-a-real-size', 'q31', ['mag', 'um'])
  })

  it('q6: magnification = image ÷ real, both in mm', () => {
    const built = build('magnification-from-sizes', 'q6')
    for (const b of built) {
      const p = b.question.prompt
      const um = num(/ ([\d.]+) µm/, p)
      const mm = num(/ ([\d.]+) mm/, p)
      const s = small(b.values.context as string)
      expect(s.sizes).toContain(um)
      expect(answer(b)).toBe(c((mm * 1000) / um))
      expect(Number.isInteger(answer(b)) && within(answer(b), s.mags[0], s.mags[1])).toBe(true)
      // A light microscope stops at ×1500; anything more is an electron micrograph.
      expect(p).toContain(answer(b) <= 1500 ? 'light micrograph' : 'electron micrograph')
      expect(b.question.solution).toContain(`Convert first: $${um}\\ \\mu\\text{m} = ${txt(um / 1000)}$ mm.`)
      expect(b.question.solution).toContain(`so the magnification is **×${answer(b)}**`)
      expect(b.question.solution).toContain(`without converting gives ${txt(mm / um)}, a thousand times too small.`)
      expect(method(b)).toEqual(['converts both lengths to the same unit', 'divides image size by actual size'])
      expect(last(b)).toBe(`×${answer(b)}`)
      expect(mark(b.question, txt(mm / um)).correct).toBe(false)
    }
    expect(contexts(built)).toBe(MICROSCOPY.SMALL.length)
    spread('magnification-from-sizes', 'q6', ['um', 'mm'])
  })

  it('q13: cm → mm and µm → mm, then image ÷ real', () => {
    const built = build('magnification-of-a-drawing', 'q13')
    for (const b of built) {
      const p = b.question.prompt
      const um = num(/ ([\d.]+) µm/, p)
      const cm = num(/ ([\d.]+) cm/, p)
      expect(small(b.values.context as string).sizes).toContain(um)
      expect(within(cm, 4, 20) && cm !== 10).toBe(true)
      expect(answer(b)).toBe(c((cm * 10) / (um / 1000)))
      expect(Number.isInteger(answer(b))).toBe(true)
      expect(method(b)).toEqual([`converts ${cm} cm to ${txt(cm * 10)} mm`, `converts ${um} µm to ${txt(um / 1000)} mm`])
      expect(b.question.solution).toContain(`$${cm}\\text{ cm} = ${txt(cm * 10)}$ mm, and $${um}\\ \\mu\\text{m} = ${txt(um / 1000)}$ mm.`)
      expect(last(b)).toBe(`×${answer(b)}`)
      // One conversion missed (cm left as it is) gives a tenth of the answer.
      expect(mark(b.question, txt(answer(b) / 10)).correct).toBe(false)
    }
    expect(contexts(built)).toBe(4)
    spread('magnification-of-a-drawing', 'q13', ['um', 'cm'])
  })

  it('q22: both lengths in metres, in standard form, and the same in µm', () => {
    const built = build('standard-form-magnification', 'q22')
    for (const b of built) {
      const p = b.question.prompt
      const m = /\$([\d.]+) \\times 10\^\{(-\d)\}\$ m/.exec(p)!
      const real = Number(m[1]) * 10 ** Number(m[2])
      const mm = num(/ (\d+) mm/, p)
      const um = c(real * 1e6)
      const s = small(b.values.context as string)
      expect(s.sizes).toContain(um)
      expect(Number(m[2])).toBe(b.values.context === 'measles virus' ? -7 : -6)
      expect(answer(b)).toBe(c(mm / 1000 / real))
      expect(within(answer(b), s.mags[0], s.mags[1])).toBe(true)
      expect(answer(b) > 1500 ? p.includes('electron micrograph') : p.includes('light micrograph')).toBe(true)
      expect(b.question.solution).toContain(`Put both lengths in metres: ${mm} mm $= `)
      expect(b.question.solution).toContain(`so the magnification is **×${answer(b)}**`)
      expect(b.question.solution).toContain(`is ${um} µm, ${mm} mm is `)
      expect(b.question.solution).toMatch(new RegExp(` \\\\div ${String(um).replace('.', '\\.')} = `))
      expect(method(b)).toEqual(['both lengths in the same unit', 'divides image size by actual size'])
      expect(last(b)).toBe(`×${answer(b)}`)
    }
    expect(contexts(built)).toBe(MICROSCOPY.SF_SMALL.length)
    spread('standard-form-magnification', 'q22', ['um', 'mm'])
  })

  it('q22: the standard-form division prints its working, as 24 mm over 8 × 10⁻⁶ m is 0.3 × 10⁴', () => {
    let checked = 0
    for (const b of build('standard-form-magnification', 'q22', 1000)) {
      const [um, mm] = [Number(b.values.um), Number(b.values.mm)]
      // Two-figure images under 100 mm and a real size of whole µm: 2.4 × 10⁻², 8 × 10⁻⁶.
      if (!Number.isInteger(um) || mm >= 100 || mm % 10 === 0) continue
      checked++
      expect(b.question.solution).toContain(`$\\dfrac{${txt(mm / 10)} \\times 10^{-2}}{${um} \\times 10^{-6}} = ${txt(answer(b) / 1e4)} \\times 10^{4} = `)
      expect(b.question.solution).toContain(`$${mm}\\,000 \\div ${um} = ${texed(answer(b))}$.`)
    }
    expect(checked).toBeGreaterThan(20)
  })

  it('q23: the magnification from the scale bar, then the specimen divided by it', () => {
    const built = build('size-from-a-scale-bar', 'q23')
    for (const b of built) {
      const p = b.question.prompt
      const bar = num(/labelled ([\d.]+) µm/, p)
      const length = num(/scale bar (?:labelled [\d.]+ µm is|beside it is) (\d+) mm long/, p)
      const s = MICROSCOPY.BARRED.find((x) => x.name === b.values.context)!
      const cell = num(/measures ([\d.]+) mm/, p)
      const mag = c((length * 1000) / bar)
      expect(length).toBe(b.values.length)
      expect(s.bars).toContain(bar)
      expect(answer(b)).toBe(c((cell * 1000) / mag))
      expect(s.sizes).toContain(answer(b))
      expect(s.light ? mag <= 1500 && p.includes('light micrograph') : mag >= 2000 && p.includes('electron micrograph')).toBe(true)
      expect(length !== 10 && within(cell, 10, 150)).toBe(true)
      expect(method(b)).toEqual([`magnification from the scale bar, ×${mag}`, `converts ${cell} mm to µm and divides by the magnification`])
      expect(b.question.solution).toContain(`The bar: ${length} mm $= ${length}\\,000$ µm on the image, representing ${bar} µm, so the magnification is $${length}\\,000 \\div ${bar} = \\times ${texed(mag)}$.`)
      expect(b.question.solution).toContain(`${cell} mm $= ${texed(c(cell * 1000))}$ µm, and $${texed(c(cell * 1000))} \\div ${texed(mag)} = ${answer(b)}$ µm.`)
      expect(b.question.solution).toContain(` = ${answer(b)}$ µm.`)
      expect(last(b)).toBe(`${answer(b)} µm`)
      // Dividing the cell by the bar's length without the label is marked wrong.
      expect(mark(b.question, txt(cell / length)).correct).toBe(false)
    }
    expect(contexts(built)).toBe(MICROSCOPY.BARRED.length)
    spread('size-from-a-scale-bar', 'q23', ['bar', 'length', 'mm'])
  })

  it('q23: the proportion route appears only where the number of bar lengths prints exactly', () => {
    const b = build('size-from-a-scale-bar', 'q23', 600).find((x) => x.values.bar === 20 && x.values.length === 25 && x.values.um === 84)
    if (b) expect(b.question.solution).toContain('Or by proportion: the palisade cell is $105 \\div 25 = 4.2$ bar lengths, and $4.2 \\times 20 = 84$ µm.')
    for (const x of build('size-from-a-scale-bar', 'q23', 300)) {
      const bars = c(Number(x.values.mm) / Number(x.values.length))
      expect(x.question.solution.includes('Or by proportion'), x.seed).toBe(Math.abs(bars * 1000 - Math.round(bars * 1000)) < 1e-6)
    }
  })

  it('q24: the field of view in µm ÷ the cells across it, for the field that magnification gives', () => {
    const built = build('size-from-the-field-of-view', 'q24')
    const fields: Record<number, [number, number]> = { 40: [4, 5.5], 100: [1.4, 2.2], 400: [0.38, 0.56] }
    for (const b of built) {
      const p = b.question.prompt
      const mag = num(/×(\d+)/, p)
      const field = num(/(?:field of view|light microscope) is ([\d.]+) mm across/, p)
      const n = num(/about (\d+) [a-z ]*cells/, p)
      const f = MICROSCOPY.FIELDS.find((x) => x.name === b.values.context)!
      expect(mag).toBe(f.mag)
      expect(within(field, ...fields[mag]!)).toBe(true)
      expect(n).not.toBe(10)
      // Never a count of 5, 20 or 50: the size would be the field doubled or halved with the point moved.
      for (const x of [field, field * 2, field / 2]) expect(isPowerOfTen(answer(b) / x), b.seed).toBe(false)
      expect(answer(b)).toBe(c((field * 1000) / n))
      expect(f.sizes.some((y) => Math.abs(y - answer(b)) < 1e-9)).toBe(true)
      expect(b.question.solution).toContain(`${field} mm $= `)
      expect(b.question.solution).toContain(`}{${n}} = ${answer(b)}$ µm.`)
      expect(b.question.solution).toContain('This is an **estimate**')
      expect(method(b)).toEqual([`converts ${field} mm to ${txt(field * 1000)} µm and divides by ${n}`])
      expect(last(b)).toBe(`about ${answer(b)} µm`)
      // Leaving the field in mm is marked wrong.
      expect(mark(b.question, txt(field / n)).correct).toBe(false)
    }
    expect(contexts(built)).toBe(MICROSCOPY.FIELDS.length)
    spread('size-from-the-field-of-view', 'q24', ['field', 'n'])
  })

  it('q32: the two magnifications multiply, then the poster ÷ the total, into µm', () => {
    const words = ['three', 'four', 'five', 'six', 'eight']
    const built = build('size-from-an-enlarged-photograph', 'q32')
    for (const b of built) {
      const p = b.question.prompt
      const mag = num(/×(\d+)/, p)
      const k = [3, 4, 5, 6, 8][words.indexOf(/enlarged (\w+) times/.exec(p)![1]!)]!
      const mm = num(/ ([\d.]+) mm (?:long|across)/, p)
      const s = light(b.values.context as string)
      expect(k).toBeDefined()
      expect(mag <= 1500).toBe(true)
      expect(answer(b)).toBe(c((mm * 1000) / (mag * k)))
      expect(s.sizes).toContain(answer(b))
      expect(within(mm, 30, 300) && Number.isInteger(mm * 2)).toBe(true)
      expect(method(b)[0]).toBe(`combines the magnifications: ${mag} × ${k} = ${(mag * k).toLocaleString('en-GB').replace(/,/g, mag * k >= 10000 ? ' ' : '')}`)
      expect(method(b)[1]).toMatch(new RegExp(`^divides ${mm} mm by [\\d ]+ and converts to µm$`))
      expect(b.question.solution).toContain(`$${mag} \\times ${k} = `)
      expect(b.question.solution).toContain(`= ${txt(answer(b) / 1000)}$ mm, and $${txt(answer(b) / 1000)} \\times 1000 = ${answer(b)}$ µm`)
      expect(b.question.solution).toContain(`Forgetting the enlargement gives $${mm} \\div ${mag} = ${txt(mm / mag)}$ mm`)
      expect(last(b)).toBe(`${answer(b)} µm`)
      // Forgetting the enlargement is marked wrong.
      expect(mark(b.question, String(answer(b) * k)).correct).toBe(false)
    }
    expect(contexts(built)).toBe(MICROSCOPY.LIGHT.length)
    spread('size-from-an-enlarged-photograph', 'q32', ['mag', 'k', 'mm'])
  })

  it('every specimen is the size it really is', () => {
    const real: Record<string, [number, number]> = {
      'palisade cell': [40, 90],
      'onion epidermis cell': [150, 400],
      'cheek cell': [35, 80],
      Paramecium: [170, 300],
      'white blood cell': [10, 22],
      bacterium: [1, 5],
      mitochondrion: [1, 4],
      chloroplast: [3, 8],
      'red blood cell': [6.5, 8.5],
      'yeast cell': [3, 5],
      nucleus: [5, 9],
      'measles virus': [0.1, 0.3],
    }
    for (const s of [...MICROSCOPY.LIGHT, ...MICROSCOPY.SF_SMALL]) for (const x of s.sizes) expect(within(x, ...real[s.name]!), `${s.name} ${x}`).toBe(true)
    for (const s of MICROSCOPY.LIGHT) expect(s.mags[1]).toBeLessThanOrEqual(1500)
    for (const s of MICROSCOPY.SF_SMALL) expect(s.mags[1]).toBeLessThanOrEqual(2000000)
  })
})

describe('bacteria and cells doubling', () => {
  const minutes = (p: string) => {
    const m = /after (?:(\d+) hours?)?(?: ?(\d+) minutes)?/.exec(p)!
    return Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0)
  }

  for (const slot of ['q6', 'q12']) {
    it(`microbes ${slot}: time ÷ doubling time divisions, then 2ⁿ from one bacterium`, () => {
      const built = build('bacterial-doubling', slot)
      for (const b of built) {
        const p = b.question.prompt
        const d = num(/every (\d+) minutes/, p)
        const t = minutes(p)
        const n = t / d
        const bac = MICROSCOPY.DOUBLERS.find((x) => x.name === b.values.context)!
        expect(bac.doublings).toContain(d)
        expect(within(d, 15, 40)).toBe(true)
        expect(Number.isInteger(n)).toBe(true)
        expect(within(n, slot === 'q6' ? 4 : 14, slot === 'q6' ? 13 : 23)).toBe(true)
        expect(answer(b)).toBe(2 ** n)
        expect(b.question.solution).toContain(`$${t} \\div ${d} = ${n}$ divisions.`)
        expect(b.question.solution).toContain(`$2^{${n}}`)
        expect(method(b)).toEqual([`${n} divisions`])
        expect(last(b)).toBe(String(2 ** n))
        if (slot === 'q12') expect(p).toMatch(/Give a whole number\.$/)
        // Doubling the number of divisions instead of raising 2 to it is marked wrong.
        expect(mark(b.question, String(2 * n)).correct).toBe(false)
      }
      expect(contexts(built)).toBe(MICROSCOPY.DOUBLERS.length)
      spread('bacterial-doubling', slot, ['d', 'minutes'])
    })
  }

  it('microbes q12: the written figures close as the written answer does', () => {
    const b = build('bacterial-doubling', 'q12', 3000, 'find').find((x) => x.values.n === 18 && x.values.d === 20)!
    expect(b.question.prompt).toContain('after 6 hours')
    expect(b.question.solution).toContain('6 hours is 360 minutes, and $360 \\div 20 = 18$ divisions.')
    expect(b.question.solution).toContain('$2^{18}$, which is **262144 bacteria**')
  })

  it('microbes q25: N₀ × 2ⁿ for food left out, at most six hours', () => {
    const built = build('bacterial-growth-from-a-count', 'q25')
    for (const b of built) {
      const p = b.question.prompt
      const d = num(/every (\d+) minutes/, p)
      const n0 = num(/ ([\d ]+) bacteria (?:when|once)/, p)
      const t = minutes(p)
      const n = t / d
      const food = MICROSCOPY.FOODS.find((x) => x.name === b.values.context)!
      expect(food.doublings).toContain(d)
      expect(Number.isInteger(n) && within(n, 4, 10) && t <= 360).toBe(true)
      expect(isPowerOfTen(n0)).toBe(false)
      // The doubling time and the starting count are never the same figure, nor it with the point moved.
      expect(isPowerOfTen(n0 / d), b.seed).toBe(false)
      expect(answer(b)).toBe(n0 * 2 ** n)
      expect(method(b)).toEqual([`counts ${n} divisions in ${duration(t)}`, `multiplies the starting count by 2 to the power ${n}, which is ${2 ** n}`])
      expect(b.question.solution).toContain(`$${t} \\div ${d} = ${n}$ divisions`)
      expect(b.question.solution).toContain(`Doubling is a power, not a multiple: multiplying`)
      expect(last(b)).toBe(answer(b) >= 10000 ? answer(b).toLocaleString('en-GB').replace(/,/g, ' ') : String(answer(b)))
      // n₀ × 2n, the multiple, is marked wrong.
      expect(mark(b.question, String(n0 * 2 * n)).correct).toBe(false)
    }
    expect(contexts(built)).toBe(MICROSCOPY.FOODS.length)
    spread('bacterial-growth-from-a-count', 'q25', ['d', 'n', 'n0'])
  })

  it('microbes q25: the written figures read as the written solution does', () => {
    const b = build('bacterial-growth-from-a-count', 'q25', 6000, 'find').find((x) => x.values.n0 === 500 && x.values.d === 30 && x.values.n === 8)!
    expect(b.question.solution).toContain('4 hours is 240 minutes, and $240 \\div 30 = 8$ divisions')
    expect(b.question.solution).toContain('multiplied by $2^{8} = 256$. Then $500 \\times 256$, which is **128000 bacteria**')
    expect(b.question.solution).toContain('multiplying 500 by $8 \\times 2 = 16$ would give 8000')
    expect(last(b)).toBe('128 000')
  })

  it('mitosis q27: days into hours, cycles, then N₀ × 2ⁿ cells', () => {
    const built = build('cell-cycle-doubling', 'q27')
    for (const b of built) {
      const p = b.question.prompt
      const h = num(/every (\d+) hours/, p)
      const n0 = num(/starts with ([\d ]+) of/, p)
      const days = num(/after (\d+) days/, p)
      const n = (days * 24) / h
      const cul = MICROSCOPY.CULTURES.find((x) => x.name === b.values.context)!
      expect(cul.cycles).toContain(h)
      expect(within(h, 18, 48) && h !== 24).toBe(true)
      // At least three cycles: with two, 2² = 2 × 2, so "multiply by 2n" would score.
      expect(Number.isInteger(n) && within(n, 3, 8) && days <= 14).toBe(true)
      expect(mark(b.question, String(n0 * 2 * n)).correct, b.seed).toBe(false)
      expect(mark(b.question, String(n0 * days)).correct, b.seed).toBe(false)
      expect(isPowerOfTen(n0)).toBe(false)
      expect(answer(b)).toBe(n0 * 2 ** n)
      expect(b.question.solution).toContain(`${days} days $= ${days} \\times 24 = ${days * 24}$ hours, and $\\dfrac{${days * 24}}{${h}} = ${n}$ cycles.`)
      expect(b.question.solution).toContain(`$${Array(n).fill('2').join(' \\times ')} = ${2 ** n}$`)
      expect(method(b)[0]).toBe(`converts ${days} days to ${days * 24} hours and finds ${n} cell cycles`)
      expect(method(b)[1]).toMatch(new RegExp(` times: multiplies by ${2 ** n}$`))
      expect(last(b)).toBe(`${answer(b) >= 10000 ? answer(b).toLocaleString('en-GB').replace(/,/g, ' ') : answer(b)} cells`)
      expect(mark(b.question, String(n0 * n)).correct).toBe(false)
    }
    expect(contexts(built)).toBe(MICROSCOPY.CULTURES.length)
    spread('cell-cycle-doubling', 'q27', ['h', 'n0'])
  })
})

describe('colony counts', () => {
  it('microbes q24: the mean of three counts, none of them the mean', () => {
    const built = build('mean-colony-count', 'q24')
    for (const b of built) {
      const p = b.question.prompt
      const xs = /(\d+), (\d+) and (\d+)/.exec(p)!.slice(1).map(Number)
      const sum = xs[0]! + xs[1]! + xs[2]!
      expect(answer(b)).toBe(sum / 3)
      expect(Number.isInteger(answer(b))).toBe(true)
      expect(new Set(xs).size).toBe(3)
      expect(xs).not.toContain(answer(b))
      // School cultures are kept at 25 °C at most, and the temperature is neither a count nor the mean.
      const t = num(/at (\d+) °C/, p)
      expect(t).toBeLessThanOrEqual(25)
      expect(t).toBe(b.values.temperature)
      expect([...xs, answer(b)], b.seed).not.toContain(t)
      expect(b.question.solution).toContain(`$\\dfrac{${xs.join(' + ')}}{3} = \\dfrac{${sum}}{3} = ${answer(b)}$ colonies per plate.`)
      expect(method(b)).toEqual(['adds the three counts and divides by 3'])
      // The middle count is marked wrong.
      expect(mark(b.question, String([...xs].sort((a, z) => a - z)[1])).correct).toBe(false)
    }
    expect(contexts(built)).toBe(MICROSCOPY.PLATED.length)
    spread('mean-colony-count', 'q24', ['low', 'high'])
  })
})

describe('chromosome numbers', () => {
  it('uses each species’ real diploid number', () => {
    const known: Record<string, number> = { human: 46, dog: 78, horse: 64, cat: 38, cow: 60, mouse: 40, chicken: 78, 'fruit fly': 8, potato: 48, maize: 20, rice: 24, tomato: 24, 'bread wheat': 42, onion: 16, 'garden pea': 14 }
    const all = Object.fromEntries([...ANIMALS, ...PLANTS])
    for (const [sp, n] of Object.entries(known)) expect(all[sp], sp).toBe(n)
    for (const [, n] of [...ANIMALS, ...PLANTS]) expect(n % 2).toBe(0)
  })

  it('cells q24: half the body-cell number, for an animal or a plant gamete', () => {
    const built = build('haploid-chromosome-number', 'q24')
    for (const b of built) {
      const p = b.question.prompt
      const two = num(/(\d+) chromosomes/, p)
      const sp = b.values.species as string
      const plant = b.values.context === 'plant'
      expect((plant ? PLANTS : ANIMALS).find(([s]) => s === sp)![1]).toBe(two)
      expect(p).toContain(sp)
      expect(p).toMatch(plant ? /(pollen grain|egg cell)[.?]$/ : /(sperm|egg) cell[.?]$/)
      expect(answer(b)).toBe(two / 2)
      expect(b.question.solution).toContain(`$${two} \\div 2 = ${two / 2}$.`)
      // "One set" is false for a polyploid crop such as bread wheat; "half the chromosomes" is true of every species.
      expect(b.question.solution).toContain(`carries **half the chromosomes** of a body cell: $${two} \\div 2 = ${two / 2}$.`)
      expect(b.question.solution).not.toContain('one set')
      expect(b.question.solution).toContain(`restores the body-cell number of ${two} in the zygote.`)
      expect(method(b)).toEqual(['halves the body-cell number'])
      expect(mark(b.question, String(two)).correct).toBe(false)
    }
    expect(contexts(built)).toBe(2)
    spread('haploid-chromosome-number', 'q24', ['species'])
  })

  it('cells q25: three haploid sets when two sperm enter one egg', () => {
    const built = build('two-sperm-chromosome-number', 'q25')
    for (const b of built) {
      const p = b.question.prompt
      const two = num(/(\d+) chromosomes/, p)
      const sp = b.values.species as string
      expect(ANIMALS.find(([s]) => s === sp)![1]).toBe(two)
      // Mammals only: birds are polyspermic, and triploid chickens and zebrafish live.
      expect(MAMMALS.map(([s]) => s)).toContain(sp)
      expect(['chicken', 'turkey', 'zebrafish', 'fruit fly']).not.toContain(sp)
      expect(p).toMatch(/two sperm|a second sperm/)
      expect(answer(b)).toBe((3 * two) / 2)
      expect(method(b)).toEqual([`halves ${two} to find ${two / 2} in each gamete nucleus`, 'adds three haploid sets: egg plus two sperm'])
      expect(b.question.solution).toContain(`$3 \\times ${two / 2} = ${answer(b)}$ chromosomes, instead of the normal $2 \\times ${two / 2} = ${two}$.`)
      // The normal number, and four sets, are marked wrong.
      expect(mark(b.question, String(two)).correct).toBe(false)
      expect(mark(b.question, String(2 * two)).correct).toBe(false)
    }
    expect(new Set(built.map((b) => b.question.prompt.slice(0, 30))).size).toBeGreaterThan(20)
    expect(MAMMALS.length).toBe(ANIMALS.length - 4)
    expect(new Set(build('two-sperm-chromosome-number', 'q25', 2000, 'spread').map((b) => b.values.species))).toEqual(new Set(MAMMALS.map(([s]) => s)))
    spread('two-sperm-chromosome-number', 'q25', ['species'])
  })
})

describe("a baby's gain in mass", () => {
  it('mitosis q26: (now − birth) ÷ birth × 100, from real masses for the age', () => {
    const built = build('baby-mass-percentage-gain', 'q26')
    for (const b of built) {
      const p = b.question.prompt
      const birth = num(/mass of ([\d.]+) kg at birth/, p)
      const now = num(/mass was ([\d.]+) kg/, p)
      const chk = MICROSCOPY.CHECKS.find((x) => x.name === b.values.context)!
      expect(within(birth, 2.6, 4.2) && within(now, chk.masses[0], chk.masses[1])).toBe(true)
      expect(p).toContain(chk.girl ? 'baby girl' : 'baby boy')
      expect(p).toContain(chk.girl ? 'her mass' : 'his mass')
      const change = c(now - birth)
      expect(answer(b)).toBe(Math.round(((now - birth) / birth) * 100))
      expect(Math.abs(((now - birth) / birth) * 100 - answer(b))).toBeLessThan(1e-9)
      expect(within(answer(b), chk.gains[0], chk.gains[1])).toBe(true)
      const [bt, nt, ct] = [birth.toFixed(2), now.toFixed(2), change.toFixed(2)]
      expect(p).toContain(`${bt} kg at birth`)
      expect(b.question.solution).toContain(`Increase $= ${nt} - ${bt} = ${ct}$ kg.`)
      expect(b.question.solution).toContain(`$\\dfrac{${ct}}{${bt}} \\times 100 = ${answer(b)}\\%$`)
      expect(method(b)).toEqual([`finds the increase, ${ct} kg, and divides it by the birth mass of ${bt} kg`])
      expect(last(b)).toBe(`${answer(b)}%`)
      // Dividing by the mass now, or giving the new mass as a percentage of the old, is marked wrong.
      expect(mark(b.question, txt(Math.round(((now - birth) / now) * 1000) / 10)).correct).toBe(false)
      expect(mark(b.question, String(answer(b) + 100)).correct).toBe(false)
    }
    expect(contexts(built)).toBe(MICROSCOPY.CHECKS.length)
    spread('baby-mass-percentage-gain', 'q26', ['birth', 'now'])
  })
})
