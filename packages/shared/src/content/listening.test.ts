import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The French listening items (6 October 2026): every topic has a comprehension question and a
 * dictation in its quiz pool, and no dictation hinges on something the ear cannot hear.
 *
 * Two reviewers found dictations whose right spelling turned on the speaker's sex, which a
 * recording on its own does not give: "je suis allé(e)", "je suis fier/fière", "mes ami(e)s".
 * Written in the third person, or with a word whose ending is heard, the sentence has one
 * spelling. These patterns catch the first-person and second-person forms that hide it.
 */
const DIR = join(import.meta.dirname, '../../../../supabase/seed/content/french')
interface Q { id: string; type: string; accepted?: string[]; listen?: { text: string; dictation?: boolean } }
const topics = readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as { id: string; questions: Q[]; quiz: { questionIds: string[] } })

/** A lookahead, not \b: JavaScript's \b does not count é as a letter, so "tombé" never ended a word. */
const END = String.raw`(?=[\s,.!?]|$)`
const UNHEARD = [
  new RegExp(String.raw`\b(je|tu)\s+(ne\s+|n')?(me\s+|m'|te\s+|t')?(suis|es)\s+(pas\s+|jamais\s+)?\S+(é|i|u)e?s?` + END, 'i'),
  new RegExp(String.raw`\b(je|tu)\s+(ne\s+|n')?(suis|es)\s+(pas\s+)?(fier|fière|cher|seul|heureux|heureuse|prêt|prête)` + END, 'i'),
  /\bmes amie?s\b/i,
  new RegExp(String.raw`\b(nous sommes|vous êtes)\s+\S+(é|i|u)e?s` + END, 'i'),
]

/** The dictations the reviewers flagged, so the patterns are known to catch something. */
const FLAGGED = [
  'Je suis fier de mes deux cultures.', 'Je suis allée en ville avec ma mère.', "Pourquoi est-ce que tu n'es pas venu ?",
  'Ce soir, je vais sortir avec mes amis.', 'Je suis tombé de vélo et je me suis cassé le bras.', "L'été dernier, je suis parti en Espagne.",
]

describe('French listening', () => {
  it('found the French topics', () => expect(topics.length).toBe(53))

  it.each(topics.map((t) => [t.id, t] as const))('%s has a listening question and a dictation in its quiz pool', (_id, t) => {
    expect(t.questions.find((q) => q.id === 'listening')?.listen).toBeTruthy()
    expect(t.questions.find((q) => q.id === 'dictation')?.listen?.dictation).toBe(true)
    expect(t.quiz.questionIds).toEqual(expect.arrayContaining(['listening', 'dictation']))
  })

  it('catches every dictation the reviewers flagged, and none of their fixes', () => {
    for (const f of FLAGGED) expect(UNHEARD.some((r) => r.test(f)), f).toBe(true)
    for (const f of ['Il est fier de ses deux cultures.', 'Elle est allée en ville avec sa mère.', "Pourquoi est-ce que tu n'es pas content ?"]) expect(UNHEARD.some((r) => r.test(f)), f).toBe(false)
  })

  it('never asks for a spelling that turns on who is speaking', () => {
    const hits = topics.flatMap((t) => t.questions.filter((q) => q.listen?.dictation && UNHEARD.some((r) => r.test(q.listen!.text))).map((q) => `${t.id}: ${q.listen!.text}`))
    expect(hits).toEqual([])
  })
})
