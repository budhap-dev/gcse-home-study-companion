import { AUTO_MARKED_TYPES, seededShuffle, sheetQuestions, type Generated, type Question, type Topic, type WorksheetLevel } from '@study/shared'
import type { SessionItem } from '../progress/reviewSession.ts'
import { getGuide, type TopicSummary } from './index.ts'
import { minutesPerMark } from './paper.ts'
import { groupParts } from './parts.ts'

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
  /** One worksheet level, or `all`: a timed practice in one topic that climbs from Core to Advanced. */
  level: MixedLevel
  /** How long the sheet should take, at the exam's pace (13 November 2026). Set instead of `count`. */
  minutes?: number
  /** How many questions; links made before lengths existed still carry it. */
  count?: number
  code: string
}
export type MixedLevel = WorksheetLevel | 'all'

export const MIXED_COUNTS = [5, 8, 10, 12, 15, 20] as const
/** The lengths a sheet can be asked for, in minutes. */
export const LENGTHS = [10, 30, 60] as const
export const LENGTH_LABEL: Record<(typeof LENGTHS)[number], string> = { 10: '10 min', 30: '30 min', 60: '1 hour' }
/** Fewer than three topics and the topic still gives the method away. */
export const MIXED_MIN_TOPICS = 3
const LEVELS: WorksheetLevel[] = ['core', 'higher', 'advanced']

export function parseSpec(subjectId: string, params: URLSearchParams): MixedSpec | undefined {
  const topicIds = [...new Set((params.get('topics') ?? '').split(',').filter((t) => /^[a-z0-9-]+$/.test(t)))]
  const raw = params.get('level')
  const level: MixedLevel | undefined = raw === 'all' ? 'all' : LEVELS.find((l) => l === raw)
  const minutes = Number(params.get('min'))
  const count = Number(params.get('n'))
  const code = params.get('sheet')?.toLowerCase()
  const timed = LENGTHS.includes(minutes as never)
  if (!level || !code || !/^[a-z0-9]{4,12}$/.test(code)) return undefined
  // A practice across every level is one topic's own; a mix at one level still needs three topics.
  if (topicIds.length < (level === 'all' ? 1 : MIXED_MIN_TOPICS) || (level === 'all' && !timed)) return undefined
  if (timed) return { subjectId, topicIds, level, minutes, code }
  if (!MIXED_COUNTS.includes(count as never)) return undefined
  return { subjectId, topicIds, level, count, code }
}

/** The link to a sheet: on screen, or printed with one or more versions (one code each). */
export function mixedPath(spec: MixedSpec, print?: { codes: string[]; answers?: boolean }): string {
  const q = `topics=${spec.topicIds.join(',')}&level=${spec.level}&${spec.minutes ? `min=${spec.minutes}` : `n=${spec.count}`}`
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
  if (spec.minutes) return pickForTime(spec, spec.minutes, summaries)
  const level = spec.level === 'all' ? 'higher' : spec.level
  const count = spec.count ?? 10
  const pools = seededShuffle(spec.topicIds, spec.code).flatMap((topicId) => {
    const t = summaries.find((s) => s.id === topicId && s.subjectId === spec.subjectId)
    if (!t) return []
    const markable = new Set(t.questions.filter((q) => AUTO_MARKED_TYPES.includes(q.type)).map((q) => q.id))
    return [{ topicId, ids: seededShuffle(t.worksheets[level].questionIds.filter((id) => markable.has(id)), `${spec.code}:${topicId}`) }]
  })
  const items: SessionItem[] = []
  for (let round = 0; items.length < count && pools.some((p) => p.ids.length > round); round++) {
    for (const p of pools) if (items.length < count && p.ids[round]) items.push({ topicId: p.topicId, questionId: p.ids[round]! })
  }
  return groupParts(items, summaries)
}

/**
 * A sheet that fills a length of time at the exam's pace (the written papers' minutes over
 * their marks), not a number of questions. It is built from units: a question on its own, or
 * the markable parts of one multi-part question together, since a part drawn alone would lose
 * the parts that lead up to it. Each pool (a topic at a level) is shuffled by the code and the
 * pools take turns, a unit going in only while it fits; when nothing fits, the shortest unit
 * goes in alone. A practice across every level asks its Core questions first, then Higher,
 * then Advanced, so it ramps the way a paper does.
 */
export function pickForTime(spec: MixedSpec, minutes: number, summaries: TopicSummary[]): SessionItem[] {
  const budget = minutes / minutesPerMark(getGuide(spec.subjectId))
  const levels = spec.level === 'all' ? LEVELS : [spec.level]
  interface Unit { topicId: string; ids: string[]; marks: number; rank: number }
  const pools: Unit[][] = []
  for (const topicId of seededShuffle(spec.topicIds, spec.code)) {
    const t = summaries.find((s) => s.id === topicId && s.subjectId === spec.subjectId)
    if (!t) continue
    const byId = new Map(t.questions.map((q) => [q.id, q]))
    const taken = new Set<string>()
    levels.forEach((level, rank) => {
      const units = new Map<string, Unit>()
      for (const id of t.worksheets[level].questionIds) {
        const q = byId.get(id)
        if (!q || taken.has(id) || !AUTO_MARKED_TYPES.includes(q.type)) continue
        taken.add(id)
        const key = q.stemId ?? id
        const u = units.get(key) ?? { topicId, ids: [], marks: 0, rank }
        u.ids.push(id); u.marks += q.marks
        units.set(key, u)
      }
      // Parts in the order the topic writes them, (a) before (b).
      const order = new Map(t.questions.map((q, i) => [q.id, i]))
      for (const u of units.values()) u.ids.sort((a, b) => order.get(a)! - order.get(b)!)
      const keys = seededShuffle([...units.keys()], `${spec.code}:${topicId}:${level}`)
      pools.push(keys.map((k) => units.get(k)!))
    })
  }
  const picked: Unit[] = []
  let used = 0
  const longest = Math.max(0, ...pools.map((p) => p.length))
  for (let round = 0; round < longest; round++) {
    for (const p of pools) {
      const u = p[round]
      if (u && used + u.marks <= budget) { picked.push(u); used += u.marks }
    }
  }
  if (!picked.length) {
    const shortest = pools.flat().sort((a, b) => a.marks - b.marks)[0]
    if (shortest) picked.push(shortest)
  }
  const ordered = spec.level === 'all' ? picked.map((u, i) => ({ u, i })).sort((a, b) => a.u.rank - b.u.rank || a.i - b.i).map((x) => x.u) : picked
  return ordered.flatMap((u) => u.ids.map((questionId) => ({ topicId: u.topicId, questionId })))
}

export interface MixedQuestion { item: SessionItem; question: Question; generated?: Generated }

/** The questions as the sheet shows them: new numbers wherever a generator exists. */
export function sheetFor(spec: Pick<MixedSpec, 'subjectId' | 'code'>, items: SessionItem[], topics: Map<string, Topic>): MixedQuestion[] {
  const fresh = new Map<string, MixedQuestion>()
  for (const topicId of new Set(items.map((m) => m.topicId))) {
    const t = topics.get(topicId)
    if (!t) continue
    const written = items.filter((m) => m.topicId === topicId).flatMap((m) => t.questions.filter((q) => q.id === m.questionId))
    for (const s of sheetQuestions(spec.subjectId, topicId, written, spec.code)) fresh.set(`${topicId}/${s.question.id}`, { item: { topicId, questionId: s.question.id }, question: s.question, ...(s.generated ? { generated: s.generated } : {}) })
  }
  return items.flatMap((m) => fresh.get(`${m.topicId}/${m.questionId}`) ?? [])
}
