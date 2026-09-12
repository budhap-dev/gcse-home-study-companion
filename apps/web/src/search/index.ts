import { getSubject } from '@study/shared'
import { TOPICS } from '../content/index.ts'

/**
 * One searchable place in the app. Records are per **section**, not per topic, so a hit
 * on "conjugate" lands on the grade 9 step of Surds rather than the topic page, and the
 * result can say which part of the topic matched.
 *
 * The index is derived from the already-bundled content, so it costs no extra download.
 * It is built once, lazily, on the first search.
 */
export interface SearchRecord {
  /** Unique within the index. */
  key: string
  subjectId: string
  subjectName: string
  subjectColour: string
  topicId: string
  topicTitle: string
  /** What this record is: the topic itself, a lesson step, the exam note, a question. */
  kind: 'topic' | 'lesson' | 'exam-technique' | 'question'
  /** Shown as the result heading, under the topic title. */
  heading: string
  /** Where clicking the result goes. */
  to: string
  /** The searchable body. */
  text: string
  /** Every distinct word in title, heading and body, for stem matching. */
  words: Set<string>
}

export interface SearchHit {
  record: SearchRecord
  score: number
  snippet: string
}

/** Strips the markdown and maths that would otherwise clutter a snippet. */
function plain(source: string): string {
  return source
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\$\$([\s\S]+?)\$\$/g, ' $1 ')
    .replace(/\$([^$\n]+?)\$/g, ' $1 ')
    .replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1')
    .replace(/\\[a-zA-Z]+/g, ' ')
    .replace(/[*_`#>{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

let cached: SearchRecord[] | null = null

export function searchIndex(): SearchRecord[] {
  if (cached) return cached
  const records: SearchRecord[] = []
  const blank = new Set<string>()
  for (const topic of TOPICS) {
    const subject = getSubject(topic.subjectId)
    const base = `/subjects/${topic.subjectId}/topics/${topic.id}`
    const common = {
      subjectId: topic.subjectId,
      subjectName: subject?.name ?? topic.subjectId,
      subjectColour: subject?.colour ?? '#1e2330',
      topicId: topic.id,
      topicTitle: topic.title,
    }
    const unit = subject?.units.find((u) => u.id === topic.unitId)?.name ?? ''

    records.push({
      ...common, key: topic.id, kind: 'topic', heading: unit, to: base, words: blank,
      text: plain([topic.title, unit, topic.specPoints.join(' '), topic.lesson.steps.map((s) => s.title).join('. ')].join('. ')),
    })

    topic.lesson.steps.forEach((step, i) => {
      records.push({
        ...common, key: `${topic.id}#${step.id}`, kind: 'lesson', heading: step.title, words: blank,
        // Deep link: the lesson opens on this step rather than wherever the student left off.
        to: `${base}/lesson?step=${i + 1}`,
        // The step title is the heading already, so it is left out of the body to stop
        // the snippet repeating what the result has just said. Title matches still score
        // through `heading`, and the stem index takes the heading in as well.
        text: plain([step.body, step.check?.prompt ?? ''].join('. ')),
      })
    })

    records.push({
      ...common, key: `${topic.id}#exam`, kind: 'exam-technique', heading: 'Exam technique', words: blank,
      to: `/subjects/${topic.subjectId}/exam-technique`,
      text: plain([topic.examTechnique.body, ...topic.examTechnique.examinerErrors, topic.examTechnique.grade9Looks].join('. ')),
    })

    // Questions are one record for the whole bank: finding "which topic asks about
    // recoil" is useful, but a result per question would drown everything else.
    records.push({
      ...common, key: `${topic.id}#questions`, kind: 'question', heading: `${topic.questions.length} questions`, words: blank,
      to: `${base}/quiz`,
      text: plain(topic.questions.map((q) => `${q.prompt} ${q.skill}`).join('. ')),
    })
  }
  for (const record of records) {
    const all = `${record.topicTitle} ${record.heading} ${record.subjectName} ${record.text}`
    // Index the joined-up form of a hyphenated word as well, so a student who types
    // "breakeven" finds content that writes "break-even".
    record.words = new Set([...tokens(all), ...tokens(all.replace(/[-–—]/g, ''))])
  }
  cached = records
  return records
}

function tokens(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? []
}

function sharedPrefix(a: string, b: string): number {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return i
}

/**
 * Whether a word in the content is the same idea as a word the student typed, allowing
 * for the endings English puts on school vocabulary. The school says *congruency*, the
 * topic is called *Congruent triangles*, and exact matching finds nothing.
 *
 * A word the query sits inside always counts, which covers plurals and compounds. Beyond
 * that the two must agree on most of the **longer** word — at least four characters and
 * 70% of its length — so congruency reaches congruent, while read stays away from real
 * and readxyz reaches nothing at all.
 */
export function sameStem(word: string, term: string): boolean {
  if (word.includes(term)) return true
  const need = Math.max(4, Math.ceil(Math.max(word.length, term.length) * 0.7))
  return sharedPrefix(word, term) >= need
}

/** Where the term first appears, or failing that the first word that shares its stem, so the snippet shows what matched. */
function firstMatch(lower: string, term: string): number {
  const literal = lower.indexOf(term)
  if (literal !== -1) return literal
  for (const m of lower.matchAll(/[a-z0-9]+/g)) if (sameStem(m[0], term)) return m.index ?? -1
  return -1
}

function makeSnippet(text: string, terms: string[]): string {
  const lower = text.toLowerCase()
  let at = -1
  for (const term of terms) {
    const found = firstMatch(lower, term)
    if (found !== -1 && (at === -1 || found < at)) at = found
  }
  if (at === -1) return text.slice(0, 150) + (text.length > 150 ? '…' : '')
  const start = Math.max(0, at - 60)
  const end = Math.min(text.length, at + 110)
  return (start > 0 ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : '')
}

export function searchTerms(query: string): string[] {
  return query.toLowerCase().split(/\s+/).map((t) => t.trim()).filter((t) => t.length > 1)
}

/**
 * Weighted scoring: a hit in a topic title or a step heading is worth far more than one
 * buried in the body. Every word must match somewhere, which keeps a two-word query
 * from returning everything that mentions either word.
 */
export function search(query: string, records: SearchRecord[] = searchIndex()): SearchHit[] {
  const terms = searchTerms(query)
  if (terms.length === 0) return []

  const hits: SearchHit[] = []
  for (const record of records) {
    const title = record.topicTitle.toLowerCase()
    const heading = record.heading.toLowerCase()
    const subject = record.subjectName.toLowerCase()
    const body = record.text.toLowerCase()

    let score = 0
    let matchedAll = true
    for (const term of terms) {
      let s = 0
      if (title.includes(term)) s += 10
      if (title.split(/\s+/).includes(term)) s += 6
      if (heading.includes(term)) s += 6
      if (subject.includes(term)) s += 4
      if (body.includes(term)) s += 1
      if (s === 0 && body.replace(/[-–—]/g, '').includes(term)) s += 1
      // Nothing matched exactly: fall back to the stem, at a lower weight so an exact
      // hit always outranks an inflected one.
      if (s === 0 && [...record.words].some((w) => sameStem(w, term))) {
        s += tokens(`${title} ${heading}`).some((w) => sameStem(w, term)) ? 5 : 1
      }
      if (s === 0) matchedAll = false
      score += s
    }
    // A topic record outranks its own sections when the title is what matched.
    if (record.kind === 'topic') score += 2
    if (matchedAll && score > 0) hits.push({ record, score, snippet: makeSnippet(record.text, terms) })
  }
  return hits.sort((a, b) => b.score - a.score || a.record.key.localeCompare(b.record.key))
}
