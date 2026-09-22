import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { STATUS_COLOUR, STATUS_LABEL, TOPIC_STATUSES } from '@study/shared'
import { supabase } from '../../auth/client.ts'
import { useAuth } from '../../auth/useAuth.ts'
import { SectionLabel } from '../../components/KindChip.tsx'
import { StatusIcon } from '../../components/StatusChip.tsx'
import { emptyState, type ProgressState } from '../../progress/store.ts'
import { firstNameOf, personName } from '../../auth/personName.ts'
import { parentSummary, type ActivityEntry, type ParentSummary } from '../../progress/summary.ts'
import { AssignPanel } from './Assign.tsx'
import { TopicBreakdown } from './TopicBreakdown.tsx'
import { StatusDonut } from '../../components/charts/StatusDonut.tsx'
import { WeeklyBars } from '../../components/charts/WeeklyBars.tsx'
import { SkillBars } from '../../components/charts/SkillBars.tsx'
import { rankedSkills, statusTotals, weeklyMinutes } from '../../progress/charts.ts'
import { skillStats } from '../../progress/xp.ts'

export interface Child {
  email: string
  name: string
  state?: ProgressState
  syncedAt?: string
}

export type FamilyTab = 'dashboard' | 'tasks'
const TABS: { id: FamilyTab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'tasks', label: 'Tasks' },
]

/** One glyph per kind, so the feed can be skimmed down the left edge. */
const ACTIVITY_EMOJI: Record<ActivityEntry['kind'], string> = {
  quiz: '⚡', worksheet: '📝', lesson: '📖', flashcards: '🃏',
  'cheat-sheet': '📋', why: '🌍', 'exam-technique': '🎓',
}

const day = (iso: string) => new Date(iso.length > 10 ? iso : iso + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

/**
 * What a parent sees. Read only by design, in the database as well as here: a parent can
 * look at a child's progress but never change it, so nothing on this screen can quietly
 * undo work the student did.
 *
 * It answers three questions in order — is the work happening, is it going in, and where
 * is it going wrong — because those are the ones that lead to a useful conversation.
 *
 * Reading the week and setting the next task are separate jobs, done at different times,
 * so they are separate tabs rather than one long scroll.
 */
export function Family() {
  const auth = useAuth()
  const [params, setParams] = useSearchParams()
  // The tab is in the URL, so a refresh, a bookmark or a link sent to the other parent
  // all land back on the one that was open. Dashboard is the plain /family address.
  const tab: FamilyTab = params.get('tab') === 'tasks' ? 'tasks' : 'dashboard'
  const setTab = (t: FamilyTab) => setParams(t === 'dashboard' ? {} : { tab: t }, { replace: true })
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
      // Whole rows rather than a named list of columns: naming display_name would make
      // this screen fail outright on a deployment that has not had the migration applied
      // yet, and the row is small enough that asking for all of it costs nothing.
      const rows = await supabase!.from('user_progress').select('*')
      if (rows.error) { if (live) { setError(rows.error.message); setLoading(false) } return }
      const byEmail = new Map((rows.data ?? []).map((r) => [r.email as string, r]))
      const merged: Child[] = (list.data ?? []).map((r) => {
        const row = byEmail.get(r.email as string)
        return {
          email: r.email as string,
          name: personName({ note: r.note as string | null, profile: row?.display_name as string | null, email: r.email as string }),
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
  if (auth.status !== 'allowed') return <Shell><p className="text-ink-2">Sign in with your family account to see how the work is going. <Link to="/settings" className="font-bold text-ink underline">Go to Settings</Link>.</p></Shell>
  if (auth.role !== 'parent') return <Shell><p className="text-ink-2">This page is for parent accounts. You are signed in as a student, so this shows nothing extra — your own numbers are on <Link to="/progress" className="font-bold text-ink underline">Progress</Link>.</p></Shell>
  if (loading) return <Shell><p className="text-ink-2">Loading…</p></Shell>
  if (error) return <Shell><p className="text-[color:var(--status-not-secure-ink)]">{error}</p></Shell>
  if (children.length === 0) return <Shell><p className="text-ink-2">No student accounts on the family list yet. Add one in <Link to="/settings" className="font-bold text-ink underline">Settings</Link>, using the Google address they sign in with.</p></Shell>

  const child = children.find((c) => c.email === chosen) ?? children[0]!
  const first = firstNameOf(child.name)

  return (
    <Shell title={child.name} subtitle={tab === 'tasks' ? `What ${first} has been set, and how it is going.` : `How ${first} is getting on, from their signed-in account.`}>
      {children.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {children.map((c) => (
            <button key={c.email} type="button" onClick={() => setChosen(c.email)} aria-pressed={c.email === child.email}
              className={`min-h-11 rounded-xl px-4 font-bold ${c.email === child.email ? 'bg-ink text-surface' : 'border border-rule'}`}>{c.name}</button>
          ))}
        </div>
      )}
      <FamilyBody child={child} tab={tab} onTab={setTab} />
    </Shell>
  )
}

/**
 * The tab bar and whichever tab is open. Kept separate from the loading and sign-in
 * states above so it can be rendered, and tested, from a child record alone.
 */
export function FamilyBody({ child, tab, onTab }: { child: Child; tab: FamilyTab; onTab: (t: FamilyTab) => void }) {
  const first = firstNameOf(child.name)
  return (
    <>
      <FamilyTabs tab={tab} onTab={onTab} />
      {tab === 'dashboard' ? (
        <TabPanel tab="dashboard">
          {child.state ? <ChildReport child={child} summary={parentSummary(child.state)} /> : (
            <p className="rounded-2xl border border-rule bg-surface p-4 text-ink-2">
              <strong className="text-ink">{first}</strong> has not signed in yet, so nothing has reached the account. Work done while signed out stays on that device.
              Tasks can still be set on the <button type="button" onClick={() => onTab('tasks')} className="font-bold text-ink underline">Tasks</button> tab.
            </p>
          )}
        </TabPanel>
      ) : (
        <TabPanel tab="tasks">
          {/* Setting tasks does not depend on the child having synced anything yet, so
              this tab works the same for an account with no history. */}
          <AssignPanel email={child.email} name={first} state={child.state} />
        </TabPanel>
      )}
    </>
  )
}

/** Arrow keys move along a tab list, which is what a keyboard user expects of one. */
const STEP: Record<string, (i: number) => number> = {
  ArrowRight: (i) => i + 1,
  ArrowLeft: (i) => i - 1,
  Home: () => 0,
  End: () => TABS.length - 1,
}

export function FamilyTabs({ tab, onTab }: { tab: FamilyTab; onTab: (t: FamilyTab) => void }) {
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = STEP[e.key]
    if (!step) return
    e.preventDefault()
    const at = TABS.findIndex((t) => t.id === tab)
    const next = TABS[(step(at) + TABS.length) % TABS.length]!
    onTab(next.id)
    document.getElementById(`familytab-${next.id}`)?.focus()
  }
  return (
    <div role="tablist" aria-label="Family view" onKeyDown={onKeyDown} className="flex gap-1 border-b border-rule">
      {TABS.map((t) => {
        const on = t.id === tab
        return (
          <button key={t.id} type="button" role="tab" id={`familytab-${t.id}`} aria-controls={`familypanel-${t.id}`}
            aria-selected={on} tabIndex={on ? 0 : -1} onClick={() => onTab(t.id)}
            className={`-mb-px min-h-11 border-b-2 px-4 font-bold ${on ? 'border-ink text-ink' : 'border-transparent text-ink-2'}`}>
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

function TabPanel({ tab, children }: { tab: FamilyTab; children: React.ReactNode }) {
  return <div role="tabpanel" id={`familypanel-${tab}`} aria-labelledby={`familytab-${tab}`} tabIndex={0} className="flex flex-col gap-6">{children}</div>
}

function Shell({ children, title, subtitle }: { children: React.ReactNode; title?: string; subtitle?: string }) {
  return (
    <article className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold leading-tight">{title ?? 'Family'}</h1>
        <p className="text-ink-2">{subtitle ?? 'How your family is getting on, from their signed-in accounts.'}</p>
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
        <strong className="text-ink">{firstNameOf(child.name)}</strong>
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
          <p className="rounded-xl border border-rule bg-surface px-4 py-3 text-sm text-ink-2">Nothing is stuck. Every topic {firstNameOf(child.name)} has worked on has either gone well or is still in progress.</p>
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

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-2xl border border-rule bg-surface p-4">
          <SectionLabel colour="#0f766e" emoji="🍩">Where the topics stand</SectionLabel>
          <StatusDonut totals={statusTotals(child.state!)} />
        </div>
        <div className="flex flex-col gap-3 rounded-2xl border border-rule bg-surface p-4">
          <SectionLabel colour="#2e8b57" emoji="📅">Study time by week</SectionLabel>
          <WeeklyBars weeks={weeklyMinutes(child.state!)} goal={s.goalMinutes} />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-2xl border border-rule bg-surface p-4">
          <SectionLabel colour="#c8501f" emoji="📉">Needs the most work</SectionLabel>
          <SkillBars skills={rankedSkills(skillStats(child.state!).all, 6)} empty="Not enough answers yet. A skill needs two questions before it counts." />
        </div>
        <div className="flex flex-col gap-3 rounded-2xl border border-rule bg-surface p-4">
          <SectionLabel colour="#2e8b57" emoji="💪">Going well</SectionLabel>
          <SkillBars skills={s.strengths} empty="Nothing above 80% yet." />
        </div>
      </section>

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
                <Link to={`/subjects/${sub.id}`} className="font-bold underline accent-ink" style={{ '--subject': sub.colour } as React.CSSProperties}>{sub.name}</Link>
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
        {s.recent.length === 0 ? <p className="text-sm text-ink-2">Nothing done yet.</p> : (
          <ul className="flex flex-col gap-1.5">
            {s.recent.map((a) => (
              <li key={a.id} className="flex flex-col rounded-lg border border-rule bg-surface px-3 py-2 text-sm"
                style={{ '--subject': a.subjectColour } as React.CSSProperties}>
                <span className="flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span aria-hidden className="shrink-0">{ACTIVITY_EMOJI[a.kind]}</span>
                    {/* Only a topic has a breakdown to open; the subject-wide exam technique
                        page is named but not a button, so nothing invites a tap that would
                        do nothing. */}
                    {a.topicId ? (
                      <button type="button" onClick={() => toggle(a.topicId!)} aria-expanded={openTopic === a.topicId}
                        className="min-w-0 py-1 text-left font-bold text-ink underline">{a.title}</button>
                    ) : <span className="min-w-0 py-1 font-bold text-ink">{a.title}</span>}
                  </span>
                  {/* A percentage where the work was marked; the kind's own phrase where it
                      was not, so a deck of flashcards is not shown as a score it never had. */}
                  <strong className="shrink-0 tabular-nums">{a.pct !== undefined ? `${a.pct}%` : ''}</strong>
                </span>
                {/* One meta line rather than a tail on the title: at phone width the title
                    wraps, and a trailing " · Flashcards · 17 Sept" then began the next line
                    with a stray separator. The subject is dropped where the title is already
                    the subject, which is every exam technique row. */}
                <span className="pl-6 text-xs text-ink-2">
                  {a.topicId ? `${a.subjectName} · ` : ''}
                  <span className="accent-ink font-bold">{a.label}</span>
                  {' · '}{day(a.at)}{' · '}{a.detail}
                </span>
                {a.topicId && openTopic === a.topicId && child.state && <TopicBreakdown topicId={a.topicId} state={child.state} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="rounded-xl bg-panel px-4 py-3 text-xs text-ink-2">
        This is what has reached {firstNameOf(child.name)}&rsquo;s account. Work done while signed out, or in a different browser, does not appear here until they sign in on that device.
        Nothing on this page changes {firstNameOf(child.name)}&rsquo;s progress — a parent account can read it but not write it.
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

