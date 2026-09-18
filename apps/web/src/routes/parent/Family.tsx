import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { STATUS_COLOUR, STATUS_LABEL, TOPIC_STATUSES } from '@study/shared'
import { supabase } from '../../auth/client.ts'
import { TOPICS } from '../../content/index.ts'
import { useAuth } from '../../auth/useAuth.ts'
import { SectionLabel } from '../../components/KindChip.tsx'
import { StatusIcon } from '../../components/StatusChip.tsx'
import { emptyState, type ProgressState } from '../../progress/store.ts'
import { parentSummary, type ParentSummary } from '../../progress/summary.ts'
import { AssignPanel } from './Assign.tsx'
import { TopicBreakdown } from './TopicBreakdown.tsx'

export interface Child {
  email: string
  name: string
  state?: ProgressState
  syncedAt?: string
}

const TOPIC_INDEX = new Map(TOPICS.map((t) => [t.id, t]))
const day = (iso: string) => new Date(iso.length > 10 ? iso : iso + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

/**
 * What a parent sees. Read only by design, in the database as well as here: a parent can
 * look at a child's progress but never change it, so nothing on this screen can quietly
 * undo work the student did.
 *
 * It answers three questions in order — is the work happening, is it going in, and where
 * is it going wrong — because those are the ones that lead to a useful conversation.
 */
export function Family() {
  const auth = useAuth()
  const [children, setChildren] = useState<Child[]>([])
  const [chosen, setChosen] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (auth.status !== 'allowed' || auth.role !== 'parent' || !supabase) return
    let live = true
    void (async () => {
      setLoading(true)
      const list = await supabase!.from('allowed_emails').select('email, note').eq('role', 'student').order('added_at')
      if (list.error) { if (live) { setError(list.error.message); setLoading(false) } return }
      const rows = await supabase!.from('user_progress').select('email, state, updated_at')
      if (rows.error) { if (live) { setError(rows.error.message); setLoading(false) } return }
      const byEmail = new Map((rows.data ?? []).map((r) => [r.email as string, r]))
      const merged: Child[] = (list.data ?? []).map((r) => {
        const row = byEmail.get(r.email as string)
        return {
          email: r.email as string,
          name: ((r.note as string | null) ?? '').trim() || (r.email as string).split('@')[0]!,
          state: row ? { ...emptyState(), ...(row.state as Partial<ProgressState>) } : undefined,
          syncedAt: row?.updated_at as string | undefined,
        }
      })
      if (!live) return
      setChildren(merged)
      setChosen((c) => c ?? merged[0]?.email ?? null)
      setLoading(false)
    })()
    return () => { live = false }
  }, [auth.status, auth.role])

  if (auth.status === 'disabled') return <Shell><p className="text-ink-2">Family sign-in is not set up on this build, so there is no account to follow. Progress is saved on each device instead.</p></Shell>
  if (auth.status !== 'allowed') return <Shell><p className="text-ink-2">Sign in with your family account to see how your child is getting on. <Link to="/settings" className="font-bold text-ink underline">Go to Settings</Link>.</p></Shell>
  if (auth.role !== 'parent') return <Shell><p className="text-ink-2">This page is for parent accounts. You are signed in as a student, so this shows nothing extra — your own numbers are on <Link to="/progress" className="font-bold text-ink underline">Progress</Link>.</p></Shell>
  if (loading) return <Shell><p className="text-ink-2">Loading…</p></Shell>
  if (error) return <Shell><p className="text-status-not-secure">{error}</p></Shell>
  if (children.length === 0) return <Shell><p className="text-ink-2">No student accounts on the family list yet. Add one in <Link to="/settings" className="font-bold text-ink underline">Settings</Link>, using the Google address your child signs in with.</p></Shell>

  const child = children.find((c) => c.email === chosen) ?? children[0]!

  return (
    <Shell>
      {children.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {children.map((c) => (
            <button key={c.email} type="button" onClick={() => setChosen(c.email)} aria-pressed={c.email === child.email}
              className={`min-h-11 rounded-xl px-4 font-bold ${c.email === child.email ? 'bg-ink text-surface' : 'border border-rule'}`}>{c.name}</button>
          ))}
        </div>
      )}
      {/* Setting tasks does not depend on the child having synced anything yet, so the
          panel sits outside the report and shows even for an account with no history. */}
      <AssignPanel email={child.email} name={child.name} state={child.state} />

      {child.state ? <ChildReport child={child} summary={parentSummary(child.state)} /> : (
        <p className="rounded-2xl border border-rule bg-surface p-4 text-ink-2">
          <strong className="text-ink">{child.name}</strong> has not signed in yet, so nothing has reached the account. Work done while signed out stays on that device.
        </p>
      )}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <article className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold leading-tight">Family</h1>
        <p className="text-ink-2">How your child is getting on, from their signed-in account.</p>
      </header>
      {children}
    </article>
  )
}

export function ChildReport({ child, summary }: { child: Child; summary: ParentSummary }) {
  const s = summary
  // One topic open at a time, inline: the answer to "how did that go" belongs next to the
  // row that raised the question, not on a separate screen.
  const [openTopic, setOpenTopic] = useState<string | null>(null)
  const toggle = (id: string) => setOpenTopic((cur) => (cur === id ? null : id))
  const goalPct = s.goalMinutes > 0 ? Math.round((100 * s.weekMinutes) / s.goalMinutes) : 0
  const gap = s.daysSinceActive
  return (
    <div className="flex flex-col gap-6">
      <p className="text-ink-2">
        <strong className="text-ink">{child.name}</strong>
        {s.lastActive ? ` last studied ${gap === 0 ? 'today' : gap === 1 ? 'yesterday' : `${gap} days ago, on ${day(s.lastActive)}`}.` : ' has not finished anything yet.'}
        {child.syncedAt && ` Account last updated ${day(child.syncedAt)}.`}
      </p>

      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Tile label="This week" value={`${s.weekMinutes} min`} note={`${goalPct}% of the ${s.goalMinutes} minute goal · ${s.activeDays} ${s.activeDays === 1 ? 'day' : 'days'} studied`} />
        <Tile label="Streak" value={`${s.streak} ${s.streak === 1 ? 'day' : 'days'}`} note="Days in a row with something finished" />
        <Tile label="Quiz average" value={s.averageQuizPct === undefined ? '—' : `${s.averageQuizPct}%`}
          note={quizNote(s)} />
        <Tile label="Topics secure" value={`${s.topicsMastered}`} note={`${s.topicsStarted} ${s.topicsStarted === 1 ? 'topic' : 'topics'} started`} />
      </section>

      <section className="flex flex-col gap-3">
        <SectionLabel colour="#d25b3b" emoji="🎯">Worth a conversation</SectionLabel>
        {s.stuck.length === 0 ? (
          <p className="rounded-xl border border-rule bg-surface px-4 py-3 text-sm text-ink-2">Nothing is stuck. Every topic {child.name} has worked on has either gone well or is still in progress.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {s.stuck.map((x) => (
              <li key={x.topicId} className="flex flex-col rounded-lg border border-rule bg-surface px-3 py-2 text-sm">
                <span className="flex items-center justify-between gap-3">
                  <button type="button" onClick={() => toggle(x.topicId)} aria-expanded={openTopic === x.topicId}
                    className="min-w-0 py-1 text-left font-bold text-ink underline">{x.title}</button>
                  <span className="shrink-0 text-right text-ink-2">
                    {x.reason === 'low-score' ? <>scored <strong className="tabular-nums text-ink">{x.pct}%</strong></> : 'lesson read, no quiz yet'}
                    <span className="text-ink-3"> · {x.subjectName}</span>
                  </span>
                </span>
                {openTopic === x.topicId && child.state && <TopicBreakdown topicId={x.topicId} state={child.state} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      {(s.needsWork.length > 0 || s.strengths.length > 0) && (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Panel title="Doing well" colour="#2e8b57" emoji="💪" empty="Not enough answers yet." rows={s.strengths} />
          <Panel title="Weakest skills" colour="#c8501f" emoji="📉" empty="Nothing below 60% yet." rows={s.needsWork} />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <SectionLabel colour="#0f766e" emoji="📊">Each subject</SectionLabel>
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-2">
          {TOPIC_STATUSES.map((st) => <li key={st} className="flex items-center gap-1.5"><StatusIcon status={st} size={12} />{STATUS_LABEL[st]}</li>)}
          <li className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full bg-panel ring-1 ring-rule" aria-hidden />Not started</li>
        </ul>
        <div className="flex flex-col gap-2">
          {s.subjects.map((sub) => (
            <div key={sub.id} className="flex flex-col gap-2 rounded-xl border border-rule bg-surface px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <Link to={`/subjects/${sub.id}`} className="font-bold underline" style={{ color: sub.colour }}>{sub.name}</Link>
                <span className="text-xs text-ink-2">{sub.started} of {sub.total} started{sub.lastActive ? ` · last opened ${day(sub.lastActive)}` : ''}</span>
              </div>
              {/* Untouched topics are left as the bar's own background, so a subject not
                  yet begun reads as empty rather than as a wall of the failing colour. */}
              <div className="flex h-3 overflow-hidden rounded-full bg-panel">
                {(['grade-9-ready', 'secure', 'developing', 'not-secure'] as const).map((st) => (
                  <span key={st} style={{ width: `${(100 * sub.counts[st]) / sub.total}%`, background: STATUS_COLOUR[st] }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <SectionLabel colour="#c27a00" emoji="🕒">Recent work</SectionLabel>
        {s.recent.length === 0 ? <p className="text-sm text-ink-2">Nothing finished yet.</p> : (
          <ul className="flex flex-col gap-1.5">
            {s.recent.map((a) => (
              <li key={a.id} className="flex flex-col rounded-lg border border-rule bg-surface px-3 py-2 text-sm">
                <span className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <button type="button" onClick={() => toggle(a.topicId)} aria-expanded={openTopic === a.topicId}
                      className="py-1 text-left font-bold text-ink underline">{TOPIC_INDEX.get(a.topicId)?.title ?? a.topicId}</button>
                    <span className="text-ink-2"> · {a.kind === 'quiz' ? 'Quiz' : `${a.level![0]!.toUpperCase()}${a.level!.slice(1)} worksheet`} · {day(a.completedAt)}</span>
                  </span>
                  <strong className="shrink-0 tabular-nums">{Math.round((100 * a.marksScored) / a.marksAvailable)}%</strong>
                </span>
                {openTopic === a.topicId && child.state && <TopicBreakdown topicId={a.topicId} state={child.state} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="rounded-xl bg-panel px-4 py-3 text-xs text-ink-2">
        This is what has reached {child.name}&rsquo;s account. Work done while signed out, or in a different browser, does not appear here until they sign in on that device.
        Nothing on this page changes {child.name}&rsquo;s progress — a parent account can read it but not write it.
      </p>
    </div>
  )
}


/** The average is over the last ten quizzes, and the trend needs six to mean anything. */
function quizNote(s: ParentSummary): string {
  if (s.quizCount === 0) return 'No quizzes yet'
  if (s.quizCount === 1) return 'One quiz so far'
  const of = s.quizCount > 10 ? `Last 10 of ${s.quizCount}` : `Across all ${s.quizCount}`
  if (s.trend === undefined) return of
  return `${of} · ${s.trend >= 0 ? `up ${s.trend}` : `down ${-s.trend}`} points`
}

function Tile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-rule bg-surface px-4 py-3">
      <span className="text-xs font-bold uppercase tracking-wide text-ink-3">{label}</span>
      <span className="text-2xl font-bold tabular-nums">{value}</span>
      <span className="text-xs text-ink-2">{note}</span>
    </div>
  )
}

function Panel({ title, colour, emoji, rows, empty }: { title: string; colour: string; emoji: string; rows: { skill: string; subjectId: string; pct: number }[]; empty: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-rule bg-surface px-4 py-3">
      <SectionLabel colour={colour} emoji={emoji}>{title}</SectionLabel>
      {rows.length === 0 ? <p className="text-sm text-ink-2">{empty}</p> : (
        <ul className="flex flex-col gap-1 text-sm">
          {rows.map((x) => <li key={x.subjectId + x.skill} className="flex justify-between gap-2"><span>{x.skill}</span><strong className="tabular-nums">{x.pct}%</strong></li>)}
        </ul>
      )}
    </div>
  )
}
