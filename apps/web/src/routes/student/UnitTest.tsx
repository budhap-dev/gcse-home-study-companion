import { getSubject } from '@study/shared'
import { Link, useLocation, useParams, useSearchParams } from 'react-router'
import { PaperSession } from '../../components/paper/PaperSession.tsx'
import { TopicLoading } from '../../components/TopicLoading.tsx'
import { ShareSheet } from '../../components/ShareSheet.tsx'
import { getGuide, topicsForSubject } from '../../content/index.ts'
import { useTopics } from '../../content/load.ts'
import { sheetFor } from '../../content/mixedSheet.ts'
import { minutesPerMark, parseYear, unitTestItems, unitTestPath, unitTopics } from '../../content/paper.ts'
import { newSheetCode, sheetParam } from '../../content/sheetCode.ts'
import { itemKey, recordReview } from '../../progress/reviewSession.ts'

const BUTTON = 'flex min-h-12 items-center justify-center rounded-xl px-5 font-bold'

/**
 * An end-of-unit test (TOP-3): two to four questions from each topic a unit card shows, on the
 * paper screen. The link fixes the paper, so a test can be sent and sat by someone else.
 * Recorded per topic like a mixed worksheet: a visit to each topic, wrong answers to Redo my
 * mistakes, and no change to a topic's quiz-based status.
 */
export function UnitTest() {
  const { subjectId = '', unitId = '' } = useParams()
  const [params] = useSearchParams()
  const { pathname, search } = useLocation()
  const year = parseYear(params.get('year'))
  const code = sheetParam(params)
  const subject = getSubject(subjectId)
  const unit = subject?.units.find((u) => u.id === unitId)
  const topics = unitTopics(topicsForSubject(subjectId), unitId, year)
  const items = code ? unitTestItems(topics, code) : []
  const loaded = useTopics(items.map((m) => ({ subjectId, topicId: m.topicId })))

  if (!subject || !unit || !code || items.length === 0) {
    return (
      <article className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <h1 className="text-2xl font-bold">This unit test link is not complete</h1>
        <p className="text-ink-2">A unit test is started from a unit on the subject’s map.</p>
        <Link to={subject ? `/subjects/${subjectId}` : '/subjects'} className={`${BUTTON} w-fit bg-ink text-surface`}>Go to the map</Link>
      </article>
    )
  }
  if (!loaded) return <TopicLoading />
  const questions = sheetFor({ subjectId, code }, items, loaded)
  const seen = new Map(questions.map((q) => [itemKey(q.item), q.question]))
  const name = `${unit.name}${year ? ` · Year ${year}` : ''}`
  return (
    <PaperSession
      key={`${pathname}${search}`}
      storageKey={`study-companion.paper.unit.${subjectId}.${unitId}`}
      path={`${pathname}${search}`}
      subjectId={subjectId}
      kicker={`${subject.name} · Unit test`}
      title={name}
      intro={[
        `From ${topics.length} ${topics.length === 1 ? 'topic' : 'topics'}: ${topics.map((t) => t.title).join(', ')}.`,
        'Easier questions first, as a paper starts; the topic of each is shown only once it is handed in.',
        'It adds to each topic’s history and keeps it from fading; a topic’s quiz still decides its status.',
      ]}
      questions={questions}
      perMark={minutesPerMark(getGuide(subjectId))}
      studyKind="review"
      record={(r) => recordReview(r.id, items, r.answers, (id) => loaded.get(id), r.finishedAt, 'unit-test', { seen: (m) => seen.get(itemKey(m)), seed: code }, r.timed ? { timed: r.timed } : {})}
      after={
        <>
          <ShareSheet path={`${pathname}${search}`} title={`${subject.name} · unit test · ${name}`} />
          <Link to={unitTestPath(subjectId, unitId, newSheetCode(), year)} className={`${BUTTON} bg-[color:var(--subject)] text-white`}>A different test</Link>
          <Link to={`/subjects/${subjectId}`} className={`${BUTTON} border border-rule bg-surface`}>Back to the map</Link>
        </>
      }
    />
  )
}
