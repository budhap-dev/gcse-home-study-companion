import { getSubject, type PastPaper, type PastPaperLink, type PastPaperLinkKind } from '@study/shared'
import { Link, useParams } from 'react-router'
import { BackLink } from '../../components/BackLink.tsx'
import { PastPaperScore, SeriesGrade } from '../../components/PastPaperScore.tsx'
import { summaryById } from '../../content/index.ts'
import { pastPapersFor } from '../../content/pastPapers.ts'

const KIND_LABEL: Record<PastPaperLinkKind, string> = {
  'question-paper': 'Question paper',
  'mark-scheme': 'Mark scheme',
  'examiner-report': 'Examiner’s report',
  insert: 'Insert',
  answers: 'Answers and commentary',
  audio: 'Audio',
}

function BoardLink({ link, quiet }: { link: PastPaperLink; quiet?: boolean }) {
  return (
    <a href={link.url} target="_blank" rel="noopener noreferrer" className={`btn btn-sm ${quiet ? 'btn-secondary text-ink-2' : 'btn-secondary'}`}>
      {link.label ?? KIND_LABEL[link.kind]}
      <span aria-hidden className="text-xs">↗</span>
      <span className="sr-only">(opens the board’s PDF)</span>
    </a>
  )
}

/**
 * Past papers (backlog section 14): the board's own Higher-tier papers for a subject, newest
 * first, each linking to the board's PDF. The app keeps no copy: the papers belong to the board.
 */
export function PastPapers() {
  const { subjectId = '' } = useParams()
  const subject = getSubject(subjectId)
  const index = pastPapersFor(subjectId)
  if (!subject) return <p>Unknown subject.</p>
  const back = `/subjects/${subject.id}`

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <BackLink to={back} label={`Back to ${subject.name}`} />
      <header className="flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.08em] accent-ink">{subject.name} · {index?.board ?? subject.board}</p>
        <h1 className="text-3xl font-bold leading-tight">Past papers</h1>
        <p className="text-ink-2">
          The board’s own papers{index?.series.some((s) => s.papers.some((p) => /H$/.test(p.id))) ? ', Higher tier' : ''}, newest first. Each link opens the board’s PDF on its own site: sit the paper on paper, then mark it with the mark scheme beside it.
        </p>
        {index?.note && <p className="rounded-xl border border-rule bg-panel px-4 py-3 text-sm">{index.note}</p>}
        {index?.series.some((s) => s.boundaries) && (
          <p className="text-sm text-ink-2">
            Sat one? Mark it with the mark scheme and log your score: the board’s grade boundaries for that series turn it into a grade. One paper’s grade uses the board’s boundary for that paper, so it is an estimate; with every paper of a series logged, the board’s boundaries for the whole subject give the grade you would have been given.
          </p>
        )}
        {index?.practice && (
          <a href={index.practice.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary w-fit">
            {index.practice.label} <span aria-hidden>↗</span>
          </a>
        )}
      </header>

      {!index || index.series.length === 0 ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-rule bg-surface p-5">
          <h2 className="text-lg font-bold">No papers to link to yet</h2>
          <p className="text-ink-2">{index?.note ? 'See the note above.' : 'The board has not published papers for this specification yet.'}</p>
          {index && <a href={index.finder} target="_blank" rel="noopener noreferrer" className="btn btn-secondary w-fit">The board’s past papers page <span aria-hidden>↗</span></a>}
        </section>
      ) : (
        index.series.map((s) => (
          <section key={s.id} aria-labelledby={`series-${s.id}`} className="flex flex-col gap-3 rounded-2xl border border-rule bg-surface p-4 sm:p-5">
            <div className="flex flex-col gap-1">
              <h2 id={`series-${s.id}`} className="text-xl font-bold">{s.label}</h2>
              {s.note && <p className="text-sm text-ink-2">{s.note}</p>}
            </div>
            <ul className="flex flex-col divide-y divide-rule">
              {s.papers.map((p) => (
                <li key={p.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                  <h3 className="font-bold">{p.name}</h3>
                  <div className="flex flex-wrap gap-2">
                    {p.links.map((l) => <BoardLink key={l.url} link={l} quiet={l.kind === 'examiner-report'} />)}
                  </div>
                  {p.questions && <QuestionTopics paper={p} subjectId={subject.id} />}
                  {s.id !== 'sample' && <PastPaperScore subjectId={subject.id} series={s} paper={p} />}
                </li>
              ))}
            </ul>
            <SeriesGrade subjectId={subject.id} series={s} />
            {s.sheets.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-t border-rule pt-3">
                <span className="text-sm text-ink-2">For every paper in this series:</span>
                {s.sheets.map((l) => <BoardLink key={l.url} link={l} />)}
              </div>
            )}
          </section>
        ))
      )}

      {index && (
        <footer className="flex flex-col gap-2 text-sm text-ink-2">
          <p>Papers from the most recent exams stay with teachers for about a year before the board publishes them. The links need a signal; checked against the board’s site on {new Date(index.checked).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.</p>
          <a href={index.finder} target="_blank" rel="noopener noreferrer" className="w-fit font-bold underline">Everything the board publishes for {subject.name} <span aria-hidden>↗</span></a>
        </footer>
      )}
    </article>
  )
}

/**
 * What each question of a tagged paper tests (section 14, box 2): its number, its marks and
 * the app's topics, each a link to the topic. Folded away until asked for, as most visits
 * are for the PDF links.
 */
function QuestionTopics({ paper, subjectId }: { paper: PastPaper; subjectId: string }) {
  const questions = paper.questions ?? []
  return (
    <details className="group rounded-xl border border-rule">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm font-bold">
        What each question tests
        <span className="text-ink-2 transition-transform group-open:rotate-180" aria-hidden>▾</span>
      </summary>
      {paper.answer && <p className="border-t border-rule px-3 py-2 text-sm text-ink-2">{paper.answer} Each question is on one text: answer the ones on the texts you study.</p>}
      <ol className="flex flex-col divide-y divide-rule border-t border-rule">
        {questions.map((q) => (
          <li key={q.n} className="flex gap-3 px-3 py-2 text-sm">
            <span className="w-16 shrink-0 font-bold tabular-nums">Q{q.n}<span className="block text-xs font-normal text-ink-2">{q.marks} {q.marks === 1 ? 'mark' : 'marks'}</span></span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              {q.title && <span className={q.topics.length ? 'w-full' : 'w-full text-ink-2'}>{q.title}</span>}
              {q.topics.length === 0 && <span className="text-ink-2">{q.title ? 'Not one of the texts in the app' : 'Not in the app’s topics yet'}</span>}
              {q.topics.map((t) => (
                <Link key={t} to={`/subjects/${subjectId}/topics/${t}`} className="font-bold underline decoration-rule underline-offset-2 hover:decoration-current">
                  {summaryById(t)?.title ?? t}
                </Link>
              ))}
            </span>
          </li>
        ))}
      </ol>
    </details>
  )
}

