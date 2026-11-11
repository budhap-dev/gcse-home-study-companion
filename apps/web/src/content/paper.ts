import { AUTO_MARKED_TYPES, seededShuffle, type GradeBand, type SubjectGuide } from '@study/shared'
import type { SessionItem } from '../progress/reviewSession.ts'
import type { TopicSummary } from './index.ts'

/**
 * Exam-style papers (TOP-3, WKP-4, WKP-5): which questions a paper asks, and how long it gives.
 * The paper screen itself is PaperSession.tsx; what a paper is made of lives here, so it can be
 * tested without a browser. Like a mixed worksheet, a paper is fixed by its link: the same
 * code always asks the same questions with the same numbers.
 */

/** The written papers' minutes over their marks: about 1.1 a mark in Maths, 1.25 in Computer Science. */
export function minutesPerMark(guide: Pick<SubjectGuide, 'papers'> | undefined): number {
  // Speaking is a conversation and coursework has no exam time: neither paces a written paper.
  const written = (guide?.papers ?? []).filter((p) => p.minutes && !/speaking/i.test(p.name))
  const marks = written.reduce((s, p) => s + p.marks, 0)
  const minutes = written.reduce((s, p) => s + (p.minutes ?? 0), 0)
  return marks > 0 ? minutes / marks : 1
}

/** The time a paper of `marks` allows, in whole minutes, never under five. */
export function minutesFor(marks: number, perMark: number): number {
  return Math.max(5, Math.round(marks * perMark))
}

/** Questions per topic in a unit test: two to four, fewer as the unit has more topics. */
export function perTopic(topicCount: number): number {
  if (topicCount <= 3) return 4
  if (topicCount <= 6) return 3
  if (topicCount <= 12) return 2
  // A whole large unit at once (Maths algebra has 23 topics): one each keeps it near an hour.
  return 1
}

/** The bands a topic's questions are taken from, in turn: a test ramps the way a paper does. */
const BAND_TURNS: GradeBand[] = ['6-7', '4-5', '8-9', '6-7']
const BAND_ORDER: GradeBand[] = ['4-5', '6-7', '8-9']

/**
 * A unit test (TOP-3): `perTopic` questions from each of the topics given, only the kinds the
 * app marks, a spread of grade bands from each, then ordered easiest band first as a paper
 * is. Topics are kept apart where they can be, so two questions from one topic do not sit
 * side by side while another topic has one waiting.
 */
export function unitTestItems(topics: TopicSummary[], code: string): SessionItem[] {
  const k = perTopic(topics.length)
  const picked: { item: SessionItem; band: GradeBand; turn: number }[] = []
  for (const t of topics) {
    const markable = t.questions.filter((q) => AUTO_MARKED_TYPES.includes(q.type))
    const byBand = new Map(BAND_ORDER.map((b) => [b, seededShuffle(markable.filter((q) => q.gradeBand === b).map((q) => q.id), `${code}:${t.id}:${b}`)]))
    const rest = seededShuffle(markable.map((q) => q.id), `${code}:${t.id}`)
    const taken = new Set<string>()
    for (let i = 0; i < k && taken.size < markable.length; i++) {
      const band = BAND_TURNS[i % BAND_TURNS.length]!
      const id = byBand.get(band)!.find((x) => !taken.has(x)) ?? rest.find((x) => !taken.has(x))
      if (!id) break
      taken.add(id)
      picked.push({ item: { topicId: t.id, questionId: id }, band: markable.find((q) => q.id === id)!.gradeBand, turn: i })
    }
  }
  // Easiest band first; within a band, the topics take turns in teaching order.
  const order = new Map(topics.map((t, i) => [t.id, i]))
  return picked
    .sort((a, b) => BAND_ORDER.indexOf(a.band) - BAND_ORDER.indexOf(b.band) || a.turn - b.turn || order.get(a.item.topicId)! - order.get(b.item.topicId)!)
    .map((p) => p.item)
}

/** The topics a unit test covers: the unit's, in one school year or in all of them. */
export function unitTopics(subjectTopics: TopicSummary[], unitId: string, year?: number): TopicSummary[] {
  return subjectTopics.filter((t) => t.unitId === unitId && (year === undefined || t.year === year))
}

/** The link to a unit test of the topics a unit card shows. */
export function unitTestPath(subjectId: string, unitId: string, code: string, year?: number): string {
  return `/subjects/${subjectId}/units/${unitId}/test?${year ? `year=${year}&` : ''}sheet=${code}`
}

/** A year read from a link: one of the school years, or none for the whole unit. */
export function parseYear(raw: string | null): 9 | 10 | 11 | undefined {
  const y = Number(raw)
  return y === 9 || y === 10 || y === 11 ? y : undefined
}
