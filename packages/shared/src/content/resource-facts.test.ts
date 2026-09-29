import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ResourceFile, type Resource } from '../resources.ts'

const ROOT = join(import.meta.dirname, '../../../../supabase/seed/resources')
const sheets = (subject: string) => ResourceFile.parse(JSON.parse(readFileSync(join(ROOT, `${subject}.json`), 'utf8'))).resources
const sheet = (subject: string, id: string) => sheets(subject).find((r) => r.id === id)!
const formulae = (r: Resource) => r.blocks.flatMap((b) => (b.kind === 'formulae' ? b.groups.flatMap((g) => g.items) : []))
const tables = (r: Resource) => r.blocks.flatMap((b) => (b.kind === 'table' ? [b] : []))
/** Everything a sheet says, in one string. */
const words = (r: Resource) => JSON.stringify(r)

/**
 * What the boards' own documents say, held against the sheets. Each of these was wrong on
 * a sheet and found by reading the sheet beside the document, in September 2026.
 */
describe('Chemistry, against AQA 8462', () => {
  /** Specification 8.2: "Practicals 2 and 7 are GCSE Chemistry only." The sheet said one. */
  it('marks two required practicals as Chemistry only: 2 and 7', () => {
    const r = sheet('chemistry', 'required-practicals')
    const only = tables(r)[0]!.rows.map((row) => row[0]!).filter((name) => name.includes('(Chemistry only)'))
    expect(only.map((name) => name[0])).toEqual(['2', '7'])
    expect(r.summary).toContain('Two, titration and identifying ions, are Chemistry only')
  })

  /** The handbook puts the alkali in the flask and the acid in the burette. */
  it('runs the titration the way the handbook does: acid from the burette', () => {
    const row = tables(sheet('chemistry', 'required-practicals'))[0]!.rows.find((r) => r[0]!.startsWith('2.'))!
    expect(row[1]).toMatch(/alkali into a flask.*acid from a burette/)
  })

  /** 4.7.1.4 names bromine water as a test, and it is not on the sheet, so the sheet cannot claim every test. */
  it('does not claim every test in the specification', () => {
    expect(sheet('chemistry', 'chemical-tests').summary).not.toMatch(/^Every test/)
  })

  /** Copper burns green in the flame test, but a firework's green is barium, and copper gives it blue. */
  it('does not give copper as a firework’s green', () => {
    const fireworks = sheet('chemistry', 'chemical-tests').applications.find((a) => a.title === 'Fireworks')!
    expect(fireworks.body).not.toMatch(/copper/i)
  })

  it('explains each term it leans on', () => {
    expect(words(sheet('chemistry', 'ion-charges'))).toContain('**What an ion is.**')
    expect(words(sheet('chemistry', 'chemical-tests'))).toContain('A precipitate is a solid')
    expect(words(sheet('chemistry', 'structures'))).toContain('Delocalised electrons are outer electrons')
    expect(words(sheet('chemistry', 'homologous-series'))).toContain('**What a homologous series is.**')
  })

  /** Methane has one carbon and so no C–C bond at all. */
  it('does not give alkanes a C–C bond as their functional group', () => {
    const row = tables(sheet('chemistry', 'homologous-series'))[0]!.rows.find((r) => r[0]!.startsWith('Alkanes'))!
    expect(row[1]).not.toContain('C–C')
  })
})

describe('Biology, against Edexcel 1BI0', () => {
  const practicals = tables(sheet('biology', 'core-practicals'))[0]!.rows

  /** Appendix 3: "Algal balls (or similar) must be set up and placed at varying distances from a light source". */
  it('names the algal balls the specification asks for in 6.5', () => {
    const row = practicals.find((r) => r[0]!.startsWith('6.5'))!
    expect(row[1]).toContain('algal balls')
    expect(row[2]).toContain('algal balls')
  })

  /** Appendix 3: "A known mass of potato must be added to sucrose solution". Salt is not in it. */
  it('uses sucrose, not salt, for osmosis in potatoes', () => {
    const row = practicals.find((r) => r[0]!.startsWith('1.16'))!
    expect(row[1]).toContain('sucrose')
    expect(row[1]).not.toContain('salt')
  })

  /** Point 6.6 is printed in bold, which the specification says is Higher tier only. */
  it('marks the inverse square law as Higher tier, and nothing else', () => {
    expect(formulae(sheet('biology', 'biology-maths')).filter((f) => f.higher).map((f) => f.name)).toEqual(['Inverse square law'])
  })

  /** 8.2 asks every student for "the calculation of surface area : volume ratio". */
  it('has the surface area to volume ratio', () => {
    expect(formulae(sheet('biology', 'biology-maths')).map((f) => f.name)).toContain('Surface area to volume ratio')
  })

  it('gives every calculation something to go on: what its words mean, or numbers', () => {
    for (const f of formulae(sheet('biology', 'biology-maths'))) expect(f.symbols?.length ?? 0, f.name).toBeGreaterThan(15)
  })

  /** 8.8 names "the valves", and the sheet's summary promised them. */
  it('says what a valve is for', () => {
    expect(words(sheet('biology', 'the-heart'))).toContain('**The valves.**')
  })

  /** The range is the adult one; a reader of 14 may work out their own. */
  it('says the healthy BMI range is for adults', () => {
    const bmi = sheet('biology', 'biology-maths').applications.find((a) => a.title === 'Doctors and BMI')!
    expect(bmi.body).toContain('for adults')
    expect(bmi.body).toContain('under 18')
  })
})

describe('Business, against Edexcel 1BS0', () => {
  const r = sheet('business', 'business-formulae')
  const all = formulae(r)
  const NUMBER: Record<string, number> = { twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15 }

  /** Appendix 3 has twelve headings and fourteen formulae: two headings hold two each. */
  it('counts its own formulae in its summary', () => {
    const said = /^All (\w+) formulae/.exec(r.summary)![1]!
    expect(NUMBER[said]).toBe(all.length)
    expect(all).toHaveLength(14)
  })

  /**
   * One business runs through every example: revenue £4000, cost of sales £1500, other
   * costs £2000. Net profit took off £1700 instead, and came to £800, the same figure as
   * the net cash flow beside it, which blurred the two.
   */
  it('runs one business through its profit examples', () => {
    const example = (name: string) => all.find((f) => f.name === name)!.symbols!
    expect(example('Gross profit')).toContain('£4000 - £1500 = £2500')
    expect(example('Net profit')).toContain('£2500 - £2000 = £500')
    expect(example('Net profit margin')).toContain('\\dfrac{500}{4000} \\times 100 = 12.5\\%')
    expect(example('Net profit')).not.toContain(example('Net cash flow').match(/£\d+\$?$/)?.[0] ?? '£800')
  })

  /** The specification says formulae are not given. It says nothing of marks for writing them down. */
  it('does not promise marks the specification does not', () => {
    expect(r.statusNote).toContain('Formulae will not be provided in the examinations for Paper 1 or Paper 2.')
    expect(r.statusNote).not.toMatch(/some marks are for/)
  })

  it('spells out the abbreviations the specification spells out', () => {
    expect(all.find((f) => f.name === 'Total costs')!.symbols).toMatch(/^TC is total cost, TFC total fixed costs and TVC total variable costs/)
  })
})

describe('Computer Science, against AQA 8525', () => {
  const pseudo = sheet('computer-science', 'pseudo-code')

  /**
   * Specification 3.1: "students must respond as instructed", and Paper 1 asks for program
   * code in C#, Python or VB.NET. The sheet said you may write in pseudo-code "or in any
   * clear, consistent style of your own", as if any answer could be.
   */
  it('says the question decides the form of the answer', () => {
    expect(pseudo.statusNote).toContain('Each question says what form the answer must take')
    expect(pseudo.statusNote).toContain('clear, consistent and unambiguous')
    expect(pseudo.applications.map((a) => a.title)).not.toContain('Exam answers in any language')
  })

  /** 3.2.8: "string to integer, string to real, integer to string, real to string". Two were missing. */
  it('has all four string conversions', () => {
    for (const name of ['STRING_TO_INT', 'STRING_TO_REAL', 'INT_TO_STRING', 'REAL_TO_STRING']) expect(words(pseudo), name).toContain(name)
  })

  /** Two names in one code span with a space between read as one command. */
  it('never puts two commands in one code span', () => {
    // A fenced example is code laid out on its own lines, indented: it is not a span.
    const spans = [...words(pseudo).replace(/```.*?```/g, '').matchAll(/`([^`]+)`/g)].map((m) => m[1]!)
    expect(spans.length).toBeGreaterThan(60)
    expect(spans.filter((s) => / {2,}/.test(s))).toEqual([])
    for (const pair of ['AND OR', 'OR NOT', 'STRING_TO_INT INT_TO_STRING', 'CHAR_TO_CODE CODE_TO_CHAR']) expect(spans.filter((s) => s.includes(pair)), pair).toEqual([])
  })

  /** A line too long for a phone's code block makes the whole example scroll sideways. */
  it('keeps every line of its written-out examples short enough for a phone', () => {
    const examples = pseudo.blocks.flatMap((b) => (b.kind === 'text' ? [...b.body.matchAll(/```\n([\s\S]*?)\n```/g)].map((m) => m[1]!) : []))
    expect(examples).toHaveLength(3)
    for (const line of examples.flatMap((e) => e.split('\n'))) expect(line.length, line).toBeLessThanOrEqual(38)
  })

  /** The record, the function and the loop each do what the words under them say. */
  it('traces its own loop correctly', () => {
    const loop = pseudo.blocks.flatMap((b) => (b.kind === 'text' ? [b.body] : [])).find((t) => t.includes('Tracing a loop'))!
    const [, from, to, step] = /FOR i ← (\d+) TO (\d+) STEP (\d+)/.exec(loop)!.map(Number)
    const totals: number[] = []
    let total = 0
    for (let i = from!; i <= to!; i += step!) { total += i; totals.push(total) }
    expect(totals).toEqual([1, 4, 9])
    for (const t of totals) expect(loop).toContain(`\`total\` becomes ${t}`)
    expect(loop).toContain(`The output is ${total}.`)
  })

  /** The specification never says "denary": its papers say decimal. */
  it('calls base 10 decimal, as the papers do', () => {
    const bases = sheet('computer-science', 'number-bases-and-ascii')
    expect(tables(bases)[0]!.columns[0]).toBe('Decimal')
    expect(bases.summary).toMatch(/^Decimal, binary and hexadecimal/)
    expect(words(bases)).toContain('Some books call it denary')
  })

  /** The specification writes AND as a full stop on the line, and so does the drawing above the caption. */
  it('writes AND the way the specification and the drawing do', () => {
    const gates = words(sheet('computer-science', 'logic-gates'))
    expect(gates).not.toContain('\\\\cdot')
    expect(gates).toContain('(A \\\\,.\\\\, B) + \\\\overline{C}')
  })

  /** 3.3.6 and 3.3.7 name them "sampling rate" and "sample resolution". */
  it('uses the specification’s names for a sound file', () => {
    const storage = words(sheet('computer-science', 'units-of-storage'))
    expect(storage).toContain('sampling rate')
    expect(storage).toContain('sample resolution')
    expect(storage).not.toMatch(/\{sample rate\}|\{resolution\}/)
  })
})

describe('English, against AQA 8700 and 8702', () => {
  const techniques = sheet('english-language', 'language-techniques')
  const [language, structure] = tables(techniques)

  /**
   * The June 2023 mark scheme lists "Sentence Forms" under Question 2, language, and takes
   * a sentence-level point for structure only "when judged to contribute to whole
   * structure". The short sentence sat in the structure table.
   */
  it('lists the short sentence under language, and says when it counts as structure', () => {
    expect(language!.rows.map((r) => r[0])).toContain('Short sentence')
    expect(structure!.rows.map((r) => r[0])).not.toContain('Short sentence')
    expect(structure!.note).toContain('counts as structure only when')
  })

  it('says which question each table serves', () => {
    expect(language!.note).toContain('Paper 1 Question 2 (8 marks) and Paper 2 Question 3 (12 marks)')
    expect(structure!.note).toContain('Paper 1 Question 3 (8 marks)')
  })

  /** "The effect to write about" must be an effect: the metaphor row compared techniques instead. */
  it('gives an effect in every row, not a comparison of techniques', () => {
    for (const row of [...language!.rows, ...structure!.rows]) expect(row[2], row[0]).not.toMatch(/stronger than a simile/)
    expect(language!.rows.find((r) => r[0] === 'Simile')![2]).toMatch(/\*like\* or \*as\*/)
  })

  /** AQA prints the title with one accent, and so do the app's lessons. */
  it('spells The Emigrée as AQA prints it', () => {
    const poems = tables(sheet('english-literature', 'power-and-conflict'))[0]!.rows.map((r) => r[0])
    expect(poems).toContain('The Emigrée')
    expect(poems).toHaveLength(15)
  })

  /** The Duke is alive and arranging his next marriage: his power has not been outlasted. */
  it('does not say the art outlasts the power in My Last Duchess', () => {
    const pair = sheet('english-literature', 'power-and-conflict').applications.find((a) => a.title === 'Choosing a pair in the exam')!
    expect(pair.body).not.toContain('in both the art outlasts the power')
    expect(pair.body).toContain('power still at work')
  })

  /** Sheila and Eric accept responsibility: that split is the theme of age. */
  it('does not say all the Birlings refuse responsibility', () => {
    const lasting = sheet('english-literature', 'set-texts').applications.find((a) => a.title === 'Why these stories last')!
    expect(lasting.body).toContain('the older Birlings')
  })

  /** 8702: Paper 1 is 1 hour 45 minutes, 64 marks, 40%; Paper 2 is 2 hours 15 minutes, 96 marks, 60%. */
  it('gives the two Literature papers their length and weight', () => {
    expect(tables(sheet('english-literature', 'set-texts'))[0]!.note).toBe('Paper 1 is 1 hour 45 minutes, 64 marks and 40% of the GCSE. Paper 2 is 2 hours 15 minutes, 96 marks and 60%.')
  })
})
