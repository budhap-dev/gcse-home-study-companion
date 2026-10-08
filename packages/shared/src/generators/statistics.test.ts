import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../content/questions.ts'
import { GENERATORS, generate, sheetQuestions } from './index.ts'
import type { Generated } from './types.ts'

/**
 * Structural checks for the statistics and distributions generators. The release check
 * (generators.test.ts) proves each answer agrees with the generator's own second method;
 * these work every average, quartile, density and estimate out again here, from the raw
 * data the generator drew, with implementations of their own. They also check the traps
 * the solutions warn about are real (midpoints, not class bounds; density, not frequency;
 * a pooled sample, not averaged proportions), and that slots sharing a sheet ask different
 * things.
 */
const ROOT = join(import.meta.dirname, '../../../../supabase/seed/content')
const topicFile = (topicId: string) => JSON.parse(readFileSync(join(ROOT, 'maths', `${topicId}.json`), 'utf8'))
const bank = (topicId: string) => Question.array().parse(topicFile(topicId).questions)
const N = 300

function build(id: string, slotId: string, n = N): Generated[] {
  const g = GENERATORS.find((x) => x.id === id)
  if (!g) throw new Error(`no generator ${id}`)
  const slot = bank(g.topicId).find((q) => q.id === slotId)!
  return Array.from({ length: n }, (_, i) => generate(g, slot, `statistics-${i}`))
}
const num = (b: Generated) => {
  if (b.question.type !== 'numeric') throw new Error('not numeric')
  return b.question.answer
}
const v = (b: Generated, key: string) => Number(b.values[key])
const list = (b: Generated, key: string) => String(b.values[key]).split(',').map(Number)
const close = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b))

/* Independent implementations: written here from the definitions, sharing nothing with the generators. */
const sum = (xs: number[]) => {
  let s = 0
  for (const x of xs) s += x
  return s
}
const mean = (xs: number[]) => sum(xs) / xs.length
const sortUp = (xs: number[]) => xs.slice().sort((a, b) => a - b)
/** The (n + 1)/2-th value of the sorted list, averaging when that falls between two. */
function median(xs: number[]): number {
  const s = sortUp(xs)
  const pos = (s.length + 1) / 2
  return (s[Math.floor(pos) - 1]! + s[Math.ceil(pos) - 1]!) / 2
}
/** The most common value, or undefined when there is a tie for it. */
function mode(xs: number[]): number | undefined {
  const tally: Record<string, number> = {}
  for (const x of xs) tally[x] = (tally[x] ?? 0) + 1
  const top = Math.max(...Object.values(tally))
  const at = Object.keys(tally).filter((k) => tally[k] === top)
  return at.length === 1 ? Number(at[0]) : undefined
}
const range = (xs: number[]) => sortUp(xs)[xs.length - 1]! - sortUp(xs)[0]!
/** Quartiles as the box-plots lesson teaches: medians of the halves, the median itself left out of both. */
function quartiles(xs: number[]): [number, number] {
  const s = sortUp(xs)
  const n = s.length
  const lower = s.filter((_, i) => i < Math.floor(n / 2))
  const upper = s.filter((_, i) => i >= Math.ceil(n / 2))
  return [median(lower), median(upper)]
}
const expandTable = (values: number[], freqs: number[]) => {
  const out: number[] = []
  values.forEach((x, i) => {
    for (let k = 0; k < freqs[i]!; k++) out.push(x)
  })
  return out
}

describe('averages and range', () => {
  it('range, median and mode match the raw list, and the median sees both odd and even counts', () => {
    for (const b of build('averages-of-a-list', 'q1')) expect(num(b), b.seed).toBe(range(list(b, 'data')))
    const q2 = build('averages-of-a-list', 'q2')
    for (const b of q2) expect(num(b), b.seed).toBe(median(list(b, 'data')))
    expect(new Set(q2.map((b) => v(b, 'n') % 2))).toEqual(new Set([0, 1]))
    expect(q2.some((b) => !Number.isInteger(num(b)))).toBe(true)
    for (const b of build('averages-of-a-list', 'q3')) {
      const xs = list(b, 'data')
      expect(num(b), b.seed).toBe(mode(xs))
      // The solution says the mode is not the middle value.
      expect(num(b)).not.toBe(median(xs))
    }
  })

  it('a scaled and shifted list has its range scaled only, never shifted', () => {
    for (const b of build('averages-of-a-list', 'q17')) {
      const xs = list(b, 'data')
      const a = v(b, 'a')
      const k = v(b, 'b')
      const f = b.values.kind === 'add-multiply' ? (x: number) => (x + k) * a : b.values.kind === 'multiply-subtract' ? (x: number) => a * x - k : (x: number) => a * x + k
      expect(num(b), b.seed).toBe(range(xs.map(f)))
      expect(num(b)).not.toBe(a * range(xs) + k)
      expect(v(b, 'range')).toBe(range(xs))
    }
    expect(new Set(build('averages-of-a-list', 'q17').map((b) => b.values.kind)).size).toBe(3)
  })

  it('a mean from a frequency table is the mean of the table written out, and dividing by the rows is wrong', () => {
    for (const b of build('frequency-table-averages', 'q6')) {
      const raw = expandTable(list(b, 'values'), list(b, 'freqs'))
      expect(raw.length).toBe(v(b, 'n'))
      expect(close(num(b), mean(raw)), b.seed).toBe(true)
      expect(v(b, 'trap')).not.toBe(num(b))
      expect(close(v(b, 'trap'), sum(raw) / list(b, 'values').length)).toBe(true)
    }
  })

  it('a median from a frequency table is the middle of the table written out, for odd and even totals and across rows', () => {
    const built = build('frequency-table-averages', 'q7', 600)
    for (const b of built) {
      const values = list(b, 'values')
      const raw = expandTable(values, list(b, 'freqs'))
      expect(num(b), b.seed).toBe(median(raw))
      // Never the middle row's value: the solution warns against reading that.
      expect(num(b)).not.toBe(values[Math.floor(values.length / 2)])
    }
    expect(new Set(built.map((b) => v(b, 'n') % 2))).toEqual(new Set([0, 1]))
    // An even total whose two middle values sit in different rows gives a half.
    expect(built.some((b) => !Number.isInteger(num(b)))).toBe(true)
  })

  it('a missing frequency gives the stated mean when put back', () => {
    for (const b of build('frequency-table-averages', 'q13')) {
      const freqs = list(b, 'freqs')
      expect(freqs[v(b, 'at')]).toBe(num(b))
      expect(close(mean(expandTable(list(b, 'values'), freqs)), v(b, 'mean')), b.seed).toBe(true)
    }
  })

  it('a value added or removed is what moves one mean to the other', () => {
    for (const b of build('means-from-totals', 'q8')) {
      const xs = list(b, 'list')
      expect(xs[xs.length - 1]).toBe(num(b))
      expect(mean(xs.slice(0, -1))).toBe(v(b, 'm1'))
      expect(mean(xs)).toBe(v(b, 'm2'))
    }
    for (const b of build('means-from-totals', 'q15')) {
      const xs = list(b, 'list')
      expect(xs[xs.length - 1]).toBe(num(b))
      expect(mean(xs)).toBe(v(b, 'm1'))
      expect(mean(xs.slice(0, -1))).toBe(v(b, 'm2'))
    }
  })

  it('a combined mean weights each group by its size, and averaging the two means is wrong', () => {
    for (const b of build('means-from-totals', 'q10')) {
      const [n1, m1, n2, m2] = [v(b, 'n1'), v(b, 'm1'), v(b, 'n2'), v(b, 'm2')]
      expect(close(num(b), (n1 * m1 + n2 * m2) / (n1 + n2)), b.seed).toBe(true)
      expect(n1).not.toBe(n2)
      expect(num(b)).not.toBe((m1 + m2) / 2)
    }
  })

  it('the five-number puzzle has the stated mode, median, mean and range, and asks for the end the mode is not at', () => {
    const built = build('averages-puzzle', 'q12')
    for (const b of built) {
      const xs = list(b, 'data')
      expect(mode(xs), b.seed).toBe(v(b, 'mode'))
      expect(median(xs)).toBe(v(b, 'median'))
      expect(mean(xs)).toBe(v(b, 'mean'))
      expect(range(xs)).toBe(v(b, 'range'))
      expect(xs.every((x) => x > 0 && Number.isInteger(x))).toBe(true)
      expect(num(b)).toBe(b.values.modeAt === 'bottom' ? Math.max(...xs) : Math.min(...xs))
    }
    expect(new Set(built.map((b) => b.values.modeAt))).toEqual(new Set(['bottom', 'top']))
  })

  it('a modal category is the most common category, never its frequency', () => {
    for (const b of build('modal-category', 'q4')) {
      const cats = String(b.values.categories).split(',')
      const freqs = list(b, 'freqs')
      const top = Math.max(...freqs)
      expect(freqs.filter((f) => f === top)).toHaveLength(1)
      expect(b.values.answer).toBe(cats[freqs.indexOf(top)])
      if (b.question.type !== 'short-text') throw new Error('not short-text')
      expect(b.question.accepted[0]).toBe(b.values.answer)
      expect(b.question.accepted).not.toContain(String(top))
    }
  })
})

describe('charts and diagrams for data', () => {
  it('every pie chart’s angles add to 360°, and the asked sector is its share of 360', () => {
    for (const slot of ['q2', 'q6']) {
      for (const b of build('pie-chart-angles', slot)) {
        const freqs = list(b, 'freqs')
        const angles = freqs.map((f) => (f / v(b, 'N')) * 360)
        expect(close(sum(angles), 360)).toBe(true)
        expect(list(b, 'angles').map((a, i) => close(a, angles[i]!)).every(Boolean)).toBe(true)
        expect(close(num(b), angles[0]!), b.seed).toBe(true)
        expect(num(b)).not.toBe(freqs[0])
      }
    }
    for (const b of build('pie-chart-angles', 'q17')) {
      const parts = list(b, 'parts')
      const angles = parts.map((p) => (p / sum(parts)) * 360)
      expect(close(sum(angles), 360)).toBe(true)
      expect(close(num(b), b.values.which === 'largest' ? Math.max(...angles) : Math.min(...angles)), b.seed).toBe(true)
    }
    expect(new Set(build('pie-chart-angles', 'q17').map((b) => b.values.which))).toEqual(new Set(['largest', 'smallest']))
  })

  it('a survey total gives the sector its stated angle', () => {
    for (const b of build('pie-chart-angles', 'q12')) expect(close((v(b, 'f') / num(b)) * 360, v(b, 'theta')), b.seed).toBe(true)
  })

  it('two-way tables add up across and down', () => {
    for (const b of build('two-way-tables', 'q10')) expect(num(b)).toBe(v(b, 'T') - v(b, 'a') - v(b, 'k'))
    for (const b of build('two-way-tables', 'q16')) {
      const [pn, pd] = String(b.values.p).split('/').map(Number) as [number, number]
      const [qn, qd] = String(b.values.q).split('/').map(Number) as [number, number]
      const T = v(b, 'T')
      const A = (T * pn) / pd
      const B = T - A
      const By = (B * qn) / qd
      const Ay = v(b, 'Z') - By
      expect([A, B, By, Ay].every((x) => Number.isInteger(x) && x > 0), b.seed).toBe(true)
      expect(num(b)).toBe(A - Ay)
    }
  })
})

describe('sampling and populations', () => {
  it('estimates scale the sample proportion up to the population', () => {
    for (const b of build('sample-proportions', 'q4')) expect(close(num(b), v(b, 'k') / v(b, 'n'))).toBe(true)
    for (const slot of ['q5', 'q9']) for (const b of build('sample-proportions', slot)) expect(close(num(b), (v(b, 'k') / v(b, 'n')) * v(b, 'N')), b.seed).toBe(true)
    for (const b of build('sample-proportions', 'q15')) expect(close((v(b, 'k') / v(b, 'n')) * num(b), v(b, 'E')), b.seed).toBe(true)
  })

  it('two samples are pooled, and averaging their proportions gives a different answer', () => {
    for (const b of build('sample-proportions', 'q12')) {
      const [k1, n1, k2, n2, Nn] = [v(b, 'k1'), v(b, 'n1'), v(b, 'k2'), v(b, 'n2'), v(b, 'N')]
      expect(close(num(b), ((k1 + k2) / (n1 + n2)) * Nn), b.seed).toBe(true)
      expect(Math.abs(num(b) - ((k1 / n1 + k2 / n2) / 2) * Nn)).toBeGreaterThanOrEqual(1)
    }
  })

  it('a sample mean scales to a total, and quadrat counts to a field', () => {
    for (const b of build('sample-means', 'q7')) {
      expect(mean(list(b, 'data'))).toBe(v(b, 'mean'))
      expect(close(num(b), (mean(list(b, 'data')) * v(b, 'N')) / 1000), b.seed).toBe(true)
    }
    for (const b of build('sample-means', 'q17')) expect(close(num(b), mean(list(b, 'data')) * v(b, 'a') * v(b, 'b')), b.seed).toBe(true)
  })

  it('capture–recapture matches the marked share of the catch to the marked share of the population', () => {
    for (const b of build('capture-recapture', 'q21')) expect(close(v(b, 'k') / v(b, 'n'), v(b, 'M') / num(b)), b.seed).toBe(true)
  })
})

describe('scatter graphs', () => {
  it('q7 reads low in the data, q8 high in it, and q11 beyond it, where the line gives nonsense', () => {
    const where = { q7: 'low', q8: 'high', q11: 'beyond' } as const
    for (const [slot, w] of Object.entries(where)) {
      for (const b of build('line-of-best-fit-estimate', slot)) {
        const [m, c, lo, hi, x] = [v(b, 'm'), v(b, 'c'), v(b, 'lo'), v(b, 'hi'), v(b, 'x')]
        expect(num(b)).toBe(m * x + c)
        if (w === 'low') expect(x > lo && x <= (lo + hi) / 2).toBe(true)
        if (w === 'high') expect(x >= (lo + hi) / 2 && x < hi).toBe(true)
        if (w === 'beyond') {
          expect(x).toBeGreaterThan(hi)
          expect(num(b) < 0 || num(b) > 100, b.seed).toBe(true)
          expect(b.question.solution).toContain('impossible')
        }
      }
    }
  })
})

describe('histograms', () => {
  it('frequency density × width is the frequency, for every bar asked about', () => {
    for (const slot of ['q2', 'q5', 'q11']) {
      for (const b of build('frequency-density', slot)) {
        expect(close(num(b) * (v(b, 'b') - v(b, 'a')), v(b, 'f')), b.seed).toBe(true)
        // q11's total is a distractor: dividing it by the width is not the answer.
        if (slot === 'q11') expect(close(num(b), v(b, 'N') / (v(b, 'b') - v(b, 'a')))).toBe(false)
      }
    }
    for (const slot of ['q4', 'q6']) for (const b of build('histogram-bars', slot)) expect(close(num(b) / v(b, 'w'), v(b, 'h')), b.seed).toBe(true)
    for (const b of build('histogram-bars', 'q10')) expect(num(b)).toBe(v(b, 'w') * v(b, 'h'))
    // The height is a density, so the frequency is never the height itself.
    for (const b of build('histogram-bars', 'q6')) expect(num(b)).not.toBe(v(b, 'h'))
  })

  it('part of a bar is density × the part’s width: at one end for q8, strictly inside for q12', () => {
    for (const slot of ['q8', 'q12']) {
      for (const b of build('histogram-bars', slot)) {
        const [a, w, fd, p, q] = [v(b, 'a'), v(b, 'w'), v(b, 'fd'), v(b, 'p'), v(b, 'q')]
        expect(close(num(b), fd * (q - p)), b.seed).toBe(true)
        expect(p >= a && q <= a + w && q - p < w).toBe(true)
        if (slot === 'q8') expect(p === a || q === a + w).toBe(true)
        else expect(p > a && q < a + w).toBe(true)
      }
    }
  })

  it('a second bar’s frequency uses both widths, and scaling the first frequency by the height alone is wrong', () => {
    for (const slot of ['q13', 'q18']) {
      for (const b of build('histogram-second-bar', slot)) {
        const want = (v(b, 'f1') / v(b, 'w1')) * (v(b, 'num') / v(b, 'den')) * v(b, 'w2')
        expect(close(num(b), want), b.seed).toBe(true)
        expect(close(num(b), v(b, 'trap'))).toBe(false)
      }
    }
    // q13 scales by a half or a multiple, q18 by a fraction less than one.
    for (const b of build('histogram-second-bar', 'q18')) expect(v(b, 'num') / v(b, 'den')).toBeLessThan(1)
    expect(build('histogram-second-bar', 'q13').some((b) => v(b, 'num') / v(b, 'den') > 1)).toBe(true)
  })

  it('the median class holds the middle of the data written out', () => {
    for (const b of build('histogram-median-class', 'q14')) {
      const bounds = list(b, 'bounds')
      const raw = expandTable(bounds.slice(1), list(b, 'freqs'))
      expect(raw.length % 2).toBe(0)
      expect(num(b), b.seed).toBe(median(raw))
    }
  })
})

describe('box plots', () => {
  it('the IQR and range come from a data set with the stated five-number summary', () => {
    for (const slot of ['q3', 'q4']) {
      for (const b of build('box-plot-measures', slot)) {
        const data = list(b, 'data')
        const [min, q1, med, q3, max] = list(b, 'five')
        const [lq, uq] = quartiles(data)
        expect([sortUp(data)[0], lq, median(data), uq, sortUp(data)[data.length - 1]]).toEqual([min, q1, med, q3, max])
        expect(num(b)).toBe(slot === 'q3' ? uq - lq : range(data))
      }
    }
  })

  it('median and quartiles match the raw list, with halves of odd and even size', () => {
    const q5 = build('median-and-quartiles', 'q5')
    for (const b of q5) {
      const xs = list(b, 'data')
      expect(num(b), b.seed).toBe(median(xs))
      // The middle of the unsorted list is not the median, as the solution says.
      expect(xs[(xs.length - 1) / 2]).not.toBe(num(b))
      expect(xs.length % 2).toBe(1)
    }
    const q6 = build('median-and-quartiles', 'q6')
    for (const b of q6) expect(num(b), b.seed).toBe(quartiles(list(b, 'data'))[1])
    const q7 = build('median-and-quartiles', 'q7')
    for (const b of q7) expect(num(b), b.seed).toBe(median(list(b, 'data')))
    const q8 = build('median-and-quartiles', 'q8')
    for (const b of q8) expect(num(b), b.seed).toBe(quartiles(list(b, 'data'))[0])
    for (const b of q6) expect(v(b, 'n') % 2).toBe(1)
    for (const b of [...q7, ...q8]) expect(v(b, 'n') % 2).toBe(0)
    // Each half is sometimes odd (one middle value) and sometimes even (two to average).
    expect(new Set(q6.map((b) => Math.floor(v(b, 'n') / 2) % 2))).toEqual(new Set([0, 1]))
    expect(new Set(q8.map((b) => Math.floor(v(b, 'n') / 2) % 2))).toEqual(new Set([0, 1]))
  })

  it('a quarter lies beyond each quartile and half inside the box', () => {
    const share = { 'above-q3': 0.25, 'below-q1': 0.25, between: 0.5, 'above-q1': 0.75, 'below-q3': 0.75 } as Record<string, number>
    for (const slot of ['q10', 'q16']) {
      for (const b of build('box-plot-shares', slot)) expect(num(b)).toBe(v(b, 'n') * share[String(b.values.share)]!)
    }
    expect(new Set(build('box-plot-shares', 'q10').map((b) => b.values.share))).toEqual(new Set(['above-q3', 'below-q1']))
    expect(new Set(build('box-plot-shares', 'q16').map((b) => b.values.share))).toEqual(new Set(['between', 'above-q1', 'below-q3']))
  })
})

describe('grouped and cumulative frequency', () => {
  const mids = (bounds: number[]) => bounds.slice(1).map((u, i) => (bounds[i]! + u) / 2)

  it('a grouped mean uses midpoints, and the class-bound slips give different answers', () => {
    for (const slot of ['q5', 'q15']) {
      for (const b of build('grouped-mean', slot)) {
        const bounds = list(b, 'bounds')
        const freqs = list(b, 'freqs')
        expect(close(num(b), mean(expandTable(mids(bounds), freqs))), b.seed).toBe(true)
        const upper = mean(expandTable(bounds.slice(1), freqs))
        const lower = mean(expandTable(bounds.slice(0, -1), freqs))
        expect(close(upper, v(b, 'trap'))).toBe(true)
        expect(close(num(b), upper)).toBe(false)
        expect(close(num(b), lower)).toBe(false)
        expect(b.question.solution).toContain('Midpoints')
      }
    }
    // q15 sometimes has unequal classes.
    expect(build('grouped-mean', 'q15').some((b) => new Set(list(b, 'bounds').slice(1).map((u, i) => u - list(b, 'bounds')[i]!)).size > 1)).toBe(true)
  })

  it('the modal class has the highest frequency, and cumulative frequency counts the data up to a class', () => {
    for (const b of build('modal-class', 'q1')) {
      const bounds = list(b, 'bounds')
      const freqs = list(b, 'freqs')
      const j = freqs.indexOf(Math.max(...freqs))
      expect(b.values.modal).toBe(`${bounds[j]}-${bounds[j + 1]}`)
    }
    for (const b of build('cumulative-frequency', 'q2')) expect(num(b)).toBe(sum(list(b, 'freqs').slice(0, v(b, 'j'))))
    for (const b of build('cumulative-frequency', 'q6')) expect(num(b) * 2).toBe(v(b, 'n'))
  })

  it('the median and quartiles read from the graph match straight lines between the table’s points', () => {
    const readAt = (bounds: number[], freqs: number[], y: number) => {
      const xs = bounds
      const ys = [0, ...freqs.map((_, i) => sum(freqs.slice(0, i + 1)))]
      for (let i = 1; i < ys.length; i++) if (ys[i]! >= y) return xs[i - 1]! + ((y - ys[i - 1]!) / (ys[i]! - ys[i - 1]!)) * (xs[i]! - xs[i - 1]!)
      return NaN
    }
    for (const b of build('cumulative-frequency', 'q7')) {
      expect(close(num(b), readAt(list(b, 'bounds'), list(b, 'freqs'), v(b, 'n') / 2)), b.seed).toBe(true)
      expect(b.question.type === 'numeric' && b.question.tolerance <= 0.5).toBe(true)
    }
    for (const b of build('cumulative-frequency', 'q8')) {
      const [bounds, freqs, n] = [list(b, 'bounds'), list(b, 'freqs'), v(b, 'n')]
      expect(close(v(b, 'q1'), readAt(bounds, freqs, n / 4))).toBe(true)
      expect(close(v(b, 'q3'), readAt(bounds, freqs, (3 * n) / 4))).toBe(true)
      expect(num(b)).toBe(v(b, 'q3') - v(b, 'q1'))
    }
  })

  it('the number above a reading is the frequencies of the classes above it', () => {
    for (const b of build('cumulative-frequency', 'q10')) {
      const bounds = list(b, 'bounds')
      const freqs = list(b, 'freqs')
      const j = bounds.indexOf(v(b, 'at'))
      expect(num(b), b.seed).toBe(sum(freqs.slice(j)))
    }
  })
})

describe('slots sharing a sheet ask different things', () => {
  const sheet = (topicId: string, level: string, seed: string) => {
    const t = topicFile(topicId)
    const qs = bank(topicId)
    return sheetQuestions('maths', topicId, t.worksheets[level].questionIds.map((id: string) => qs.find((q) => q.id === id)!), seed)
  }
  const cases: [string, string, string, string][] = [
    ['averages-and-range', 'core', 'averages-of-a-list', 'task'],
    ['averages-and-range', 'higher', 'frequency-table-averages', 'task'],
    ['averages-and-range', 'higher', 'means-from-totals', 'task'],
    ['charts-and-diagrams-for-data', 'higher', 'pie-chart-angles', 'task'],
    ['sampling-and-populations', 'advanced', 'sample-proportions', 'task'],
    ['scatter-graphs-and-correlation', 'higher', 'line-of-best-fit-estimate', 'where'],
    ['histograms', 'higher', 'histogram-bars', 'task'],
    ['box-plots', 'higher', 'median-and-quartiles', 'task'],
    ['grouped-and-cumulative-frequency', 'higher', 'cumulative-frequency', 'task'],
  ]
  for (const [topicId, level, generatorId, key] of cases) {
    it(`${generatorId} on the ${topicId} ${level} sheet`, () => {
      for (let i = 0; i < 50; i++) {
        const items = sheet(topicId, level, `sheet-${i}`).filter((s) => s.generated?.generatorId === generatorId)
        expect(items.length).toBeGreaterThan(1)
        const asked = items.map((s) => s.generated!.values[key])
        expect(new Set(asked).size, `${i}: ${asked.join(', ')}`).toBe(asked.length)
      }
    })
  }

  it('the sampling higher sheet surveys people in q5 and tests things in q9', () => {
    for (let i = 0; i < 50; i++) {
      const items = sheet('sampling-and-populations', 'higher', `sheet-${i}`)
      const q5 = items.find((s) => s.question.id === 'q5')!.question.prompt
      const q9 = items.find((s) => s.question.id === 'q9')!.question.prompt
      expect(q5).not.toMatch(/bulbs|eggs|seeds|phones/)
      expect(q9).toMatch(/bulbs|eggs|seeds|phones/)
    }
  })

  it('the histogram advanced sheet scales q13 by a half or a multiple and q18 by a fraction', () => {
    for (let i = 0; i < 50; i++) {
      const items = sheet('histograms', 'advanced', `sheet-${i}`).filter((s) => s.generated?.generatorId === 'histogram-second-bar')
      const ratios = items.map((s) => Number(s.generated!.values.num) / Number(s.generated!.values.den))
      expect(new Set(ratios).size).toBe(ratios.length)
    }
  })
})
