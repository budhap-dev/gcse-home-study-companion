import { describe, expect, it } from 'vitest'
import { claimAnswer, mark, normaliseText, parseNumber } from './marking.ts'
import type { Question } from './content/questions.ts'

const base = { id: 'q', prompt: 'p', marks: 2, gradeBand: '6-7' as const, skill: 's', calculator: 'either' as const, tags: [], solution: 's', markScheme: [{ code: 'M1', marks: 2, description: 'd' }], discriminators: [] }

describe('parseNumber', () => {
  it('reads decimals, fractions, negatives, thousands, and units', () => {
    expect(parseNumber('0.25')).toBe(0.25)
    expect(parseNumber('1/4')).toBe(0.25)
    expect(parseNumber('-2')).toBe(-2)
    expect(parseNumber('180,000')).toBe(180000)
    expect(parseNumber('14 m/s', 'm/s')).toBe(14)
    expect(parseNumber('58.8 J', 'J')).toBe(58.8)
  })
  it('forgives a leading "x =" or "="', () => {
    expect(parseNumber('x = 5')).toBe(5)
    expect(parseNumber('x=-2')).toBe(-2)
    expect(parseNumber('= 4.5')).toBe(4.5)
    expect(parseNumber('F = 20 N', 'N')).toBe(20)
    expect(parseNumber('area = 12 cm²', 'cm²')).toBe(12)
  })
  it('forgives a currency symbol, because the solutions print one', () => {
    expect(parseNumber('£500')).toBe(500)
    expect(parseNumber('-£700')).toBe(-700)
    expect(parseNumber('£-700')).toBe(-700)
    expect(parseNumber('£4.36')).toBe(4.36)
    expect(parseNumber('£11 500')).toBe(11500)
    expect(parseNumber('€40')).toBe(40)
    expect(parseNumber('$12 000')).toBe(12000)
  })
  it('rejects non-numbers', () => {
    expect(parseNumber('four')).toBeUndefined()
    expect(parseNumber('')).toBeUndefined()
    expect(parseNumber('1/0')).toBeUndefined()
  })

  /**
   * A division sign is a key on every maths keyboard, so a student who presses it means
   * a fraction. normaliseText had always accepted it and parseNumber had not.
   */
  it('reads a division sign as a fraction', () => {
    expect(parseNumber('3÷4')).toBe(0.75)
    expect(parseNumber('3 ÷ 4')).toBe(0.75)
    expect(parseNumber('-1÷2')).toBe(-0.5)
  })

  /** Brackets round the parts of a fraction, which is what a maths editor produces. */
  it('reads a bracketed fraction', () => {
    expect(parseNumber('(3)/(4)')).toBe(0.75)
    expect(parseNumber('(3)/4')).toBe(0.75)
    expect(parseNumber('(-1)/(2)')).toBe(-0.5)
  })

  /**
   * "1 1/2" is one and a half. The rule that joins "25 000" into 25000 used to run first
   * and turn it into 11/2, so the student was marked as meaning 5.5 — a wrong number
   * returned silently, which is worse than refusing to read it at all.
   */
  it('reads a mixed number, and does not silently mangle it', () => {
    expect(parseNumber('1 1/2')).toBe(1.5)
    expect(parseNumber('2 3/4')).toBe(2.75)
    expect(parseNumber('-1 1/2')).toBe(-1.5)
    expect(parseNumber('1 1/0')).toBeUndefined()
  })

  /** The rules above must not disturb the spaced thousands the content itself prints. */
  it('still reads spaced thousands', () => {
    expect(parseNumber('25 000')).toBe(25000)
    expect(parseNumber('180 000')).toBe(180000)
    expect(parseNumber('1 000 000')).toBe(1000000)
  })
})

describe('normaliseText', () => {
  /** A student without a pi key types the letters; the content writes the symbol. */
  it('matches a typed pi against an accepted π', () => {
    expect(normaliseText('2pir')).toBe(normaliseText('2πr'))
    expect(normaliseText('r=sqrt(a/pi)')).toBe(normaliseText('r=sqrt(a/π)'))
  })

  /** Folding runs symbol to letters, so words that happen to contain "pi" are untouched. */
  it('leaves words containing pi alone', () => {
    expect(normaliseText('pitch')).toBe('pitch')
    expect(normaliseText('capital')).toBe('capital')
    expect(normaliseText('pipette')).toBe('pipette')
  })

  it('ignores case, spaces, superscripts, and braces', () => {
    expect(normaliseText('x⁸')).toBe('x^8')
    expect(normaliseText(' X ^ 8 ')).toBe('x^8')
    expect(normaliseText('2^{-2}')).toBe('2^-2')
    expect(normaliseText('2^(-2)')).toBe('2^-2')
    expect(normaliseText('2⁻²')).toBe('2^-2')
  })
  it('treats the typographic minus, root symbols, and a leading y= as equivalent', () => {
    expect(normaliseText('y = 2x − 2')).toBe(normaliseText('2x-2'))
    expect(normaliseText('5√2')).toBe(normaliseText('5sqrt2'))
    expect(normaliseText('5 root 2')).toBe(normaliseText('5sqrt(2)'))
    expect(normaliseText('√5 + √2')).toBe(normaliseText('sqrt(5)+sqrt(2)'))
  })

  it('reads the maths field\'s +- and a typed +/- as the ± the content prints', () => {
    // MathLive sends x = −3 ± √7 as x=-3+-sqrt(7); before this a student who used the ± key was marked wrong.
    expect(normaliseText('x=-3+-sqrt(7)')).toBe(normaliseText('x = -3 ± √7'))
    expect(normaliseText('1 +/- √2')).toBe(normaliseText('1 ± √2'))
    expect(normaliseText('x = \\pm 2')).toBe(normaliseText('x = ±2'))
    expect(normaliseText('2 × 3')).toBe(normaliseText('2*3'))
    expect(normaliseText('1/(9x⁴)')).toBe(normaliseText('1/(9x^4)'))
  })
})

describe('mark', () => {
  it('numeric with tolerance', () => {
    const q: Question = { ...base, type: 'numeric', answer: 9.9, tolerance: 0.1, unitsRequired: false, units: 'm/s' }
    expect(mark(q, '9.9').correct).toBe(true)
    expect(mark(q, '9.95 m/s').correct).toBe(true)
    expect(mark(q, '10.1').correct).toBe(false)
    expect(mark(q, 'nine').marksScored).toBe(0)
  })
  it('short text with variants', () => {
    const q: Question = { ...base, type: 'short-text', accepted: ['1/(9x^4)', '1/9x^4'] }
    expect(mark(q, '1 / (9x⁴)').correct).toBe(true)
    expect(mark(q, '9x^4').correct).toBe(false)
  })
  it('multiple choice needs the exact set', () => {
    const q: Question = { ...base, type: 'multiple-choice', options: ['a', 'b', 'c'], correct: [0, 2] }
    expect(mark(q, [2, 0]).correct).toBe(true)
    expect(mark(q, [0]).correct).toBe(false)
  })
  it('ordering compares against the natural order', () => {
    const q: Question = { ...base, type: 'ordering', items: ['a', 'b', 'c'] }
    expect(mark(q, [0, 1, 2]).correct).toBe(true)
    expect(mark(q, [1, 0, 2]).correct).toBe(false)
  })
  it('extended is capped self-assessment', () => {
    const q: Question = { ...base, type: 'extended', marks: 6, suggestedMinutes: 8, criteria: [{ text: 'c', marks: 6 }], modelAnswer: 'm' }
    expect(mark(q, 4)).toEqual({ correct: false, marksScored: 4, marksAvailable: 6 })
    expect(mark(q, 9).marksScored).toBe(6)
  })
})

describe('standard form', () => {
  it('accepts the ways a student writes a power of ten', () => {
    for (const written of ['180000', '180,000', '180 000', '1.8e5', '1.8 x 10^5', '1.8 × 10^5', '1.8x10^5', '1.8 × 10⁵']) {
      expect(parseNumber(written), written).toBe(180000)
    }
    expect(parseNumber('2.5 x 10^4')).toBe(25000)
    expect(parseNumber('10^3')).toBe(1000)
    expect(parseNumber('10⁻³')).toBeCloseTo(0.001, 12)
    expect(parseNumber('1.6 x 10^-19')).toBeCloseTo(1.6e-19, 30)
  })

  it('still refuses things that are not numbers', () => {
    expect(parseNumber('ten to the five')).toBeUndefined()
    expect(parseNumber('x 10^')).toBeUndefined()
  })

  it('leaves ordinary numbers alone', () => {
    expect(parseNumber('10')).toBe(10)
    expect(parseNumber('100')).toBe(100)
    expect(parseNumber('0.5')).toBe(0.5)
    expect(parseNumber('49 N/m', 'N/m')).toBe(49)
  })
})

describe('negative answers', () => {
  it('accepts a Unicode minus or dash as well as a hyphen', () => {
    expect(parseNumber('−500', '£')).toBe(-500)
    expect(parseNumber('–700')).toBe(-700)
    expect(parseNumber('-£500', '£')).toBe(-500)
    expect(parseNumber('£-500', '£')).toBe(-500)
  })
})

describe('apostrophes', () => {
  it('treats a curly apostrophe as a straight one, for French answers', () => {
    const q: Question = {
      id: 'q', type: 'short-text', prompt: 'p', marks: 1, gradeBand: '4-5', skill: 's',
      calculator: 'either', tags: [], solution: 's', markScheme: [{ code: 'B1', marks: 1, description: 'd' }],
      discriminators: [], accepted: ["j'ai mal à la tête"],
    }
    for (const typed of ["j'ai mal à la tête", "j’ai mal à la tête", "J'ai mal à la tête", "j' ai mal à la tête"]) {
      expect(mark(q, typed).correct, typed).toBe(true)
    }
  })
})

describe('sentence punctuation', () => {
  const q = (accepted: string[]): Question => ({
    id: 'q', type: 'short-text', prompt: 'p', marks: 1, gradeBand: '4-5', skill: 's',
    calculator: 'either', tags: [], solution: 's', markScheme: [{ code: 'B1', marks: 1, description: 'd' }],
    discriminators: [], accepted,
  })

  it('forgives a closing full stop that the accepted answer does not have', () => {
    const sentence = q(["je me couche tôt parce que j'ai besoin de dormir"])
    expect(mark(sentence, "Je me couche tôt parce que j'ai besoin de dormir.").correct).toBe(true)
    expect(mark(sentence, "Je me couche tôt parce que j'ai besoin de dormir !").correct).toBe(true)
  })

  it('forgives commas that the accepted answer does not have', () => {
    const sentence = q(["avant je buvais du coca mais maintenant je bois de l'eau"])
    expect(mark(sentence, "Avant, je buvais du coca, mais maintenant je bois de l'eau.").correct).toBe(true)
  })

  it('requires punctuation the accepted answer includes, as in program output', () => {
    const output = q(['Hi Amy!'])
    expect(mark(output, 'Hi Amy!').correct).toBe(true)
    expect(mark(output, 'Hi Amy').correct).toBe(false)
    // Exact program output (matchCase) keeps its commas; so does SQL, where a comma is syntax.
    const greeting = { ...q(['Hello, Ada']), matchCase: true } as Question
    expect(mark(greeting, 'Hello, Ada').correct).toBe(true)
    expect(mark(greeting, 'Hello Ada').correct).toBe(false)
    const insert = q(["INSERT INTO Club VALUES (4, 'Debating')"])
    expect(mark(insert, "INSERT INTO Club VALUES (4 'Debating')").correct).toBe(false)
  })

  it('forgives a prose comma the accepted answer has and the student left out', () => {
    // Found reviewing French on 25 September 2026: 350 accepted French answers carry a
    // comma, and a correct sentence typed without it was marked wrong.
    const sentence = q(["quand j'étais petit, je jouais dans la cour"])
    expect(mark(sentence, "Quand j'étais petit je jouais dans la cour.").correct).toBe(true)
    expect(mark(sentence, "Quand j'étais petit, je jouais dans la cour.").correct).toBe(true)
    // A comma between numbers is not prose: a list of numbers keeps its separators.
    expect(mark(q(['2, 5, 6, 8']), '2568').correct).toBe(false)
    expect(mark(q(['2, 5, 6, 8']), '2,5,6,8').correct).toBe(true)
  })

  it('forgives a closing question mark the accepted answer has and the student left out', () => {
    const question = q(['vous pourriez me dire où est la gare ?'])
    expect(mark(question, 'Vous pourriez me dire où est la gare').correct).toBe(true)
    expect(mark(question, 'Vous pourriez me dire où est la gare ?').correct).toBe(true)
  })

  it('forgives the semicolon that ends an SQL statement, and either quote round a text value', () => {
    const insert = q(["INSERT INTO Club (ClubID, ClubName) VALUES (4, 'Debating')"])
    expect(mark(insert, "INSERT INTO Club (ClubID, ClubName) VALUES (4, 'Debating');").correct).toBe(true)
    expect(mark(insert, 'INSERT INTO Club (ClubID, ClubName) VALUES (4, "Debating");').correct).toBe(true)
    expect(mark(insert, 'INSERT INTO Club (ClubID, ClubName) VALUES (4, Debating)').correct).toBe(false)
  })

  it('keeps the star in SQL, where it is the column list and not a times sign', () => {
    const all = q(['SELECT * FROM Student'])
    expect(mark(all, 'select * from Student;').correct).toBe(true)
    expect(mark(all, 'SELECT FROM Student').correct).toBe(false)
    expect(mark(q(['DELETE FROM Student WHERE StudentID = 2']), 'DELETE * FROM Student WHERE StudentID = 2').correct).toBe(false)
    // Outside SQL it is still a times sign.
    expect(mark(q(['3x']), '3*x').correct).toBe(true)
  })

  it('keeps a times sign between two numbers, so a product of primes cannot run together', () => {
    const product = q(['2^2 × 3 × 7'])
    expect(mark(product, '2^2 × 3 × 7').correct).toBe(true)
    expect(mark(product, '2^2*3*7').correct).toBe(true)
    expect(mark(product, '2^23 × 7').correct).toBe(false)
    expect(mark(product, '2^2 × 37').correct).toBe(false)
    const standard = q(['7.3 × 10^4'])
    expect(mark(standard, '7.3 × 10^4').correct).toBe(true)
    expect(mark(standard, '7.31 × 0^4').correct).toBe(false)
  })

  it('takes a unit typed without its superscript', () => {
    const area = { id: 'q', type: 'numeric', prompt: 'p', answer: 0.68, tolerance: 0.001, units: 'm²', marks: 1 } as unknown as Question
    for (const typed of ['0.68 m²', '0.68 m2', '0.68m^2', '0.68']) expect(mark(area, typed).correct, typed).toBe(true)
    const density = { id: 'q', type: 'numeric', prompt: 'p', answer: 1300, tolerance: 0.5, units: 'kg/m³', marks: 1 } as unknown as Question
    for (const typed of ['1300 kg/m³', '1300 kg/m3', '1300 kg/m^3']) expect(mark(density, typed).correct, typed).toBe(true)
  })

  it('reads a mixed number as whole and fraction, not as digits run together', () => {
    const mixed = q(['2 1/3'])
    expect(mark(mixed, '2 1/3').correct).toBe(true)
    // What the maths field sends for two and a third.
    expect(mark(mixed, '2(1)/(3)').correct).toBe(true)
    expect(mark(mixed, '21/3').correct).toBe(false)
    expect(parseNumber('2(1)/(3)')).toBeCloseTo(7 / 3, 10)
    expect(parseNumber('-1(1)/(2)')).toBeCloseTo(-1.5, 10)
    expect(parseNumber('(7)/(3)')).toBeCloseTo(7 / 3, 10)
  })

  it('keeps the two quote marks apart outside SQL', () => {
    const output = q(['"c"'])
    expect(mark(output, '"c"').correct).toBe(true)
    expect(mark(output, "'c'").correct).toBe(false)
  })

  it('takes a hyphen between words as the space it stands for', () => {
    const drives = q(['solid state, magnetic, optical'])
    expect(mark(drives, 'solid-state, magnetic, optical').correct).toBe(true)
    // Not after a single letter or next to a digit, where it is a minus sign or a name.
    const difference = q(['x-y'])
    expect(mark(difference, 'xy').correct).toBe(false)
    expect(normaliseText('carbon-12')).toBe('carbon-12')
  })

  it('reads quotes round the whole answer as marking a string', () => {
    const output = q(['maerts'])
    expect(mark(output, "'maerts'").correct).toBe(true)
    expect(mark(output, '“maerts”').correct).toBe(true)
    // Unless the accepted answer prints them itself.
    const quoted = q(['"sunset"'])
    expect(mark(quoted, 'sunset').correct).toBe(false)
  })

  it('treats a comma between digits as part of the answer', () => {
    const point = q(['(3,5)'])
    expect(mark(point, '(3, 5)').correct).toBe(true)
    expect(mark(point, '(35)').correct).toBe(false)
  })

  it('leaves normaliseText itself alone, so a decimal point survives', () => {
    expect(normaliseText('2.5')).toBe('2.5')
    expect(normaliseText('Hi Amy!')).toBe('hiamy!')
  })
})

describe('accents', () => {
  const q = (accepted: string[]): Question => ({
    id: 'q', type: 'short-text', prompt: 'p', marks: 1, gradeBand: '4-5', skill: 's',
    calculator: 'either', tags: [], solution: 's', markScheme: [{ code: 'B1', marks: 1, description: 'd' }],
    discriminators: [], accepted,
  })

  it('accepts any mix of accents when the list holds an accent-free twin', () => {
    // The twins said accents were not being marked, but a half-accented answer matched
    // neither twin and was marked wrong.
    const born = q(['je suis née à londres', 'je suis nee a londres'])
    expect(mark(born, 'je suis née a londres').correct).toBe(true)
    expect(mark(born, 'je suis nee à Londres').correct).toBe(true)
    // Only accents are forgiven: dropping the agreement is still wrong.
    expect(mark(born, 'je suis né à londres').correct).toBe(false)
    expect(mark(born, 'je suis allée à londres').correct).toBe(false)
  })

  it('keeps accents strict when the list has no accent-free twin', () => {
    const participle = q(['mangé'])
    expect(mark(participle, 'mangé').correct).toBe(true)
    expect(mark(participle, 'mange').correct).toBe(false)
  })
})

describe('leading articles', () => {
  const q = (accepted: string[]): Question => ({
    id: 'q', type: 'short-text', prompt: 'p', marks: 1, gradeBand: '4-5', skill: 's',
    calculator: 'either', tags: [], solution: 's', markScheme: [{ code: 'B1', marks: 1, description: 'd' }],
    discriminators: [], accepted,
  })

  it('forgives "the", "a" or "an" in front of a plain noun answer', () => {
    expect(mark(q(['stomata']), 'The stomata').correct).toBe(true)
    expect(mark(q(['hybridoma']), 'a hybridoma').correct).toBe(true)
    expect(mark(q(['interrupted cadence']), 'An interrupted cadence.').correct).toBe(true)
  })

  it('keeps a definite article the accepted answer itself begins with', () => {
    // "The sun" names a particular thing, so the article is part of the answer.
    expect(mark(q(['the sun']), 'the sun').correct).toBe(true)
    expect(mark(q(['the sun']), 'sun').correct).toBe(false)
  })

  it('forgives an indefinite article on either side of a definition', () => {
    // "A tax on imports" is how a definition reads, but a student writing the bare
    // phrase the topic itself teaches was being marked wrong.
    expect(mark(q(['a tax on imports']), 'tax on imports').correct).toBe(true)
    expect(mark(q(['a tax on imports']), 'a tax on imports').correct).toBe(true)
    expect(mark(q(['an import tax']), 'import tax').correct).toBe(true)
    expect(mark(q(['a hybridoma']), 'the hybridoma').correct).toBe(true)
  })

  it('keeps program output, equations and accented words strict', () => {
    expect(mark(q(['Hi Amy!']), 'the Hi Amy!').correct).toBe(false)
    expect(mark(q(['Na→Na++e-']), 'the Na→Na++e-').correct).toBe(false)
    expect(mark(q(['mangé']), 'a mangé').correct).toBe(false)
  })
})

describe('negative coordinates', () => {
  const point: Question = {
    id: 'q', type: 'short-text', prompt: 'p', marks: 1, gradeBand: '4-5', skill: 's',
    calculator: 'either', tags: [], solution: 's', markScheme: [{ code: 'B1', marks: 1, description: 'd' }],
    discriminators: [], accepted: ['(0,-2)'],
  }

  it('keeps the comma before a negative number, so (0, -2) is not read as (0-2)', () => {
    expect(mark(point, '(0, -2)').correct).toBe(true)
    expect(mark(point, '(0,−2)').correct).toBe(true)
    expect(mark(point, '(0-2)').correct).toBe(false)
    expect(mark(point, '(0 -2)').correct).toBe(false)
  })
})

/**
 * Found reviewing Chemistry on 23 September 2026: the content prints equations with →,
 * subscripts and superscript charges, and a student typing on a phone gives ->, 2 and +.
 * The accepted lists had tried to spell out every combination by hand — 213 entries across
 * eight topics — and still missed some, so a correct equation typed exactly as the lesson
 * printed it could be marked wrong.
 */
describe('chemical equations', () => {
  const eq = (accepted: string[], prompt = 'Write the equation.'): Question => ({ ...base, prompt, type: 'short-text', accepted })

  it('reads every way of typing an arrow as the same arrow', () => {
    const q = eq(['2Na + Cl2 -> 2NaCl'])
    for (const typed of ['2Na + Cl₂ → 2NaCl', '2Na + Cl2 --> 2NaCl', '2Na + Cl2 => 2NaCl', '2Na+Cl2⟶2NaCl']) {
      expect(mark(q, typed).correct, typed).toBe(true)
    }
    // An equals sign is not folded into an arrow: in maths it means something else.
    expect(normaliseText('a = b')).toBe('a=b')
  })

  it('treats subscript counts as plain digits', () => {
    expect(normaliseText('C₆H₁₂O₆')).toBe(normaliseText('C6H12O6'))
    expect(mark(eq(['CO2']), 'CO₂').correct).toBe(true)
  })

  it('reads a superscript charge as a charge, and a superscript power as a power', () => {
    expect(normaliseText('Fe³⁺')).toBe('fe3+')
    expect(normaliseText('OH⁻')).toBe('oh-')
    expect(normaliseText('Cu²⁺ + 2e⁻ → Cu')).toBe(normaliseText('Cu2+ + 2e- -> Cu'))
    expect(normaliseText('x²')).toBe('x^2')
    expect(normaliseText('x⁻¹')).toBe('x^-1')
  })
})

describe('lists in any order', () => {
  const list = (accepted: string[], prompt = 'Name them.'): Question => ({ ...base, prompt, type: 'short-text', accepted })

  it('accepts the same items in a different order and with different joins', () => {
    const q = list(['nitrogen, phosphorus and potassium'])
    for (const typed of ['potassium, nitrogen, phosphorus', 'phosphorus and potassium and nitrogen', 'Nitrogen; potassium; phosphorus.']) {
      expect(mark(q, typed).correct, typed).toBe(true)
    }
    expect(mark(list(['Fe2+ and Fe3+']), 'Fe³⁺ and Fe²⁺').correct).toBe(true)
    expect(mark(list(['sand, sodium carbonate and limestone']), 'sand, limestone, sodium carbonate').correct).toBe(true)
  })

  it('still needs every item, and no extra ones', () => {
    const q = list(['nitrogen, phosphorus and potassium'])
    expect(mark(q, 'nitrogen and potassium').correct).toBe(false)
    expect(mark(q, 'nitrogen, phosphorus, potassium and calcium').correct).toBe(false)
  })

  it('keeps the order where the order is the answer', () => {
    // Items that start with a number: a sort, a vector, run-length pairs.
    expect(mark(list(['3, 6, 1, 9']), '9, 1, 6, 3').correct).toBe(false)
    expect(mark(list(['4, 5']), '5, 4').correct).toBe(false)
    expect(mark(list(['4a, 3b, 1c']), '3b, 4a, 1c').correct).toBe(false)
    // A question that asks for them in order.
    expect(mark(list(['fetch, decode, execute'], 'Name the three stages, in order.'), 'decode, fetch, execute').correct).toBe(false)
    // Blanks to fill, each word in its own gap.
    expect(mark(list(['plus, que'], 'Il fait ______ chaud ______ dans le nord.'), 'que, plus').correct).toBe(false)
    // An equation's two sides.
    expect(mark(list(['glucose + oxygen -> carbon dioxide + water']), 'carbon dioxide + water -> glucose + oxygen').correct).toBe(false)
    // An item longer than three words is a phrase, not a list entry.
    expect(mark(list(['it is not in the equation and it speeds things up']), 'it speeds things up and it is not in the equation').correct).toBe(false)
  })
})

describe('claiming a typed answer', () => {
  it('gives full marks and records that the student claimed them', () => {
    expect(claimAnswer({ correct: false, marksScored: 0, marksAvailable: 2 })).toEqual({ correct: true, marksScored: 2, marksAvailable: 2, claimed: true })
  })
})

describe('genotypes', () => {
  const q = (prompt: string, accepted: string[]): Question => ({ ...base, marks: 1, type: 'short-text', prompt, accepted })

  it('keeps the case of a genotype, where the case is the answer', () => {
    const cross = q('What is the genotype of all the offspring?', ['Bb', 'all Bb'])
    expect(mark(cross, 'Bb').correct).toBe(true)
    expect(mark(cross, 'all Bb').correct).toBe(true)
    expect(mark(cross, 'BB').correct).toBe(false)
    expect(mark(cross, 'bb').correct).toBe(false)
    expect(mark(cross, 'bB').correct).toBe(false)
    expect(mark(q('Give the genotype.', ['BbTt']), 'bbtt').correct).toBe(false)
  })

  it('keeps a homozygote strict only when the prompt asks for a genotype', () => {
    expect(mark(q('Give the genotype of a homozygous recessive plant.', ['bb']), 'BB').correct).toBe(false)
    expect(mark(q('Give the genotype of a homozygous recessive plant.', ['bb']), 'bb').correct).toBe(true)
  })

  it('still folds case everywhere else', () => {
    expect(mark(q('Who discovered the neutron?', ['James Chadwick']), 'james chadwick').correct).toBe(true)
    expect(mark(q('Name the network.', ['a LAN']), 'lan').correct).toBe(true)
    expect(mark(q('What are the sex chromosomes of a human male?', ['XY']), 'xy').correct).toBe(true)
  })
})

describe('magnification', () => {
  it('reads a times sign on either side of the number', () => {
    expect(parseNumber('×3000')).toBe(3000)
    expect(parseNumber('x 400')).toBe(400)
    expect(parseNumber('400×')).toBe(400)
    expect(parseNumber('400x')).toBe(400)
    expect(parseNumber('1.8 × 10^5')).toBe(180000)
  })
})

describe('matching case', () => {
  const q = (accepted: string[], matchCase: boolean): Question => ({
    id: 'q', type: 'short-text', prompt: 'Which character has the code 84?', marks: 1, gradeBand: '4-5', skill: 's',
    calculator: 'either', tags: [], solution: 's', markScheme: [{ code: 'B1', marks: 1, description: 'd' }],
    discriminators: [], accepted, matchCase,
  })

  it('refuses the other case when the question says case is the answer', () => {
    expect(mark(q(['T'], true), 'T').correct).toBe(true)
    expect(mark(q(['T'], true), 't').correct).toBe(false)
    expect(mark(q(['c'], true), "'c'").correct).toBe(true)
    expect(mark(q(['c'], true), "'C'").correct).toBe(false)
  })

  it('counts the break between words, since exact output is what is marked', () => {
    expect(mark(q(['Hi Amy!'], true), 'Hi Amy!').correct).toBe(true)
    expect(mark(q(['Hi Amy!'], true), "'Hi  Amy!'").correct).toBe(true)
    expect(mark(q(['Hi Amy!'], true), 'HiAmy!').correct).toBe(false)
    expect(mark(q(['FailPass'], true), 'Fail Pass').correct).toBe(false)
    expect(mark(q(['FailPass'], true), 'Fail, Pass').correct).toBe(false)
  })

  it('folds case everywhere else', () => {
    expect(mark(q(['T'], false), 't').correct).toBe(true)
  })
})
