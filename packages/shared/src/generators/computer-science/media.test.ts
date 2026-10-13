import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate, sheetQuestions } from '../index.ts'
import type { Generated } from '../types.ts'
import { CAPS, MEDIA, mediaGenerators } from './media.ts'

/**
 * Structural tests for the 3.3.6 and 3.3.7 generators. Each reads the prompt's own figures back
 * (pixels wide and high, the depth, the rate, resolution and seconds, grouped as printed) and works
 * the answer from them alone; checks every printed step, the routing, each context's own ranges,
 * the named wrong routes, and that no answer, prompt or calculation takes over a slot.
 */
const TOPIC = 'representing-images-and-sound'
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/computer-science')
const file = JSON.parse(readFileSync(join(ROOT, `${TOPIC}.json`), 'utf8'))
const bank = Question.array().parse(file.questions)
const slotOf = (id: string) => bank.find((q) => q.id === id)!

function build(generatorId: string, slotId: string, n = 300, prefix = 'structure'): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  return Array.from({ length: n }, (_, i) => generate(g, slotOf(slotId), `${prefix}-${i}`))
}
const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const accepts = (b: Generated, typed: string) => mark(b.question, typed).correct
const methods = (b: Generated) => b.question.markScheme.slice(0, -1).map((l) => l.description)
function share<T>(built: T[], key: (b: T) => unknown) {
  const counts = new Map<unknown, number>()
  for (const b of built) counts.set(key(b), (counts.get(key(b)) ?? 0) + 1)
  return { worst: Math.max(...counts.values()) / built.length, distinct: counts.size }
}
/** A figure as the pack prints it: 160 000 from five digits, 160\,000 in maths. */
const prose = (x: number) => (x >= 10000 ? String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : String(x))
const tex = (x: number) => prose(x).replace(/ /g, '\\,')
/** A printed figure read back: "32 000" is 32000. */
const num = (s: string) => Number(s.replace(/ /g, ''))
const FIG = String.raw`(\d{1,3}(?: \d{3})+|\d+)`

const SLOTS: [string, string][] = [
  ['media-image-bits', 'q3'],
  ['media-colours-from-depth', 'q4'],
  ['media-sound-bits', 'q5'],
  ['media-image-bytes', 'q6'],
  ['media-bitmap-bits', 'q9'],
  ['media-sound-kilobytes', 'q13'],
]

/** Width, height and depth from an image prompt. */
function image(b: Generated) {
  const p = b.question.prompt
  // A QR code is "a grid of 21 by 21 black and white squares", a pixel a square.
  const size = (new RegExp(`${FIG} pixels wide and ${FIG} pixels high`).exec(p) ?? /a grid of (\d+) by (\d+) black and white squares/.exec(p))!
  const depth = /colour depth (?:of|is) (\d+) bits?|uses (\d+) bits for each pixel|in (\d+) bits\b|stored as (\d+) bit\b/.exec(p)
  return { w: num(size[1]!), h: num(size[2]!), d: depth ? Number(depth.slice(1).find(Boolean)) : NaN }
}

/** Rate, resolution and seconds from a sound prompt. */
function sound(b: Generated) {
  const p = b.question.prompt
  const rate = num(new RegExp(`(?:at ${FIG} Hz|sampled ${FIG} times a second)`).exec(p)!.slice(1).find(Boolean)!)
  const res = Number(/(\d+)-bit sample resolution|resolution of (\d+) bits/.exec(p)!.slice(1).find(Boolean))
  const secs = Number(/(\d+) seconds|(\d+)-second/.exec(p)!.slice(1).find(Boolean))
  return { rate, res, secs }
}

describe('every images and sound build', () => {
  it('cites 3.3.6 and 3.3.7 and their formulae', () => {
    const header = readFileSync(join(import.meta.dirname, 'media.ts'), 'utf8').split('const TOPIC')[0]!
    for (const s of ['3.3.6', '3.3.7', 'W x H x D', '(W x H x D)/8', 'rate x res x secs', '1 kB = 1000 bytes']) expect(header).toContain(s)
  })

  it('has a generator for every numeric slot, routed by slot', () => {
    expect(mediaGenerators.flatMap((g) => g.replaces).sort()).toEqual(bank.filter((q) => q.type === 'numeric').map((q) => q.id).sort())
    for (const [id, slot] of SLOTS) expect(mediaGenerators.find((g) => g.id === id)!.replaces).toEqual([slot])
    for (const g of mediaGenerators) expect(() => g.build(() => 0.5, slotOf('q1'), 0)).toThrow(/no builder/)
  })

  it("keeps the slot's units, tolerance and mark-scheme codes, and agrees with its second route", () => {
    for (const [id, slotId] of SLOTS) {
      const slot = slotOf(slotId)
      for (const b of build(id, slotId, 150)) {
        const q = b.question
        if (q.type !== 'numeric' || slot.type !== 'numeric') throw new Error('not numeric')
        expect(q.units).toBe(slot.units)
        expect(q.tolerance).toBe(0)
        expect(Number.isInteger(q.answer)).toBe(true)
        expect(q.answer).toBeGreaterThan(0)
        // A 1-mark slot takes the pack's B1 (scheme.ts), where the written q4 prints A1.
        expect(q.markScheme.map((l) => l.code)).toEqual(slot.marks === 1 ? ['B1'] : slot.markScheme.map((l) => l.code))
        expect(b.check.agrees, b.seed).toBe(true)
        expect(q.prompt).not.toMatch(/\b1 seconds|\ba 8|\ban [2-79]/)
      }
    }
  })

  it('is marked right typed plain, grouped with spaces and with commas', () => {
    for (const [id, slotId] of SLOTS) {
      for (const b of build(id, slotId, 100)) {
        const a = answer(b)
        expect(accepts(b, String(a)), b.seed).toBe(true)
        expect(accepts(b, prose(a))).toBe(true)
        expect(accepts(b, a.toLocaleString('en-GB'))).toBe(true)
        expect(accepts(b, String(a + 1))).toBe(false)
      }
    }
  })

  it('never fails to draw, over 3000 seeds per slot', () => {
    for (const [id, slotId] of SLOTS) {
      const g = GENERATORS.find((x) => x.id === id)!
      expect(() => {
        for (let i = 0; i < 3000; i++) generate(g, slotOf(slotId), `throw-${i}`)
      }, id).not.toThrow()
    }
  })

  it('gives the written prompt in under 5% of builds, no prompt in over 5%, and spreads answers, inputs and calculations', () => {
    for (const [id, slotId] of SLOTS) {
      const many = build(id, slotId, 1000, 'spread')
      expect(share(many, (b) => b.question.prompt).worst, `${slotId} prompt`).toBeLessThan(0.05)
      expect(many.filter((b) => b.question.prompt === slotOf(slotId).prompt).length, slotId).toBeLessThan(50)
      const answers = share(many, answer)
      expect(answers.worst, `${slotId} answer`).toBeLessThanOrEqual(0.4)
      // q4 has seven honest depths (see COLOUR_DEPTHS); every other slot at least ten answers.
      expect(answers.distinct, `${slotId} answers`).toBeGreaterThanOrEqual(slotId === 'q4' ? MEDIA.COLOUR_DEPTHS.length : 10)
      const calc = (b: Generated) => JSON.stringify(Object.entries(b.values).filter(([k]) => !['picture', 'bitmap', 'sound', 'context'].includes(k)))
      expect(share(many, calc).worst, `${slotId} calculation`).toBeLessThan(1 / 6)
      // Inputs: none over 40%, but the resolution of q13, which is 16 or 24 bits by design.
      for (const [k, v] of Object.entries(many[0]!.values)) {
        if (typeof v !== 'number' || (slotId === 'q13' && k === 'resolution')) continue
        expect(share(many, (b) => b.values[k]).worst, `${slotId} ${k}`).toBeLessThanOrEqual(0.4)
      }
    }
  })
})

describe('images (3.3.6)', () => {
  it('q3: W × H × D bits, the depth 2 to 8 and never equal to a side', () => {
    const built = build('media-image-bits', 'q3')
    for (const b of built) {
      const { w, h, d } = image(b)
      const pic = MEDIA.BIT_PICTURES.find((p) => p.name === b.values.picture)!
      expect(answer(b), b.question.prompt).toBe(w * h * d)
      expect(pic.depths).toContain(d)
      expect(d).toBeGreaterThan(1)
      expect([w, h]).not.toContain(d)
      expect(Math.max(w, h)).toBeLessThanOrEqual(3 * Math.min(w, h))
      expect(b.question.prompt).toMatch(/in bits\?$|How many bits/)
      expect(methods(b)).toEqual([`${w} × ${h} × ${d}`])
      expect(b.question.solution).toBe(`Size in bits $= W \\times H \\times D = ${w} \\times ${h} \\times ${d} = $ **${prose(w * h * d)}** bits: ${prose(w * h)} pixels at ${d} bits each.`)
      // Wrong routes: the depth forgotten, bytes for bits, the colours (2^D) for the depth, the figures added.
      for (const wrong of [w * h, (w * h * d) / 8, w * h * 2 ** d, w + h + d]) expect(accepts(b, String(wrong))).toBe(false)
    }
    expect(new Set(built.map((b) => b.values.picture))).toEqual(new Set(MEDIA.BIT_PICTURES.map((p) => p.name)))
    const lit = generate(GENERATORS.find((g) => g.id === 'media-image-bits')!, slotOf('q3'), 'review-c').question
    expect(lit.prompt).toBe('A sprite for a computer game is 16 pixels wide and 16 pixels high, with a colour depth of 3 bits. What is its file size in bits?')
    expect(lit.solution).toBe('Size in bits $= W \\times H \\times D = 16 \\times 16 \\times 3 = $ **768** bits: 256 pixels at 3 bits each.')
  })

  it('q4: 2^D colours; never a depth where 2D, D² or the size multiplied in gives the answer', () => {
    const built = build('media-colours-from-depth', 'q4', 600)
    for (const b of built) {
      const p = b.question.prompt
      const d = Number(/(\d+)(?: bits|-bit code)/.exec(p)![1])
      let colours = 1
      for (let i = 0; i < d; i++) colours += colours
      expect(answer(b), p).toBe(colours)
      expect(MEDIA.COLOUR_DEPTHS).toContain(d)
      expect([1, 2, 4]).not.toContain(d)
      expect(b.question.solution).toContain(`$2^{${d}} = ${tex(colours)}$, so **${prose(colours)}** colours. The depth is ${d} **bits**`)
      expect(b.question.markScheme).toEqual([{ code: 'B1', marks: 1, description: prose(colours) }])
      // Wrong routes: the depth itself, doubled, squared, the largest value (2^D − 1), the next depth's count.
      for (const wrong of [d, 2 * d, d * d, colours - 1, colours * 2]) expect(accepts(b, String(wrong))).toBe(false)
      const size = new RegExp(`${FIG} pixels wide and ${FIG} pixels high`).exec(p)
      if (size) {
        const [w, h] = [num(size[1]!), num(size[2]!)]
        // The size multiplied in is wrong, and no printed side equals the answer.
        for (const wrong of [w * h * d, w * h * colours, w * h]) expect(accepts(b, String(wrong))).toBe(false)
        expect([w, h]).not.toContain(colours)
        expect(b.question.solution).toContain(`The image's size does not come into it: each of its ${prose(w * h)} pixels can be any one of the ${prose(colours)} colours.`)
        // An image of fewer pixels than colours cannot use them all: it is asked per pixel.
        if (w * h < colours) expect(p).toMatch(/each pixel be\?$/)
      }
      // Doubled out by hand for one mark: 4096 colours at most.
      expect(colours).toBeLessThanOrEqual(4096)
      // Displays at the depths displays use; an old machine's palette asked as a palette, never as its depth per pixel.
      if (b.values.context === 'display') expect([8, 12]).toContain(d)
      if (b.values.context === 'palette') {
        expect([3, 6]).toContain(d)
        expect(p).toMatch(/How many colours are in the palette\?$/)
      }
      expect(p).not.toMatch(/\b9 bits|console from the 1980s|stores the colour of each pixel/)
    }
    const contexts = new Set(built.map((b) => b.values.context))
    expect(contexts).toEqual(new Set(['bare', 'sized', 'display', 'palette']))
    // One calculation is one depth: none over a sixth of the slot (24 bits was a fifth).
    expect(share(build('media-colours-from-depth', 'q4', 1000, 'depth'), (b) => b.values.depth).worst).toBeLessThan(1 / 6)
    expect(built.filter((b) => /pixels wide/.test(b.question.prompt)).length / built.length).toBeGreaterThan(0.3)
  })

  it('q6: W × H × D ÷ 8 bytes; never a depth of 1 or 8; a whole number of bytes', () => {
    const built = build('media-image-bytes', 'q6')
    for (const b of built) {
      const { w, h, d } = image(b)
      const bits = w * h * d
      const pic = MEDIA.BYTE_PICTURES.find((p) => p.name === b.values.picture)!
      expect(pic.depths).toContain(d)
      expect([1, 8]).not.toContain(d)
      expect(bits % 8).toBe(0)
      expect(answer(b), b.question.prompt).toBe(bits / 8)
      expect([w, h, d]).not.toContain(bits / 8)
      expect(pic.pairs).toContainEqual([w, h])
      expect(bits, b.question.prompt).toBeLessThanOrEqual(CAPS.q6)
      expect(b.question.prompt).toMatch(/in bytes[.?]$/)
      expect(methods(b)).toEqual([`${w} × ${h} × ${d}`, 'divides by 8'])
      expect(b.question.solution).toContain(`$${w} \\times ${h} \\times ${d} = ${tex(bits)}$ bits, and $${tex(bits)} \\div 8 = $ **${prose(bits / 8)}** bytes.`)
      // Wrong routes: bits for bytes, ÷ 8 twice, a byte a pixel, 2^D for D, 1000 for 8.
      for (const wrong of [bits, bits / 64, w * h, (w * h * 2 ** d) / 8, bits / 1000]) expect(accepts(b, String(wrong))).toBe(false)
    }
    expect(new Set(built.map((b) => b.values.picture))).toEqual(new Set(MEDIA.BYTE_PICTURES.map((p) => p.name)))
    const lit = generate(GENERATORS.find((g) => g.id === 'media-image-bytes')!, slotOf('q6'), 'review-c').question
    expect(lit.prompt).toBe('A sprite for a computer game is 48 pixels wide and 32 pixels high, with a colour depth of 2 bits. What is its file size in bytes?')
    expect(lit.solution).toBe('$48 \\times 32 \\times 2 = 3072$ bits, and $3072 \\div 8 = $ **384** bytes. The formula gives bits, so the divide by 8 is essential.')
  })

  it('q9: a black and white bitmap, a bit a pixel, never 3 × 3 (q19 and q20 on the sheet)', () => {
    const built = build('media-bitmap-bits', 'q9')
    for (const b of built) {
      const { w, h, d } = image(b)
      expect(d).toBe(1)
      expect(answer(b), b.question.prompt).toBe(w * h)
      expect(Math.min(w, h)).toBeGreaterThanOrEqual(4)
      expect(b.question.prompt).toContain('black and white')
      expect(methods(b)).toEqual([`${w} × ${h} × 1`])
      expect(b.question.solution).toBe(`$${w} \\times ${h} \\times 1 = $ **${prose(w * h)}** bits: one bit for each of the ${prose(w * h)} pixels.`)
      // Wrong routes: the 2 colours taken as the depth, bytes for bits, the sides added.
      for (const wrong of [2 * w * h, (w * h) / 8, w + h]) expect(accepts(b, String(wrong))).toBe(false)
    }
    expect(new Set(built.map((b) => b.values.bitmap)).size).toBe(4)
    for (const b of built) {
      expect(b.question.prompt).not.toMatch(/smartwatch|\b84\b/)
      if (b.values.bitmap === 'QR code') {
        const n = b.values.width
        expect(b.question.prompt).toBe(`A QR code is a grid of ${n} by ${n} black and white squares. It is stored as a bitmap with one pixel for each square and a colour depth of 1 bit. How many bits are needed to store it?`)
      }
      if (b.values.bitmap === 'fitness tracker') expect(b.question.prompt).toMatch(/^A fitness tracker has a small black and white screen /)
    }
  })

  it('images on the core and higher sheets ask their own questions', () => {
    const sheet = (level: string) => (file.worksheets[level].questionIds as string[]).map((id) => slotOf(id))
    for (let i = 0; i < 200; i++) {
      const core = sheetQuestions('computer-science', TOPIC, sheet('core'), `sheet-${i}`)
      const q3 = core.find((s) => s.question.id === 'q3')!.question
      // q3 never prints a number of colours, which q4 asks.
      expect(q3.prompt + q3.solution).not.toMatch(/colours\b(?! depth)/)
      const higher = sheetQuestions('computer-science', TOPIC, sheet('higher'), `sheet-${i}`)
      for (const s of higher) if (['q5', 'q6', 'q9'].includes(s.question.id)) expect(s.generated, `${s.question.id} sheet-${i}`).toBeDefined()
    }
  })
})

describe('sound (3.3.7)', () => {
  it('caps the arithmetic at about 25 times the written question, over 3000 seeds', () => {
    expect(CAPS).toEqual({ q5: 4_000_000, q13: 8_000_000, q6: 400_000 })
    for (const [id, slotId, bitsOf] of [
      ['media-sound-bits', 'q5', (b: Generated) => answer(b)],
      ['media-sound-kilobytes', 'q13', (b: Generated) => answer(b) * 8000],
      ['media-image-bytes', 'q6', (b: Generated) => answer(b) * 8],
    ] as const) {
      const most = Math.max(...build(id, slotId, 3000, 'cap').map(bitsOf))
      expect(most, slotId).toBeLessThanOrEqual(CAPS[slotId])
    }
  })

  it('q5: rate × res × secs bits, each recording in its own ranges', () => {
    const built = build('media-sound-bits', 'q5')
    for (const b of built) {
      const { rate, res, secs } = sound(b)
      const s = MEDIA.SOUNDS.find((x) => x.name === b.values.sound)!
      expect(answer(b), b.question.prompt).toBe(rate * res * secs)
      expect(s.rates).toContain(rate)
      expect(s.resolutions).toContain(res)
      expect(secs).toBeGreaterThanOrEqual(s.seconds[0])
      expect(secs).toBeLessThanOrEqual(s.seconds[1])
      expect(secs).not.toBe(res)
      // By hand: no more than 4 000 000 bits (25 times the written 160 000); high rates last 2 to 8 seconds.
      expect(rate * res * secs, b.question.prompt).toBeLessThanOrEqual(CAPS.q5)
      if (rate >= 32000) expect(secs).toBeLessThanOrEqual(8)
      expect(b.question.prompt).toMatch(/in bits\?$/)
      expect(methods(b)).toEqual([`${prose(rate)} × ${res} × ${secs}`])
      expect(b.question.solution).toBe(`Rate × res × secs $= ${tex(rate)} \\times ${res} \\times ${secs} = $ **${prose(rate * res * secs)}** bits: ${prose(rate * secs)} samples of ${res} bits each.`)
      // Wrong routes: the resolution forgotten, bytes for bits, one second only.
      for (const wrong of [rate * secs, (rate * res * secs) / 8, rate * res]) expect(accepts(b, String(wrong))).toBe(false)
    }
    expect(new Set(built.map((b) => b.values.sound))).toEqual(new Set(MEDIA.SOUNDS.map((s) => s.name)))
    const lit = generate(GENERATORS.find((g) => g.id === 'media-sound-bits')!, slotOf('q5'), 'review-c').question
    expect(lit.prompt).toBe('A voice note lasts 26 seconds. It is sampled at 8000 Hz with a 16-bit sample resolution. What is its file size in bits?')
    expect(lit.solution).toBe('Rate × res × secs $= 8000 \\times 16 \\times 26 = $ **3 328 000** bits: 208 000 samples of 16 bits each.')
    expect(lit.markScheme.map((l) => l.description)).toEqual(['8000 × 16 × 26', '3 328 000'])
  })

  it('q13: bits ÷ 8 ÷ 1000 kilobytes, at 16 or 24 bits, never 1024', () => {
    const built = build('media-sound-kilobytes', 'q13')
    for (const b of built) {
      const { rate, res, secs } = sound(b)
      const s = MEDIA.SOUNDS.find((x) => x.name === b.values.sound)!
      const bits = rate * res * secs
      const kb = bits / 8 / 1000
      expect(answer(b), b.question.prompt).toBe(kb)
      expect([16, 24]).toContain(res)
      expect(s.rates).toContain(rate)
      expect(secs).toBeGreaterThanOrEqual(s.seconds[0])
      expect(secs).toBeLessThanOrEqual(s.seconds[1])
      expect(kb).toBeGreaterThanOrEqual(50)
      // By hand: no more than 8 000 000 bits (about 6 times the written 1 280 000); high rates last 2 to 8 seconds.
      expect(bits, b.question.prompt).toBeLessThanOrEqual(CAPS.q13)
      if (rate >= 32000) expect(secs).toBeLessThanOrEqual(8)
      expect(b.question.prompt).toMatch(/in kilobytes\?$/)
      expect(methods(b)).toEqual([`${prose(rate)} × ${res} × ${secs} = ${prose(bits)} bits`, 'divides by 8 and by 1000'])
      expect(b.question.solution).toBe(`$${tex(rate)} \\times ${res} \\times ${secs} = ${tex(bits)}$ bits. Divide by 8: $${tex(bits / 8)}$ bytes. Divide by 1000: **${prose(kb)}** kB. Both divisions are needed, and the second uses 1 kB = 1000 bytes.`)
      // Wrong routes, as typed: 1024 for 1000 (rounded), ÷ 8 forgotten, ÷ 1000 forgotten, ÷ 8 twice,
      // the resolution and the ÷ 8 both forgotten, the bytes ÷ 1000 twice.
      for (const wrong of [Math.round(bits / 8 / 1024), bits / 1000, bits / 8, kb / 8, (rate * secs) / 1000, kb / 1000]) expect(accepts(b, String(wrong))).toBe(false)
    }
  })
})
