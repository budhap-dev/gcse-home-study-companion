import { getSubject } from '@study/shared'
import { Link, useParams, useSearchParams } from 'react-router'
import { ShareSheet } from '../../components/ShareSheet.tsx'
import { TopicLoading } from '../../components/TopicLoading.tsx'
import { summaryById, topicsForSubject } from '../../content/index.ts'
import { useTopics } from '../../content/load.ts'
import { mixedPath, parseSpec, pickItems, sheetFor, versionCodes } from '../../content/mixedSheet.ts'
import { PrintedQuestions } from './WorksheetPrint.tsx'

const LEVEL = { core: 'Core', higher: 'Higher', advanced: 'Advanced' } as const

/**
 * A mixed worksheet laid out for A4: one sheet per version, each on a new page with its own
 * code, or, with ?answers=1, the answer sheets for the same versions in the same order. The
 * code at the top and foot of each page ties a sheet to its answers.
 */
export function MixedPrint() {
  const { subjectId = '' } = useParams()
  const [params] = useSearchParams()
  const spec = parseSpec(subjectId, params)
  const subject = getSubject(subjectId)
  const answers = params.get('answers') === '1'
  const codes = spec ? versionCodes(params, spec.code) : []
  const summaries = topicsForSubject(subjectId)
  const versions = spec ? codes.map((code) => ({ code, items: pickItems({ ...spec, code }, summaries) })) : []
  const loaded = useTopics([...new Set(versions.flatMap((v) => v.items.map((m) => m.topicId)))].map((topicId) => ({ subjectId, topicId })))

  if (!subject || !spec) return <p className="p-6">This worksheet link is not complete. <Link to="/subjects" className="underline">Choose a subject</Link> and make one.</p>
  if (!loaded) return <TopicLoading />

  return (
    <article className="print-sheet mx-auto w-full max-w-3xl">
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => window.print()} className="h-11 rounded-lg bg-ink px-4 font-bold text-surface">
          {codes.length > 1 ? `Print all ${codes.length}` : 'Print this sheet'}
        </button>
        <Link to={mixedPath(spec, { codes, answers: !answers })} className="flex h-11 items-center rounded-lg border border-rule px-4 font-bold">
          {answers ? 'Print the questions instead' : 'Print the answers instead'}
        </Link>
        <ShareSheet path={mixedPath(spec, { codes })} title={`${subject.name} · mixed worksheet ${spec.code}`} />
        <Link to={mixedPath(spec)} className="flex h-11 items-center rounded-lg border border-rule px-4 font-bold">Do sheet {spec.code} on screen</Link>
        <Link to={`/subjects/${subjectId}/make-worksheet`} className="flex h-11 items-center rounded-lg border border-rule px-4 font-bold">Make another</Link>
      </div>

      {versions.map((v, i) => {
        const questions = sheetFor({ ...spec, code: v.code }, v.items, loaded).map((s) => s.question)
        const marks = questions.reduce((s, q) => s + q.marks, 0)
        const titles = [...new Set(v.items.map((m) => m.topicId))].map((id) => summaryById(id)?.title ?? id)
        return (
          <section key={v.code} className="mixed-version" style={i > 0 ? { breakBefore: 'page' } : undefined}>
            <header className="mb-4 border-b border-rule pb-3">
              <p className="text-sm text-ink-2">{subject.name} · {subject.board}</p>
              <h1 className="text-2xl font-bold leading-tight">
                Mixed worksheet · {LEVEL[spec.level]}{codes.length > 1 ? ` · version ${i + 1}` : ''}{answers ? ' · answers' : ''}
              </h1>
              <p className="text-sm text-ink-2">
                Sheet <strong className="font-mono text-ink">{v.code}</strong> · {questions.length} questions · {marks} marks
                {!answers && ' · Name ............................................  Date ....................'}
              </p>
              <p className="text-xs text-ink-2">Topics: {titles.join(', ')}</p>
            </header>
            <PrintedQuestions questions={questions} answers={answers} />
            <p className="mt-4 border-t border-rule pt-2 text-xs text-ink-2">
              {answers ? `Answers for sheet ${v.code} only: a different code has different questions.` : `Sheet ${v.code}. The answers are on a separate sheet with the same code.`}
            </p>
          </section>
        )
      })}
    </article>
  )
}
