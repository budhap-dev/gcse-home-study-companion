import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { mark } from '../marking.ts'

/**
 * An accepted answer beginning "the" is compared strictly.
 *
 * That is deliberate: `withoutArticle` keeps the article when an accepted answer starts
 * with "the", so "the sun" is not matched by a bare "sun". The side effect is that a list
 * offering only "the carbon dioxide produced escaped into the atmosphere" marks the same
 * sentence wrong when a student leaves the article off -- 87 questions across six subjects
 * were in that position, mostly Chemistry.
 *
 * So where the article is grammatical filler in front of a clause, the bare form has to be
 * listed as well. French is the exception: there the answer is usually a translation, and
 * "the timetable" is the translation.
 */
const ROOT = join(import.meta.dirname, '../../../../supabase/seed/content')

interface Item { id: string; type?: string; accepted?: string[] }
interface Topic { id: string; subjectId: string; questions: Item[]; lesson: { steps: { check?: Item }[] } }

const topics: { sub: string; doc: Topic }[] = readdirSync(ROOT)
  .filter((d) => statSync(join(ROOT, d)).isDirectory())
  .flatMap((sub) =>
    readdirSync(join(ROOT, sub))
      .filter((f) => f.endsWith('.json'))
      .map((f) => ({ sub, doc: JSON.parse(readFileSync(join(ROOT, sub, f), 'utf8')) as Topic })),
  )

/** Two words outside French, four inside it, matching how the lists were widened. */
const minWords = (sub: string) => (sub === 'french' ? 4 : 2)

describe('accepted answers that start with "the"', () => {
  it('found the content pack', () => {
    expect(topics.length).toBeGreaterThan(50)
  })

  it('also accept the same answer without the article', () => {
    const offenders: string[] = []
    for (const { sub, doc } of topics) {
      const items = [...doc.questions, ...doc.lesson.steps.flatMap((s) => (s.check ? [s.check] : []))]
      for (const q of items) {
        if (!Array.isArray(q.accepted)) continue
        for (const a of q.accepted) {
          const m = /^the\s+([a-z][a-z -]*)$/i.exec(a)
          if (!m) continue
          const bare = m[1]!
          if (bare.split(/\s+/).length < minWords(sub)) continue
          // The marker is the judge, not the list: another entry may already cover it.
          if (mark(q as never, bare).correct) continue
          offenders.push(`${sub}/${doc.id} ${q.id}: accepts "${a}" but rejects "${bare}"`)
        }
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })
})
