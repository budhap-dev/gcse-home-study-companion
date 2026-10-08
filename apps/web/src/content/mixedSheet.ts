import { AUTO_MARKED_TYPES, seededShuffle, sheetQuestions, type Generated, type Question, type Topic, type WorksheetLevel } from '@study/shared'
import type { SessionItem } from '../progress/reviewSession.ts'
import type { TopicSummary } from './index.ts'

/**
 * A mixed worksheet (WKS-4, WKP-3): questions from several topics at one level, so the
 * student has to decide which method each one needs instead of being told by the topic.
 *
 * Everything about a sheet is in its link: the topics, the level, how many questions and the
 * sheet code. The code decides which written questions are picked and, where a generator
 * exists, their numbers, so the same link always opens, prints and marks the same sheet.
 */
export interface MixedSpec {
  subjectId: string
  topicIds: string[]
  level: WorksheetLevel
  count: number
  code: string
}

export const MIXED_COUNTS = [5, 8, 10, 12, 15, 20] as const
/** Fewer than three topics and the topic still gives the method away. */
export const MIXED_MIN_TOPICS = 3
const LEVELS: WorksheetLevel[] = ['core', 'higher', 'advanced']

export function parseSpec(subjectId: string, params: URLSearchParams): MixedSpec | undefined {
  const topicIds = (params.get('topics') ?? '').split(',').filter((t) => /^[a-z0-9-]+$/.test(t))
  const level = LEVELS.find((l) => l === params.get('level'))
  const count = Number(params.get('n'))
  const code = params.get('sheet')?.toLowerCase()
  if (topicIds.length < MIXED_MIN_TOPICS || !level || !MIXED_COUNTS.includes(count as never) || !code || !/^[a-z0-9]{4,12}$/.test(code)) return undefined
  return { subjectId, topicIds: [...new Set(topicIds)], level, count, code }
}

/** The link to a sheet: on screen, or printed with one or more versions (one code each). */
export function mixedPath(spec: MixedSpec, print?: { codes: string[]; answers?: boolean }): string {
  const q = `topics=${spec.topicIds.join(',')}&level=${spec.level}&n=${spec.count}`
  return print
    ? `/subjects/${spec.subjectId}/mixed/print?${q}&sheet=${print.codes[0]}&sheets=${print.codes.join(',')}${print.answers ? '&answers=1' : ''}`
    : `/subjects/${spec.subjectId}/mixed?${q}&sheet=${spec.code}`
}

/** The codes of the versions to print, read from a print link; the sheet's own code is the first. */
export function versionCodes(params: URLSearchParams, first: string): string[] {
  const listed = (params.get('sheets') ?? '').split(',').map((c) => c.toLowerCase()).filter((c) => /^[a-z0-9]{4,12}$/.test(c))
  return [...new Set([first, ...listed])].slice(0, 4)
}

/**
 * The written questions a sheet uses, in the order it asks them.
 *
 * Only questions the app can mark go in, since a mixed sheet is marked as it goes. Each
 * topic's questions at the level are shuffled by the code, then topics take turns, so the
 * sheet spreads across every topic chosen and never asks two from one topic in a row while
 * another still has some left.
 */
export function pickItems(spec: MixedSpec, summaries: TopicSummary[]): SessionItem[] {
  const pools = seededShuffle(spec.topicIds, spec.code).flatMap((topicId) => {
    const t = summaries.find((s) => s.id === topicId && s.subjectId === spec.subjectId)
    if (!t) return []
    const markable = new Set(t.questions.filter((q) => AUTO_MARKED_TYPES.includes(q.type)).map((q) => q.id))
    return [{ topicId, ids: seededShuffle(t.worksheets[spec.level].questionIds.filter((id) => markable.has(id)), `${spec.code}:${topicId}`) }]
  })
  const items: SessionItem[] = []
  for (let round = 0; items.length < spec.count && pools.some((p) => p.ids.length > round); round++) {
    for (const p of pools) if (items.length < spec.count && p.ids[round]) items.push({ topicId: p.topicId, questionId: p.ids[round]! })
  }
  return items
}

export interface MixedQuestion { item: SessionItem; question: Question; generated?: Generated }

/** The questions as the sheet shows them: new numbers wherever a generator exists. */
export function sheetFor(spec: MixedSpec, items: SessionItem[], topics: Map<string, Topic>): MixedQuestion[] {
  const fresh = new Map<string, MixedQuestion>()
  for (const topicId of new Set(items.map((m) => m.topicId))) {
    const t = topics.get(topicId)
    if (!t) continue
    const written = items.filter((m) => m.topicId === topicId).flatMap((m) => t.questions.filter((q) => q.id === m.questionId))
    for (const s of sheetQuestions(spec.subjectId, topicId, written, spec.code)) fresh.set(`${topicId}/${s.question.id}`, { item: { topicId, questionId: s.question.id }, question: s.question, ...(s.generated ? { generated: s.generated } : {}) })
  }
  return items.flatMap((m) => fresh.get(`${m.topicId}/${m.questionId}`) ?? [])
}
