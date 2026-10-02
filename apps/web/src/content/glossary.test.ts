import { describe, expect, it } from 'vitest'
import { GLOSSARY, termByName, termBySlug } from './glossary.ts'

/** The lookup as it was first written: every term compared for every name. */
function byScanning(name: string, subjectId?: string) {
  const matches = GLOSSARY.filter((t) => t.term.toLowerCase() === name.toLowerCase())
  return matches.find((t) => t.subjectId === subjectId) ?? matches[0]
}

describe('looking a term up by name', () => {
  it('finds what a scan of the whole list finds, for every "see also" in the glossary', () => {
    let asked = 0
    let found = 0
    for (const term of GLOSSARY) {
      for (const name of term.related) {
        asked++
        const hit = termByName(name, term.subjectId)
        expect(hit, `${term.term} -> ${name}`).toBe(byScanning(name, term.subjectId))
        if (hit) found++
      }
    }
    // Floors, so that a glossary with no "see also" names could not pass as one checked.
    expect(asked).toBeGreaterThan(1000)
    expect(found).toBeGreaterThan(500)
  })

  it('prefers the entry in the asking subject when two subjects share a name', () => {
    expect(termByName('Index', 'maths')?.subjectId).toBe('maths')
    expect(termByName('Index', 'computer-science')?.subjectId).toBe('computer-science')
    expect(termByName('tangent', 'physics')?.subjectId).toBe('physics')
  })

  it('ignores case, and falls back to the first entry of that name', () => {
    expect(termByName('INDEX', 'french')).toBe(byScanning('index'))
    expect(termByName('index')).toBe(byScanning('index'))
  })

  it('returns nothing for a name with no entry yet', () => {
    expect(termByName('no such term anywhere')).toBeUndefined()
  })

  it('gives every term a slug of its own', () => {
    for (const term of GLOSSARY) expect(termBySlug(term.slug), term.slug).toBe(term)
  })
})
