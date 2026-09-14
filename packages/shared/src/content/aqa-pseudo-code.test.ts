import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const DIR = join(import.meta.dirname, '../../../../supabase/seed/content/computer-science')

const topics = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => ({ file: f, text: readFileSync(join(DIR, f), 'utf8') }))

/** The fenced blocks in a topic, which is where pseudo-code lives. */
function codeBlocks(text: string): string[] {
  // The JSON holds the content with \n escaped, so match on the escaped form.
  return [...text.matchAll(/```\\n([\s\S]*?)```/g)].map((m) => m[1]!)
}

/** Blocks that use RETURN with no SUBROUTINE around it, where RETURN means nothing. */
function returnOutsideSubroutine(blocks: string[]): string[] {
  return blocks.filter((b) => /\bRETURN\b/.test(b) && !/\bSUBROUTINE\b/.test(b))
}

/**
 * Variables a block treats as strings, via SUBSTRING or POSITION, that it also
 * subscripts. AQA indexes arrays with [] but has no string indexing: a single
 * character is SUBSTRING(i, i, s), both ends inclusive, counting from 0. Restricting
 * this to variables already used with a string operation keeps a numeric array sum
 * like `total ← total + a[i]`, which is perfectly correct, out of the results.
 */
function stringIndexing(blocks: string[]): string[] {
  return blocks.flatMap((b) => {
    const names = new Set([...b.matchAll(/\bSUBSTRING\(\s*[^,]+,\s*[^,]+,\s*(\w+)\s*\)/g)].map((m) => m[1]!))
    for (const m of b.matchAll(/\bPOSITION\(\s*(\w+)/g)) names.add(m[1]!)
    return [...names].filter((n) => new RegExp(`\\b${n}\\[`).test(b))
  })
}

/**
 * AQA 8525 publishes its own pseudo-code, and its conventions differ from the other
 * boards and from every real language. These rules were all broken at least once by
 * content that read as perfectly correct to anyone thinking in Python or C#, and none
 * of them is visible to schema validation, so they are pinned here.
 */
describe('AQA 8525 pseudo-code conventions', () => {
  it('never calls it exam reference language, which is OCR\'s term', () => {
    const bad = topics.filter((t) => /reference language/i.test(t.text)).map((t) => t.file)
    expect(bad).toEqual([])
  })

  it('never treats a runtime error as a creditable answer', () => {
    // AQA recognises two error types, syntax and logic. The phrase may legitimately
    // appear in prose that corrects it, and a multiple-choice distractor has to say
    // it out loud, so only the places that award marks are checked: an accepted
    // answer or a mark-scheme point naming a third category would be teaching one.
    const bad: string[] = []
    for (const t of topics) {
      const topic = JSON.parse(t.text) as {
        questions: {
          id: string
          accepted?: string[]
          markScheme: { description: string }[]
          criteria?: { text: string }[]
        }[]
      }
      for (const q of topic.questions) {
        const creditable = [...(q.accepted ?? []), ...q.markScheme.map((m) => m.description), ...(q.criteria ?? []).map((c) => c.text)]
        for (const line of creditable) if (/runtime error/i.test(line)) bad.push(`${t.file} ${q.id}: "${line}"`)
      }
    }
    expect(bad).toEqual([])
  })

  it('writes the relational operators as the board prints them', () => {
    // AQA's guide uses ≤ and ≥, never the two-character forms.
    const bad = topics.filter((t) => /<=|>=/.test(t.text)).map((t) => t.file)
    expect(bad).toEqual([])
  })

  it('only uses RETURN inside a subroutine', () => {
    // RETURN means nothing outside SUBROUTINE … ENDSUBROUTINE, and AQA pseudo-code
    // has no loop-break, so an early exit is a RETURN in a subroutine or a flag.
    const bad = topics.flatMap((t) => returnOutsideSubroutine(codeBlocks(t.text)).map(() => t.file))
    expect([...new Set(bad)]).toEqual([])
  })

  it('reads a single character with SUBSTRING rather than indexing a string', () => {
    const bad = topics.flatMap((t) => stringIndexing(codeBlocks(t.text)).map((n) => `${t.file}: ${n}`))
    expect(bad).toEqual([])
  })

  it('has detectors that actually fire, so a clean run means something', () => {
    // A convention test that silently matches nothing is worse than none at all.
    expect(returnOutsideSubroutine(['FOR i ← 0 TO 3\n   RETURN a\nENDFOR'])).toHaveLength(1)
    expect(returnOutsideSubroutine(['SUBROUTINE f(a)\n   RETURN a\nENDSUBROUTINE'])).toHaveLength(0)
    expect(stringIndexing(['out ← out + s[i]\nx ← SUBSTRING(0, 0, s)'])).toEqual(['s'])
    expect(stringIndexing(['total ← total + a[i]\nx ← SUBSTRING(0, 0, s)'])).toEqual([])
  })
})
