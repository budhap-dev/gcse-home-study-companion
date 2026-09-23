import { getSubject } from '@study/shared'
import { Link, useParams } from 'react-router'
import { RichText } from '../../components/RichText.tsx'
import { Visual } from '../../components/Visual.tsx'
import { getTopic } from '../../content/index.ts'
import { useActivityTimer } from '../../progress/useActivityTimer.ts'
import { useRecordActivity } from '../../progress/useRecordActivity.ts'

/**
 * Where the idea is met outside a classroom.
 *
 * This lives on its own page rather than on the topic page, for two measured reasons.
 * Inline, it pushed the Lesson tile 2.8 screens down a phone — a student who came to do
 * the lesson had to scroll past three screens of context first. And the pictures were
 * squeezed into a 256px column when their natural width is about twice that.
 *
 * The topic page keeps the one paragraph that says *why the topic exists*, because that
 * is framing a student should not have to tap for. This page is the examples, which are
 * a thing you go and read — the same split the design makes between the two.
 */
export function WhyItExists() {
  const { subjectId, topicId } = useParams()
  const topic = subjectId && topicId ? getTopic(subjectId, topicId) : undefined
  const subject = subjectId ? getSubject(subjectId) : undefined
  // Before the early return: a hook cannot be called conditionally.
  useRecordActivity(topic && { subjectId: topic.subjectId, topicId: topic.id }, 'why')
  useActivityTimer(topic && { subjectId: topic.subjectId, topicId: topic.id, kind: 'why' })
  if (!topic || !subject) return <p>Unknown topic.</p>
  const why = topic.why

  return (
    <article className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.08em] accent-ink">
          <Link to={`/subjects/${subject.id}/topics/${topic.id}`} className="inline-block -my-1 py-1 hover:underline">{topic.title}</Link>
        </p>
        <h1 className="text-3xl font-bold leading-tight">Where you meet it</h1>
      </header>

      {!why ? (
        <p className="text-ink-2">This topic does not have this section yet.</p>
      ) : (
        <>
          {/* The "why this exists" paragraph is not repeated here. It is one field shown on
              the topic page, one tap back, and showing it twice read as padding. */}
          {why.examples.map((ex, i) => (
            <section key={i} className="flex flex-col gap-3 rounded-2xl border border-rule bg-surface px-4 py-4">
              <h2 className="text-xl font-bold leading-tight">{ex.title}</h2>
              {ex.visual && <Visual visual={ex.visual} />}
              <RichText source={ex.body} />
            </section>
          ))}

          <Link
            to={`/subjects/${subject.id}/topics/${topic.id}/lesson`}
            className="w-fit rounded-lg bg-[color:var(--subject)] px-4 py-2 font-bold text-white"
          >
            Start the lesson
          </Link>
        </>
      )}
    </article>
  )
}
