import { GlossaryFile, entrySlug, type GlossaryEntry } from '@study/shared'

/**
 * The glossary, bundled at build time from supabase/seed/glossary, the same way topics
 * are. It is small text next to the topics themselves, and both the glossary page and
 * the search box need it immediately, so there is nothing to gain by fetching it.
 */
const files = import.meta.glob('../../../../supabase/seed/glossary/*.json', { eager: true, import: 'default' })

export interface Term extends GlossaryEntry {
  slug: string
}

export const GLOSSARY: Term[] = Object.values(files)
  .flatMap((raw) => GlossaryFile.parse(raw).entries)
  .map((entry) => ({ ...entry, slug: entrySlug(entry) }))
  .sort((a, b) => a.term.localeCompare(b.term, 'en', { sensitivity: 'base' }))

const bySlug = new Map(GLOSSARY.map((t) => [t.slug, t]))
export function termBySlug(slug: string): Term | undefined {
  return bySlug.get(slug)
}

/**
 * Resolves a `related` name to its entry, preferring one in the same subject so that
 * Maths "Index" points at the Maths entry and Computer Science at its own. Unknown
 * names are ignored rather than an error, so a name can be written before its entry is.
 */
export function termByName(name: string, subjectId?: string): Term | undefined {
  const matches = GLOSSARY.filter((t) => t.term.toLowerCase() === name.toLowerCase())
  return matches.find((t) => t.subjectId === subjectId) ?? matches[0]
}

/** The terms a topic teaches, in the order the glossary lists them. */
export function termsForTopic(topicId: string): Term[] {
  return GLOSSARY.filter((t) => t.topics.includes(topicId))
}
