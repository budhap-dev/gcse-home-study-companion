import { expectedAnswer, getSubject, type Question, type WorksheetLevel } from '@study/shared'
import { Link, useParams, useSearchParams } from 'react-router'
import { RichText } from '../../components/RichText.tsx'
import { Visual } from '../../components/Visual.tsx'
import { getTopic, totalMarks } from '../../content/index.ts'

const LEVEL_LABEL: Record<WorksheetLevel, string> = { core: 'Core', higher: 'Higher', advanced: 'Advanced' }

/**
 * A worksheet laid out for A4, and its answers as a separate document.
 *
 * Printed by the browser rather than built as a PDF. Print to PDF produces the file
 * anyone actually wants, and going through the browser keeps the KaTeX and the SVG
 * diagrams as vectors — which is what the requirement to print "at full resolution"
 * means. A PDF library would rasterise both and weigh several hundred kilobytes.
 *
 * ?answers=1 prints the answers and mark scheme instead of the questions, so the two are
 * separate documents rather than one a student has to fold over.
 */
export function WorksheetPrint() {
  const { subjectId, topicId, level } = useParams()
  const [params] = useSearchParams()
  const answers = params.get('answers') === '1'
  const topic = subjectId && topicId ? getTopic(subjectId, topicId) : undefined
  const sheet = topic && level ? topic.worksheets[level as WorksheetLevel] : undefined
  if (!topic || !sheet) return <p className="p-6">Unknown worksheet.</p>

  const questions = sheet.questionIds
    .map((id) => topic.questions.find((q) => q.id === id))
    .filter((q): q is Question => Boolean(q))
  const marks = totalMarks(topic, sheet.questionIds)
  const subject = getSubject(topic.subjectId)
  const back = `/subjects/${topic.subjectId}/topics/${topic.id}/worksheet/${level}`

  return (
    <article className="print-sheet mx-auto w-full max-w-3xl">
      {/* Not printed: the controls that only make sense on screen. */}
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => window.print()} className="h-11 rounded-lg bg-ink px-4 font-bold text-surface">Print this sheet</button>
        <Link to={`${back}/print${answers ? '' : '?answers=1'}`} className="flex h-11 items-center rounded-lg border border-rule px-4 font-bold">
          {answers ? 'Print the questions instead' : 'Print the answers instead'}
        </Link>
        <Link to={back} className="flex h-11 items-center rounded-lg border border-rule px-4 font-bold">Back</Link>
      </div>

      <header className="mb-4 border-b border-rule pb-3">
        <p className="text-sm text-ink-2">{subject?.name} · {subject?.board}</p>
        <h1 className="text-2xl font-bold leading-tight">
          {topic.title} · {LEVEL_LABEL[level as WorksheetLevel]} worksheet{answers ? ' · answers' : ''}
        </h1>
        <p className="text-sm text-ink-2">
          {questions.length} questions · {marks} marks
          {!answers && ' · Name ............................................  Date ....................'}
        </p>
      </header>

      <ol className="flex flex-col">
        {questions.map((q, i) => (
          <li key={q.id} className="question break-inside-avoid border-b border-rule py-3 last:border-b-0">
            <div className="flex items-start justify-between gap-4">
              <span className="flex min-w-0 gap-2">
                <span className="font-bold tabular-nums">{i + 1}.</span>
                <RichText source={q.prompt} className="text-[15px]" />
              </span>
              <span className="shrink-0 text-sm text-ink-2">({q.marks})</span>
            </div>
            {q.type === 'multiple-choice' && (
              <ol className="mt-2 flex flex-col gap-1 pl-6 text-[15px]">
                {q.options.map((o, k) => (
                  <li key={k} className="flex gap-2">
                    <span className="text-ink-2">{'ABCD'[k] ?? k + 1}</span>
                    <RichText source={o} className="inline text-[15px]" />
                  </li>
                ))}
              </ol>
            )}
            {'visual' in q && q.visual && <div className="mt-2 max-w-md"><Visual visual={q.visual} /></div>}
            {answers ? <AnswerBlock question={q} /> : <Working marks={q.marks} />}
          </li>
        ))}
      </ol>
    </article>
  )
}

/**
 * Ruled space to work in, taller for a question worth more marks.
 *
 * Lines rather than a blank box: a blank box invites one line of writing in the middle of
 * it. The height is capped because a twelve-mark question does not need two pages of
 * space, and a page break in the middle of the working is worse than slightly less room.
 */
function Working({ marks }: { marks: number }) {
  const lines = Math.min(10, Math.max(2, marks * 2))
  return (
    <div className="mt-2" aria-hidden>
      {Array.from({ length: lines }, (_, i) => <div key={i} className="h-7 border-b border-dotted border-rule" />)}
    </div>
  )
}

function AnswerBlock({ question }: { question: Question }) {
  const expected = expectedAnswer(question)
  return (
    <div className="mt-2 flex flex-col gap-1 border-l-2 border-rule pl-3 text-[14px]">
      {expected && <p><strong>Answer:</strong> <RichText source={expected} className="inline text-[14px]" /></p>}
      <div><strong>Working:</strong> <RichText source={question.solution} className="inline text-[14px]" /></div>
      <ul className="flex flex-col">
        {question.markScheme.map((m, i) => (
          <li key={i} className="flex gap-2 text-ink-2">
            <span className="shrink-0 font-bold tabular-nums">{m.code}</span>
            {/* Mark scheme descriptions carry LaTeX — "$3\sqrt{5}$ or $2\sqrt{5}$ seen" —
                so they go through RichText like every other authored string. */}
            <RichText source={m.description} className="inline text-[14px]" />
            <span className="ml-auto shrink-0">({m.marks})</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
