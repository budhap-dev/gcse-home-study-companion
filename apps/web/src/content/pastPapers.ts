import { PastPaperIndex } from '@study/shared'

/**
 * The past papers index (backlog section 14), read once. Only the reference screens and the
 * topic page's "In past papers" import this, each on demand, so it stays out of the first load.
 */
const files = import.meta.glob('../../../../supabase/seed/past-papers/*.json', { eager: true, import: 'default' })
export const PAST_PAPERS: PastPaperIndex[] = Object.values(files).map((raw) => PastPaperIndex.parse(raw))

export function pastPapersFor(subjectId: string): PastPaperIndex | undefined {
  return PAST_PAPERS.find((p) => p.subjectId === subjectId)
}

export interface PastUse {
  seriesId: string
  series: string
  paper: string
  n: number
  marks: number
  /** The question paper on the board's site. */
  url: string
  /** This topic is the question's main one, not one it also draws on. */
  main: boolean
}

/** Every past paper question that tests a topic, newest series first, in paper and question order. */
export function pastUses(subjectId: string, topicId: string): PastUse[] {
  const index = pastPapersFor(subjectId)
  if (!index) return []
  const out: PastUse[] = []
  for (const s of index.series) {
    for (const p of s.papers) {
      const url = p.links.find((l) => l.kind === 'question-paper')?.url
      if (!url) continue
      for (const q of p.questions ?? []) {
        const at = q.topics.indexOf(topicId)
        if (at >= 0) out.push({ seriesId: s.id, series: s.label, paper: `Paper ${p.id}`, n: q.n, marks: q.marks, url, main: at === 0 })
      }
    }
  }
  return out
}
