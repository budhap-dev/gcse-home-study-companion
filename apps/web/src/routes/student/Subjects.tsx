import { SUBJECTS, SYLLABUS } from '@study/shared'
import type { SubjectId, SyllabusBlock } from '@study/shared'
import { Link } from 'react-router'
import { topicsForSubject } from '../../content/index.ts'
import { useProgress } from '../../progress/useProgress.ts'
import { evidenceFor } from '../../progress/store.ts'

const YEARS = [9, 10, 11] as const

/** Written and planned topic counts for one subject, per school year and overall. */
function countsFor(subjectId: SubjectId) {
  const blocks: SyllabusBlock[] = SYLLABUS[subjectId] ?? []
  const byYear = YEARS.map((year) => {
    const inYear = blocks.filter((b) => b.year === year)
    return {
      year,
      total: inYear.reduce((n, b) => n + b.topics.length, 0),
      done: inYear.reduce((n, b) => n + b.topics.filter((t) => t.topicId).length, 0),
    }
  })
  return {
    byYear,
    total: byYear.reduce((n, y) => n + y.total, 0),
    done: byYear.reduce((n, y) => n + y.done, 0),
  }
}

function Cell({ done, total }: { done: number; total: number }) {
  if (total === 0) return <span className="text-ink-3">—</span>
  return (
    <span className={done === total ? 'font-bold text-ink' : 'text-ink-2'}>
      <span className="tabular-nums">{done}</span>
      <span className="text-ink-3"> / {total}</span>
    </span>
  )
}

/**
 * How many of a subject's written topics carry "Why this exists" and "Where you meet it".
 *
 * The denominator is deliberately the topics that exist, not the whole syllabus: the
 * section lives on a topic, so an unwritten row cannot have one and counting it as a gap
 * would blame this rollout for work that belongs to the topic itself. That makes the
 * fraction a different one from the availability columns, which is why it sits apart
 * from them with its own heading.
 */
function whyCountFor(subjectId: SubjectId) {
  const topics = topicsForSubject(subjectId)
  return { done: topics.filter((t) => t.why).length, total: topics.length }
}

/** "Maths", "Maths and Physics", "Maths, Physics and Chemistry". */
function listNames(names: string[]) {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

export function Subjects() {
  const progress = useProgress()
  const rows = SUBJECTS.map((s) => ({ subject: s, ...countsFor(s.id), why: whyCountFor(s.id) }))
  const grand = rows.reduce((a, r) => ({ done: a.done + r.done, total: a.total + r.total }), { done: 0, total: 0 })
  const grandWhy = rows.reduce((a, r) => ({ done: a.done + r.why.done, total: a.total + r.why.total }), { done: 0, total: 0 })
  // Named in the sentence above the table so the state of the rollout is legible without
  // scrolling the table sideways, which is what a phone has to do to reach that column.
  const whyComplete = rows.filter((r) => r.why.total > 0 && r.why.done === r.why.total).map((r) => r.subject.name)
  const whyStarted = rows.filter((r) => r.why.done > 0 && r.why.done < r.why.total).map((r) => r.subject.name)

  return (
    <article className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold leading-tight">Subjects</h1>
        <p className="text-ink-2">Eight GCSEs at Higher tier, plus Further Maths, taught in full depth. Topics appear here as they are written.</p>
      </header>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SUBJECTS.map((s) => {
          const topics = topicsForSubject(s.id)
          const ready = topics.filter((t) => evidenceFor(t.id, progress).status === 'grade-9-ready').length
          return (
            <li key={s.id}>
              <Link
                to={`/subjects/${s.id}`}
                style={{ '--subject': s.colour } as React.CSSProperties}
                className="flex items-center gap-3 rounded-xl border border-rule bg-surface px-4 py-3 hover:border-[color:var(--subject)]"
              >
                <span className="h-3 w-3 rounded-sm" style={{ background: s.colour }} aria-hidden />
                <span className="flex flex-col">
                  <span className="font-bold">{s.name}</span>
                  <span className="text-xs text-ink-2">
                    {s.board} · {topics.length === 0 ? 'no topics yet' : `${ready} of ${topics.length} mastered`}
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>

      {/*
        How much of each subject exists, written against planned, per school year. The
        plan is the school's own syllabus, so an empty year means the app has nothing
        for work the class still covers. A table earns its place here: eight subjects
        across three years is a grid, and the numbers are meant to be compared.
      */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold">What’s available now</h2>
          <p className="text-sm text-ink-2">
            Topics you can open today, against the whole syllabus the school teaches. The rest are on the way: open a subject to see what is coming and when the class meets it.
          </p>
          <p className="text-sm text-ink-2">
            The last column counts the topics that already answer <strong>why this exists</strong> and <strong>where you meet it</strong> — the purpose of the idea, and two or three places it turns up. So far{' '}
            <strong className="text-ink tabular-nums">{grandWhy.done} of {grandWhy.total}</strong> written topics have it
            {whyComplete.length > 0 && <> — all of {listNames(whyComplete)}{whyStarted.length > 0 && <>, and a start on {listNames(whyStarted)}</>}</>}. It is counted against the topics written so far rather than the whole syllabus, so it is a different fraction from the rest of the row.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[27rem] border-collapse text-sm sm:min-w-[34rem]">
            <caption className="sr-only">Topics available now against the whole syllabus, by subject and school year, and how many of the written topics explain why the idea exists and where you meet it</caption>
            <thead>
              <tr className="border-b border-rule text-left text-xs uppercase tracking-[0.06em] text-ink-3">
                <th scope="col" className="py-2 pr-3 font-bold">Subject</th>
                {YEARS.map((y) => (
                  <th key={y} scope="col" className="whitespace-nowrap px-3 py-2 text-right font-bold">Year {y}</th>
                ))}
                <th scope="col" className="whitespace-nowrap px-3 py-2 text-right font-bold">All years</th>
                <th scope="col" className="hidden w-28 py-2 pl-3 font-bold sm:table-cell">Available</th>
                {/* Not nowrap: this heading is the widest in the row, and on a phone the
                    table already scrolls sideways, so letting it wrap keeps the column
                    nearer the edge of the screen. */}
                <th scope="col" className="w-20 border-l border-rule py-2 pl-3 text-right font-bold">Why it exists</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ subject, byYear, done, total, why }) => (
                <tr key={subject.id} className="border-b border-rule/60">
                  <th scope="row" className="py-2 pr-3 text-left font-normal">
                    <Link to={`/subjects/${subject.id}`} className="flex items-center gap-2 whitespace-nowrap py-1 font-bold hover:underline">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: subject.colour }} aria-hidden />
                      {subject.name}
                    </Link>
                  </th>
                  {byYear.map((y) => (
                    <td key={y.year} className="whitespace-nowrap px-3 py-2 text-right">
                      <Cell done={y.done} total={y.total} />
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-3 py-2 text-right"><Cell done={done} total={total} /></td>
                  <td className="hidden py-2 pl-3 sm:table-cell">
                    <span
                      className="block h-1.5 w-full overflow-hidden rounded-full bg-panel"
                      role="img"
                      aria-label={`${total === 0 ? 0 : Math.round((done / total) * 100)} per cent available`}
                    >
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${total === 0 ? 0 : (done / total) * 100}%`, background: subject.colour }}
                      />
                    </span>
                  </td>
                  <td className="whitespace-nowrap border-l border-rule py-2 pl-3 text-right">
                    <Cell done={why.done} total={why.total} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-rule">
                <th scope="row" className="whitespace-nowrap py-2 pr-3 text-left font-bold">All subjects</th>
                {YEARS.map((y) => {
                  const d = rows.reduce((n, r) => n + (r.byYear.find((b) => b.year === y)?.done ?? 0), 0)
                  const t = rows.reduce((n, r) => n + (r.byYear.find((b) => b.year === y)?.total ?? 0), 0)
                  return <td key={y} className="whitespace-nowrap px-3 py-2 text-right font-bold"><Cell done={d} total={t} /></td>
                })}
                <td className="whitespace-nowrap px-3 py-2 text-right font-bold"><Cell done={grand.done} total={grand.total} /></td>
                <td className="hidden whitespace-nowrap py-2 pl-3 text-right text-xs text-ink-2 tabular-nums sm:table-cell">{grand.total - grand.done} coming soon</td>
                <td className="whitespace-nowrap border-l border-rule py-2 pl-3 text-right font-bold"><Cell done={grandWhy.done} total={grandWhy.total} /></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </article>
  )
}
