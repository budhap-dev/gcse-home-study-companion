import { getSubject } from '@study/shared'
import { Link, useLocation, useParams, useSearchParams } from 'react-router'
import { PaperSession } from '../../components/paper/PaperSession.tsx'
import { TopicLoading } from '../../components/TopicLoading.tsx'
import { ShareSheet } from '../../components/ShareSheet.tsx'
import { getGuide, topicsForSubject } from '../../content/index.ts'
import { useTopics } from '../../content/load.ts'
import { sheetFor } from '../../content/mixedSheet.ts'
import { grade9Items, grade9Path, minutesPerMark, parseYear, unitTestItems, unitTestPath, unitTopics } from '../../content/paper.ts'
import { newSheetCode, sheetParam } from '../../content/sheetCode.ts'
import { itemKey, recordReview } from '../../progress/reviewSession.ts'


/** The two papers a unit card offers: what each is called, picks and says about itself. */
const KINDS = {
  'unit-test': {
    name: 'Unit test',
    pick: unitTestItems,
    path: unitTestPath,
    another: 'A different test',
    intro: [
      'Easier questions first, as a paper starts; the topic of each is shown only once it is handed in.',
      'It adds to each topic’s history and keeps it from fading; a topic’s quiz still decides its status.',
    ],
  },
  'grade-9': {
    name: 'Grade 9 set',
    pick: grade9Items,
    path: grade9Path,
    another: 'A new set',
    intro: [
      'Grade 8 to 9 problems only: multi-step, unfamiliar contexts, show that. Expect to be stretched.',
      'Each comes with a full worked solution and its mark scheme once the set is handed in.',
      'It adds to each topic’s history; a topic’s quiz and Advanced worksheet still decide its status.',
    ],
  },
} as const

/**
 * A unit's papers: an end-of-unit test (TOP-3), two to four questions from each topic, or a
 * grade 9 set (WKP-5), eight of the hardest problems; both from the topics a unit card shows,
 * on the paper screen. The link fixes the paper, so it can be sent and sat by someone else.
 * Recorded per topic like a mixed worksheet: a visit to each topic, wrong answers to Redo my
 * mistakes, and no change to a topic's quiz-based status.
 */
export function UnitPaper({ kind }: { kind: keyof typeof KINDS }) {
  const k = KINDS[kind]
  const { subjectId = '', unitId = '' } = useParams()
  const [params] = useSearchParams()
  const { pathname, search } = useLocation()
  const year = parseYear(params.get('year'))
  const code = sheetParam(params)
  const subject = getSubject(subjectId)
  const unit = subject?.units.find((u) => u.id === unitId)
  const topics = unitTopics(topicsForSubject(subjectId), unitId, year)
  const items = code ? k.pick(topics, code) : []
  const loaded = useTopics(items.map((m) => ({ subjectId, topicId: m.topicId })))

  if (!subject || !unit || !code || items.length === 0) {
    return (
      <article className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <h1 className="text-2xl font-bold">This {k.name.toLowerCase()} link is not complete</h1>
        <p className="text-ink-2">It is started from a unit on the subject’s map.</p>
        <Link to={subject ? `/subjects/${subjectId}` : '/subjects'} className="btn btn-primary btn-lg w-fit">Go to the map</Link>
      </article>
    )
  }
  if (!loaded) return <TopicLoading />
  const questions = sheetFor({ subjectId, code }, items, loaded)
  const seen = new Map(questions.map((q) => [itemKey(q.item), q.question]))
  const name = `${unit.name}${year ? ` · Year ${year}` : ''}`
  const from = [...new Set(items.map((m) => m.topicId))].length
  return (
    <PaperSession
      key={`${pathname}${search}`}
      storageKey={`study-companion.paper.${kind}.${subjectId}.${unitId}`}
      path={`${pathname}${search}`}
      subjectId={subjectId}
      kicker={`${subject.name} · ${k.name}`}
      title={name}
      intro={[`From ${from} ${from === 1 ? 'topic' : 'topics'}: ${topics.filter((t) => items.some((m) => m.topicId === t.id)).map((t) => t.title).join(', ')}.`, ...k.intro]}
      questions={questions}
      perMark={minutesPerMark(getGuide(subjectId))}
      studyKind="review"
      back={{ to: `/subjects/${subjectId}`, label: `Back to ${subject.name}` }}
      record={(r) => recordReview(r.id, items, r.answers, (id) => loaded.get(id), r.finishedAt, kind, { seen: (m) => seen.get(itemKey(m)), seed: code }, r.timed ? { timed: r.timed } : {})}
      after={
        <>
          <ShareSheet path={`${pathname}${search}`} title={`${subject.name} · ${k.name.toLowerCase()} · ${name}`} />
          <Link to={k.path(subjectId, unitId, newSheetCode(), year)} className="btn btn-primary btn-lg">{k.another}</Link>
          <Link to={`/subjects/${subjectId}`} className="btn btn-secondary btn-lg">Back to the map</Link>
        </>
      }
    />
  )
}

export function UnitTest() {
  return <UnitPaper kind="unit-test" />
}

export function Grade9Set() {
  return <UnitPaper kind="grade-9" />
}
