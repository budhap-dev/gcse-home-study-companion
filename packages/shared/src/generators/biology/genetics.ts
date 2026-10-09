import { show } from '../format.ts'
import { cap, closes, figures, numeric, prose, tex } from '../physics/build.ts'
import { clearOf, distinct, evenly, noOnes, powerOfTen, range } from '../chemistry/build.ts'
import { draw, int, pick } from '../random.ts'
import type { Generator } from '../types.ts'
import { balanced, ending, figureTolerance, gcd, memo, toThree, unitsOf, WithArticle as A, withArticle as a } from './build.ts'
import { ANIMALS, duration, PLANTS } from './microscopy.ts'

/**
 * Genetics (AQA 8461, 4.6.1.1 to 4.6.1.8): DNA and its bases, the triplet code, meiosis and
 * fertilisation, asexual reproduction, monohybrid crosses, family trees, inherited disorders and
 * the ABO blood groups. The numeric written slots of "The genetic code: DNA, chromosomes and
 * genes", "DNA, genes and protein synthesis", "Genetic disorders and screening", "Inheritance and
 * genetic diagrams" and "Meiosis and sexual reproduction" have a generator here, except six left
 * written: three ask a fact to recall (23 pairs, 3 bases, 4 daughter cells), one is the same 50%
 * every time (the chance of a girl), and two have too few real versions to vary (a blood group
 * unlike both parents' comes from only ten pairs of parents; a hybrid's chromosome number from
 * only a dozen real hybrids whose parents' numbers differ).
 *
 * Every figure is one the thing really has. A base makes up 13 to 37% of a DNA sample (GC content
 * runs from about 25% to 75% across living things), never 25%, which would make all four equal.
 * Bacterial plasmids are 2 to 60 kb and their antibiotic-resistance genes 0.6 to 1.5 kb; DNA
 * viruses that infect bacteria carry 30 to 170 kb and genes of 0.4 to 3 kb; a gene on a human
 * chromosome is 1 to 30 kb. A polypeptide has 100 to 800 amino acids, and the non-coding DNA where
 * RNA polymerase binds in front of a gene is 40 to 400 base pairs. Crosses are Mendel's: 3 : 1,
 * 1 : 2 : 1 and 1 : 1, with the traits really dominant (a pea's tall stem, purple flower and green
 * pod, a guinea pig's black fur). Cystic fibrosis is recessive and polydactyly dominant, both on
 * an autosome; haemophilia, red-green colour blindness and Duchenne muscular dystrophy are
 * X-linked recessive, and no man with Duchenne muscular dystrophy is a father here. Chromosome
 * numbers are each species' own (microscopy.ts holds them), and bacteria divide every 15 to 40
 * minutes.
 *
 * A choice the student makes is drawn so a lazy rule pays about half the time: the recessive or
 * the dominant phenotype, a recessive or a dominant family, a woman who is a carrier or is not,
 * a boy or a girl.
 */
const DNA = 'dna-chromosomes-and-genes'
const PROTEIN = 'dna-genes-and-protein-synthesis'
const DISORDERS = 'genetic-disorders-and-screening'
const INHERITANCE = 'inheritance-and-genetic-diagrams'
const MEIOSIS = 'meiosis-and-sexual-reproduction'

/** k boxes out of n, as a percentage: 1 in 4 is 25. */
const percent = (k: number, n: number) => (k / n) * 100

// =============================================================================================
// Bases: A pairs with T, C with G
// =============================================================================================

export type Base = 'A' | 'T' | 'C' | 'G'
export const BASES: Base[] = ['A', 'T', 'C', 'G']
const BASE_NAME: Record<Base, string> = { A: 'adenine', T: 'thymine', C: 'cytosine', G: 'guanine' }
export const PARTNER: Record<Base, Base> = { A: 'T', T: 'A', C: 'G', G: 'C' }
/** The other pair: for A or T, C and G; for C or G, A and T. */
export const otherPair = (b: Base): [Base, Base] => (b === 'A' || b === 'T' ? ['C', 'G'] : ['A', 'T'])
const named = (b: Base) => `${BASE_NAME[b]} (${b})`
/**
 * One base's share of the bases, %. GC content runs from about 25% to 75% across living things,
 * so each base is 13 to 37%; never 25%, where all four are equal and a student who assumes so
 * is marked right.
 */
export const SHARES = range(13, 37).filter((p) => p !== 25)

const PARTNER_PROMPTS = [
  (p: number, x: Base, y: Base) => `A sample of DNA is ${p}% ${x}. What percentage of its bases are ${y}?`,
  (p: number, x: Base, y: Base) => `In a sample of double-stranded DNA, ${p}% of the bases are ${named(x)}. What percentage of the bases are ${named(y)}?`,
  (p: number, x: Base, y: Base) => `Of the bases in a DNA molecule, ${p}% are ${x}. What percentage of its bases are ${y}?`,
]

/** The partner's share is the same: written as DNA q6 (24% T, so 24% A). */
export const partnerBase: Generator = {
  id: 'dna-partner-base-percentage',
  subjectId: 'biology',
  topicId: DNA,
  replaces: ['q6'],
  build(r, slot, turn) {
    const x = BASES[turn % BASES.length]!
    const y = PARTNER[x]
    const [o1, o2] = otherPair(x)
    const p = pick(r, SHARES)
    const rest = 100 - 2 * p
    return numeric(
      slot,
      {
        prompt: pick(r, PARTNER_PROMPTS)(p, x, y),
        solution: `${x} pairs with ${y}, so the amounts are equal: **${p}%** ${y}. The other $100 - ${p} - ${p} = ${rest}\\%$ is ${o1} and ${o2}, ${rest / 2}% each.`,
        method: [`${y} pairs with ${x}, so equals it`],
        answer: p,
        units: unitsOf(slot),
      },
      // Second route: what is left after the other pair, halved.
      { agrees: (100 - rest) / 2 === p, detail: `(100 − ${rest}) ÷ 2 = ${(100 - rest) / 2}` },
      { context: x, given: p, asked: y },
    )
  },
}

const OTHER_SHORT = [
  (p: number, x: Base, z: Base) => `A sample of DNA is ${p}% ${x}. What percentage of its bases are ${z}?`,
  (p: number, x: Base, z: Base) => `Of the bases in a DNA molecule, ${p}% are ${x}. What percentage of its bases are ${z}?`,
  (p: number, x: Base, z: Base) => `In a sample of double-stranded DNA, ${p}% of the bases are ${named(x)}. What percentage of the bases are ${named(z)}?`,
]
const RULE = 'In DNA, adenine (A) pairs with thymine (T), and cytosine (C) pairs with guanine (G).'
const OTHER_LONG = [
  (p: number, x: Base, z: Base) => `In a sample of double-stranded DNA, ${p}% of all the bases are ${named(x)}. ${RULE} Calculate the percentage of the bases in the sample that are ${named(z)}.`,
  (p: number, x: Base, z: Base) => `A sample of DNA is analysed, and ${p}% of all its bases are ${named(x)}. ${RULE} Calculate the percentage of its bases that are ${named(z)}.`,
]

/** (100 − 2 × share) ÷ 2: written as DNA q11 (24% T, so 26% G) and protein q26 (30% A, so 20% G). */
function otherPairShare(id: string, topicId: string, slotId: string, long: boolean): Generator {
  return {
    id,
    subjectId: 'biology',
    topicId,
    replaces: [slotId],
    build(r, slot, turn) {
      const x = BASES[turn % BASES.length]!
      const y = PARTNER[x]
      const [o1, o2] = otherPair(x)
      const z = pick(r, [o1, o2])
      // The answer evenly: SHARES is symmetric about 25, so 50 − p runs over it too.
      const ans = pick(r, SHARES)
      const p = 50 - ans
      const pair = 2 * p
      const rest = 100 - pair
      const n = (b: Base) => (long ? BASE_NAME[b] : b)
      return numeric(
        slot,
        {
          prompt: pick(r, long ? OTHER_LONG : OTHER_SHORT)(p, x, z),
          solution:
            `${cap(n(x))} pairs with ${n(y)}, so ${n(y)} is also **${p}%**, and the two together are $${p} + ${p} = ${pair}\\%$. ` +
            `The remaining $100 - ${pair} = ${rest}\\%$ is ${n(o1)} and ${n(o2)}, which pair with each other, so they are equal: $${rest} \\div 2 = ${ans}\\%$ ${n(z)}. ` +
            `Check: $${p} + ${p} + ${ans} + ${ans} = 100$.`,
          method: [long ? `uses complementary pairing: ${n(y)} is also ${p}%, so ${n(o1)} and ${n(o2)} together are ${rest}%` : `${x} + ${y} = ${pair}%`],
          answer: ans,
          units: unitsOf(slot),
        },
        // Second route: the four shares add to 100.
        { agrees: p + p + ans + ans === 100, detail: `${p} + ${p} + ${ans} + ${ans} = ${p + p + ans + ans}` },
        { context: x, given: p, asked: z },
      )
    },
  }
}
export const otherPairDna = otherPairShare('dna-other-pair-percentage', DNA, 'q11', false)
export const otherPairProtein = otherPairShare('protein-other-pair-percentage', PROTEIN, 'q26', true)

// ---------------------------------------------------------------------------------------------
// DNA q24: a gene's share of the molecule it sits on
// ---------------------------------------------------------------------------------------------

export interface Stretch {
  name: string
  /** Gene lengths and molecule lengths in base pairs. */
  genes: number[]
  lengths: number[]
  text: (g: string, L: string) => string
  /** The sentence after the working. */
  close: string
}
export const STRETCHES: Stretch[] = [
  {
    name: 'plasmid',
    genes: range(600, 1500, 10),
    lengths: range(2000, 60000, 500),
    text: (g, L) =>
      `A bacterial plasmid is a small ring of DNA. One plasmid is ${L} base pairs long and carries a gene for antibiotic resistance that is ${g} base pairs long. Calculate the percentage of the plasmid's base pairs that this gene takes up.`,
    close: 'The rest of the plasmid holds its other genes and the DNA it needs to be copied.',
  },
  {
    name: 'virus',
    genes: range(400, 3000, 10),
    lengths: range(30000, 170000, 1000),
    text: (g, L) =>
      `The DNA of a virus that infects bacteria is one molecule ${L} base pairs long. One of its genes is ${g} base pairs long. Calculate the percentage of the molecule's base pairs that this gene takes up.`,
    close: "A virus's DNA carries dozens of genes, packed close together, so each takes only a small share.",
  },
  {
    name: 'chromosome',
    genes: range(1000, 30000, 100),
    lengths: range(20000, 400000, 5000),
    text: (g, L) =>
      `A section of DNA cut from a human chromosome is ${L} base pairs long. It contains one gene, which is ${g} base pairs long. Calculate the percentage of the section's base pairs that the gene takes up.`,
    close: 'A chromosome carries many genes, with long stretches between them that are not genes at all, which is why one chromosome can hold hundreds of them.',
  },
]
interface Share {
  g: number
  L: number
  f: ReturnType<typeof toThree>
}
const sharesOf = (s: Stretch): Share[] =>
  s.genes.flatMap((g) =>
    s.lengths
      .map((L) => ({ g, L, f: toThree((100 * g) / L) }))
      // Exact, as the written 3% is: an answer that ends within three figures, so no rounding to argue over.
      .filter((x) => !x.f.rounded && x.f.exact >= 0.5 && x.f.exact <= 40 && clearOf(x.f.answer, x.g, x.L) && noOnes(x.f.answer) && !powerOfTen(x.L / x.g)),
  )

/** gene ÷ molecule × 100: written as DNA q24 (1200 of 40 000 base pairs, 3%). */
export const geneShare: Generator = {
  id: 'gene-percentage-of-a-dna-molecule',
  subjectId: 'biology',
  topicId: DNA,
  replaces: ['q24'],
  build(r, slot, turn) {
    const s = STRETCHES[turn % STRETCHES.length]!
    // Gene, molecule and answer each spread: the lengths that divide cleanly would fill a context.
    const x = balanced(r, `genetics:gene-share:${s.name}`, () => sharesOf(s), (y) => y.g, (y) => y.L, (y) => y.f.answer)
    const tol = figureTolerance(x.f)
    return numeric(
      slot,
      {
        prompt: s.text(prose(x.g), prose(x.L)),
        solution: `$\\dfrac{${tex(x.g)}}{${tex(x.L)}} \\times 100 ${ending(x.f, '%')}. One gene is a small fraction of the whole molecule. ${s.close}`,
        method: [`divides ${prose(x.g)} by ${prose(x.L)} and multiplies by 100`],
        answer: x.f.answer,
        tolerance: tol,
        units: unitsOf(slot),
      },
      // Second route: that share of the molecule gives the gene back, to the rounding.
      { agrees: Math.abs((x.f.answer / 100) * x.L - x.g) <= (tol * x.L) / 100 + 1e-9, detail: `${show(x.f.answer)}% of ${x.L} = ${show((x.f.answer / 100) * x.L)}` },
      { context: s.name, gene: x.g, length: x.L, share: x.f.answer },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// DNA q25: the number of one base from the base pairs and another base's share
// ---------------------------------------------------------------------------------------------

export interface Molecule {
  name: string
  /** Base pairs. */
  pairs: number[]
  text: (n: string, p: number, x: Base, z: Base) => string
}
export const MOLECULES: Molecule[] = [
  {
    name: 'plasmid',
    pairs: range(2000, 60000, 500),
    text: (n, p, x, z) => `A bacterial plasmid is a ring of double-stranded DNA ${n} base pairs long. Of all its bases, ${p}% are ${x}. Calculate the number of ${z} bases in the plasmid.`,
  },
  {
    name: 'virus',
    pairs: range(30000, 170000, 1000),
    text: (n, p, x, z) => `The DNA of a virus is one double-stranded molecule ${n} base pairs long, and ${p}% of all its bases are ${x}. Calculate the number of ${z} bases in the molecule.`,
  },
  {
    name: 'section',
    pairs: range(10000, 200000, 1000),
    text: (n, p, x, z) => `A section of DNA cut from a chromosome contains ${n} base pairs. Of all its bases, ${p}% are ${x}. Calculate the number of ${z} bases in the section.`,
  },
]
interface Count {
  N: number
  p: number
  /** Bases of the given one, and of its partner. */
  given: number
  answer: number
}
const countsOf = (m: Molecule): Count[] =>
  m.pairs.flatMap((N) =>
    SHARES.map((p) => ({ N, p, given: (N * p) / 50, answer: (N * (50 - p)) / 50 })).filter(
      (x) => Number.isInteger(x.given) && Number.isInteger(x.answer) && figures(x.answer) <= 3 && figures(x.N) <= 3 && clearOf(x.answer, x.N, x.p, x.given),
    ),
  )

/** 2N bases, less the given pair, halved: written as DNA q25 (20 000 base pairs, 30% A, 8000 G). */
export const baseCount: Generator = {
  id: 'dna-base-count-from-base-pairs',
  subjectId: 'biology',
  topicId: DNA,
  replaces: ['q25'],
  build(r, slot, turn) {
    const m = MOLECULES[turn % MOLECULES.length]!
    const x = balanced(r, `genetics:base-count:${m.name}`, () => countsOf(m), (y) => y.N, (y) => y.p, (y) => y.answer)
    const b = pick(r, BASES)
    const y = PARTNER[b]
    const [o1, o2] = otherPair(b)
    const z = pick(r, [o1, o2])
    const bases = 2 * x.N
    const pair = 2 * x.given
    const rest = bases - pair
    return numeric(
      slot,
      {
        prompt: m.text(prose(x.N), x.p, b, z),
        solution:
          `${prose(x.N)} base **pairs** is $2 \\times ${tex(x.N)} = ${tex(bases)}$ bases. ` +
          `${b} pairs with ${y}, so ${b} and ${y} are equal: ${x.p}% of ${prose(bases)} is ${prose(x.given)} ${b} and ${prose(x.given)} ${y}, which is ${prose(pair)} together. ` +
          `The remaining $${tex(bases)} - ${tex(pair)} = ${tex(rest)}$ bases are ${o1} and ${o2}, and ${o1} pairs with ${o2}, so they are equal: ` +
          closes(`\\dfrac{${tex(rest)}}{2}`, x.answer, `${z} bases`) +
          ` Using ${prose(x.N)} as the number of bases halves every count, which is the commonest slip: a base pair is two bases.`,
        method: [`doubles the base pairs to ${prose(bases)} bases`, `${b} = ${y} = ${prose(x.given)}, so ${o1} and ${o2} share the remaining ${prose(rest)}`],
        answer: x.answer,
        line: show(x.answer),
        units: unitsOf(slot),
      },
      // Second route: the four counts add up to every base in the molecule.
      { agrees: 2 * x.given + 2 * x.answer === bases && Math.abs((x.answer / bases) * 100 - (50 - x.p)) < 1e-9, detail: `${x.given} × 2 + ${x.answer} × 2 = ${2 * x.given + 2 * x.answer}` },
      { context: m.name, N: x.N, p: x.p, answer: x.answer },
    )
  },
}

// =============================================================================================
// The triplet code: protein q6 and q27
// =============================================================================================

export interface Coding {
  name: string
  /** Amino acids. */
  acids: number[]
  texts: ((b: string) => string)[]
}
export const CODINGS: Coding[] = [
  {
    name: 'section',
    acids: range(8, 99),
    texts: [(b) => `A section of DNA is ${b} bases long. How many amino acids does it code for?`, (b) => `A section of one strand of DNA has ${b} bases. How many amino acids does this section code for?`],
  },
  {
    name: 'gene',
    acids: range(100, 800),
    texts: [
      (b) => `The coding DNA of a gene is ${b} bases long, counting one strand. Every triplet in it codes for one amino acid. How many amino acids are in the protein made from this gene?`,
      (b) => `Along the strand that is read, the coding part of a gene has ${b} bases. If every triplet codes for one amino acid, how many amino acids does the gene code for?`,
    ],
  },
  {
    name: 'mRNA',
    acids: range(50, 600),
    texts: [
      (b) => `An mRNA molecule made from a gene carries a coding sequence ${b} bases long. If every triplet in it codes for one amino acid, how many amino acids are joined to make the polypeptide?`,
      (b) => `The coding sequence of an mRNA molecule is ${b} bases long. Every triplet in it codes for one amino acid. How many amino acids does it code for?`,
    ],
  },
]

/** Bases ÷ 3: written as protein q6 (45 bases, 15 amino acids). */
export const tripletCount: Generator = {
  id: 'amino-acids-from-bases',
  subjectId: 'biology',
  topicId: PROTEIN,
  replaces: ['q6'],
  build(r, slot, turn) {
    const c = CODINGS[turn % CODINGS.length]!
    const n = pick(r, c.acids)
    const b = 3 * n
    return numeric(
      slot,
      {
        prompt: pick(r, c.texts)(prose(b)),
        solution: `Three bases, a triplet, code for one amino acid: $${b} \\div 3 = ${n}$ amino acids.`,
        method: [`divides ${b} by 3`],
        answer: n,
        units: unitsOf(slot),
      },
      { agrees: n * 3 === b, detail: `${n} × 3 = ${n * 3}` },
      { context: c.name, bases: b, acids: n },
    )
  },
}

const GENE_PROMPTS = [
  (T: number, n: number) =>
    `A section of DNA contains ${prose(T)} bases in total, counting both of its strands. Along its length, the first ${n} base pairs are non-coding DNA located in front of a gene, where RNA polymerase binds; all the remaining base pairs are the coding DNA of that gene. Three bases code for one amino acid. Assume every triplet in the coding DNA codes for one amino acid. Calculate the number of amino acids in the polypeptide made from this gene.`,
  (T: number, n: number) =>
    `A length of double-stranded DNA has ${prose(T)} bases altogether, counting both strands. At one end, ${n} base pairs of non-coding DNA lie in front of a gene: this is where RNA polymerase binds. The rest of the base pairs are the coding DNA of the gene. Three bases code for one amino acid, and every triplet of the coding DNA codes for one. Calculate the number of amino acids in the polypeptide made from this gene.`,
]

/** (T ÷ 2 − non-coding) ÷ 3: written as protein q27 (2280 bases, 90 non-coding base pairs, 350 amino acids). */
export const polypeptideLength: Generator = {
  id: 'amino-acids-from-a-gene-with-non-coding-dna',
  subjectId: 'biology',
  topicId: PROTEIN,
  replaces: ['q27'],
  build(r, slot, turn) {
    // Both drawn evenly and independently, so neither can fill the other's range.
    const { acids, n } = draw(
      r,
      (q) => ({ acids: int(q, 100, 800), n: int(q, 40, 400) }),
      (v) => distinct(v.acids, v.n, 2 * (v.n + 3 * v.acids), v.n + 3 * v.acids, 3 * v.acids) && clearOf(v.acids, v.n, 2 * (v.n + 3 * v.acids), v.n + 3 * v.acids),
    )
    const coding = 3 * acids
    const pairs = n + coding
    const T = 2 * pairs
    return numeric(
      slot,
      {
        prompt: GENE_PROMPTS[turn % GENE_PROMPTS.length]!(T, n),
        solution:
          `Each base on one strand is paired with a base on the other, so the section is $${T} \\div 2 = ${pairs}$ base pairs long.\n\n` +
          `The first ${n} base pairs are non-coding DNA, where RNA polymerase binds; they are not read into amino acids. That leaves $${pairs} - ${n} = ${coding}$ bases of coding DNA along the strand that is read.\n\n` +
          `Three bases code for one amino acid: $${coding} \\div 3 = ${acids}$ amino acids.\n\n` +
          `Check backwards: $${acids} \\times 3 = ${coding}$; $${coding} + ${n} = ${pairs}$; $${pairs} \\times 2 = ${T}$. Forgetting to halve would give more than twice the true number, because the mRNA is made from the coding DNA of one strand only.`,
        method: [`halves the total to get ${pairs} base pairs, the length of one strand`, `subtracts the ${n} non-coding base pairs and divides the ${coding} by 3`],
        answer: acids,
        units: unitsOf(slot),
        line: String(acids),
      },
      // Second route: build the section back up from the answer.
      { agrees: 2 * (acids * 3 + n) === T, detail: `2 × (${acids} × 3 + ${n}) = ${2 * (acids * 3 + n)}` },
      { context: `prompt ${turn % GENE_PROMPTS.length}`, total: T, nonCoding: n, acids },
    )
  },
}

// =============================================================================================
// The ABO blood groups: disorders q5 and q20
// =============================================================================================

const ABO_ORDER = 'ABO'
/** Two alleles as a genotype in the usual order: O and A make AO. */
export const aboGenotype = (x: string, y: string) => [x, y].sort((p, q) => ABO_ORDER.indexOf(p) - ABO_ORDER.indexOf(q)).join('')
/** A and B are codominant and O recessive to both. */
export const bloodGroup = (g: string) => (g === 'OO' ? 'O' : g.includes('A') && g.includes('B') ? 'AB' : g.includes('A') ? 'A' : 'B')
const ABO_GENOTYPES = ['AA', 'AO', 'BB', 'BO', 'AB', 'OO']
/** The Punnett square's four boxes, row by row: rows are the first parent's gametes. */
export const aboSquare = (p1: string, p2: string) => [p1[0]!, p1[1]!].flatMap((x) => [p2[0]!, p2[1]!].map((y) => aboGenotype(x, y)))

interface AboCross {
  p1: string
  p2: string
  kind: 'group' | 'genotype'
  target: string
  answer: number
}
/** Every pair of parents (not two identical homozygotes) and every group or genotype a child of theirs may have. */
const aboCrosses = memo('genetics:abo', (): AboCross[] =>
  ABO_GENOTYPES.flatMap((p1) =>
    ABO_GENOTYPES.filter((p2) => p1 !== p2 || p1[0] !== p1[1]).flatMap((p2) => {
      const boxes = aboSquare(p1, p2)
      const groups = ['A', 'B', 'AB', 'O'].map((t) => ({ p1, p2, kind: 'group' as const, target: t, answer: percent(boxes.filter((b) => bloodGroup(b) === t).length, 4) }))
      // A genotype that is not its group's only one: AB is group AB, so it is asked as a group.
      const genotypes = ['AA', 'AO', 'BB', 'BO', 'OO'].map((t) => ({ p1, p2, kind: 'genotype' as const, target: t, answer: percent(boxes.filter((b) => b === t).length, 4) }))
      return [...groups, ...genotypes].filter((c) => c.answer > 0)
    }),
  ),
)

const asked = (c: AboCross) => (c.kind === 'group' ? `blood group ${c.target}` : `genotype ${c.target}`)
const ABO_PROMPTS: Record<string, ((c: AboCross) => string)[]> = {
  q5: [
    (c) => `Parents with genotypes ${c.p1} and ${c.p2} have a child. What is the percentage chance the child has ${asked(c)}?`,
    (c) => `A mother with genotype ${c.p1} and a father with genotype ${c.p2} have a child. What is the percentage chance that the child has ${asked(c)}?`,
  ],
  q20: [
    (c) =>
      `In the ABO blood group system, A and B are codominant and O is recessive to both. A parent with genotype ${c.p1} has a child with a parent whose genotype is ${c.p2}. What is the percentage chance that the child has ${asked(c)}?`,
    (c) =>
      `In the ABO blood group system, the alleles A and B are codominant and O is recessive to both. A woman with genotype ${c.p1} and a man with genotype ${c.p2} have a child. What is the percentage chance that the child has ${asked(c)}?`,
  ],
}

/** A square of two parents' gametes, as a Markdown table. */
const table = (top: string[], side: string[], cells: string[]) =>
  `| | ${top.join(' | ')} |\n| --- | ${top.map(() => '---').join(' | ')} |\n${side.map((s, i) => `| ${s} | ${cells.slice(i * top.length, (i + 1) * top.length).join(' | ')} |`).join('\n')}`

const gives = (g: string) => (g[0] === g[1] ? `can only give **${g[0]}**` : `gives **${g[0]}** or **${g[1]}**`)

/** Boxes ÷ 4: written as disorders q5 (AO × BO, 25% AB) and q20 (AB × OO, 50% A). */
export const aboChance: Generator = {
  id: 'abo-blood-group-chance',
  subjectId: 'biology',
  topicId: DISORDERS,
  replaces: ['q5', 'q20'],
  build(r, slot, turn) {
    const kind = turn % 2 === 0 ? 'group' : 'genotype'
    // Each answer (25, 50, 75, 100) as likely, then the parents and the target.
    const c = balanced(r, `genetics:abo:${kind}`, () => aboCrosses().filter((x) => x.kind === kind), (x) => x.p1, (x) => x.answer)
    const boxes = aboSquare(c.p1, c.p2)
    const k = boxes.filter((b) => (c.kind === 'group' ? bloodGroup(b) === c.target : b === c.target)).length
    const read = boxes.map((b) => `${b} → **${bloodGroup(b)}**`).join(', ')
    // Second route: the chance from each parent's alleles, multiplied, never the boxes.
    const pa = (g: string, x: string) => [...g].filter((y) => y === x).length / 2
    const chanceOf = (g: string) => (g[0] === g[1] ? pa(c.p1, g[0]!) * pa(c.p2, g[0]!) : pa(c.p1, g[0]!) * pa(c.p2, g[1]!) + pa(c.p1, g[1]!) * pa(c.p2, g[0]!))
    const wanted = c.kind === 'group' ? ['AA', 'AO', 'BB', 'BO', 'AB', 'OO'].filter((g) => bloodGroup(g) === c.target) : [c.target]
    const second = 100 * wanted.reduce((s, g) => s + chanceOf(g), 0)
    const prompts = ABO_PROMPTS[slot.id] ?? ABO_PROMPTS.q5!
    return numeric(
      slot,
      {
        prompt: pick(r, prompts)(c),
        solution:
          `The ${c.p1} parent ${gives(c.p1)}; the ${c.p2} parent ${gives(c.p2)}.\n\n${table([c.p2[0]!, c.p2[1]!], [c.p1[0]!, c.p1[1]!], boxes)}\n\n` +
          `As blood groups: ${read}.\n\n` +
          (c.kind === 'group'
            ? `Group ${c.target} is ${k} box${k === 1 ? '' : 'es'} in 4: $${k} \\div 4 \\times 100 = ${c.answer}\\%$.`
            : `Genotype ${c.target} is ${k} box${k === 1 ? '' : 'es'} in 4: $${k} \\div 4 \\times 100 = ${c.answer}\\%$.`),
        method: [`offspring ${boxes.join(', ')}`],
        answer: c.answer,
        units: unitsOf(slot),
      },
      { agrees: Math.abs(second - c.answer) < 1e-9, detail: `from the alleles: ${show(second)}%` },
      { context: kind, p1: c.p1, p2: c.p2, target: c.target, answer: c.answer },
    )
  },
}

// =============================================================================================
// X-linked recessive disorders: disorders q7, q14, q19 and q27
// =============================================================================================

export type Status = 'clear' | 'carrier' | 'affected'
export interface Linked {
  name: string
  /** "Haemophilia is caused by a recessive allele on the X chromosome." */
  intro: string
  /** The same with the alleles named: "(h)", and "(H) gives normal blood clotting". */
  introAlleles: string
  dom: string
  rec: string
  /** "have haemophilia", "be colour-blind": after "to". */
  be: string
  /** "not have haemophilia", "have normal colour vision": after "to". */
  free: string
  /** "have haemophilia", "are colour-blind": after "who", for several. */
  are: string
  /** "do not have haemophilia", "have normal colour vision". */
  areNot: string
  /** "has haemophilia", "is colour-blind": after "who", for one. */
  is: string
  /** "does not have haemophilia", "is not colour-blind". */
  isNot: string
  /** For a parent, past: "had haemophilia", "did not have haemophilia", and "did" after "but her father". */
  had: string
  hadNot: string
  did: string
  /** "haemophilia", "the condition": what a carrier carries the allele for. */
  of: string
  mothers: Status[]
  fathers: Status[]
}
export const HAEMOPHILIA: Linked = {
  name: 'haemophilia',
  intro: 'Haemophilia is caused by a recessive allele on the X chromosome.',
  introAlleles: 'Haemophilia is caused by a recessive allele (h) on the X chromosome; the dominant allele (H) gives normal blood clotting.',
  dom: 'Xᴴ',
  rec: 'Xʰ',
  be: 'have haemophilia',
  free: 'not have haemophilia',
  are: 'have haemophilia',
  areNot: 'do not have haemophilia',
  is: 'has haemophilia',
  isNot: 'does not have haemophilia',
  had: 'had haemophilia',
  hadNot: 'did not have haemophilia',
  did: 'did',
  of: 'haemophilia',
  mothers: ['clear', 'carrier'],
  fathers: ['clear', 'affected'],
}
export const COLOUR_BLINDNESS: Linked = {
  name: 'colour blindness',
  intro: 'Red-green colour blindness is caused by a recessive allele on the X chromosome.',
  introAlleles: 'Red-green colour blindness is caused by a recessive allele (b) on the X chromosome; the dominant allele (B) gives normal colour vision.',
  dom: 'Xᴮ',
  rec: 'Xᵇ',
  be: 'be colour-blind',
  free: 'have normal colour vision',
  are: 'are colour-blind',
  areNot: 'have normal colour vision',
  is: 'is colour-blind',
  isNot: 'is not colour-blind',
  had: 'was colour-blind',
  hadNot: 'was not colour-blind',
  did: 'was',
  of: 'colour blindness',
  mothers: ['clear', 'carrier', 'affected'],
  fathers: ['clear', 'affected'],
}
/** Men with Duchenne muscular dystrophy seldom become fathers, so the father here never has it. */
export const DUCHENNE: Linked = {
  name: 'Duchenne muscular dystrophy',
  intro: 'Duchenne muscular dystrophy is caused by a recessive allele on the X chromosome.',
  introAlleles: 'Duchenne muscular dystrophy is caused by a recessive allele (d) on the X chromosome; the dominant allele (D) gives normal muscle.',
  dom: 'Xᴰ',
  rec: 'Xᵈ',
  be: 'have Duchenne muscular dystrophy',
  free: 'not have Duchenne muscular dystrophy',
  are: 'have Duchenne muscular dystrophy',
  areNot: 'do not have Duchenne muscular dystrophy',
  is: 'has Duchenne muscular dystrophy',
  isNot: 'does not have Duchenne muscular dystrophy',
  had: 'had Duchenne muscular dystrophy',
  hadNot: 'did not have Duchenne muscular dystrophy',
  did: 'did',
  of: 'Duchenne muscular dystrophy',
  mothers: ['carrier'],
  fathers: ['clear'],
}
export const SEX_LINKED: Linked = {
  name: 'condition',
  intro: 'A sex-linked recessive condition is caused by an allele on the X chromosome.',
  introAlleles: 'A sex-linked recessive condition is caused by a recessive allele (n) on the X chromosome; the dominant allele (N) does not cause it.',
  dom: 'Xᴺ',
  rec: 'Xⁿ',
  be: 'have the condition',
  free: 'not have the condition',
  are: 'have the condition',
  areNot: 'do not have the condition',
  is: 'has the condition',
  isNot: 'does not have the condition',
  had: 'had the condition',
  hadNot: 'did not have the condition',
  did: 'did',
  of: 'the condition',
  mothers: ['clear', 'carrier', 'affected'],
  fathers: ['clear', 'affected'],
}
export const LINKED = [HAEMOPHILIA, COLOUR_BLINDNESS, DUCHENNE, SEX_LINKED]

export const motherGenotype = (d: Linked, s: Status) => eggsOf(d, s).join('')
export const fatherGenotype = (d: Linked, s: Status) => `${s === 'affected' ? d.rec : d.dom}Y`
const eggsOf = (d: Linked, s: Status) => (s === 'clear' ? [d.dom, d.dom] : s === 'carrier' ? [d.dom, d.rec] : [d.rec, d.rec])
const motherSays = (d: Linked, s: Status) => (s === 'clear' ? `does not carry the allele for ${d.of}` : s === 'carrier' ? `is a carrier of ${d.of}` : d.is)
const fatherSays = (d: Linked, s: Status) => (s === 'affected' ? d.is : d.isNot)

export interface Box {
  son: boolean
  /** Recessive alleles in the box: a daughter has 0, 1 or 2, a son 0 or 1. */
  recs: number
}
const affected = (b: Box) => (b.son ? b.recs === 1 : b.recs === 2)
export interface Ask {
  key: string
  group: 'sons' | 'daughters' | 'all'
  /** "their sons", "all their future children": `whose` is "their" or "their future". */
  whom: (whose: string) => string
  /** After "expected to": "have haemophilia", "be carriers", "be sons who are colour-blind". */
  to: (d: Linked) => string
  /** The count's label in the solution: "Sons who have haemophilia". */
  label: (d: Linked) => string
  hits: (b: Box) => boolean
}
export const ASKS: Ask[] = [
  { key: 'sons-affected', group: 'sons', whom: (w) => `${w} sons`, to: (d) => d.be, label: (d) => `Sons who ${d.are}`, hits: (b) => b.son && affected(b) },
  { key: 'sons-free', group: 'sons', whom: (w) => `${w} sons`, to: (d) => d.free, label: (d) => `Sons who ${d.areNot}`, hits: (b) => b.son && !affected(b) },
  { key: 'daughters-affected', group: 'daughters', whom: (w) => `${w} daughters`, to: (d) => d.be, label: (d) => `Daughters who ${d.are}`, hits: (b) => !b.son && affected(b) },
  { key: 'daughters-carriers', group: 'daughters', whom: (w) => `${w} daughters`, to: () => 'be carriers', label: () => 'Carrier daughters', hits: (b) => !b.son && b.recs === 1 },
  { key: 'all-affected', group: 'all', whom: (w) => `all ${w} children`, to: (d) => d.be, label: (d) => `Children who ${d.are}`, hits: affected },
  { key: 'all-carriers', group: 'all', whom: (w) => `all ${w} children`, to: () => 'be carriers', label: () => 'Carriers', hits: (b) => !b.son && b.recs === 1 },
  { key: 'all-free', group: 'all', whom: (w) => `all ${w} children`, to: (d) => d.free, label: (d) => `Children who ${d.areNot}`, hits: (b) => !affected(b) },
  { key: 'all-affected-sons', group: 'all', whom: (w) => `all ${w} children`, to: (d) => `be sons who ${d.are}`, label: (d) => `Sons who ${d.are}`, hits: (b) => b.son && affected(b) },
  { key: 'all-carrier-daughters', group: 'all', whom: (w) => `all ${w} children`, to: () => 'be daughters who are carriers', label: () => 'Carrier daughters', hits: (b) => !b.son && b.recs === 1 },
]

/** The four boxes of mother × father, a row per egg: the daughter's box, then the son's. */
export const linkedBoxes = (m: Status, f: Status): Box[] => {
  const eggs = m === 'clear' ? [0, 0] : m === 'carrier' ? [0, 1] : [1, 1]
  const sperm = f === 'affected' ? 1 : 0
  return eggs.flatMap((e) => [
    { son: false, recs: e + sperm },
    { son: true, recs: e },
  ])
}
const inGroup = (b: Box, g: Ask['group']) => (g === 'all' ? true : g === 'sons' ? b.son : !b.son)
export const linkedAnswer = (m: Status, f: Status, ask: Ask) => {
  const boxes = linkedBoxes(m, f).filter((b) => inGroup(b, ask.group))
  return percent(boxes.filter(ask.hits).length, boxes.length)
}
/**
 * The same answer from the alleles' chances, never the boxes: the mother passes the recessive
 * allele with chance q, and the father passes his X to every daughter and his Y to every son.
 */
export function linkedChance(m: Status, f: Status, key: string): number {
  const q = m === 'clear' ? 0 : m === 'carrier' ? 0.5 : 1
  const fx = f === 'affected' ? 1 : 0
  const son = { affected: q, free: 1 - q }
  const dau = { affected: q * fx, carrier: q * (1 - fx) + (1 - q) * fx, free: 1 - q * fx }
  const chance: Record<string, number> = {
    'sons-affected': son.affected,
    'sons-free': son.free,
    'daughters-affected': dau.affected,
    'daughters-carriers': dau.carrier,
    'all-affected': (son.affected + dau.affected) / 2,
    'all-carriers': dau.carrier / 2,
    'all-free': (son.free + dau.free) / 2,
    'all-affected-sons': son.affected / 2,
    'all-carrier-daughters': dau.carrier / 2,
  }
  return 100 * chance[key]!
}

const boxText = (d: Linked, b: Box) => (b.son ? `${b.recs ? d.rec : d.dom}Y` : [d.dom, d.dom, d.rec, d.rec].slice(b.recs, b.recs + 2).join(''))
const GROUP_WORD = { sons: 'son ', daughters: 'daughter ', all: '' } as const

/** The cross, read: the square, which boxes are which, and the count over the right denominator. */
export function linkedWorking(d: Linked, m: Status, f: Status, ask: Ask, answer: number) {
  const mg = motherGenotype(d, m)
  const fg = fatherGenotype(d, f)
  const boxes = linkedBoxes(m, f)
  const eggs = m === 'carrier' ? `${d.dom} or ${d.rec}` : `only ${eggsOf(d, m)[0]}`
  const fx = f === 'affected' ? d.rec : d.dom
  const daughters = boxes.filter((b) => !b.son).map((b) => boxText(d, b))
  const sons = boxes.filter((b) => b.son).map((b) => boxText(d, b))
  const group = boxes.filter((b) => inGroup(b, ask.group))
  const k = group.filter(ask.hits).length
  const den = group.length
  const word = GROUP_WORD[ask.group]
  const square = table([fx, 'Y'], eggsOf(d, m), boxes.map((b) => boxText(d, b)))
  const text =
    `The cross is ${mg} × ${fg}. Her eggs carry ${eggs}; his sperm carry ${fx} or Y.\n\n${square}\n\n` +
    `The daughters are the boxes with two X chromosomes: ${daughters.join(' and ')}. The sons are ${sons.join(' and ')}: a son receives his X from his mother and the Y from his father.\n\n` +
    `${ask.label(d)}: ${k} of the ${den} ${word}boxes, so $${k} \\div ${den} \\times 100 = ${answer}\\%$.`
  const denominator = ask.group === 'all' ? `uses all four children as the denominator: ${k} of 4` : `considers ${ask.group} only: ${k} of the 2 ${word}boxes`
  return { text, pair: `${mg} × ${fg}`, offspring: `daughters ${daughters.join(' and ')} and sons ${sons.join(' and ')}`, denominator }
}

interface LinkedCross {
  m: Status
  f: Status
  ask: Ask
  answer: number
}
/** Every cross the disorder allows (not two parents without the allele) and every question with an answer above 0. */
const crossesOf = (d: Linked): LinkedCross[] =>
  d.mothers.flatMap((m) =>
    d.fathers
      .filter((f) => !(m === 'clear' && f === 'clear'))
      .flatMap((f) => ASKS.map((ask) => ({ m, f, ask, answer: linkedAnswer(m, f, ask) })).filter((x) => x.answer > 0)),
  )

const LINKED_PROMPTS = [
  (d: Linked, x: LinkedCross) =>
    `${d.intro} A woman who ${motherSays(d, x.m)} has children with a man who ${fatherSays(d, x.f)}. What percentage of ${x.ask.whom('their')} are ${expected(x.ask.to(d))}?`,
  (d: Linked, x: LinkedCross) =>
    `${d.introAlleles} A woman who ${motherSays(d, x.m)} (${motherGenotype(d, x.m)}) has children with a man who ${fatherSays(d, x.f)} (${fatherGenotype(d, x.f)}). What percentage of ${x.ask.whom('their')} are ${expected(x.ask.to(d))}?`,
]

/** "expected to have haemophilia", "expected not to have haemophilia": never a split infinitive. */
const expected = (to: string) => (to.startsWith('not ') ? `expected not to ${to.slice(4)}` : `expected to ${to}`)

/** One X-linked cross, read over sons, daughters or all: written as disorders q7 (sons, 50%), q14 (all children, 25%) and q19 (daughters who are carriers, 100%). */
export const sexLinkedCross: Generator = {
  id: 'sex-linked-cross-percentage',
  subjectId: 'biology',
  topicId: DISORDERS,
  replaces: ['q7', 'q14', 'q19'],
  build(r, slot, turn) {
    const d = LINKED[turn % LINKED.length]!
    // Sons, daughters and all children as likely, so "out of 4" pays only a third of the time, and each
    // answer as nearly so as that allows. Duchenne gives 25% and 75% only over all children, so there
    // the answers are matched and the denominators as nearly as they can be.
    const x =
      d === DUCHENNE
        ? balanced(r, `genetics:sex-linked:${d.name}`, () => crossesOf(d), (y) => y.ask.group, (y) => y.answer)
        : balanced(r, `genetics:sex-linked:${d.name}`, () => crossesOf(d), (y) => y.answer, (y) => y.ask.group)
    const w = linkedWorking(d, x.m, x.f, x.ask, x.answer)
    const second = linkedChance(x.m, x.f, x.ask.key)
    return numeric(
      slot,
      {
        prompt: pick(r, LINKED_PROMPTS)(d, x),
        solution: `A woman who ${motherSays(d, x.m)} is ${motherGenotype(d, x.m)}; a man who ${fatherSays(d, x.f)} is ${fatherGenotype(d, x.f)}. ${w.text}`,
        method: [`draws the cross: ${w.pair} gives ${w.offspring}`, w.denominator],
        answer: x.answer,
        units: unitsOf(slot),
        line: show(x.answer),
      },
      { agrees: Math.abs(second - x.answer) < 1e-9, detail: `from the alleles' chances: ${show(second)}%` },
      { context: d.name, mother: x.m, father: x.f, ask: x.ask.key, group: x.ask.group, answer: x.answer },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// Disorders q27: the woman's genotype found from her family, then the cross
// ---------------------------------------------------------------------------------------------

export interface Clue {
  key: string
  carrier: boolean
  /** The disorders it fits. */
  fits: (d: Linked) => boolean
  /** The partner's status it fits. */
  partners: Status[]
  /** The family, and the partner: `p` says what the partner has. */
  text: (d: Linked, p: string) => string
  /** The deduction, for the solution. */
  why: (d: Linked) => string
  /** For the mark scheme: "because she received Xʰ from her father". */
  because: (d: Linked) => string
  /** "their", or "their future" when a child is already born. */
  whose: string
}
export const CLUES: Clue[] = [
  {
    key: 'father',
    carrier: true,
    fits: (d) => d !== DUCHENNE,
    partners: ['clear', 'affected'],
    text: (d, p) => `A woman ${d.isNot}, but her father ${d.did}. She has children with a man who ${p}.`,
    why: (d) =>
      `Her father ${d.had}, so he was ${d.rec}Y. A daughter receives her father's only X, so she received ${d.rec}. She ${d.isNot}, so her other X carries the dominant allele: she is a carrier, ${d.dom}${d.rec}.`,
    because: (d) => `because she received ${d.rec} from her father`,
    whose: 'their',
  },
  {
    key: 'mother',
    carrier: true,
    fits: (d) => d === COLOUR_BLINDNESS || d === SEX_LINKED,
    partners: ['clear', 'affected'],
    text: (d, p) => `A woman ${d.isNot}, but her mother ${d.is}. She has children with a man who ${p}.`,
    why: (d) =>
      `Her mother ${d.is}, so she is ${d.rec}${d.rec} and every egg she made carried ${d.rec}: the woman received ${d.rec}. She ${d.isNot}, so her other X carries the dominant allele: she is a carrier, ${d.dom}${d.rec}.`,
    because: (d) => `because she received ${d.rec} from her mother`,
    whose: 'their',
  },
  {
    key: 'son',
    carrier: true,
    fits: (d) => d !== DUCHENNE,
    partners: ['clear', 'affected'],
    text: (d, p) => `A woman who ${d.isNot} and her partner, who ${p}, already have a son who ${d.is}.`,
    why: (d) =>
      `A son receives his X from his mother and the Y from his father. Their son ${d.is}, so he is ${d.rec}Y and his ${d.rec} came from her. She ${d.isNot}, so her other X carries the dominant allele: she is a carrier, ${d.dom}${d.rec}.`,
    because: (d) => `because her son's ${d.rec} came from her`,
    whose: 'their future',
  },
  {
    key: 'daughter',
    carrier: true,
    fits: (d) => d === COLOUR_BLINDNESS || d === SEX_LINKED,
    partners: ['affected'],
    text: (d, p) => `A woman who ${d.isNot} and her partner, who ${p}, already have a daughter who ${d.is}.`,
    why: (d) =>
      `Their daughter ${d.is}, so she is ${d.rec}${d.rec}: she received ${d.rec} from each parent, one of them from the woman. The woman ${d.isNot}, so her other X carries the dominant allele: she is a carrier, ${d.dom}${d.rec}.`,
    because: (d) => `because her daughter received ${d.rec} from her`,
    whose: 'their future',
  },
  {
    key: 'tested',
    carrier: false,
    fits: (d) => d !== DUCHENNE,
    partners: ['affected'],
    text: (d, p) => `A woman ${d.isNot}. Her father ${d.hadNot}, and a genetic test has shown that her mother does not carry the allele for ${d.of}. She has children with a man who ${p}.`,
    why: (d) =>
      `Her father ${d.hadNot}, so he was ${d.dom}Y and gave her ${d.dom}. Her mother does not carry the allele, so she is ${d.dom}${d.dom} and also gave her ${d.dom}. The woman is ${d.dom}${d.dom}: she is not a carrier.`,
    because: (d) => `because each parent could give her only ${d.dom}`,
    whose: 'their',
  },
]

interface Family {
  clue: Clue
  f: Status
  ask: Ask
  answer: number
  /** The answer with the woman's status the other way round: never the answer. */
  lazy: number
}
const statusOf = (carrier: boolean): Status => (carrier ? 'carrier' : 'clear')
const familiesOf = (d: Linked): Family[] =>
  CLUES.filter((c) => c.fits(d)).flatMap((clue) =>
    clue.partners.flatMap((f) =>
      ASKS.map((ask) => ({ clue, f, ask, answer: linkedAnswer(statusOf(clue.carrier), f, ask), lazy: linkedAnswer(statusOf(!clue.carrier), f, ask) })).filter(
        (x) => x.answer > 0 && x.answer !== x.lazy,
      ),
    ),
  )

/** Men with Duchenne muscular dystrophy seldom father children, so it gives no clue from a father and no non-carrier to cross with an affected man. */
const DEDUCED = [HAEMOPHILIA, COLOUR_BLINDNESS, SEX_LINKED]

/** Carrier or not from the family, then the cross: written as disorders q27 (her father had haemophilia; the daughters of a man with it, 50%). */
export const deducedCarrier: Generator = {
  id: 'sex-linked-carrier-from-the-family',
  subjectId: 'biology',
  topicId: DISORDERS,
  replaces: ['q27'],
  build(r, slot, turn) {
    const d = DEDUCED[turn % DEDUCED.length]!
    // Carrier or not half each, so "she is a carrier" pays half the time. A carrier's answers (25, 50
    // and 75%) a third each; a non-carrier's 100% three times in five and 50% twice, so no answer
    // passes 40%, and the 50% a carrier gives (the written slot's) is still drawn. Then sons, daughters
    // or all children evenly among the questions with that answer, then the question, then the family.
    const all = familiesOf(d)
    const carrier = pick(r, [true, false])
    const answer = pick(r, carrier ? [25, 50, 75] : [100, 100, 100, 50, 50])
    const same = all.filter((y) => y.clue.carrier === carrier && y.answer === answer)
    const group = pick(r, [...new Set(same.map((y) => y.ask.group))])
    const key = pick(r, [...new Set(same.filter((y) => y.ask.group === group).map((y) => y.ask.key))])
    const x = pick(r, same.filter((y) => y.ask.key === key))
    const m = statusOf(x.clue.carrier)
    const w = linkedWorking(d, m, x.f, x.ask, x.answer)
    const second = linkedChance(m, x.f, x.ask.key)
    return numeric(
      slot,
      {
        prompt: `${pick(r, [d.intro, d.introAlleles])} ${x.clue.text(d, fatherSays(d, x.f))} Calculate the percentage of ${x.ask.whom(x.clue.whose)} ${expected(x.ask.to(d))}.`,
        solution: `**The woman's genotype.** ${x.clue.why(d)}\n\n**The cross.** ${w.text}`,
        method: [`deduces that the woman is ${m === 'carrier' ? 'a carrier' : 'not a carrier'}, ${motherGenotype(d, m)}, ${x.clue.because(d)}`, `crosses ${w.pair} to give ${w.offspring}; ${w.denominator}`],
        answer: x.answer,
        units: unitsOf(slot),
      },
      { agrees: Math.abs(second - x.answer) < 1e-9 && x.lazy !== x.answer, detail: `from the alleles' chances: ${show(second)}%; with her status the other way round: ${show(x.lazy)}%` },
      { context: d.name, clue: x.clue.key, carrier: String(x.clue.carrier), father: x.f, ask: x.ask.key, answer: x.answer },
    )
  },
}

// =============================================================================================
// Monohybrid crosses: inheritance q5, q19 and q26
// =============================================================================================

export interface Trait {
  name: string
  /** "pea plant"; "" for people. */
  organism: string
  plural: string
  letter: string
  domAdj: string
  recAdj: string
  /** "flowers", "fur"; "" for a pea's height, which is an adjective alone. */
  feature: string
  rule: string
  human?: boolean
  plant?: boolean
}
const trait = (name: string, organism: string, plural: string, letter: string, domAdj: string, recAdj: string, feature: string, plant = false): Trait => ({
  name,
  organism,
  plural,
  letter,
  domAdj,
  recAdj,
  feature,
  rule: `In ${plural}, the allele for ${domAdj} ${feature || 'stems'} (${letter}) is dominant to the allele for ${recAdj} ${feature || 'stems'} (${letter.toLowerCase()}).`,
  plant,
})
/** Real dominant and recessive pairs, as the textbooks give them. */
export const TRAITS: Trait[] = [
  trait('pea height', 'pea plant', 'pea plants', 'T', 'tall', 'short', '', true),
  trait('pea flowers', 'pea plant', 'pea plants', 'P', 'purple', 'white', 'flowers', true),
  trait('pea pods', 'pea plant', 'pea plants', 'G', 'green', 'yellow', 'pods', true),
  trait('pod shape', 'pea plant', 'pea plants', 'I', 'inflated', 'constricted', 'pods', true),
  trait('tomato fruit', 'tomato plant', 'tomato plants', 'R', 'red', 'yellow', 'fruit', true),
  trait('guinea pig fur', 'guinea pig', 'guinea pigs', 'B', 'black', 'white', 'fur'),
  trait('guinea pig hair', 'guinea pig', 'guinea pigs', 'S', 'short', 'long', 'hair'),
  trait('fly wings', 'fruit fly', 'fruit flies', 'N', 'normal', 'vestigial', 'wings'),
  trait('mouse fur', 'mouse', 'mice', 'B', 'black', 'brown', 'fur'),
  trait('cat hair', 'cat', 'cats', 'S', 'short', 'long', 'hair'),
  {
    name: 'cystic fibrosis',
    organism: '',
    plural: 'people',
    letter: 'F',
    domAdj: '',
    recAdj: '',
    feature: '',
    rule: 'Cystic fibrosis is caused by a recessive allele (f); the dominant allele (F) does not cause it.',
    human: true,
  },
  {
    name: 'polydactyly',
    organism: '',
    plural: 'people',
    letter: 'D',
    domAdj: '',
    recAdj: '',
    feature: '',
    rule: 'Polydactyly (extra fingers or toes) is caused by a dominant allele (D); the recessive allele (d) gives the usual number of fingers and toes.',
    human: true,
  },
]

export type Genotype = 'AA' | 'Aa' | 'aa'
/** A genotype in the trait's letters: Tt, tt, TT. */
export const spell = (tr: Trait, g: Genotype) => g.replace(/A/g, tr.letter).replace(/a/g, tr.letter.toLowerCase())
export const boxesOf = (g1: Genotype, g2: Genotype): Genotype[] =>
  [g1[0]!, g1[1]!].flatMap((x) => [g2[0]!, g2[1]!].map((y): Genotype => (x === 'A' && y === 'A' ? 'AA' : x === 'A' || y === 'A' ? 'Aa' : 'aa')))

/** "tall pea plant", "pea plant with purple flowers"; `noun` replaces the organism ("plants"). */
const describe = (tr: Trait, adj: string, noun: string) => (tr.feature ? `${noun} with ${adj} ${tr.feature}` : `${adj} ${noun}`)
/** The phenotype after "to": "be tall", "have purple flowers", "have cystic fibrosis". */
export function phenotype(tr: Trait, dominant: boolean): string {
  if (tr.name === 'cystic fibrosis') return dominant ? 'not have cystic fibrosis' : 'have cystic fibrosis'
  if (tr.name === 'polydactyly') return dominant ? 'have polydactyly' : 'not have polydactyly'
  const adj = dominant ? tr.domAdj : tr.recAdj
  return tr.feature ? `have ${adj} ${tr.feature}` : `be ${adj}`
}
/** One parent, as a clause after "a parent who" for people, or as a noun phrase with its genotype. */
function parent(tr: Trait, g: Genotype, noun = tr.organism): string {
  const gt = spell(tr, g)
  if (tr.name === 'cystic fibrosis') return g === 'aa' ? `has cystic fibrosis (${gt})` : g === 'Aa' ? `is a carrier (${gt})` : `does not carry the allele (${gt})`
  if (tr.name === 'polydactyly') return g === 'aa' ? `does not have polydactyly (${gt})` : g === 'Aa' ? `has polydactyly and is heterozygous (${gt})` : `has polydactyly and is homozygous (${gt})`
  const zyg = g === 'Aa' ? 'heterozygous ' : g === 'AA' ? 'homozygous ' : ''
  return `${a(`${zyg}${describe(tr, g === 'aa' ? tr.recAdj : tr.domAdj, noun)}`)} (${gt})`
}

export type Outcome = 'dominant' | 'recessive' | 'heterozygous' | 'homozygous dominant'
export const OUTCOMES: Outcome[] = ['dominant', 'recessive', 'heterozygous', 'homozygous dominant']
const counts = (o: Outcome, b: Genotype) => (o === 'dominant' ? b !== 'aa' : o === 'recessive' ? b === 'aa' : o === 'heterozygous' ? b === 'Aa' : b === 'AA')
const CROSSES: [Genotype, Genotype][] = [
  ['Aa', 'Aa'],
  ['Aa', 'aa'],
  ['aa', 'Aa'],
  ['AA', 'aa'],
  ['aa', 'AA'],
  ['AA', 'Aa'],
  ['Aa', 'AA'],
]

interface Mono {
  g1: Genotype
  g2: Genotype
  outcome: Outcome
  answer: number
}
const monos = memo('genetics:monohybrid', (): Mono[] =>
  CROSSES.flatMap(([g1, g2]) => OUTCOMES.map((outcome) => ({ g1, g2, outcome, answer: percent(boxesOf(g1, g2).filter((b) => counts(outcome, b)).length, 4) }))).filter((x) => x.answer > 0),
)

const outcomeText = (tr: Trait, o: Outcome) =>
  o === 'dominant' || o === 'recessive'
    ? phenotype(tr, o === 'dominant')
    : o === 'heterozygous'
      ? tr.name === 'cystic fibrosis'
        ? 'be carriers (heterozygous)'
        : 'be heterozygous'
      : `be homozygous dominant (${spell(tr, 'AA')})`

function monoPrompt(tr: Trait, x: Mono): string {
  const what = outcomeText(tr, x.outcome)
  if (tr.human) {
    const pair =
      x.g1 === x.g2
        ? tr.name === 'cystic fibrosis'
          ? `Two parents who are both carriers (${spell(tr, 'Aa')}) have children.`
          : `Two parents who both have polydactyly and are heterozygous (${spell(tr, 'Aa')}) have children.`
        : `A parent who ${parent(tr, x.g1)} has children with a parent who ${parent(tr, x.g2)}.`
    return `${tr.rule} ${pair} What percentage of their children are ${expected(what)}?`
  }
  const cross = x.g1 === x.g2 ? `Two ${parent(tr, x.g1, tr.plural).replace(/^an? /, '')} are crossed.` : `${cap(parent(tr, x.g1))} is crossed with ${parent(tr, x.g2)}.`
  return `${tr.rule} ${cross} What percentage of the offspring are ${expected(what)}?`
}

/** Boxes ÷ 4 over a monohybrid cross: written as inheritance q5 (Bb × Bb, 25% recessive) and q19 (Bb × bb, 50% white). */
export const monohybrid: Generator = {
  id: 'monohybrid-cross-percentage',
  subjectId: 'biology',
  topicId: INHERITANCE,
  replaces: ['q5', 'q19'],
  build(r, slot, turn) {
    const tr = TRAITS[turn % TRAITS.length]!
    // The dominant and the recessive phenotype about equally, so "the dominant one" pays half the phenotype questions; each answer as likely.
    // Only Aa × Aa gives 25% and 75%, so with the answers even it is about half the crosses; the
    // genotypes are given in the prompt, so no rule about the cross pays.
    const x = balanced(r, 'genetics:monohybrid', monos, (y) => (y.outcome === 'dominant' || y.outcome === 'recessive' ? y.outcome : 'genotype'), (y) => y.answer)
    const boxes = boxesOf(x.g1, x.g2)
    const k = boxes.filter((b) => counts(x.outcome, b)).length
    const [s1, s2] = [spell(tr, x.g1), spell(tr, x.g2)]
    const L = tr.letter
    const l = L.toLowerCase()
    const gam = (g: Genotype) => (g[0] === g[1] ? `only **${spell(tr, g)[0]}**` : `**${L}** or **${l}**`)
    const which =
      x.outcome === 'dominant'
        ? `Every box with the dominant allele ${L} shows the dominant characteristic`
        : x.outcome === 'recessive'
          ? `Only ${spell(tr, 'aa')}, with no ${L}, shows the recessive characteristic`
          : x.outcome === 'heterozygous'
            ? `The heterozygous boxes are the ${spell(tr, 'Aa')} ones`
            : `The homozygous dominant boxes are the ${spell(tr, 'AA')} ones`
    // Second route: each parent's chance of passing the dominant allele, multiplied.
    const pA = (g: Genotype) => [...g].filter((c) => c === 'A').length / 2
    const [a1, a2] = [pA(x.g1), pA(x.g2)]
    const chance = { AA: a1 * a2, Aa: a1 * (1 - a2) + (1 - a1) * a2, aa: (1 - a1) * (1 - a2) }
    const second = 100 * (x.outcome === 'dominant' ? chance.AA + chance.Aa : x.outcome === 'recessive' ? chance.aa : x.outcome === 'heterozygous' ? chance.Aa : chance.AA)
    const square = boxes.map((b) => spell(tr, b)).join(', ')
    return numeric(
      slot,
      {
        prompt: monoPrompt(tr, x),
        solution:
          (x.g1 === x.g2 ? `Each ${s1} parent's gametes carry ${gam(x.g1)}.` : `The ${s1} parent's gametes carry ${gam(x.g1)}; the ${s2} parent's carry ${gam(x.g2)}.`) +
          ` The square holds **${square}**. ` +
          `${which}: ${k} of the 4 boxes, so $${k} \\div 4 \\times 100 = ${x.answer}\\%$.`,
        method: [`gametes from ${s1} and ${s2}; offspring ${square}`],
        answer: x.answer,
        units: unitsOf(slot),
      },
      { agrees: Math.abs(second - x.answer) < 1e-9, detail: `from the alleles: ${show(second)}%` },
      { context: tr.name, cross: `${x.g1} × ${x.g2}`, pair: [x.g1, x.g2].sort().join(' × '), outcome: x.outcome, answer: x.answer },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// Inheritance q26: the expected number of plants from a cross
// ---------------------------------------------------------------------------------------------

export const PLANT_TRAITS = TRAITS.filter((x) => x.plant)
interface Expected {
  cross: 'Aa × Aa' | 'Aa × aa'
  dominant: boolean
  N: number
  /** Boxes of 4 with the phenotype asked. */
  k: number
  answer: number
}
/** 40 to 1200 seeds that grow (Mendel counted 1064), the count exact. */
const expectedOf = memo('genetics:expected', (): Expected[] =>
  range(40, 1200)
    .flatMap((N) =>
      (['Aa × Aa', 'Aa × aa'] as const).flatMap((cross) =>
        [true, false].map((dominant) => {
          const k = cross === 'Aa × aa' ? 2 : dominant ? 3 : 1
          return { cross, dominant, N, k, answer: (N * k) / 4 }
        }),
      ),
    )
    .filter((x) => Number.isInteger(x.answer) && figures(x.answer) <= 3 && noOnes(x.answer) && !powerOfTen(x.N) && !powerOfTen(x.answer)),
)

/** N × 3 ÷ 4, N ÷ 4 or N ÷ 2: written as inheritance q26 (Tt × Tt, 480 plants, 360 tall). */
export const expectedPlants: Generator = {
  id: 'expected-number-from-a-cross',
  subjectId: 'biology',
  topicId: INHERITANCE,
  replaces: ['q26'],
  build(r, slot, turn) {
    const tr = PLANT_TRAITS[turn % PLANT_TRAITS.length]!
    // The cross half each and the dominant or the recessive phenotype half each, then the count.
    const x = balanced(r, 'genetics:expected', expectedOf, (y) => y.cross, (y) => String(y.dominant), (y) => y.N)
    const [dom, het, rec] = [spell(tr, 'AA'), spell(tr, 'Aa'), spell(tr, 'aa')]
    const L = tr.letter
    const crossText = x.cross === 'Aa × Aa' ? `Two ${parent(tr, 'Aa', 'plants').replace(/^an? /, '')} are crossed` : `${cap(parent(tr, 'Aa', 'plant'))} is crossed with ${parent(tr, 'aa', 'plant')}`
    const phen = describe(tr, x.dominant ? tr.domAdj : tr.recAdj, 'plants')
    const square = x.cross === 'Aa × Aa' ? [dom, het, het, rec] : [het, het, rec, rec]
    const why =
      x.cross === 'Aa × Aa'
        ? x.dominant
          ? `${dom} and ${het} both carry the dominant allele ${L}`
          : `only ${rec} has no ${L}`
        : x.dominant
          ? `the two ${het} boxes carry the dominant allele ${L}`
          : `the two ${rec} boxes have no ${L}`
    const share = `${x.k} in 4, or ${(x.k / 4) * 100}%`
    const other = x.N - x.answer
    return numeric(
      slot,
      {
        prompt: `${tr.rule} ${crossText}, and ${x.N} of the seeds produced grow into plants. Calculate the number of these plants expected to ${phenotype(tr, x.dominant)}.`,
        solution:
          `Each ${het} parent's gametes carry **${L}** or **${L.toLowerCase()}**${x.cross === 'Aa × aa' ? `; the ${rec} parent's carry only **${L.toLowerCase()}**` : ''}. ` +
          `The Punnett square for ${x.cross === 'Aa × Aa' ? `${het} × ${het}` : `${het} × ${rec}`} gives **${square.join(', ')}**. ${cap(phen)}: ${why}, so ${share}.\n\n` +
          `Expected ${phen} = $${x.N} \\times ${x.k} \\div 4 = ${x.answer}$.\n\n` +
          `Check: the other plants are $${x.N} - ${x.answer} = ${other}$, and $${x.answer} + ${other} = ${x.N}$.`,
        method: [`uses the cross to find that ${share.replace(', or ', ' (')}) ${phenotype(tr, x.dominant).replace(/^be /, 'are ')}`],
        answer: x.answer,
        units: unitsOf(slot),
        line: String(x.answer),
      },
      // Second route: the other phenotype's count, taken from the total.
      { agrees: x.N - (x.N * (4 - x.k)) / 4 === x.answer, detail: `${x.N} − ${x.N} × ${4 - x.k} ÷ 4 = ${x.N - (x.N * (4 - x.k)) / 4}` },
      { context: tr.name, cross: x.cross, dominant: String(x.dominant), N: x.N, answer: x.answer },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// Inheritance q20: which pattern a family shows, then the next child
// ---------------------------------------------------------------------------------------------

export interface Child {
  son: boolean
  shows: boolean
}
/** Two to four children, at most two sons and two daughters, in birth order. */
const childLists = memo('genetics:children', (): Child[][] => {
  const kinds: Child[] = [
    { son: true, shows: true },
    { son: true, shows: false },
    { son: false, shows: true },
    { son: false, shows: false },
  ]
  let lists: Child[][] = [[]]
  const out: Child[][] = []
  for (let n = 1; n <= 4; n++) {
    lists = lists.flatMap((l) => kinds.map((k) => [...l, k]))
    out.push(...lists.filter((l) => l.length >= 2 && l.filter((c) => c.son).length <= 2 && l.filter((c) => !c.son).length <= 2))
  }
  return out
})
/** "Son", or "Older son" and "Younger son" when there are two. */
export function labels(children: Child[]): string[] {
  const seen = { son: 0, daughter: 0 }
  return children.map((c) => {
    const word = c.son ? 'son' : 'daughter'
    const total = children.filter((x) => x.son === c.son).length
    const i = seen[word]++
    return total === 1 ? cap(word) : `${i === 0 ? 'Older' : 'Younger'} ${word}`
  })
}

export type Pattern = 'recessive' | 'dominant'
export type FamilyAsk = 'shows' | 'free' | 'heterozygous'
interface Pedigree {
  pattern: Pattern
  children: Child[]
  ask: FamilyAsk
  answer: number
}
/**
 * The parents share a status and a daughter differs from them. A daughter, not a son: an affected
 * son of unaffected parents could be X-linked recessive, and an unaffected son of affected parents
 * X-linked dominant; a daughter rules both out (an unaffected father has no recessive X to give
 * her, and an affected father with a dominant X allele gives it to every daughter).
 */
const pedigrees = memo('genetics:pedigrees', (): Pedigree[] =>
  (['recessive', 'dominant'] as const).flatMap((pattern) =>
    childLists()
      .filter((l) => l.some((c) => !c.son && c.shows === (pattern === 'recessive')))
      .flatMap((children) =>
        (['shows', 'free', 'heterozygous'] as const).map((ask) => ({
          pattern,
          children,
          ask,
          answer: ask === 'heterozygous' ? 50 : (ask === 'shows') === (pattern === 'dominant') ? 75 : 25,
        })),
      ),
  ),
)
const FAMILY_ASKS: Record<FamilyAsk, (p: Pattern) => string> = {
  shows: () => 'this child shows the condition',
  free: () => 'this child does not show the condition',
  heterozygous: (p) => (p === 'recessive' ? 'this child is a carrier: heterozygous, without showing the condition' : 'this child is heterozygous'),
}

/** The pattern from the table, both parents Aa, then 1 : 2 : 1: written as inheritance q20 (a recessive family; the chance of a carrier, 50%). */
export const familyTable: Generator = {
  id: 'family-table-next-child',
  subjectId: 'biology',
  topicId: INHERITANCE,
  replaces: ['q20'],
  build(r, slot) {
    // Recessive or dominant half each, so "it must be recessive" pays about half the time; each answer as likely.
    const x = balanced(r, 'genetics:pedigree', pedigrees, (y) => y.pattern, (y) => y.ask, (y) => y.answer)
    const parentsShow = x.pattern === 'dominant'
    const yn = (b: boolean) => (b ? 'yes' : 'no')
    const names = labels(x.children)
    const rows = x.children.map((c, i) => `| ${names[i]} | Mother and Father | ${yn(c.shows)} |`)
    const tbl = `| Person | Parents | Shows the condition? |\n| --- | --- | --- |\n| Mother | not known | ${yn(parentsShow)} |\n| Father | not known | ${yn(parentsShow)} |\n${rows.join('\n')}`
    const key = x.children.findIndex((c) => !c.son && c.shows !== parentsShow)
    const who = names[key]!.toLowerCase()
    const deduce =
      x.pattern === 'recessive'
        ? `The ${who} shows the condition but **neither parent does**, so the allele must be **recessive** (a) and each parent must carry one copy without showing it: both are **Aa**.`
        : `Both parents show the condition but the ${who} **does not**, so she has two copies of the allele that does not cause it, one from each parent. Each parent carries that allele without it showing, so the condition's allele must be **dominant** (A): both parents are **Aa**.`
    const boxes = { shows: parentsShow ? 'the three **AA, Aa and Aa** boxes' : 'the **aa** box', free: parentsShow ? 'the **aa** box' : 'the three **AA, Aa and Aa** boxes', heterozygous: 'the two **Aa** boxes' }[x.ask]
    const k = x.answer / 25
    const who2 = { shows: 'show the condition', free: 'do not show it', heterozygous: x.pattern === 'recessive' ? 'are carriers' : 'are heterozygous' }[x.ask]
    // Second route: 1 AA : 2 Aa : 1 aa as chances, with the condition's genotypes by pattern.
    const share = { AA: 0.25, Aa: 0.5, aa: 0.25 }
    const second = 100 * (x.ask === 'heterozygous' ? share.Aa : (x.ask === 'shows') === parentsShow ? share.AA + share.Aa : share.aa)
    return numeric(
      slot,
      {
        prompt: `A condition is controlled by a single gene. The table describes one family.\n\n${tbl}\n\nThe mother and father have another child. What is the percentage chance that ${FAMILY_ASKS[x.ask](x.pattern)}?`,
        solution:
          `${deduce} The cross Aa × Aa gives **AA, Aa, Aa, aa**. The children who ${who2} come from ${boxes}, so the chance is ${k} in 4: $${k} \\div 4 \\times 100 = ${x.answer}\\%$. ` +
          `The other children in the table do not change this, because each birth is independent.`,
        method: [`deduces the condition is ${x.pattern} and both parents are heterozygous`, 'Aa × Aa gives 1 AA : 2 Aa : 1 aa'],
        answer: x.answer,
        units: unitsOf(slot),
      },
      { agrees: Math.abs(second - x.answer) < 1e-9, detail: `from 1 : 2 : 1: ${show(second)}%` },
      { context: x.pattern, ask: x.ask, children: x.children.length, answer: x.answer },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// Inheritance q27: a genotype's chance times the chance of a girl or a boy
// ---------------------------------------------------------------------------------------------

export interface Autosomal {
  name: string
  dominant: boolean
  letter: string
  /** The opening sentence: the alleles, and that the gene is not on a sex chromosome. */
  rule: string
  has: string
  have: string
  hasNot: string
  haveNot: string
}
export const AUTOSOMAL: Autosomal[] = [
  {
    name: 'cystic fibrosis',
    dominant: false,
    letter: 'F',
    rule: 'Cystic fibrosis is caused by a recessive allele (f) of a gene that is not on a sex chromosome; the dominant allele (F) does not cause it.',
    has: 'has cystic fibrosis',
    have: 'have cystic fibrosis',
    hasNot: 'does not have cystic fibrosis',
    haveNot: 'do not have cystic fibrosis',
  },
  {
    name: 'recessive condition',
    dominant: false,
    letter: 'N',
    rule: 'A condition is caused by a recessive allele (n) of a gene that is not on a sex chromosome; the dominant allele (N) does not cause it.',
    has: 'has the condition',
    have: 'have the condition',
    hasNot: 'does not have the condition',
    haveNot: 'do not have the condition',
  },
  {
    name: 'polydactyly',
    dominant: true,
    letter: 'D',
    rule: 'Polydactyly (extra fingers or toes) is caused by a dominant allele (D) of a gene that is not on a sex chromosome; the recessive allele (d) gives the usual number of fingers and toes.',
    has: 'has polydactyly',
    have: 'have polydactyly',
    hasNot: 'does not have polydactyly',
    haveNot: 'do not have polydactyly',
  },
  {
    name: 'dominant condition',
    dominant: true,
    letter: 'E',
    rule: 'A condition is caused by a dominant allele (E) of a gene that is not on a sex chromosome; the recessive allele (e) does not cause it.',
    has: 'has the condition',
    have: 'have the condition',
    hasNot: 'does not have the condition',
    haveNot: 'do not have the condition',
  },
]

export type Want = 'has' | 'free' | 'carrier'
interface Next {
  /** Both parents heterozygous, or one heterozygous and one homozygous recessive. */
  both: boolean
  knownSon: boolean
  /** A second child of the other sex, who shows what a parent who has it shows (and so tells nothing). */
  extra: boolean
  girl: boolean
  want: Want
  /** Boxes of 4 with the genotype wanted. */
  k: number
  answer: number
}
const nextsOf = (d: Autosomal): Next[] =>
  [true, false].flatMap((both) =>
    [true, false].flatMap((knownSon) =>
      [true, false].flatMap((extra) => [true, false].map((girl) => ({ girl, extra }))).flatMap(({ girl, extra }) =>
        (['has', 'free', 'carrier'] as Want[])
          .filter((w) => !(d.dominant && w === 'carrier'))
          .map((want) => {
            const boxes: Genotype[] = both ? ['AA', 'Aa', 'Aa', 'aa'] : ['Aa', 'Aa', 'aa', 'aa']
            const shows = (g: Genotype) => (d.dominant ? g !== 'aa' : g === 'aa')
            const k = boxes.filter((g) => (want === 'has' ? shows(g) : want === 'free' ? !shows(g) : g === 'Aa')).length
            return { both, knownSon, extra, girl, want, k, answer: (k / 4) * 50 }
          }),
      ),
    ),
  )

/** The family: whatever the pattern, the child shows that each parent carries the recessive allele. */
function familyText(d: Autosomal, x: Next): string {
  const child = x.knownSon ? 'son' : 'daughter'
  const other = x.knownSon ? 'daughter' : 'son'
  // The extra child shows what the known one does not: a child who tells nothing about the parents.
  if (x.extra) {
    const known = d.dominant ? `a ${child} who ${d.hasNot}` : `a ${child} who ${d.has}`
    const second = d.dominant ? `a ${other} who ${d.has}` : `a ${other} who ${d.hasNot}`
    const pair = x.knownSon ? `${known} and ${second}` : `${second} and ${known}`
    if (!d.dominant) return x.both ? `Two parents who ${d.haveNot} have two children: ${pair}.` : `One parent ${d.has} and the other does not. They have two children: ${pair}.`
    return x.both ? `Two parents who both ${d.have} have two children: ${pair}.` : `One parent ${d.has} and the other does not. They have two children: ${pair}.`
  }
  if (!d.dominant) return x.both ? `Two parents who ${d.haveNot} have a ${child} who has it.` : `One parent ${d.has} and the other does not. They have a ${child} who also has it.`
  return x.both ? `Two parents who both ${d.have} have a ${child} who does not.` : `One parent ${d.has} and the other does not. They have a ${child} who ${d.hasNot}.`
}
const wantText = (d: Autosomal, want: Want) => (want === 'has' ? d.has : want === 'free' ? d.hasNot : 'is a carrier: heterozygous, without the condition')

/** ¼, ½ or ¾ times ½: written as inheritance q27 (Ff × Ff, a girl with the condition, 12.5%). */
export const childOfSex: Generator = {
  id: 'genotype-and-sex-chance',
  subjectId: 'biology',
  topicId: INHERITANCE,
  replaces: ['q27'],
  build(r, slot, turn) {
    const d = AUTOSOMAL[turn % AUTOSOMAL.length]!
    // A girl or a boy half each, and with or without the condition about half each, so neither lazy rule pays; each answer as likely.
    const x = balanced(r, `genetics:child-of-sex:${d.name}`, () => nextsOf(d), (y) => String(y.girl), (y) => y.want, (y) => y.answer)
    const L = d.letter
    const l = L.toLowerCase()
    const [dom, het, hom] = [`${L}${L}`, `${L}${l}`, `${l}${l}`]
    const known = x.knownSon ? 'son' : 'daughter'
    const pron = x.knownSon ? 'he' : 'she'
    const deduce = d.dominant
      ? `The ${known} does not have it, so ${pron} is **${hom}** and received ${l} from each parent. ` +
        (x.both ? `Both parents have it, so each also has ${L}: both are **${het}**.` : `The parent who has it must also have ${L}: that parent is **${het}**, and the other is **${hom}**.`)
      : `The ${known} has it, so ${pron} is **${hom}** and received ${l} from each parent. ` +
        (x.both ? `Neither parent has it, so each also has ${L}: both are **${het}**.` : `The parent who has it is **${hom}**; the other does not have it, so also has ${L}: that parent is **${het}**.`)
    const boxes = x.both ? [dom, het, het, hom] : [het, het, hom, hom]
    const which =
      x.want === 'carrier'
        ? `the ${het} boxes are carriers`
        : (x.want === 'has') === d.dominant
          ? x.both
            ? `${dom} and ${het} ${d.dominant ? d.have : d.haveNot}`
            : `the ${het} boxes ${d.dominant ? d.have : d.haveNot}`
          : `the ${hom} box${x.both ? '' : 'es'} ${x.both ? (d.dominant ? d.hasNot : d.has) : d.dominant ? d.haveNot : d.have}`
    const chanceOf = `the chance that a child ${wantText(d, x.want).replace(/: heterozygous, without the condition$/, '')} is ${x.k} in 4`
    const sex = x.girl ? 'girl' : 'boy'
    const h = gcd(x.k, 8)
    const [num, den] = [x.k / h, 8 / h]
    return numeric(
      slot,
      {
        prompt: `${d.rule} ${familyText(d, x)} A child is equally likely to be a boy or a girl, and sex does not affect this gene. Calculate the percentage chance that their next child will be ${x.girl ? 'a girl' : 'a boy'} who ${wantText(d, x.want)}.`,
        solution:
          `**The parents' genotypes.** ${deduce}\n\n` +
          `**The gene.** ${x.both ? `${het} × ${het}` : `${het} × ${hom}`}: each ${het} parent's gametes carry ${L} or ${l}${x.both ? '' : `, and the ${hom} parent's only ${l}`}, giving **${boxes.join(', ')}**. Here ${which}, so ${chanceOf}.\n\n` +
          (x.extra ? `The other child does not change this: each birth is independent.\n\n` : '') +
          `**The sex.** The mother is XX and her eggs all carry X; the father is XY and his sperm carry X or Y. The cross gives **XX, XX, XY, XY**, so the chance of a ${sex} is 1 in 2.\n\n` +
          `**Both together.** The two are independent, so multiply: $\\dfrac{${x.k}}{4} \\times \\dfrac{1}{2} = \\dfrac{${num}}{${den}}$, and $${num} \\div ${den} \\times 100 = ${x.answer}\\%$.`,
        method: [`deduces that the parents are ${x.both ? `both ${het}` : `${het} and ${hom}`}, so ${chanceOf}`, `multiplies by the chance of a ${sex}, 1 in 2`],
        answer: x.answer,
        units: unitsOf(slot),
        line: `${show(x.answer)}%`,
      },
      // Second route: count the 16 boxes of gene and sex together (4 gene boxes × 4 sex boxes).
      { agrees: Math.abs((x.k * 2 * 100) / 16 - x.answer) < 1e-9, detail: `${x.k * 2} of 16 boxes of gene and sex: ${show((x.k * 2 * 100) / 16)}%` },
      { context: d.name, both: String(x.both), extra: String(x.extra), girl: String(x.girl), want: x.want, answer: x.answer },
    )
  },
}

// =============================================================================================
// Meiosis and fertilisation: q4 and q9; asexual reproduction: q25
// =============================================================================================

interface Kingdom {
  name: string
  species: [string, number][]
  /** Body cell, and the gametes as named: "sperm cell", "egg cell". */
  cell: string
  gametes: string[]
}
const KINGDOMS: Kingdom[] = [
  { name: 'animal', species: ANIMALS, cell: 'body cell', gametes: ['sperm cell', 'egg cell', 'gamete'] },
  { name: 'plant', species: PLANTS, cell: 'leaf cell', gametes: ['egg cell', 'pollen grain nucleus', 'gamete'] },
]
const HALF_PROMPTS = [
  (sp: string, two: number, cell: string, g: string, _plant: boolean) => `${A(`${sp} ${cell}`)} has ${two} chromosomes. How many chromosomes are in ${a(`${sp} ${g}`)}?`,
  (sp: string, two: number, cell: string, g: string, plant: boolean) =>
    `The ${cell}s of ${a(plant ? `${sp} plant` : sp)} each contain ${two} chromosomes. Its gametes are made by meiosis. How many chromosomes does each ${sp} ${g} contain?`,
]

/** Half the body-cell number: written as meiosis q4 (human, 46, gamete 23). */
export const gameteNumber: Generator = {
  id: 'meiosis-gamete-chromosome-number',
  subjectId: 'biology',
  topicId: MEIOSIS,
  replaces: ['q4'],
  build(r, slot, turn) {
    const k = KINGDOMS[turn % KINGDOMS.length]!
    const [sp, two] = evenly(r, `genetics:gamete-number:${k.name}`, () => k.species, (x) => x[1])
    const g = pick(r, k.gametes)
    const n = two / 2
    return numeric(
      slot,
      {
        prompt: pick(r, HALF_PROMPTS)(sp, two, k.cell, g, k.name === 'plant'),
        solution: `Meiosis halves the number of chromosomes, so a gamete carries **half the chromosomes** of a body cell: $${two} \\div 2 = ${n}$. When two gametes fuse at fertilisation, the body-cell number of ${two} is restored.`,
        method: ['halves the body-cell number'],
        answer: n,
      },
      { agrees: Number.isInteger(n) && n + n === two, detail: `${n} + ${n} = ${two}` },
      { context: k.name, species: sp, diploid: two },
    )
  },
}

const FUSE_PROMPTS: Record<string, ((sp: string, n: number) => string)[]> = {
  animal: [
    (sp, n) => `${A(`${sp} sperm cell`)} contains ${n} chromosomes. It fuses with ${a(`${sp} egg cell`)} at fertilisation. How many chromosomes does the zygote have?`,
    (sp, n) => `At fertilisation, two ${sp} gametes fuse. Each gamete contains ${n} chromosomes. How many chromosomes does the zygote have?`,
    (sp, n) => `${A(`${sp} egg cell`)} has ${n} chromosomes. A sperm cell from the same species fertilises it. How many chromosomes does the zygote have?`,
  ],
  plant: [
    (sp, n) => `The male gamete nucleus from ${a(`${sp} pollen grain`)} contains ${n} chromosomes. It fuses with the nucleus of ${a(`${sp} egg cell`)} at fertilisation. How many chromosomes does the zygote have?`,
    (sp, n) => `At fertilisation in ${a(`${sp} flower`)}, two gametes fuse. Each gamete contains ${n} chromosomes. How many chromosomes does the zygote have?`,
  ],
}

/** Two haploid sets: written as meiosis q9 (two human gametes, 46). */
export const zygoteNumber: Generator = {
  id: 'fertilisation-zygote-chromosome-number',
  subjectId: 'biology',
  topicId: MEIOSIS,
  replaces: ['q9'],
  build(r, slot, turn) {
    const k = KINGDOMS[turn % KINGDOMS.length]!
    const [sp, two] = evenly(r, `genetics:zygote-number:${k.name}`, () => k.species, (x) => x[1])
    const n = two / 2
    return numeric(
      slot,
      {
        prompt: pick(r, FUSE_PROMPTS[k.name]!)(sp, n),
        solution: `Each gamete is haploid, with ${n} chromosomes, so the zygote has $${n} + ${n} = ${two}$: fertilisation restores the body-cell number, and mitosis then copies it into every cell of the new ${k.name === 'animal' ? 'animal' : 'plant'}.`,
        method: ['adds the two gametes\' chromosome numbers'],
        answer: two,
      },
      { agrees: two / 2 === n && 2 * n === two, detail: `${two} ÷ 2 = ${n}` },
      { context: k.name, species: sp, diploid: two },
    )
  },
}

interface Divider {
  name: string
  text: (d: number) => string
  doublings: number[]
}
/** Doubling times in ideal conditions, minutes: the same ranges microscopy.ts uses. */
export const DIVIDERS: Divider[] = [
  { name: 'bacterium', text: (d) => `In ideal conditions, a species of bacterium divides once every ${d} minutes.`, doublings: [15, 20, 25, 30, 40] },
  { name: 'E. coli', text: (d) => `In a warm nutrient broth, *Escherichia coli* divides once every ${d} minutes.`, doublings: [20, 25, 30, 40] },
  { name: 'Salmonella', text: (d) => `In warm food, *Salmonella* divides once every ${d} minutes.`, doublings: [20, 25, 30, 40] },
]
interface Growth {
  d: number
  n: number
  s: number
  t: number
  answer: number
}
const STARTS = [1, 2, 3, 5, 6, 7]
const growthsOf = (v: Divider): Growth[] =>
  v.doublings.flatMap((d) =>
    range(4, 11).flatMap((n) =>
      STARTS.map((s) => ({ d, n, s, t: d * n, answer: s * 2 ** n })).filter(
        (x) => x.t >= 120 && x.t <= 480 && x.t % 10 === 0 && x.answer < 10000 && figures(x.answer) <= 3 && clearOf(x.answer, x.d, x.t, x.t / 60, x.s) && x.n !== x.d && x.n !== x.s,
      ),
    ),
  )

/** start × 2ⁿ, with the hours turned into minutes first: written as meiosis q25 (every 20 minutes for 3 hours, from one, 512). */
export const asexualGrowth: Generator = {
  id: 'asexual-reproduction-doubling',
  subjectId: 'biology',
  topicId: MEIOSIS,
  replaces: ['q25'],
  build(r, slot, turn) {
    const v = DIVIDERS[turn % DIVIDERS.length]!
    const x = balanced(r, `genetics:asexual:${v.name}`, () => growthsOf(v), (y) => y.d, (y) => y.n, (y) => y.answer)
    const start = x.s === 1 ? 'a single bacterium' : `${x.s} bacteria`
    const chain = Array.from({ length: x.n + 1 }, (_, i) => x.s * 2 ** i)
    const power = x.s === 1 ? `2^{${x.n}}` : `${x.s} \\times 2^{${x.n}}`
    return numeric(
      slot,
      {
        prompt: `Bacteria reproduce asexually: one cell divides into two genetically identical cells. ${v.text(x.d)} Starting from ${start}, calculate the number of bacteria after ${duration(x.t)}, assuming every cell divides on time and none die.`,
        solution:
          `${cap(duration(x.t))} is ${x.t} minutes, so the number of divisions is $${x.t} \\div ${x.d} = ${x.n}$.\n\n` +
          `The number doubles at every division: $${power} = ${x.answer}$ bacteria.\n\n` +
          `Step by step: ${chain.join(' → ')}, which is ${x.n} doublings. This rapid reproductive cycle, with no mate needed, is an advantage of asexual reproduction; the cost is that all ${x.answer} are genetically identical.`,
        method: [`converts ${duration(x.t)} to ${x.t} minutes and finds ${x.n} divisions`, `doubles the number ${x.n} times (${x.s === 1 ? '' : `${x.s} × `}2 to the power ${x.n})`],
        answer: x.answer,
        units: unitsOf(slot),
        line: String(x.answer),
      },
      // Second route: double it n times over, one division at a time.
      { agrees: Array.from({ length: x.t / x.d }).reduce<number>((c) => c * 2, x.s) === x.answer, detail: `${x.s} doubled ${x.t / x.d} times` },
      { context: v.name, d: x.d, n: x.n, s: x.s, minutes: x.t, answer: x.answer },
    )
  },
}

export const geneticsGenerators: Generator[] = [
  partnerBase,
  otherPairDna,
  geneShare,
  baseCount,
  tripletCount,
  otherPairProtein,
  polypeptideLength,
  aboChance,
  sexLinkedCross,
  deducedCarrier,
  monohybrid,
  familyTable,
  expectedPlants,
  childOfSex,
  gameteNumber,
  zygoteNumber,
  asexualGrowth,
]
