import { useEffect, useState } from 'react'
import { Link, useNavigationType, useSearchParams } from 'react-router'
import { supabase } from '../../auth/client.ts'
import { useAuth } from '../../auth/useAuth.ts'
import { SectionLabel } from '../../components/KindChip.tsx'
import { fromStored, type ProgressState } from '../../progress/store.ts'
import { firstNameOf, personName } from '../../auth/personName.ts'
import { parentSummary, type ActivityEntry, type ParentSummary } from '../../progress/summary.ts'
import { AssignPanel } from './Assign.tsx'
import { TopicBreakdown } from './TopicBreakdown.tsx'
import { STUDY_EMOJI, SubjectDetail, formatMinutes } from './SubjectDetail.tsx'
import { StatusDonut } from '../../components/charts/StatusDonut.tsx'
import { WeeklyBars } from '../../components/charts/WeeklyBars.tsx'
import { SkillBars } from '../../components/charts/SkillBars.tsx'
import { rankedSkills, statusTotals, weeklyMinutes } from '../../progress/charts.ts'
import { skillStats } from '../../progress/xp.ts'
import { ReportsPanel } from './Reports.tsx'
import { minutesBySubject } from '../../progress/subjectDetail.ts'
import { weekOnWeek } from '../../progress/weekOnWeek.ts'
import { deedsDone, recentDeeds } from '../../progress/deeds.ts'
import { CharacterIcon } from '../../components/characterIcons.tsx'
import { MapLegend, MiniMap } from '../../components/map/MapParts.tsx'
import { TrendTable } from '../../components/charts/Trend.tsx'
import { topicsForSubject } from '../../content/index.ts'
import { square } from '../../progress/map.ts'
import { subjectTrend } from '../../progress/trend.ts'

export interface Child {
  email: string
  name: string
  state?: ProgressState
  syncedAt?: string
}

export type FamilyTab = 'dashboard' | 'tasks' | 'reports'
const TABS: { id: FamilyTab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'reports', label: 'Reports' },
]

/** One glyph per kind, so the feed can be skimmed down the left edge. */
const ACTIVITY_EMOJI: Record<ActivityEntry['kind'], string> = STUDY_EMOJI

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
  const asked = params.get('tab')
  const tab: FamilyTab = asked === 'tasks' || asked === 'reports' ? asked : 'dashboard'
  const setTab = (t: FamilyTab) => setParams(t === 'dashboard' ? {} : { tab: t }, { replace: true })
  // An open subject is in the URL too, as ?subject=, and is pushed rather than replaced so
  // the browser's back button closes it again.
  const subjectId = params.get('subject') ?? undefined
  // The app scrolls to the top on a new path, and this is the same path with a new query,
  // so it does it itself; going back is left alone, like everywhere else.
  const navigationType = useNavigationType()
  useEffect(() => {
    if (navigationType !== 'POP') window.scrollTo({ top: 0, left: 0 })
  }, [subjectId, navigationType])
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
          state: row ? fromStored(row.state as Partial<ProgressState>) : undefined,
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
    <Shell title={child.name} subtitle={tab === 'tasks' ? `What ${first} has been set, and how it is going.` : tab === 'reports' ? 'Mistakes the family has reported in questions and lessons.' : `How ${first} is getting on, from their signed-in account.`}>
      {children.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {children.map((c) => (
            <button key={c.email} type="button" onClick={() => setChosen(c.email)} aria-pressed={c.email === child.email}
              className={`min-h-11 rounded-xl px-4 font-bold ${c.email === child.email ? 'bg-ink text-surface' : 'border border-rule'}`}>{c.name}</button>
          ))}
        </div>
      )}
      <FamilyBody child={child} tab={tab} onTab={setTab} subjectId={subjectId} />
    </Shell>
  )
}

/**
 * The tab bar and whichever tab is open. Kept separate from the loading and sign-in
 * states above so it can be rendered, and tested, from a child record alone.
 */
export function FamilyBody({ child, tab, onTab, subjectId }: { child: Child; tab: FamilyTab; onTab: (t: FamilyTab) => void; subjectId?: string }) {
  const first = firstNameOf(child.name)
  return (
    <>
      <FamilyTabs tab={tab} onTab={onTab} />
      {tab === 'dashboard' ? (
        <TabPanel tab="dashboard">
          {child.state && subjectId ? <SubjectDetail state={child.state} subjectId={subjectId} first={first} />
            : child.state ? <ChildReport child={child} summary={parentSummary(child.state)} /> : (
            <p className="rounded-2xl border border-rule bg-surface p-4 text-ink-2">
              <strong className="text-ink">{first}</strong> has not signed in yet, so nothing has reached the account. Work done while signed out stays on that device.
              Tasks can still be set on the <button type="button" onClick={() => onTab('tasks')} className="font-bold text-ink underline">Tasks</button> tab.
            </p>
          )}
        </TabPanel>
      ) : tab === 'reports' ? (
        <TabPanel tab="reports">
          {/* Reports are the family's, not one child's: the same list whichever child is chosen. */}
          <ReportsPanel />
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
  const gap = s.daysSinceActive
  const subjectMinutes = minutesBySubject(child.state!)
  return (
    <div className="flex flex-col gap-6">
      <p className="text-ink-2">
        <strong className="text-ink">{firstNameOf(child.name)}</strong>
        {s.lastActive ? ` last studied ${gap === 0 ? 'today' : gap === 1 ? 'yesterday' : `${gap} days ago, on ${day(s.lastActive)}`}.` : ' has not finished anything yet.'}
        {child.syncedAt && ` Account last updated ${day(child.syncedAt)}.`}
      </p>

      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Tile label="This week" value={`${s.weekMinutes} min`} note={`${s.goalDays.of > 0 ? `${s.dailyGoalMinutes} minutes reached on ${s.goalDays.met} of ${s.goalDays.of} ${s.goalDays.of === 1 ? 'day' : 'days'}` : `Goal of ${s.dailyGoalMinutes} minutes a day`} · ${s.activeDays} ${s.activeDays === 1 ? 'day' : 'days'} studied`} />
        <Tile label="Streak" value={`${s.streak} ${s.streak === 1 ? 'day' : 'days'}`} note="Days in a row with something finished" />
        <Tile label="Quiz average" value={s.averageQuizPct === undefined ? '—' : `${s.averageQuizPct}%`}
          note={quizNote(s)} />
        <Tile label="Topics secure" value={`${s.topicsMastered}`} note={`${s.topicsStarted} ${s.topicsStarted === 1 ? 'topic' : 'topics'} started`} />
      </section>

      <WeekOnWeek state={child.state!} />

      <EightWeeks state={child.state!} />

      <GoodDeeds state={child.state!} first={firstNameOf(child.name)} />

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
                {/* A next step to suggest, so the conversation ends with something to do. */}
                <span className="text-xs text-ink-2">
                  Suggested next: <strong className="text-ink">{x.reason === 'no-quiz' ? 'the quiz, to see what went in' : 'the Core worksheet, then the quiz again'}</strong>. Set it on the Tasks tab.
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
          <SectionLabel colour="#2e8b57" emoji="📅">Days on goal, by week</SectionLabel>
          <WeeklyBars weeks={weeklyMinutes(child.state!)} goal={s.dailyGoalMinutes} />
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
        <p className="text-sm text-ink-2">
          The squares are the map {firstNameOf(child.name)} sees on Home: one per topic, darker the better it is known.
          Tap a subject for its map by unit, each topic, what was done on it and how long it took.
        </p>
        <MapLegend />
        <div className="flex flex-col gap-2">
          {s.subjects.map((sub) => (
            // The whole row is the link: on a phone the name alone is a small target, and the
            // row is what a parent reads as "this subject". It opens the subject's detail
            // here rather than the student's own subject page, which shows no progress.
            <Link key={sub.id} to={`/family?subject=${sub.id}`} style={{ '--subject': sub.colour } as React.CSSProperties}
              className="group flex flex-col gap-2 rounded-xl border border-rule bg-surface px-4 py-3 hover:border-ink">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="flex items-baseline gap-2">
                  <span className="font-bold underline accent-ink">{sub.name}</span>
                  <span aria-hidden className="text-ink-3 group-hover:text-ink">›</span>
                </span>
                <span className="text-xs text-ink-2">
                  {sub.started} of {sub.total} started
                  {subjectMinutes[sub.id] ? ` · ${formatMinutes(subjectMinutes[sub.id]!)}` : ''}
                  {sub.lastActive ? ` · last opened ${day(sub.lastActive)}` : ''}
                </span>
              </div>
              <MiniMap squares={topicsForSubject(sub.id).map((t) => square(t, child.state!))} name={sub.name} />
            </Link>
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


/** The last eight weeks per subject (PAR-5): minutes and the average mark, week by week. */
function EightWeeks({ state }: { state: ProgressState }) {
  const { weeks, subjects } = subjectTrend(state)
  if (subjects.length === 0) return null
  return (
    <section className="flex flex-col gap-3">
      <SectionLabel colour="#1f3a93" emoji="📈">Last eight weeks, by subject</SectionLabel>
      <p className="text-xs text-ink-2">Minutes a week in bold, and under them the average mark on that week's quizzes and worksheets. Minutes are filed by subject from 23 September 2026.</p>
      <TrendTable weeks={weeks} subjects={subjects} />
    </section>
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

/**
 * The good deed of each of the last seven days, and how many the student has said they
 * did. Shown once a deed has been seen: a family that has not opened Home since the deeds
 * began has nothing to read here, and a parent would wonder at an empty week.
 */
function GoodDeeds({ state, first }: { state: ProgressState; first: string }) {
  if (Object.keys(state.deeds).length === 0) return null
  const days = recentDeeds(state)
  const count = deedsDone(state)
  const weekday = (day: string) => new Date(day + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' })
  return (
    <section className="flex flex-col gap-3">
      <SectionLabel colour="#c8501f" emoji="🌱">{`Good deeds · ${count} done`}</SectionLabel>
      <p className="text-sm text-ink-2">One small act of character a day on Home, with a question in the evening. What {first} was asked this week, and what they said.</p>
      <ol className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        {days.map((d) => (
          <li key={d.day} className={`flex items-center gap-3 rounded-lg border border-rule bg-surface px-3 py-2 text-sm ${d.deed ? '' : 'text-ink-3'}`}>
            <span className="w-8 shrink-0 text-xs font-bold text-ink-3">{weekday(d.day)}</span>
            {d.deed ? (
              <>
                <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: d.done ? '#c8501f' : 'var(--color-panel)', color: d.done ? '#fff' : 'var(--color-ink-3)' }}><CharacterIcon name={d.deed.icon} size={18} /></span>
                <span className="min-w-0 flex-grow leading-snug">{d.deed.text}</span>
                <span className="shrink-0 text-xs font-bold">{d.done === true ? 'Done' : d.done === false ? 'Not done' : 'Not answered'}</span>
              </>
            ) : <span>Not opened</span>}
          </li>
        ))}
      </ol>
    </section>
  )
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

/**
 * This week against last, per subject (TRK-5, PAR-1): minutes, the average mark on quizzes
 * and worksheets, and topics whose status moved. It answers "is this week better or worse
 * than last", which the week's totals alone cannot.
 */
function WeekOnWeek({ state }: { state: ProgressState }) {
  const { rows, total } = weekOnWeek(state)
  if (rows.length === 0) return null
  const arrow = (a: number | undefined, b: number | undefined, unit: string) =>
    a === undefined && b === undefined ? '—' : `${a === undefined ? '—' : `${a}${unit}`} → ${b === undefined ? '—' : `${b}${unit}`}`
  const moved = (up: number, down: number) => (up || down ? [up ? `${up} up` : '', down ? `${down} down` : ''].filter(Boolean).join(', ') : 'none')
  return (
    <section className="flex flex-col gap-3">
      <SectionLabel colour="#1f3a93" emoji="📆">This week and last</SectionLabel>
      <p className="text-xs text-ink-2">Each figure is last week → this week. Mark is the average on quizzes and worksheets; moved counts topics whose status went up or down.</p>
      <div className="overflow-x-auto rounded-xl border border-rule bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-2">
              <th className="px-2 py-2 font-bold">Subject</th>
              <th className="px-2 py-2 font-bold">Minutes</th>
              <th className="px-2 py-2 font-bold">Mark</th>
              <th className="px-2 py-2 font-bold">Moved</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.subjectId} className="border-t border-rule/60">
                <td className="px-2 py-2 font-bold"><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: r.colour }} aria-hidden />{r.name}</td>
                <td className="whitespace-nowrap px-2 py-2 tabular-nums">{arrow(r.last.minutes, r.this.minutes, '')}</td>
                <td className="whitespace-nowrap px-2 py-2 tabular-nums">{arrow(r.last.avgPct, r.this.avgPct, '%')}</td>
                <td className="px-2 py-2">{moved(r.up, r.down)}</td>
              </tr>
            ))}
            {rows.length > 1 && (
              <tr className="border-t border-rule font-bold">
                <td className="px-3 py-2">All</td>
                <td className="whitespace-nowrap px-2 py-2 tabular-nums">{arrow(total.last.minutes, total.this.minutes, '')}</td>
                <td className="whitespace-nowrap px-2 py-2 tabular-nums">{arrow(total.last.avgPct, total.this.avgPct, '%')}</td>
                <td className="px-2 py-2">{moved(total.up, total.down)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
