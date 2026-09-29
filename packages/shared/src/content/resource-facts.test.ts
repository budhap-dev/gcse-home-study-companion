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
