import { getSubject, sheetQuestions, type Question, type Topic as TopicRecord, type WorksheetLevel } from '@study/shared'
import { useMemo } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router'
import { PaperSession, type PaperRecord } from '../../components/paper/PaperSession.tsx'
import { TopicLoading } from '../../components/TopicLoading.tsx'
import { TopicMissing } from '../../components/TopicMissing.tsx'
import { getGuide } from '../../content/index.ts'
import { useTopic } from '../../content/load.ts'
import { minutesPerMark } from '../../content/paper.ts'
import { sheetParam } from '../../content/sheetCode.ts'
import { itemKey } from '../../progress/reviewSession.ts'
import { settle } from '../../progress/settle.ts'
import { getState, recordAttempt } from '../../progress/store.ts'
import { xpForQuestions } from '../../progress/xp.ts'
import { describeAnswer } from '@study/shared'

const LEVELS: WorksheetLevel[] = ['core', 'higher', 'advanced']
const LEVEL_LABEL: Record<WorksheetLevel, string> = { core: 'Core', higher: 'Higher', advanced: 'Advanced' }
const BUTTON = 'flex min-h-12 items-center justify-center rounded-xl px-5 font-bold'

/** The link to a worksheet sat as a timed paper: with a sheet code on a retry, which draws new numbers. */
export function timedPath(subjectId: string, topicId: string, level: WorksheetLevel, code?: string): string {
  return `/subjects/${subjectId}/topics/${topicId}/worksheet/${level}/timed${code ? `?sheet=${code}` : ''}`
}

/**
 * Records a timed worksheet exactly as the worksheet records itself: the same kind and level,
 * so it moves the topic's status as the untimed sheet would, with the time it took beside it.
 */
export function recordTimedWorksheet(topic: TopicRecord, level: WorksheetLevel, questions: Question[], r: PaperRecord, seed?: string) {
  const results = questions.map((q) => {
    const a = r.answers[itemKey({ topicId: topic.id, questionId: q.id })]
    const got = a?.result.marksScored ?? 0
    return {
      id: q.id, skill: q.skill, gradeBand: q.gradeBand, marksScored: got, marksAvailable: q.marks, correct: got === q.marks,
      ...(a?.self ? { self: true } : { answer: describeAnswer(q, a?.answer) }),
      ...(a?.result.claimed ? { claimed: true } : {}),
    }
  })
  const band89 = results.filter((x) => x.gradeBand === '8-9')
  const selfMarked = questions.map((q) => r.answers[itemKey({ topicId: topic.id, questionId: q.id })])
  const before = getState()
  recordAttempt({
    id: r.id,
    topicId: topic.id,
    kind: 'worksheet',
    level,
    marksScored: results.reduce((n, x) => n + x.marksScored, 0),
    marksAvailable: results.reduce((n, x) => n + x.marksAvailable, 0),
    grade89Scored: band89.reduce((n, x) => n + x.marksScored, 0),
    grade89Available: band89.reduce((n, x) => n + x.marksAvailable, 0),
    markedHow: selfMarked.every((a) => a?.self) ? 'self' : selfMarked.some((a) => a?.self || a?.methodMarked || a?.result.claimed) ? 'mixed' : 'auto',
    completedAt: r.finishedAt,
    xp: xpForQuestions(results),
    questions: results,
    ...(seed ? { seed } : {}),
    ...(r.timed ? { timed: r.timed } : {}),
  })
  settle(before)
}

/**
 * A topic worksheet sat as a timed paper (WKP-4): the same questions as the sheet (written the
 * first time, new numbers on a retry, as the worksheet decides), on the paper screen, at the
 * subject's exam pace. Nothing marked or explained until it is handed in.
 */
export function TimedWorksheet() {
  const { subjectId = '', topicId = '', level: levelParam } = useParams()
  const topic = useTopic(subjectId, topicId)
  if (topic === null) return <TopicMissing label="worksheet" />
  if (!topic) return <TopicLoading />
  return <TimedBody topic={topic} level={LEVELS.find((l) => l === levelParam)} />
}

function TimedBody({ topic, level }: { topic: TopicRecord; level?: WorksheetLevel }) {
  const [params] = useSearchParams()
  const { pathname, search } = useLocation()
  const seed = sheetParam(params)
  const subject = getSubject(topic.subjectId)
  const questions = useMemo(() => {
    if (!level) return []
    const byId = new Map(topic.questions.map((q) => [q.id, q]))
    const written = topic.worksheets[level].questionIds.map((id) => byId.get(id)).filter((q): q is Question => Boolean(q))
    return sheetQuestions(topic.subjectId, topic.id, written, seed).map((s) => ({ item: { topicId: topic.id, questionId: s.question.id }, question: s.question, ...(s.generated ? { generated: s.generated } : {}) }))
  }, [topic, level, seed])
  if (!subject || !level) return <p>Unknown worksheet.</p>
  const backTo = `/subjects/${subject.id}/topics/${topic.id}`
  return (
    <PaperSession
      key={`${pathname}${search}`}
      storageKey={`study-companion.paper.timed.${topic.id}.${level}`}
      path={`${pathname}${search}`}
      subjectId={subject.id}
      kicker={`${subject.name} · ${topic.title}`}
      title={`${LEVEL_LABEL[level]} worksheet, timed`}
      intro={[
        seed ? `Sheet ${seed}: new numbers, the same questions as the worksheet.` : 'The worksheet’s own questions, as an examiner checked them.',
        'It counts as this worksheet: the score moves the topic’s status as the untimed sheet does.',
      ]}
      questions={questions}
      perMark={minutesPerMark(getGuide(subject.id))}
      studyKind="worksheet"
      showTopic={false}
      record={(r) => recordTimedWorksheet(topic, level, questions.map((q) => q.question), r, seed)}
      after={<Link to={backTo} className={`${BUTTON} bg-[color:var(--subject)] text-white`}>Back to topic</Link>}
    />
  )
}
