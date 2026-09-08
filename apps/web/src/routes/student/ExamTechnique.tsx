import { getSubject } from '@study/shared'
import { Link, useParams } from 'react-router'
import { RichText } from '../../components/RichText.tsx'
import { getGuide, topicsForSubject } from '../../content/index.ts'

/**
 * Two layers, as the PRD describes: the subject guide (papers, command words,
 * assessment objectives, what grade 9 looks like) and each topic's own note.
 */
export function ExamTechnique() {
  const { subjectId } = useParams()
  const subject = subjectId ? getSubject(subjectId) : undefined
  const guide = subjectId ? getGuide(subjectId) : undefined
  const topics = subjectId ? topicsForSubject(subjectId) : []
  if (!subject) return <p>Unknown subject.</p>

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--subject)]">
          <Link to={`/subjects/${subject.id}`} className="hover:underline">{subject.name}</Link> · {subject.board}
        </p>
        <h1 className="text-3xl font-bold leading-tight">Exam technique</h1>
        <p className="max-w-[65ch] text-ink-2">How the papers work, what the command words ask for, and what separates a grade 9 answer from a grade 7.</p>
      </header>

      {!guide ? (
        <p className="text-ink-2">The guide for this subject has not been written yet.</p>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-2">The papers</h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {guide.papers.map((p) => (
                <div key={p.name} className="flex flex-col gap-1 rounded-xl border border-rule bg-surface p-4">
                  <span className="font-bold">{p.name}</span>
                  <span className="text-sm text-ink-2">{p.marks} marks · {p.minutes} min · {p.calculator ? 'calculator' : 'non-calculator'}</span>
                  <span className="text-sm">{p.covers}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-2">What the marks are for</h2>
            <ul className="flex flex-col gap-2">
              {guide.assessmentObjectives.map((ao) => (
                <li key={ao.code} className="flex gap-3 rounded-xl border border-rule bg-surface px-4 py-3">
                  <span className="flex flex-col items-center"><span className="font-mono text-xs text-ink-3">{ao.code}</span><span className="text-lg font-bold tabular-nums">{ao.weight}%</span></span>
                  <span className="text-sm">{ao.meaning}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-2">Command words</h2>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[max-content_1fr]">
              {guide.commandWords.map((c) => (
                <div key={c.word} className="contents">
                  <dt className="font-bold">{c.word}</dt>
                  <dd className="text-sm text-ink-2">{c.meaning}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-2">What a grade 9 answer looks like</h2>
            <ul className="flex flex-col gap-2">
              {guide.grade9ByQuestionType.map((g) => (
                <li key={g.questionType} className="flex flex-col gap-1 rounded-xl border-l-4 border-status-grade-9 bg-surface px-4 py-3">
                  <span className="font-bold">{g.questionType}</span>
                  <span className="text-sm">{g.looksLike}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {topics.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-2">Topic by topic</h2>
          {topics.map((t) => (
            <details key={t.id} className="rounded-xl border border-rule bg-surface px-4 py-3">
              <summary className="cursor-pointer font-bold">{t.title}</summary>
              <div className="mt-3 flex flex-col gap-3">
                <RichText source={t.examTechnique.body} className="text-sm" />
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Examiners report</span>
                  <ul className="flex flex-col gap-1 pl-4 text-sm">
                    {t.examTechnique.examinerErrors.map((e, i) => (
                      <li key={i} className="list-disc"><RichText source={e} inline /></li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Grade 9 looks like</span>
                  <RichText source={t.examTechnique.grade9Looks} className="text-sm" />
                </div>
                <Link to={`/subjects/${subject.id}/topics/${t.id}`} className="w-fit text-sm font-bold underline">Open topic</Link>
              </div>
            </details>
          ))}
        </section>
      )}
    </article>
  )
}
