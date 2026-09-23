import { cheatSheetOf, getSubject, type CheatTip } from '@study/shared'
import { Link, useParams } from 'react-router'
import { RichText } from '../../components/RichText.tsx'
import { Smiley } from '../../components/Smiley.tsx'
import { getTopic } from '../../content/index.ts'
import { useActivityTimer } from '../../progress/useActivityTimer.ts'
import { useRecordActivity } from '../../progress/useRecordActivity.ts'

/**
 * One page of everything worth having in your head before a test.
 *
 * Nothing on it is new: the memory hooks are the topic's `remember` tips, the formulae
 * are read off its equation cards, the key points are its summary step, the traps are its
 * examiner errors. Each of those already existed on a different screen, and three of the
 * four sat several taps deep — a student revising the night before does not want to walk
 * a fifteen-step lesson to reach its summary. So this is a view, not content: it costs no
 * authoring, it exists for every topic, and it cannot drift from the lesson.
 *
 * The memory hooks lead. Everything else on the page a student could reconstruct by
 * thinking; the mnemonic is the one thing they cannot, which is why it is here at all.
 *
 * It prints. `print-sheet` and the print rules in styles.css strip the chrome and the
 * colour, and every card avoids a page break inside itself.
 */
export function CheatSheet() {
  const { subjectId, topicId } = useParams()
  const subject = subjectId ? getSubject(subjectId) : undefined
  const topic = subjectId && topicId ? getTopic(subjectId, topicId) : undefined
  // Before the early return: a hook cannot be called conditionally.
  useRecordActivity(topic && { subjectId: topic.subjectId, topicId: topic.id }, 'cheat-sheet')
  useActivityTimer(topic && { subjectId: topic.subjectId, topicId: topic.id, kind: 'cheat-sheet' })
  if (!subject || !topic) return <p>Unknown topic.</p>
  const sheet = cheatSheetOf(topic)
  const backTo = `/subjects/${subject.id}/topics/${topic.id}`

  return (
    <article className="print-sheet mx-auto flex w-full max-w-4xl flex-col gap-5">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.08em] accent-ink">
          <Link to={`/subjects/${subject.id}`} className="inline-block -my-1 py-1 hover:underline">{subject.name}</Link>
          {' · '}
          <Link to={backTo} className="inline-block -my-1 py-1 hover:underline">{sheet.specCode ? `${sheet.specCode} ` : ''}{sheet.title}</Link>
        </p>
        <h1 className="text-3xl font-bold leading-tight">Cheat sheet</h1>
        <p className="text-ink-2">The whole topic on one page: how to remember it, the formulae, the key points, and the traps.</p>
      </header>

      {/* Screen only. Paper carries the sheet and nothing else. */}
      <div className="no-print flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => window.print()} className="h-11 rounded-lg bg-ink px-4 font-bold text-surface">Print this sheet</button>
        <Link to={`${backTo}/flashcards`} className="flex h-11 items-center rounded-lg border border-rule bg-surface px-4 font-bold">Test yourself with flashcards</Link>
        <Link to={backTo} className="flex h-11 items-center rounded-lg border border-rule bg-surface px-4 font-bold">Back to topic</Link>
      </div>

      {sheet.memoryHooks.length > 0 && (
        <Section colour="#c27a00" emoji="🧠" title="Remember it">
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {sheet.memoryHooks.map((tip) => <TipCard key={tip.title} tip={tip} lead />)}
          </ul>
        </Section>
      )}

      {sheet.formulae.length > 0 && (
        <Section colour="#1f3a93" emoji="🧮" title="Formulae">
          <ul className="flex flex-col divide-y divide-rule rounded-xl border border-rule bg-surface">
            {sheet.formulae.map((f) => (
              <li key={`${f.name}|${f.equation}`} className="break-inside-avoid flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:items-baseline sm:gap-4">
                {f.name && <span className="text-xs font-bold uppercase tracking-[0.06em] accent-ink sm:w-44 sm:shrink-0">{f.name}</span>}
                <span className="font-display text-lg font-bold leading-snug" style={{ overflowWrap: 'anywhere' }}>{f.equation}</span>
                {f.units && <span className="text-sm text-ink-2 sm:ml-auto sm:shrink-0 sm:text-right">{f.units}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {sheet.keyPoints.length > 0 && (
        <Section colour="#2e8b57" emoji="📌" title="Key points">
          <ul className="flex flex-col gap-1.5 rounded-xl border border-rule bg-surface px-4 py-3 pl-9">
            {sheet.keyPoints.map((point, i) => (
              <li key={i} className="break-inside-avoid list-disc text-[15px] leading-snug marker:text-ink-3">
                <RichText source={point} inline />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {sheet.tactics.length > 0 && (
        <Section colour="var(--subject)" emoji="🔍" title="Tactics">
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {sheet.tactics.map((tip) => <TipCard key={tip.title} tip={tip} />)}
          </ul>
        </Section>
      )}

      {sheet.traps.length > 0 && (
        <Section colour="#c8501f" emoji="⚠️" title="Examiner traps">
          <ul className="flex flex-col gap-1.5 rounded-xl border border-rule bg-surface px-4 py-3 pl-9">
            {sheet.traps.map((trap, i) => (
              <li key={i} className="break-inside-avoid list-disc text-[15px] leading-snug marker:text-ink-3">
                <RichText source={trap} inline />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {sheet.grade9 && (
        <Section colour="#6B4E9B" emoji="🏆" title="What a grade 9 answer does">
          <div className="break-inside-avoid rounded-xl border-l-4 border-status-grade-9 bg-surface px-4 py-3 text-[15px] leading-snug">
            <RichText source={sheet.grade9} />
          </div>
        </Section>
      )}

      <Link to={`${backTo}/quiz`} className="no-print w-fit rounded-lg bg-[color:var(--subject)] px-4 py-2 font-bold text-white">
        Take the quiz
      </Link>
    </article>
  )
}

function Section({ colour, emoji, title, children }: { colour: string; emoji: string; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="chip w-fit" style={{ '--chip': colour } as React.CSSProperties}><Smiley>{emoji}</Smiley>{title}</h2>
      {children}
    </section>
  )
}

/** The kind labels match the topic page, so a tip reads the same wherever it is met. */
const TIP_EMOJI: Record<CheatTip['kind'], string> = { remember: '🧠', spot: '🔍', shortcut: '⚡', check: '✅' }
const TIP_LABEL: Record<CheatTip['kind'], string> = { remember: 'Remember it', spot: 'Spot it', shortcut: 'Quicker way', check: 'Check it' }

function TipCard({ tip, lead = false }: { tip: CheatTip; lead?: boolean }) {
  return (
    <li
      className={`break-inside-avoid flex flex-col gap-1 rounded-xl border px-4 py-3 ${lead ? 'border-[color:var(--hook-card-rule)] bg-[color:var(--hook-card)]' : 'border-rule bg-surface'}`}
    >
      {!lead && (
        <span className="flex items-center gap-2">
          <Smiley>{TIP_EMOJI[tip.kind]}</Smiley>
          <span className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">{TIP_LABEL[tip.kind]}</span>
        </span>
      )}
      <span className="font-bold leading-snug">{tip.title}</span>
      <RichText source={tip.body} className="text-sm" />
    </li>
  )
}
