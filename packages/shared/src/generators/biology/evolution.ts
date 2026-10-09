import { fixed, show } from '../format.ts'
import { atMost, cap, closes, figures, near, numeric, prose, tex } from '../physics/build.ts'
import { clean, clearOf, distinct, evenly, noOnes, places, powerOfTen, range, shiftFree, tenfold, toPlaces, word } from '../chemistry/build.ts'
import { draw, int, pick, type Rng } from '../random.ts'
import type { Generator } from '../types.ts'
import { balanced, between, cut, fair, figureTolerance, full, halfLastPlace, layered, list, memo, tidy, toThree, unitsOf, whole } from './build.ts'

/**
 * Variation and evolution (AQA 8461, 4.6.2.1 variation, 4.6.2.2 evolution by natural selection,
 * 4.6.2.3 selective breeding, 4.6.2.4 genetic engineering, 4.6.3.5 fossils, 4.6.3.7 resistant
 * bacteria) and adaptation (4.7.1.4). Thirteen generators stand in for thirteen numeric written slots
 * in "Variation and natural selection", "Evidence for evolution and classification", "Classification,
 * adaptation and evolution" and "Selective breeding and genetic engineering". Four slots of "Evidence
 * for evolution and classification" stay written: q1 (when Ardi lived) and q4 (how many kingdoms)
 * ask for a fact to recall, and q9 (Ardi to Leakey's fossil) and q19 (brain volumes of the three
 * fossils) work from the three fossils' real dates and published estimates, which give three pairs
 * at most and cannot be varied without inventing fossils.
 *
 * Every figure is one the thing really has. Before treatment 0.5 to 8% of a population of bacteria
 * carry resistance; 2 to 30% of brown rats on farms carry warfarin resistance and 2 to 20% of the
 * peppered moths in a clean-air wood are dark. *Escherichia coli* divides every 20 to 30 minutes in
 * ideal conditions, *Staphylococcus aureus* every 25 to 35 and *Streptococcus pneumoniae* every 30
 * to 40. Resistant hospital samples rise from 2 to 20% to at most 80%, at most eightfold between
 * two rows. Holly leaves are 40 to 95 mm long, beech 50 to 110 mm and oak 55 to 125 mm, the shade
 * leaves longer than the sun leaves. In
 * an industrial wood of the 1800s or 1950s 75 to 98% of peppered moths were dark; after the clean
 * air laws, 70 to 95% fell to 5 to 35%. Warfarin resistance rose from 2 to 12% to 30 to 80% of
 * trapped rats, and methicillin resistance from 2 to 15% to 20 to 50% of samples. Fossil dates are
 * the published ones: *Sahelanthropus* 7, Ardi 4.4, Lucy 3.2 and Turkana Boy 1.6 million years
 * ago; *Hyracotherium* about 55, *Mesohippus* 35, *Merychippus* 15 and the first *Equus* 4 million;
 * *Pakicetus* about 50, *Rodhocetus* 47 and *Basilosaurus* 40 million. Generation times are
 * assumed at 15 to 30 years for human ancestors, 4 to 9 for horses and 6 to 15 for early whales.
 * Sediment builds up at 1 to 20 m every 100 000 years (Olduvai and Koobi Fora lie in this range);
 * hand axes date from 1.7 million years ago to 0.5, Oldowan flakes from 2.6 to 1.8. Cubes standing
 * for animals have sides of 1.5 to 30 cm: 1.5 to 5 cm for a small desert animal or bird, 2.5 to 8
 * for a small Arctic mammal. Breeding raises wheat yields by 5 to 30% from 5.0 to 8.5
 * t/ha, Green Revolution rice by 20 to 90% from 1.5 to 3.5 t/ha, milk by 5 to 40% from 4000 to
 * 7000 litres, eggs by 5 to 40% from 150 to 250 a year, and Bt cotton yields by 10 to 40% from
 * 300 to 800 kg/ha. A breeding programme adds 2 to 6% of the starting milk yield a generation:
 * Holstein-Friesians start at 5500 to 8000 litres, Jerseys 4000 to 5500, Saanen goats 600 to 1000
 * and East Friesian sheep 300 to 500. Caterpillars take 8 to 25% of ordinary maize (6 to 12 t/ha)
 * and 1 to 4% of Bt maize; 15 to 40% of ordinary cotton (1.5 to 4 t/ha) and 2 to 8% of Bt cotton;
 * 25 to 50% of ordinary brinjal (20 to 40 t/ha) and 2 to 6% of Bt brinjal.
 */
const VARIATION = 'variation-and-natural-selection'
const EVIDENCE = 'evidence-for-evolution-and-classification'
const ADAPTATION = 'classification-adaptation-and-evolution'
const BREEDING = 'selective-breeding-and-genetic-engineering'

/** A percentage in maths: 2.5\%. */
const pc = (x: number) => `${show(x)}\\%`

// =============================================================================================
// Variation and natural selection
// =============================================================================================

// ---------------------------------------------------------------------------------------------
// q6: the number carrying resistance, from a percentage of a population
// ---------------------------------------------------------------------------------------------

interface Carriers {
  name: string
  /** The population and its percentage, as the prompt says them. */
  says: (n: number, p: number) => string
  /** The question, after the setup. */
  asks: string
  /** What the answer counts, after the number: "resistant bacteria". */
  counted: string
  /** Why the number matters, closing the solution. */
  why: string
  /** Percentage carrying the trait, lowest, highest, step. */
  share: readonly [number, number, number]
  /** Population sizes: lowest, highest, step. */
  sizes: readonly [number, number, number]
}
const CARRIERS: Carriers[] = [
  {
    name: 'E. coli',
    says: (n, p) => `A population of ${prose(n)} *Escherichia coli* bacteria contains ${show(p)}% that are resistant to the antibiotic trimethoprim.`,
    asks: 'How many resistant bacteria are there?',
    counted: 'resistant bacteria',
    why: 'When trimethoprim is used, these are the bacteria that survive, and the whole population can rebuild from them.',
    share: [0.5, 8, 0.5],
    sizes: [400, 6000, 100],
  },
  {
    name: 'S. aureus',
    says: (n, p) => `In a population of ${prose(n)} *Staphylococcus aureus* bacteria, ${show(p)}% are resistant to the antibiotic methicillin.`,
    asks: 'How many of the bacteria are resistant?',
    counted: 'resistant bacteria',
    why: 'When methicillin is used, these are the bacteria that survive and reproduce, so the next population is mostly resistant.',
    share: [0.5, 8, 0.5],
    sizes: [400, 6000, 100],
  },
  {
    name: 'rats',
    says: (n, p) => `A population of ${prose(n)} brown rats lives on a group of farms. ${cap(show(p))}% of them carry an allele that makes them resistant to the rat poison warfarin.`,
    asks: 'How many of the rats are resistant to warfarin?',
    counted: 'resistant rats',
    why: 'Where warfarin is put down, these are the rats that survive and breed, so the allele for resistance becomes more common.',
    share: [2, 30, 1],
    sizes: [150, 2000, 10],
  },
  {
    name: 'moths',
    says: (n, p) => `In a wood where the air is clean and the tree bark is pale, a survey records ${prose(n)} peppered moths. ${cap(show(p))}% of them are the dark form.`,
    asks: 'How many dark moths does the survey record?',
    counted: 'dark moths',
    why: 'Against pale bark the dark form is the one birds find most easily, which is why it is now the rare form.',
    share: [2, 20, 1],
    sizes: [100, 1200, 10],
  },
]

interface Share {
  n: number
  p: number
  answer: number
}
/**
 * A whole count of three or more, the percentage not 1, 10 or 100 (or 2, 5, 20 or 50, which make
 * the answer the population doubled or halved with the point moved), and the answer none of its
 * givens with the point moved.
 */
const shares = (c: Carriers): Share[] =>
  range(...c.share).flatMap((p) =>
    range(...c.sizes)
      .map((n) => ({ n, p, answer: clean((n * p) / 100) }))
      .filter((x) => whole(x.answer) && x.answer >= 3 && noOnes(x.p) && !powerOfTen(x.p) && !powerOfTen(x.n) && shiftFree(x.answer, x.n, x.p) && distinct(x.n, x.p)),
  )

/** p% of n: written as q6 (1% of 1000 bacteria, 10). */
export const resistantCount: Generator = {
  id: 'resistant-share-count',
  subjectId: 'biology',
  topicId: VARIATION,
  replaces: ['q6'],
  build(r, slot, turn) {
    const c = CARRIERS[turn % CARRIERS.length]!
    // The percentage first, then an answer among those it allows, then a population that gives it.
    const x = layered(r, `resistant-share-count:${c.name}`, () => shares(c), (y) => y.p, (y) => y.answer)
    return numeric(
      slot,
      {
        prompt: `${c.says(x.n, x.p)} ${c.asks}`,
        solution: `$${pc(x.p)} \\times ${tex(x.n)} = \\dfrac{${show(x.p)}}{100} \\times ${tex(x.n)} = ${x.answer}$ ${c.counted}. ${c.why}`,
        method: [`finds ${show(x.p)}% of ${prose(x.n)}`],
        answer: x.answer,
        units: unitsOf(slot),
      },
      // Second route: the count as a share of the population gives the percentage back.
      { agrees: near((x.answer / x.n) * 100, x.p), detail: `${x.answer} ÷ ${x.n} × 100 = ${x.p}` },
      { context: c.name, n: x.n, p: x.p },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q9: resistant survivors doubling every generation
// ---------------------------------------------------------------------------------------------

interface Bug {
  name: string
  species: string
  antibiotic: string
  /** Minutes between divisions in ideal conditions. */
  times: number[]
}
const BUGS: Bug[] = [
  { name: 'E. coli', species: '*Escherichia coli*', antibiotic: 'trimethoprim', times: [20, 25, 30] },
  { name: 'S. aureus', species: '*Staphylococcus aureus*', antibiotic: 'flucloxacillin', times: [25, 30, 35] },
  { name: 'S. pneumoniae', species: '*Streptococcus pneumoniae*', antibiotic: 'amoxicillin', times: [30, 35, 40] },
]
/** Survivors: never 1, a power of two (the answer would be a bare power of two) or ten. */
const SURVIVORS = range(3, 40).filter((n) => !Number.isInteger(Math.log2(n)) && !powerOfTen(n))
const DOUBLINGS = range(4, 12)

/** "2 hours 20 minutes", "1 hour 30 minutes", "3 hours". */
export function duration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const hours = h === 1 ? '1 hour' : `${h} hours`
  return m ? `${hours} ${m} minutes` : hours
}

const GROWTH_PROMPTS = [
  (b: Bug, n: number, t: number, k: number) =>
    `A course of the antibiotic ${b.antibiotic} leaves ${n} resistant ${b.species} bacteria alive. In ideal conditions each bacterium divides into two every ${t} minutes. Assuming every bacterium survives and divides, how many bacteria will there be after ${duration(k * t)}?`,
  (b: Bug, n: number, t: number, k: number) =>
    `After a course of ${b.antibiotic}, ${n} ${b.species} bacteria that are resistant to it survive. In ideal conditions the population doubles every ${t} minutes. How many bacteria will there be after ${duration(k * t)}, assuming none of them die?`,
]

/** n × 2^k, k from the time and the doubling time: written as q9 (10 bacteria doubling 7 times, 1280). */
export const resistantGrowth: Generator = {
  id: 'resistant-population-doubling',
  subjectId: 'biology',
  topicId: VARIATION,
  replaces: ['q9'],
  build(r, slot, turn) {
    const b = BUGS[turn % BUGS.length]!
    const n = pick(r, SURVIVORS)
    const t = pick(r, b.times)
    const k = pick(r, DOUBLINGS)
    const minutes = k * t
    const answer = n * 2 ** k
    let grown = n
    for (let i = 0; i < k; i++) grown *= 2
    return numeric(
      slot,
      {
        prompt: pick(r, GROWTH_PROMPTS)(b, n, t, k),
        solution:
          `${cap(duration(minutes))} is ${minutes} minutes, so the population doubles $${minutes} \\div ${t} = ${k}$ times. ` +
          `${closes(`${n} \\times 2^{${k}} = ${n} \\times ${tex(2 ** k)}`, answer, 'bacteria')} ` +
          `Every one of them carries the resistance, so ${b.antibiotic} will no longer clear the infection.`,
        method: [`finds the number of doublings, ${minutes} ÷ ${t} = ${k}`, `uses 2 to the power ${k} and multiplies by ${n}`],
        answer,
        units: unitsOf(slot),
      },
      // Second route: doubling once per generation, k times over.
      { agrees: grown === answer, detail: `${n} doubled ${k} times = ${grown}` },
      { context: b.name, n, t, k },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q19: how many times greater, from a table of resistant samples
// ---------------------------------------------------------------------------------------------

interface Tested {
  name: string
  species: string
  antibiotic: string
}
const TESTED: Tested[] = [
  { name: 'E. coli', species: '*Escherichia coli*', antibiotic: 'the antibiotic ciprofloxacin' },
  { name: 'K. pneumoniae', species: '*Klebsiella pneumoniae*', antibiotic: 'a carbapenem antibiotic' },
  { name: 'S. aureus', species: '*Staphylococcus aureus*', antibiotic: 'the antibiotic methicillin' },
]
/** Which two of the four rows the question compares: first and last, first and third, second and last. */
const COMPARED = [
  [0, 3],
  [0, 2],
  [1, 3],
] as const

interface Rise {
  a: number
  b: number
  answer: number
}
/**
 * Two percentages whose ratio is exact with three figures at most, from 1.5 to 8 times, not either
 * figure itself and not their difference. The rows between need room, and a row outside the pair
 * must fit the same steady rise: at least 2.5% before it and at most 75% after it.
 */
const rises = (ask: readonly [number, number]): Rise[] =>
  range(ask[0] === 1 ? 3 : 2, 20).flatMap((a) =>
    range(a + 1, 60)
      .map((b) => ({ a, b, answer: clean(b / a) }))
      .filter((x) => tidy(x.answer, 2) && between(x.answer, [1.5, 8]) && !powerOfTen(x.answer) && ![x.a, x.b].includes(x.answer) && !near(x.answer, x.b - x.a) && x.b - x.a >= ask[1] - ask[0] + 1 && (ask[0] === 0 || x.a / Math.sqrt(x.answer) >= 2.5) && (ask[1] === 3 || x.b * Math.sqrt(x.answer) <= 75)),
  )

/**
 * Fills the four rows, rising year on year about as a steady multiplication would: each row not
 * asked about aims at the steady rise, jittered by up to 15%, and is kept inside the room the rows
 * either side leave it. No row is the answer.
 */
function rows(r: Rng, ask: readonly [number, number], x: Rise): number[] {
  const step = (x.b / x.a) ** (1 / (ask[1] - ask[0]))
  return draw(
    r,
    () => {
      const out: number[] = [0, 0, 0, 0]
      out[ask[0]] = x.a
      out[ask[1]] = x.b
      for (const i of [0, 1, 2, 3]) {
        if (i === ask[0] || i === ask[1]) continue
        const aim = (i < ask[0] ? x.a / step : i > ask[1] ? x.b * step : x.a * step ** (i - ask[0])) * (0.85 + 0.3 * r())
        const lo = i < ask[0] ? 2 : out[i - 1]! + 1
        const hi = i > ask[1] ? 80 : (i < ask[0] ? x.a : x.b) - (i < ask[0] ? 1 : ask[1] - i)
        // The whole number in the room nearest the aim, never the answer.
        const room = range(lo, Math.max(lo, hi)).filter((v) => v <= hi && v !== x.answer)
        out[i] = room.length ? room.reduce((best, v) => (Math.abs(v - aim) < Math.abs(best - aim) ? v : best)) : 0
      }
      return out
    },
    (out) => out.every((v, i) => i === 0 || v > out[i - 1]!) && out[0]! >= 2 && out[3]! <= 80 && !out.includes(x.answer),
  )
}

/** b ÷ a from two rows of a table: written as q19 (4% in 2010, 30% in 2016, 7.5). */
export const resistanceTable: Generator = {
  id: 'resistance-table-ratio',
  subjectId: 'biology',
  topicId: VARIATION,
  replaces: ['q19'],
  build(r, slot, turn) {
    const c = TESTED[turn % TESTED.length]!
    const ask = COMPARED[Math.floor(turn / TESTED.length) % COMPARED.length]!
    const x = evenly(r, `resistance-table-ratio:${ask.join('-')}`, () => rises(ask), (y) => y.answer)
    const pcs = rows(r, ask, x)
    const gap = pick(r, [2, 3])
    const start = int(r, 2003, 2013)
    const years = [0, 1, 2, 3].map((i) => start + gap * i)
    const [early, late] = [years[ask[0]]!, years[ask[1]]!]
    return numeric(
      slot,
      {
        prompt:
          `The table gives example figures for the percentage of samples of ${c.species}, taken in a hospital, that were resistant to ${c.antibiotic}.\n\n| Year | Samples resistant (%) |\n| --- | --- |\n` +
          `${years.map((y, i) => `| ${y} | ${pcs[i]} |`).join('\n')}\n\nHow many times greater was the percentage of resistant samples in ${late} than in ${early}?`,
        solution:
          `$${x.b} \\div ${x.a} = ${show(x.answer)}$, so the percentage was ${show(x.answer)} times greater. Each use of the antibiotic kills non-resistant bacteria and leaves the resistant ones to reproduce, ` +
          'so the **proportion** carrying the resistance allele rises year on year.',
        method: [`${x.b} ÷ ${x.a}`],
        answer: x.answer,
        tolerance: halfLastPlace(x.answer),
        units: unitsOf(slot),
      },
      // Second route: the earlier figure scaled by the answer gives the later one.
      { agrees: near(x.a * x.answer, x.b), detail: `${x.a} × ${x.answer} = ${x.b}` },
      { context: c.name, ask: ask.join('-'), a: x.a, b: x.b, early, late },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q25: the difference between two means, sun and shade leaves on one tree
// ---------------------------------------------------------------------------------------------

interface Tree {
  name: string
  /** After "one". */
  tree: string
  /** Mean length of the sun leaves, mm: lowest, highest. */
  sunny: readonly [number, number]
  /** How much longer the shade leaves are on average, mm: lowest, highest. */
  longer: readonly [number, number]
}
const TREES: Tree[] = [
  { name: 'holly', tree: 'holly tree', sunny: [45, 62], longer: [6, 22] },
  { name: 'beech', tree: 'beech tree', sunny: [55, 75], longer: [6, 22] },
  { name: 'oak', tree: 'oak tree', sunny: [65, 88], longer: [8, 24] },
]
const LEAF_COUNTS = [4, 5, 6]

/** n distinct whole lengths within 12% of the mean that add up to n × mean. */
function lengths(r: Rng, n: number, mean: number): number[] {
  const room = Math.floor(mean * 0.12)
  return draw(
    r,
    () => {
      const xs = Array.from({ length: n - 1 }, () => int(r, mean - room, mean + room))
      return [...xs, n * mean - xs.reduce((s, x) => s + x, 0)]
    },
    (xs) => new Set(xs).size === n && xs.every((x) => Math.abs(x - mean) <= room) && !xs.every((x, i) => i === 0 || x > xs[i - 1]!),
  )
}

/** Mean of each side and their difference: written as q25 (64 mm and 50 mm on a holly tree, 14 mm). */
export const leafMeans: Generator = {
  id: 'sun-and-shade-leaf-means',
  subjectId: 'biology',
  topicId: VARIATION,
  replaces: ['q25'],
  build(r, slot, turn) {
    const t = TREES[turn % TREES.length]!
    const n = pick(r, LEAF_COUNTS)
    const answer = int(r, ...t.longer)
    const sunny = int(r, ...t.sunny)
    const shaded = sunny + answer
    const sh = lengths(r, n, shaded)
    const su = lengths(r, n, sunny)
    const [shTotal, suTotal] = [n * shaded, n * sunny]
    return numeric(
      slot,
      {
        prompt:
          `All the leaves on one ${t.tree} have the same alleles, because every cell in the tree came from the same fertilised egg. A student measures the length of ${word(n)} leaves from the shaded side of the tree and ${word(n)} leaves from the sunny side.\n\n` +
          `| Side of tree | Leaf lengths (mm) |\n| --- | --- |\n| Shaded | ${sh.join(', ')} |\n| Sunny | ${su.join(', ')} |\n\n` +
          'Calculate the difference between the mean leaf length on the shaded side and the mean leaf length on the sunny side, in mm.',
        solution:
          'Mean = total ÷ number of readings.\n\n' +
          `Shaded side: $${sh.join(' + ')} = ${shTotal}$, and $${shTotal} \\div ${n} = ${shaded}$ mm.\n\n` +
          `Sunny side: $${su.join(' + ')} = ${suTotal}$, and $${suTotal} \\div ${n} = ${sunny}$ mm.\n\n` +
          `Difference: $${shaded} - ${sunny} = ${answer}$ mm.\n\n` +
          `Check: $${n} \\times ${shaded} = ${shTotal}$ and $${n} \\times ${sunny} = ${suTotal}$. Because every leaf on the tree has the same alleles, the difference of ${answer} mm cannot be genetic: it is **environmental variation**, ` +
          'caused by the different amount of light on the two sides of the tree.',
        method: [`mean for the shaded side: ${shTotal} ÷ ${n} = ${shaded} mm`, `mean for the sunny side: ${suTotal} ÷ ${n} = ${sunny} mm`],
        answer,
        units: unitsOf(slot),
      },
      // Second route: the difference of the totals, shared over the leaves.
      { agrees: near((sh.reduce((s, x) => s + x, 0) - su.reduce((s, x) => s + x, 0)) / n, answer), detail: `(${shTotal} − ${suTotal}) ÷ ${n}` },
      { context: t.name, n, sunny, shaded },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q26: the change in percentage points between two surveys
// ---------------------------------------------------------------------------------------------

interface Selection {
  name: string
  /** What changed, and why one form is eaten or killed. */
  setup: string
  /** The two surveys. */
  surveys: (n1: number, d1: number, n2: number, d2: number) => string
  /** "dark moths", "resistant rats", after "the percentage of". */
  form: string
  /** The form for the working: "dark", "resistant". */
  short: string
  rises: boolean
  /** Percentage of the form in the first survey, then the second: lowest, highest. */
  before: readonly [number, number]
  after: readonly [number, number]
  /** Survey sizes: lowest, highest, step. */
  sizes: readonly [number, number, number]
  /** The closing explanation. */
  why: string
}
const SELECTIONS: Selection[] = [
  {
    name: 'moths darken',
    setup:
      'In the 1800s, soot from factories blackened the bark of the trees in industrial parts of Britain. Birds find and eat more of the peppered moths that stand out against the bark, and colour in peppered moths is inherited.',
    surveys: (n1, d1, n2, d2) =>
      `Early in this period, a survey of one wood caught ${n1} peppered moths, of which ${d1} were dark and the rest pale. Several decades later, a survey of the same wood caught ${n2}, of which ${d2} were dark.`,
    form: 'dark moths',
    short: 'dark',
    rises: true,
    before: [2, 15],
    after: [60, 95],
    sizes: [120, 600, 10],
    why: 'This is natural selection. Against the blackened bark, pale moths were more likely to be eaten, so dark moths were more likely to survive and reproduce and pass on the alleles for dark colour, which became more common over the generations.',
  },
  {
    name: 'moths lighten',
    setup:
      'After the Clean Air Act of 1956 cut the soot from chimneys, lichens grew back on the trees in industrial parts of Britain and the bark became paler. Birds find and eat more of the peppered moths that stand out against the bark, and colour in peppered moths is inherited.',
    surveys: (n1, d1, n2, d2) =>
      `In the 1960s, a survey of one wood caught ${n1} peppered moths, of which ${d1} were dark. In the early 2000s, a survey of the same wood caught ${n2}, of which ${d2} were dark.`,
    form: 'dark moths',
    short: 'dark',
    rises: false,
    before: [70, 95],
    after: [5, 35],
    sizes: [120, 600, 10],
    why: 'This is natural selection working the other way. Against the paler bark, dark moths were more likely to be eaten, so pale moths were more likely to survive and reproduce, and the alleles for pale colour became more common again.',
  },
  {
    name: 'rats',
    setup:
      'Warfarin has been used as a rat poison since the 1950s. Some brown rats carry an allele that makes them resistant to it, and the allele is inherited.',
    surveys: (n1, d1, n2, d2) =>
      `When farmers in one area began to use warfarin, ${n1} rats trapped there were tested and ${d1} were resistant. After several years of poisoning, ${n2} rats trapped in the same area were tested and ${d2} were resistant.`,
    form: 'resistant rats',
    short: 'resistant',
    rises: true,
    before: [2, 12],
    after: [30, 80],
    sizes: [120, 400, 10],
    why: 'This is natural selection. The poison killed the rats without the allele, so resistant rats were more likely to survive and breed and pass the allele on, and it became more common with each generation.',
  },
  {
    name: 'bacteria',
    setup:
      'In one hospital, samples of *Staphylococcus aureus* taken from patients are tested for resistance to the antibiotic methicillin. Resistance is passed on when the bacteria divide.',
    surveys: (n1, d1, n2, d2) => `In one year, ${d1} of ${n1} samples were resistant. Ten years later, after heavy use of antibiotics, ${d2} of ${n2} samples were resistant.`,
    form: 'resistant samples',
    short: 'resistant',
    rises: true,
    before: [2, 15],
    after: [20, 50],
    sizes: [150, 600, 10],
    why: 'This is natural selection. Each use of an antibiotic kills the bacteria that are not resistant, so the resistant ones survive and divide and become a larger share of the population.',
  },
]

interface Points {
  p1: number
  p2: number
  answer: number
}
/** Two whole percentages whose difference is at least 10 points and neither of them. */
const pointsFor = (s: Selection): Points[] =>
  range(...s.before).flatMap((p1) =>
    range(...s.after)
      .map((p2) => ({ p1, p2, answer: Math.abs(p2 - p1) }))
      .filter((x) => x.answer >= 10 && x.answer !== x.p1 && x.answer !== x.p2),
  )
/** Survey sizes that give a whole count at p%, never 100, 200 or 500, which make the count the percentage, doubled or halved. */
const sizesFor = (s: Selection, p: number) => range(...s.sizes).filter((n) => whole((n * p) / 100) && (n * p) / 100 >= 2 && ![100, 200, 500].includes(n))

/** Each survey to a percentage, then the difference: written as q26 (60 of 400, 345 of 500, 54 percentage points). */
export const selectionPoints: Generator = {
  id: 'natural-selection-percentage-points',
  subjectId: 'biology',
  topicId: VARIATION,
  replaces: ['q26'],
  build(r, slot, turn) {
    const s = SELECTIONS[turn % SELECTIONS.length]!
    const x = layered(r, `natural-selection-percentage-points:${s.name}`, () => pointsFor(s), (y) => y.answer, (y) => y.p1)
    // The sizes differ, and the change in the counts is not the answer: a student who subtracts the
    // counts without turning them into percentages is marked wrong.
    const [n1, n2] = draw(
      r,
      (q) => [pick(q, sizesFor(s, x.p1)), pick(q, sizesFor(s, x.p2))],
      ([a, b]) => a !== b && !near(Math.abs((b! * x.p2) / 100 - (a! * x.p1) / 100), x.answer) && ![(a! * x.p1) / 100, (b! * x.p2) / 100].includes(x.answer),
    ) as [number, number]
    const d1 = (n1 * x.p1) / 100
    const d2 = (n2 * x.p2) / 100
    const way = s.rises ? 'increased' : 'decreased'
    return numeric(
      slot,
      {
        prompt: `${s.setup} ${s.surveys(n1, d1, n2, d2)} Calculate by how many percentage points the percentage of ${s.form} ${way}.`,
        solution:
          'The two surveys counted different numbers, so the counts must be turned into percentages before they can be compared.\n\n' +
          `Before: $\\dfrac{${d1}}{${n1}} \\times 100 = ${pc(x.p1)}$ ${s.short}.\n\n` +
          `After: $\\dfrac{${d2}}{${n2}} \\times 100 = ${pc(x.p2)}$ ${s.short}.\n\n` +
          `${s.rises ? 'Increase' : 'Decrease'}: $${s.rises ? `${x.p2} - ${x.p1}` : `${x.p1} - ${x.p2}`} = ${x.answer}$ percentage points.\n\n` +
          `Check: ${x.p1}% of ${n1} is ${d1}, and ${x.p2}% of ${n2} is ${d2}. ${s.why}`,
        method: [`percentage ${s.short} before: ${d1} ÷ ${n1} × 100 = ${x.p1}%`, `percentage ${s.short} after: ${d2} ÷ ${n2} × 100 = ${x.p2}%`],
        answer: x.answer,
        units: unitsOf(slot),
      },
      // Second route: each percentage back to its count.
      { agrees: near((x.p1 * n1) / 100, d1) && near((x.p2 * n2) / 100, d2) && near(Math.abs((d2 / n2 - d1 / n1) * 100), x.answer), detail: `${d2}/${n2} − ${d1}/${n1}` },
      { context: s.name, p1: x.p1, p2: x.p2, n1, n2 },
    )
  },
}

// =============================================================================================
// Evidence for evolution: the fossil timescale
// =============================================================================================

// ---------------------------------------------------------------------------------------------
// q25: generations between two fossils
// ---------------------------------------------------------------------------------------------

interface Fossil {
  /** The first time the prompt names it, with what it is. */
  full: string
  /** After that. */
  short: string
  /** Million years ago. */
  age: number
}
interface Line {
  name: string
  /** After "generations of". */
  of: string
  /** "about " where the date is a rounded one. */
  about: string
  fossils: Fossil[]
  /** Generation times in years the prompt may assume. */
  times: number[]
}
const LINES: Line[] = [
  {
    name: 'human ancestors',
    of: 'human ancestors',
    about: '',
    fossils: [
      { full: '*Sahelanthropus*, one of the oldest fossils thought to be a human ancestor,', short: '*Sahelanthropus*', age: 7 },
      { full: 'Ardi', short: 'Ardi', age: 4.4 },
      { full: 'Lucy', short: 'Lucy', age: 3.2 },
      { full: "Turkana Boy, the skeleton found by Richard Leakey's team,", short: 'Turkana Boy', age: 1.6 },
    ],
    times: range(15, 30),
  },
  {
    name: 'horses',
    of: 'horse ancestors',
    about: 'about ',
    fossils: [
      { full: '*Hyracotherium*, a fox-sized early relative of the horse,', short: '*Hyracotherium*', age: 55 },
      { full: '*Mesohippus*, a three-toed horse,', short: '*Mesohippus*', age: 35 },
      { full: '*Merychippus*, a grazing three-toed horse,', short: '*Merychippus*', age: 15 },
      { full: 'the first *Equus*, the genus of modern horses,', short: '*Equus*', age: 4 },
    ],
    times: range(4, 9),
  },
  {
    name: 'whales',
    of: 'whale ancestors',
    about: 'about ',
    fossils: [
      { full: '*Pakicetus*, a land mammal related to whales,', short: '*Pakicetus*', age: 50 },
      { full: '*Rodhocetus*, which swam with its legs and lived partly on land,', short: '*Rodhocetus*', age: 47 },
      { full: '*Basilosaurus*, a whale that lived wholly in the sea,', short: '*Basilosaurus*', age: 40 },
    ],
    times: range(6, 15),
  },
]

interface Span {
  older: Fossil
  younger: Fossil
  gap: number
  years: number
  g: number
  exact: number
  answer: number
  rounded: boolean
}
/**
 * Every pair of fossils, older first, with every generation time that rounds clearly: never 10, 5
 * or 20, which make the answer the gap in millions with the point moved, doubled or halved.
 */
const spans = (l: Line): Span[] =>
  l.fossils.flatMap((older, i) =>
    l.fossils.slice(i + 1).flatMap((younger) =>
      l.times.flatMap((g) => {
        const gap = clean(older.age - younger.age)
        const years = clean(gap * 1e6)
        const f = toThree(years / g)
        const x = { older, younger, gap, years, g, ...f }
        return fair(f) && shiftFree(f.answer, gap, older.age, younger.age, g) ? [x] : []
      }),
    ),
  )

const SPAN_PROMPTS = [
  (l: Line, x: Span) =>
    `${cap(x.older.full)} lived ${l.about}${show(x.older.age)} million years ago and ${x.younger.full} lived ${l.about}${show(x.younger.age)} million years ago. Assuming an average generation time of ${x.g} years, calculate how many generations of ${l.of} would fit into the time between ${x.older.short} and ${x.younger.short}.`,
  (l: Line, x: Span) =>
    `The fossil record shows that ${x.older.full} lived ${l.about}${show(x.older.age)} million years ago, and ${x.younger.full} ${l.about}${show(x.younger.age)} million years ago. If the average generation time of ${l.of} was ${x.g} years, how many generations would fit into the time between them?`,
]

/** Years ÷ generation time: written as q25 (Ardi 4.4, Lucy 3.2, 20 years, 60 000). */
export const fossilGenerations: Generator = {
  id: 'fossil-gap-generations',
  subjectId: 'biology',
  topicId: EVIDENCE,
  replaces: ['q25'],
  build(r, slot, turn) {
    const l = LINES[turn % LINES.length]!
    const x = layered(r, `fossil-gap-generations:${l.name}`, () => spans(l), (y) => `${y.older.short}|${y.younger.short}`, (y) => y.g)
    const division = `${tex(x.years)} \\div ${x.g}`
    const result = x.rounded
      ? `$${division} = ${tex(Number(cut(x.exact, String(Math.floor(x.exact)).length + 1)))}\\ldots$, which is **${x.answer} generations** to 3 significant figures.`
      : closes(division, x.answer, 'generations')
    return numeric(
      slot,
      {
        prompt: pick(r, SPAN_PROMPTS)(l, x),
        solution:
          `Time between them: $${show(x.older.age)} - ${show(x.younger.age)} = ${show(x.gap)}$ million years $= ${tex(x.years)}$ years.\n\n` +
          `Number of generations = time ÷ generation time: ${result}\n\n` +
          `Check: $${tex(x.answer)} \\times ${x.g} ${x.rounded ? '\\approx' : '='} ${tex(x.years)}$. It is an estimate, because the dates are rounded and the generation time is assumed, but it shows why the fossils can record large changes: ` +
          'natural selection had a vast number of generations in which to act.',
        method: [`finds the time between them, ${show(x.gap)} million years (${prose(x.years)} years), and divides by ${x.g}`],
        answer: x.answer,
        tolerance: figureTolerance(x),
        units: unitsOf(slot),
      },
      // Second route: the generations back to years.
      { agrees: Math.abs(x.answer * x.g - x.years) <= x.g * figureTolerance(x) + 1e-6, detail: `${x.answer} × ${x.g} ≈ ${x.years}` },
      { context: l.name, pair: `${x.older.short}|${x.younger.short}`, g: x.g },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q26: dating a tool from the sediment above or below a dated ash
// ---------------------------------------------------------------------------------------------

interface Find {
  name: string
  /** Starting a sentence: "A stone hand axe". */
  noun: string
  /** After "the". */
  short: string
  above: boolean
  /** When tools of this kind were made, million years ago: the answer's range. */
  made: readonly [number, number]
}
const FINDS: Find[] = [
  { name: 'hand axe above', noun: 'A stone hand axe', short: 'hand axe', above: true, made: [0.5, 1.7] },
  { name: 'flake above', noun: 'An Oldowan stone flake, one of the oldest kinds of stone tool,', short: 'flake', above: true, made: [1.8, 2.6] },
  { name: 'hand axe below', noun: 'A stone hand axe', short: 'hand axe', above: false, made: [0.5, 1.7] },
  { name: 'flake below', noun: 'An Oldowan stone flake, one of the oldest kinds of stone tool,', short: 'flake', above: false, made: [1.8, 2.6] },
]

interface Layer {
  s: number
  h: number
  /** Lots of 100 000 years. */
  q: number
  /** Million years. */
  t: number
}
/** A rate of 1 to 20 m per 100 000 years, a depth of 0.5 to 30 m, and 50 000 to 600 000 years between them that prints exactly; never the rate itself. */
const LAYERS: () => Layer[] = memo('tool-date-from-sediment:layers', () =>
  range(1, 20, 0.5).flatMap((s) =>
    range(0.5, 30, 0.5)
      .map((h) => ({ s, h, q: clean(h / s), t: clean(h / s / 10) }))
      .filter((x) => atMost(x.q, 1) && between(x.q, [0.5, 6]) && noOnes(x.q) && distinct(x.s, x.h)),
  ),
)

/** The ash's date, less (above) or more (below) the time the sediment took: written as q26 (1.75, 3 m at 1.5 m per 100 000 years, 1.55). */
export const toolDate: Generator = {
  id: 'tool-date-from-sediment',
  subjectId: 'biology',
  topicId: EVIDENCE,
  replaces: ['q26'],
  build(r, slot, turn) {
    const f = FINDS[turn % FINDS.length]!
    // The rate, depth and time each spread as evenly as the candidates allow (the time first left
    // one rate in half the builds), then the ash's date from those that leave the tool in the age
    // its kind was made.
    const L = balanced(r, 'tool-date-from-sediment:layers', LAYERS, (y) => y.s, (y) => y.h, (y) => y.t)
    const dates = range(0.4, 2.8, 0.01).filter((d) => {
      const a = clean(f.above ? d - L.t : d + L.t)
      return between(a, f.made) && clearOf(a, L.h, L.s, L.q) && !tenfold(d, L.h)
    })
    const ash = pick(r, dates)
    const answer = clean(f.above ? ash - L.t : ash + L.t)
    const years = clean(L.q * 100000)
    const side = f.above ? 'above the top of' : 'below the bottom of'
    return numeric(
      slot,
      {
        prompt:
          `At a dig, a layer of volcanic ash is dated to ${show(ash)} million years ago. ${f.above ? 'Above' : 'Below'} the ash, sediment built up at a steady rate of ${show(L.s)} m every 100 000 years, and the layers have not been disturbed. ` +
          `${f.noun} lies in the sediment ${show(L.h)} m ${side} the ash. Estimate how long ago the ${f.short} was left there, in millions of years.`,
        solution:
          `Time for ${show(L.h)} m of sediment to build up: $${show(L.h)} \\div ${show(L.s)} = ${show(L.q)}$ lots of 100 000 years $= ${tex(years)}$ years $= ${show(L.t)}$ million years.\n\n` +
          (f.above
            ? `The ${f.short} lies **above** the ash, so it is **younger** than the ash: $${show(ash)} - ${show(L.t)} = ${show(answer)}$ million years ago.\n\nCheck: $${show(answer)} + ${show(L.t)} = ${show(ash)}$. `
            : `The ${f.short} lies **below** the ash, so it is **older** than the ash: $${show(ash)} + ${show(L.t)} = ${show(answer)}$ million years ago.\n\nCheck: $${show(answer)} - ${show(L.t)} = ${show(ash)}$. `) +
          `This is how a stone tool is dated **from its environment**: the stone itself cannot be dated, because the rock is far older than the tool. The estimate depends on the sediment really having built up at a steady rate, and on the ${f.short} not having been moved since it was buried.`,
        method: [
          `time for ${show(L.h)} m to build up: ${show(L.h)} ÷ ${show(L.s)} × 100 000 = ${prose(years)} years (${show(L.t)} million years)`,
          `${f.above ? 'subtracts from' : 'adds to'} the date of the ash, because the ${f.short} lies ${f.above ? 'above' : 'below'} it`,
        ],
        answer,
        tolerance: toPlaces(answer, Math.max(places(ash), places(L.t))),
        units: unitsOf(slot),
        line: `${show(answer)} million years ago`,
      },
      // Second route: the depth at the rate per million years, from the ash's date.
      { agrees: near(ash + (f.above ? -1 : 1) * (L.h / (L.s * 10)), answer), detail: `${ash} ${f.above ? '−' : '+'} ${L.h} ÷ (${L.s} × 10)` },
      { context: f.name, ash, s: L.s, h: L.h, t: L.t },
    )
  },
}

// =============================================================================================
// Classification, adaptation and evolution
// =============================================================================================

// ---------------------------------------------------------------------------------------------
// q13: one form for every one of the other, from a percentage
// ---------------------------------------------------------------------------------------------

interface Majority {
  name: string
  says: (p: number) => string
  /** The question, two ways. */
  asks: readonly [string, string]
  /** "dark", "pale": the form given, then the other. */
  given: string
  other: string
  /** "dark moths for every pale one". */
  per: string
  /** The percentage given: lowest, highest. */
  range: readonly [number, number]
  /** Whether the form given is the majority. */
  majority: boolean
  why: string
}
const MAJORITIES: Majority[] = [
  {
    name: 'industrial moths',
    says: (p) => `In a survey of a wood near an industrial town in the 1950s, where soot had blackened the tree bark, ${p}% of the peppered moths recorded were the dark form.`,
    asks: ['For every pale moth, how many dark moths were there?', 'How many dark moths were recorded for each pale one?'],
    given: 'dark',
    other: 'pale',
    per: 'dark moths for every pale one',
    range: [75, 98],
    majority: true,
    why: 'Against the blackened bark the pale moths stood out, so birds ate more of them and the dark form came to outnumber the pale one.',
  },
  {
    name: 'clean-air moths',
    says: (p) => `In a survey of a wood with clean air, where lichens grow on the pale tree bark, ${p}% of the peppered moths recorded were the dark form.`,
    asks: ['For every dark moth, how many pale moths were there?', 'How many pale moths were recorded for each dark one?'],
    given: 'dark',
    other: 'pale',
    per: 'pale moths for every dark one',
    range: [2, 25],
    majority: false,
    why: 'Against the pale bark the dark moths stand out, so birds eat more of them and the pale form outnumbers the dark one.',
  },
  {
    name: 'rats',
    says: (p) => `On farms where warfarin had been used as a rat poison for many years, ${p}% of the brown rats trapped were resistant to it.`,
    asks: ['For every rat that was not resistant, how many resistant rats were there?', 'How many resistant rats were trapped for each one that was not resistant?'],
    given: 'resistant',
    other: 'not resistant',
    per: 'resistant rats for every one that was not',
    range: [60, 95],
    majority: true,
    why: 'Warfarin killed the rats without the allele for resistance, so the resistant ones survived to breed and came to outnumber the rest.',
  },
]

/** Majority ÷ minority: written as q13 (98% dark, 49). */
export const formRatio: Generator = {
  id: 'one-form-per-other',
  subjectId: 'biology',
  topicId: ADAPTATION,
  replaces: ['q13'],
  build(r, slot, turn) {
    const m = MAJORITIES[turn % MAJORITIES.length]!
    // A percentage whose ratio rounds clearly, is not the other percentage, and is not one of them.
    const options = memo(`one-form-per-other:${m.name}`, () =>
      range(...m.range).filter((p) => {
        const big = m.majority ? p : 100 - p
        const f = toThree(big / (100 - big))
        return fair(f) && clearOf(f.answer, p, 100 - p)
      }),
    )()
    const p = pick(r, options)
    const big = m.majority ? p : 100 - p
    const small = 100 - big
    const f = toThree(big / small)
    return numeric(
      slot,
      {
        prompt: `${m.says(p)} ${pick(r, m.asks)}`,
        solution:
          `If ${p} in every 100 were ${m.given}, ${100 - p} were ${m.other}. ` +
          (f.rounded
            ? `$${big} \\div ${small} = ${full(f.exact)}$, which is ${show(f.answer)} to 3 significant figures, so there were about ${show(f.answer)} ${m.per}. `
            : `$${big} \\div ${small} = ${show(f.answer)}$ ${m.per}. `) +
          m.why,
        method: [`${100 - p}% ${m.other}`],
        answer: f.answer,
        tolerance: figureTolerance(f),
        units: unitsOf(slot),
      },
      // Second route: the answer times the minority gives the majority back.
      { agrees: Math.abs(f.answer * small - big) <= small * figureTolerance(f) + 1e-9, detail: `${f.answer} × ${small} ≈ ${big}` },
      { context: m.name, p },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q24: the percentage of one form, from the count of the other
// ---------------------------------------------------------------------------------------------

interface Count {
  name: string
  says: (n: number, d: number) => string
  /** The form counted, then the one asked for. */
  counted: string
  asked: string
  /** "moths", "rats", in the working. */
  plural: string
  /** The form asked for, starting the working: "The pale moths". */
  group: string
  /** The asked form's share: lowest, highest. */
  share: readonly [number, number]
  /** Survey sizes: lowest, highest. */
  sizes: readonly [number, number]
  why: (other: number) => string
}
const COUNTS: Count[] = [
  {
    name: 'clean-air moths',
    says: (n, d) => `In a survey of a wood with clean air, ${n} peppered moths were recorded. ${d} of them were the dark form and the rest were pale. Calculate the percentage of the moths that were pale.`,
    counted: 'dark',
    asked: 'pale',
    plural: 'moths',
    group: 'The pale moths',
    share: [75, 98],
    sizes: [40, 400],
    why: (o) => `In a wood with clean air the lichen on the bark has returned, so the pale form is the hidden one and makes up the majority; only ${show(o)}% were dark.`,
  },
  {
    name: 'industrial moths',
    says: (n, d) =>
      `In a survey in the 1950s of a wood near an industrial town, where soot had blackened the bark, ${n} peppered moths were recorded. ${d} of them were the pale form and the rest were dark. Calculate the percentage of the moths that were dark.`,
    counted: 'pale',
    asked: 'dark',
    plural: 'moths',
    group: 'The dark moths',
    share: [75, 97],
    sizes: [40, 400],
    why: (o) => `Against blackened bark the dark form is the hidden one, so birds took more of the pale moths and the dark form made up the majority; only ${show(o)}% were pale.`,
  },
  {
    name: 'rats',
    says: (n, d) =>
      `On farms where warfarin had been used as a rat poison for many years, ${n} brown rats were trapped. Tests showed that ${d} of them were not resistant to warfarin and the rest were resistant. Calculate the percentage of the rats that were resistant.`,
    counted: 'not resistant',
    asked: 'resistant',
    plural: 'rats',
    group: 'The resistant rats',
    share: [55, 90],
    sizes: [40, 300],
    why: (o) => `Years of poisoning killed the rats without the allele for resistance, so the resistant ones survived to breed and now make up the majority; only ${show(o)}% were not resistant.`,
  },
]

interface Survey {
  n: number
  d: number
  m: number
  answer: number
}
/** A survey size that is not 10, 20, 25, 50, 100, 200, 250 or 500 (the percentage would be the count with the point moved, doubled or quartered). */
const plainSize = (n: number) => ![1, 2, 2.5, 5].some((k) => tenfold(n, k))
/** Every count whose other form's share is exact to 1 decimal place with three figures at most, and is not a count. */
const surveys = (c: Count): Survey[] =>
  range(...c.sizes).filter(plainSize).flatMap((n) =>
    range(1, n - 1)
      .map((d) => ({ n, d, m: n - d, answer: clean(((n - d) / n) * 100) }))
      .filter((x) => between(x.answer, c.share) && tidy(x.answer, 1) && clearOf(x.answer, x.n, x.d, x.m) && x.d >= 2),
  )

/** (n − d) ÷ n × 100: written as q24 (18 dark of 120 moths, 85% pale). */
export const formPercentage: Generator = {
  id: 'other-form-percentage',
  subjectId: 'biology',
  topicId: ADAPTATION,
  replaces: ['q24'],
  build(r, slot, turn) {
    const c = COUNTS[turn % COUNTS.length]!
    // The survey size and the answer both spread: the answer alone let one size fill 45% of a context.
    const x = balanced(r, `other-form-percentage:${c.name}`, () => surveys(c), (y) => y.answer, (y) => y.n)
    const other = clean(100 - x.answer)
    return numeric(
      slot,
      {
        prompt: c.says(x.n, x.d),
        solution:
          `${c.group} number $${x.n} - ${x.d} = ${x.m}$. As a percentage of all the ${c.plural} recorded, $\\dfrac{${x.m}}{${x.n}} \\times 100 = ${pc(x.answer)}$. ${c.why(other)}`,
        method: [`finds ${x.m} ${c.asked} ${c.plural} and divides by ${x.n}`],
        answer: x.answer,
        tolerance: halfLastPlace(x.answer),
        units: unitsOf(slot),
      },
      // Second route: 100 less the counted form's share.
      { agrees: near(100 - (x.d / x.n) * 100, x.answer), detail: `100 − ${x.d} ÷ ${x.n} × 100` },
      { context: c.name, n: x.n, d: x.d },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q25: how many times larger a small cube's surface area to volume ratio is
// ---------------------------------------------------------------------------------------------

interface Pair {
  name: string
  /** "desert animals", after "two". */
  group: string
  /** "animal", after "a small". */
  one: string
  /** Sides in cm the small cube and the large one may have, as the animals' sizes allow. */
  small: readonly [number, number]
  large: readonly [number, number]
  why: string
}
const PAIRS: Pair[] = [
  {
    name: 'desert',
    group: 'desert animals',
    one: 'animal',
    small: [1.5, 5],
    large: [5, 30],
    why: 'A small animal has more surface for each unit of volume, so it gains and loses heat faster relative to its size. That is why a small desert animal shelters in a burrow by day, and why desert animals that need to lose heat have features such as large ears that add surface.',
  },
  {
    name: 'Arctic',
    group: 'Arctic mammals',
    one: 'mammal',
    small: [2.5, 8],
    large: [10, 30],
    why: 'A small mammal has more surface for each unit of volume, so it loses heat faster relative to its size. That is why Arctic mammals that need to keep heat in tend to be large and compact, with small ears, thick fur and a layer of fat.',
  },
  {
    name: 'birds',
    group: 'birds in winter',
    one: 'bird',
    small: [1.5, 5],
    large: [4, 16],
    why: 'A small bird has more surface for each unit of volume, so it loses heat faster relative to its size on a cold night. That is why wrens, among the smallest British birds, huddle together in roosts in winter, which cuts the surface each one exposes.',
  },
]
/** Sides in cm whose ratio 6 ÷ side ends within three places; never 6, whose ratio is 1. */
const SIDES = [1.5, 2, 2.5, 3, 4, 5, 7.5, 8, 10, 12, 12.5, 15, 16, 20, 24, 25, 30]

interface Cubes {
  a: number
  b: number
  answer: number
}
/**
 * Pairs in the context's sizes whose answer is exact with three figures at most and is no side,
 * ratio or difference of sides, nor one doubled or halved, nor a power of ten (the sides would be
 * the same digits with the point moved).
 */
const cubes = (p: Pair): Cubes[] =>
  SIDES.filter((a) => between(a, p.small)).flatMap((a) =>
    SIDES.filter((b) => b > a && between(b, p.large))
      .map((b) => ({ a, b, answer: clean(b / a) }))
      .filter((x) => tidy(x.answer, 2) && !tenfold(x.a, x.b) && clearOf(x.answer, x.a, x.b, 6 / x.a, 6 / x.b) && !near(x.answer, x.b - x.a)),
  )

/** (6 ÷ a) ÷ (6 ÷ b): written as q25 (cubes of 2 cm and 6 cm, 3). */
export const cubeRatio: Generator = {
  id: 'cube-ratio-comparison',
  subjectId: 'biology',
  topicId: ADAPTATION,
  replaces: ['q25'],
  build(r, slot, turn) {
    const p = PAIRS[turn % PAIRS.length]!
    const x = layered(r, `cube-ratio-comparison:${p.name}`, () => cubes(p), (y) => y.a, (y) => y.b)
    const [sa, va, sb, vb] = [6 * x.a * x.a, x.a ** 3, 6 * x.b * x.b, x.b ** 3]
    const [ra, rb] = [clean(sa / va), clean(sb / vb)]
    return numeric(
      slot,
      {
        prompt:
          `A student models two ${p.group} as cubes to compare how easily they exchange heat with the air. A cube of side ${x.a} cm stands for a small ${p.one} and a cube of side ${x.b} cm for a larger one. ` +
          pick(r, [
            'Calculate how many times larger the surface area to volume ratio of the small cube is than that of the large cube. Give your answer as a single number.',
            'Calculate how many times smaller the surface area to volume ratio of the large cube is than that of the small cube. Give your answer as a single number.',
          ]),
        solution:
          'The surface area of a cube is $6 \\times \\text{side}^2$ and its volume is $\\text{side}^3$. ' +
          `Small cube: $6 \\times ${x.a} \\times ${x.a} = ${tex(sa)}\\ \\text{cm}^2$ and $${x.a} \\times ${x.a} \\times ${x.a} = ${tex(va)}\\ \\text{cm}^3$, so the ratio is $\\dfrac{${tex(sa)}}{${tex(va)}} = ${show(ra)}$. ` +
          `Large cube: $6 \\times ${x.b} \\times ${x.b} = ${tex(sb)}\\ \\text{cm}^2$ and $${x.b} \\times ${x.b} \\times ${x.b} = ${tex(vb)}\\ \\text{cm}^3$, so the ratio is $\\dfrac{${tex(sb)}}{${tex(vb)}} = ${show(rb)}$. ` +
          `The small cube's ratio is $\\dfrac{${show(ra)}}{${show(rb)}} = ${show(x.answer)}$ times larger. ${p.why}`,
        method: [`surface areas ${prose(sa)} and ${prose(sb)} cm² and volumes ${prose(va)} and ${prose(vb)} cm³`, `ratios ${show(ra)} and ${show(rb)}`],
        answer: x.answer,
        tolerance: halfLastPlace(x.answer),
        units: unitsOf(slot),
      },
      // Second route: for a cube the ratio is 6 ÷ side, so the comparison is the larger side ÷ the smaller.
      { agrees: near(ra / rb, x.b / x.a) && near(x.b / x.a, x.answer), detail: `${x.b} ÷ ${x.a}` },
      { context: p.name, a: x.a, b: x.b },
    )
  },
}

// =============================================================================================
// Selective breeding and genetic engineering
// =============================================================================================

// ---------------------------------------------------------------------------------------------
// q6: the percentage increase in a yield
// ---------------------------------------------------------------------------------------------

interface Yield {
  name: string
  says: (old: string, now: string) => string
  /** Starting yields: lowest, highest, step. */
  from: readonly [number, number, number]
  /** Percentage increases: lowest, highest. */
  rise: readonly [number, number]
  /** Decimal places the yields print with. */
  dp: number
}
const YIELDS: Yield[] = [
  {
    name: 'wheat',
    says: (a, b) => `A new variety of wheat, bred from the plants with the highest yields, raises the yield on a farm from ${a} to ${b} tonnes per hectare. What is the percentage increase?`,
    from: [5, 8.5, 0.1],
    rise: [5, 30],
    dp: 1,
  },
  {
    name: 'rice',
    says: (a, b) => `Growing a short-stemmed rice variety bred in the Green Revolution raised the yield of a farm from ${a} to ${b} tonnes per hectare. What is the percentage increase?`,
    from: [1.5, 3.5, 0.1],
    rise: [20, 90],
    dp: 1,
  },
  {
    name: 'milk',
    says: (a, b) => `Breeding from the cows with the highest milk yields raised the mean yield of a herd from ${a} to ${b} litres per cow per year. What is the percentage increase?`,
    from: [4000, 7000, 100],
    rise: [5, 40],
    dp: 0,
  },
  {
    name: 'eggs',
    says: (a, b) => `Breeding from the hens that lay the most eggs raised the mean number laid in a flock from ${a} to ${b} eggs per hen per year. What is the percentage increase?`,
    from: [150, 250, 1],
    rise: [5, 40],
    dp: 0,
  },
  {
    name: 'Bt cotton',
    says: (a, b) => `On one farm, growing Bt cotton, which is genetically modified to make its own insecticide, raised the yield from ${a} to ${b} kg of cotton per hectare. What is the percentage increase?`,
    from: [300, 800, 10],
    rise: [10, 40],
    dp: 0,
  },
]

interface Gain {
  a: number
  b: number
  d: number
  answer: number
}
/**
 * Every start, and every new yield on the same grid, whose percentage increase is in the context's
 * range and exact to 2 decimal places with three figures at most, and is not the increase or either
 * yield with the point moved, doubled or halved.
 */
const gains = (y: Yield): Gain[] =>
  range(...y.from).flatMap((a) =>
    range(clean(a + y.from[2]), clean(a * (1 + y.rise[1] / 100)), y.from[2] < 1 ? 0.1 : 1)
      .map((b) => ({ a, b, d: clean(b - a), answer: clean(((b - a) / a) * 100) }))
      .filter((x) => between(x.answer, y.rise) && tidy(x.answer, 2) && !powerOfTen(x.a) && shiftFree(x.answer, x.a, x.b, x.d) && distinct(x.a, x.b)),
  )

/** (new − old) ÷ old × 100: written as q6 (4.0 to 5.2 t/ha, 30%). */
export const yieldIncrease: Generator = {
  id: 'bred-yield-percentage-increase',
  subjectId: 'biology',
  topicId: BREEDING,
  replaces: ['q6'],
  build(r, slot, turn) {
    const y = YIELDS[turn % YIELDS.length]!
    const x = balanced(r, `bred-yield-percentage-increase:${y.name}`, () => gains(y), (g) => g.answer, (g) => g.a)
    const f = (v: number) => (y.dp ? fixed(v, y.dp) : String(v))
    return numeric(
      slot,
      {
        prompt: y.says(f(x.a), f(x.b)),
        solution: `The increase is $${f(x.b)} - ${f(x.a)} = ${f(x.d)}$. Then $(${f(x.d)} \\div ${f(x.a)}) \\times 100 = ${pc(x.answer)}$.`,
        method: [`finds the increase of ${f(x.d)}`, `divides by the original ${f(x.a)} and multiplies by 100`],
        answer: x.answer,
        tolerance: halfLastPlace(x.answer),
        units: unitsOf(slot),
      },
      // Second route: the new yield as a percentage of the old, less 100.
      { agrees: near((x.b / x.a) * 100 - 100, x.answer), detail: `${x.b} ÷ ${x.a} × 100 − 100` },
      { context: y.name, a: x.a, b: x.b },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q26: the mean gain per generation of a breeding programme
// ---------------------------------------------------------------------------------------------

interface Herd {
  name: string
  /** "dairy farmer", after "A". */
  farmer: string
  /** "herd", "flock". */
  group: string
  /** "cow", "goat", "ewe". */
  one: string
  /** "cows". */
  ones: string
  /** Starting mean yield, litres a year: lowest, highest, step. */
  start: readonly [number, number, number]
  /** Readings are given to this many litres. */
  grid: number
}
const HERDS: Herd[] = [
  { name: 'Holstein-Friesian cows', farmer: 'dairy farmer with Holstein-Friesian cows', group: 'herd', one: 'cow', ones: 'cows', start: [5500, 8000, 100], grid: 100 },
  { name: 'Jersey cows', farmer: 'dairy farmer with Jersey cows', group: 'herd', one: 'cow', ones: 'cows', start: [4000, 5500, 100], grid: 100 },
  { name: 'Saanen goats', farmer: 'goat farmer with Saanen dairy goats', group: 'herd', one: 'goat', ones: 'goats', start: [600, 1000, 10], grid: 10 },
  { name: 'East Friesian sheep', farmer: 'sheep farmer with East Friesian milking sheep', group: 'flock', one: 'ewe', ones: 'ewes', start: [300, 500, 10], grid: 10 },
]
const BRED = [3, 4, 6, 7, 8]
/** How far a cow's (goat's, ewe's) yield lies from the sample's mean, at most. */
const SPREAD = 0.12
const SAMPLED = [4, 5, 6, 8]

interface Programme {
  start: number
  g: number
  n: number
  answer: number
  mean: number
}
/**
 * A gain of 2 to 6% of the start a generation, whole litres; a sample size that differs from the
 * generations, so dividing by the wrong one is marked wrong; and a final mean the readings, on
 * their grid, can average to exactly, with room on the grid for that many different readings.
 */
const programmes = (h: Herd): Programme[] =>
  range(...h.start).flatMap((start) =>
    BRED.flatMap((g) =>
      SAMPLED.filter((n) => n !== g).flatMap((n) =>
        range(Math.ceil(start * 0.02), Math.floor(start * 0.06))
          .map((answer) => ({ start, g, n, answer, mean: start + g * answer }))
          .filter((x) => whole((x.n * x.mean) / h.grid) && 2 * Math.floor((x.mean * SPREAD) / h.grid) >= x.n + 2 && figures(x.answer) <= 3 && shiftFree(x.answer, x.start, x.mean) && distinct(x.answer, x.g, x.n)),
      ),
    ),
  )

/** n readings on the grid within 12% of the mean, distinct and not in order, that average to it exactly. */
function readings(r: Rng, h: Herd, n: number, mean: number): number[] {
  const room = Math.floor((mean * SPREAD) / h.grid)
  const base = Math.round(mean / h.grid) * h.grid
  return draw(
    r,
    () => {
      const xs = Array.from({ length: n - 1 }, () => base + h.grid * int(r, -room, room))
      return [...xs, n * mean - xs.reduce((s, x) => s + x, 0)]
    },
    (xs) => new Set(xs).size === n && xs.every((x) => Math.abs(x - mean) <= mean * SPREAD && whole(x / h.grid)) && !xs.every((x, i) => i === 0 || x > xs[i - 1]!),
  )
}

/** (mean of the sample − start) ÷ generations: written as q26 (6400 to a mean of 8000 over five generations, 320). */
export const herdGain: Generator = {
  id: 'breeding-gain-per-generation',
  subjectId: 'biology',
  topicId: BREEDING,
  replaces: ['q26'],
  build(r, slot, turn) {
    const h = HERDS[turn % HERDS.length]!
    // The sample size first, then the generations, then a gain and a start that fit: drawing the gain
    // first let the sample size that divides most cleanly fill 80% of a context.
    const x = layered(r, `breeding-gain-per-generation:${h.name}`, () => programmes(h), (y) => y.n, (y) => y.g, (y) => y.answer)
    const xs = readings(r, h, x.n, x.mean)
    const total = x.n * x.mean
    const rise = x.mean - x.start
    return numeric(
      slot,
      {
        prompt:
          `A ${h.farmer} starts a selective breeding programme with a ${h.group} whose mean milk yield is ${prose(x.start)} litres per ${h.one} per year. ` +
          `After ${word(x.g)} generations of breeding from the highest-yielding ${h.ones}, a sample of ${word(x.n)} ${h.ones} from the ${h.group} give yields of ${list(xs.map(prose))} litres per year. ` +
          `Using the mean yield of these ${word(x.n)} ${h.ones}, calculate the mean increase in milk yield per generation, in litres per year.`,
        solution:
          `Mean of the sample: $${xs.map(tex).join(' + ')} = ${tex(total)}$, and $${tex(total)} \\div ${x.n} = ${tex(x.mean)}$ litres per year.\n\n` +
          `Total increase: $${tex(x.mean)} - ${tex(x.start)} = ${tex(rise)}$ litres per year.\n\n` +
          `Increase per generation: $${tex(rise)} \\div ${x.g} = ${x.answer}$ litres per year.\n\n` +
          `Check: $${tex(x.start)} + ${x.g} \\times ${x.answer} = ${tex(x.mean)}$. Each round of choosing the highest-yielding ${h.ones} to breed from makes the alleles for high yield more common in the ${h.group}, which is why the mean rises generation after generation.`,
        method: [`mean of the ${word(x.n)} ${h.ones}: ${prose(total)} ÷ ${x.n} = ${prose(x.mean)}`, `divides the increase, ${prose(x.mean)} − ${prose(x.start)} = ${prose(rise)}, by the ${word(x.g)} generations`],
        answer: x.answer,
        units: unitsOf(slot),
      },
      // Second route: the readings' own total, less the start's share of it, over the sample and the generations.
      { agrees: near((xs.reduce((s, v) => s + v, 0) - x.n * x.start) / (x.n * x.g), x.answer), detail: `(Σ − ${x.n} × ${x.start}) ÷ (${x.n} × ${x.g})` },
      { context: h.name, start: x.start, g: x.g, n: x.n, answer: x.answer },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q27: the extra harvest from a Bt crop
// ---------------------------------------------------------------------------------------------

interface Crop {
  name: string
  /** "maize", after "ordinary". */
  crop: string
  /** The first time the prompt names it. */
  first: string
  /** "Bt maize, which contains a gene for insect resistance from *Bacillus thuringiensis*,". */
  bt: string
  /** What eats it. */
  pest: string
  /** Yield with no pest damage, t/ha: lowest, highest, step. */
  potential: readonly [number, number, number]
  /** Percentage lost by the ordinary crop, then the Bt crop. */
  ordinary: readonly [number, number]
  modified: readonly [number, number]
  /** Hectares: lowest, highest, step. */
  area: readonly [number, number, number]
  /** Decimal places the yield prints with: 8.0 tonnes. */
  dp: number
}
const CROPS: Crop[] = [
  {
    name: 'maize',
    crop: 'maize',
    first: 'maize',
    bt: 'Bt maize, which contains a gene for insect resistance from *Bacillus thuringiensis*,',
    pest: 'caterpillars of the corn borer moth',
    potential: [6, 12, 0.5],
    ordinary: [8, 25],
    modified: [1, 4],
    area: [15, 200, 5],
    dp: 1,
  },
  {
    name: 'cotton',
    crop: 'cotton',
    first: 'cotton',
    bt: 'Bt cotton, which contains a gene for insect resistance from *Bacillus thuringiensis*,',
    pest: 'bollworm caterpillars',
    potential: [1.5, 4, 0.1],
    ordinary: [15, 40],
    modified: [2, 8],
    area: [4, 80, 1],
    dp: 1,
  },
  {
    name: 'brinjal',
    crop: 'brinjal',
    first: 'brinjal (aubergine)',
    bt: 'Bt brinjal, which contains a gene for insect resistance from *Bacillus thuringiensis*,',
    pest: 'caterpillars of the fruit and shoot borer',
    potential: [20, 40, 1],
    ordinary: [25, 50],
    modified: [2, 6],
    area: [0.5, 4, 0.5],
    dp: 0,
  },
]

interface Harvest {
  y: number
  p1: number
  p2: number
  a: number
  per: number
  answer: number
}

/** a × y × (p1 − p2) ÷ 100: written as q27 (50 ha, 8.0 t/ha, 15% against 2%, 52 tonnes). */
export const btHarvest: Generator = {
  id: 'bt-crop-extra-harvest',
  subjectId: 'biology',
  topicId: BREEDING,
  replaces: ['q27'],
  build(r, slot, turn) {
    const c = CROPS[turn % CROPS.length]!
    // An answer exact with three figures at most, not the extra per hectare with the point moved
    // (an area of 10 or 100 hectares, or a gap of 10 points), and no two givens alike.
    const x: Harvest = draw(
      r,
      (q) => {
        const y = pick(q, range(...c.potential))
        const p1 = int(q, ...c.ordinary)
        const p2 = int(q, ...c.modified)
        const a = pick(q, range(...c.area))
        const per = clean((y * (p1 - p2)) / 100)
        return { y, p1, p2, a, per, answer: clean(a * per) }
      },
      (h) =>
        tidy(h.answer, 2) &&
        h.answer >= 1 &&
        noOnes(h.a) &&
        !powerOfTen(h.a) &&
        distinct(h.y, h.p1, h.p2, h.a) &&
        h.p1 - h.p2 !== h.p2 &&
        !powerOfTen(h.p1 - h.p2) &&
        shiftFree(h.answer, h.per, h.y, h.a, h.p1, h.p2) &&
        !near(h.answer, h.a * h.y * (1 - h.p1 / 100)) &&
        !near(h.answer, h.a * h.y * (1 - h.p2 / 100)),
    )
    const keep1 = clean(x.y * (1 - x.p1 / 100))
    const keep2 = clean(x.y * (1 - x.p2 / 100))
    const yt = fixed(x.y, c.dp)
    const total1 = clean(keep1 * x.a)
    const total2 = clean(keep2 * x.a)
    const ha = x.a === 1 ? 'hectare' : 'hectares'
    return numeric(
      slot,
      {
        prompt:
          `A farmer grows ${c.first} on ${show(x.a)} ${ha}. Without any pest damage, the crop would yield ${yt} tonnes per hectare. Ordinary ${c.crop} loses ${x.p1}% of this yield to ${c.pest}, while ${c.bt} loses only ${x.p2}%. ` +
          `Calculate how many more tonnes the farmer would harvest from the whole ${show(x.a)} ${ha} by growing the Bt crop instead of ordinary ${c.crop}.`,
        solution:
          `Harvest per hectare: the ordinary crop keeps ${100 - x.p1}%, so $${yt} \\times ${show((100 - x.p1) / 100)} = ${show(keep1)}$ tonnes; the Bt crop keeps ${100 - x.p2}%, so $${yt} \\times ${show((100 - x.p2) / 100)} = ${show(keep2)}$ tonnes.\n\n` +
          `Difference per hectare: $${show(keep2)} - ${show(keep1)} = ${show(x.per)}$ tonnes. (Or directly: the Bt crop loses $${x.p1} - ${x.p2} = ${x.p1 - x.p2}$ percentage points less, and ${x.p1 - x.p2}% of ${yt} is ${show(x.per)} tonnes.)\n\n` +
          `Whole farm: $${show(x.per)} \\times ${show(x.a)} = ${show(x.answer)}$ tonnes.\n\n` +
          `Check: the ordinary crop gives $${show(keep1)} \\times ${show(x.a)} = ${show(total1)}$ tonnes, the Bt crop $${show(keep2)} \\times ${show(x.a)} = ${show(total2)}$ tonnes, and $${show(total2)} - ${show(total1)} = ${show(x.answer)}$. ` +
          'This is the main advantage claimed for Bt crops: less of the yield is lost to insect pests, and less insecticide needs to be sprayed.',
        method: [
          `finds the harvest per hectare of each (${show(keep1)} t and ${show(keep2)} t), or ${x.p1 - x.p2}% of ${yt} = ${show(x.per)} t; any valid route`,
          `multiplies the difference per hectare by ${show(x.a)}, or finds each total for ${show(x.a)} ${ha} and subtracts`,
        ],
        answer: x.answer,
        tolerance: halfLastPlace(x.answer),
        units: unitsOf(slot),
      },
      // Second route: the two farm totals subtracted.
      { agrees: near(total2 - total1, x.answer), detail: `${total2} − ${total1}` },
      { context: c.name, y: x.y, p1: x.p1, p2: x.p2, a: x.a },
    )
  },
}

export const evolutionGenerators: Generator[] = [
  resistantCount,
  resistantGrowth,
  resistanceTable,
  leafMeans,
  selectionPoints,
  fossilGenerations,
  toolDate,
  formRatio,
  formPercentage,
  cubeRatio,
  yieldIncrease,
  herdGain,
  btHarvest,
]

/** For the tests. */
export const EVOLUTION = { CARRIERS, BUGS, SURVIVORS, DOUBLINGS, TESTED, COMPARED, TREES, SELECTIONS, LINES, FINDS, MAJORITIES, COUNTS, PAIRS, SIDES, YIELDS, HERDS, BRED, SAMPLED, CROPS }
