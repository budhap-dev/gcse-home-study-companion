import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ChildReport, FamilyBody } from './Family.tsx'
import { emptyState, timeKey, type ProgressState } from '../../progress/store.ts'
import { parentSummary } from '../../progress/summary.ts'

const render = (state: ProgressState, syncedAt?: string, name = 'Ana') =>
  renderToStaticMarkup(
    <MemoryRouter>
      <ChildReport child={{ email: 'kid@example.com', name, state, syncedAt }} summary={parentSummary(state, '2026-09-18')} />
    </MemoryRouter>,
  )

const quiz = (topicId: string, pct: number, day: string) => ({
  id: `${topicId}-${day}`, topicId, kind: 'quiz' as const, marksScored: pct, marksAvailable: 100, markedHow: 'auto' as const,
  completedAt: `${day}T10:00:00.000Z`, questions: [{ id: 'a', skill: 'rationalising denominators', gradeBand: '6-7' as const, correct: pct >= 50, marksScored: pct >= 50 ? 2 : 0, marksAvailable: 2 }],
})

describe('the parent report', () => {
  /**
   * The screen used to say "abhigyan.pandit1", because the name was the note typed when
   * the account was added or else the part of the email before the @. It now comes from
   * the account's own Google profile, and sentences use the first name only: a report
   * that says "Abhigyan Pandit last studied today" reads like a school letter.
   */
  it('calls the student by their first name in its sentences', () => {
    const state = { ...emptyState(), attempts: [quiz('surds', 80, '2026-09-18')] }
    const html = render(state, undefined, 'Abhigyan Pandit')
    expect(html).toContain('<strong class="text-ink">Abhigyan</strong>')
    expect(html).not.toContain('Abhigyan Pandit')
    expect(html).not.toContain('abhigyan')
  })

  it('leads with how long it has been, the week, and the quiz average', () => {
    const state = {
      ...emptyState(),
      attempts: [quiz('surds', 30, '2026-09-15'), quiz('laws-of-indices', 90, '2026-09-16')],
      minutes: { '2026-09-15': 25, '2026-09-16': 35 },
      dailyGoalMinutes: 30,
    }
    const html = render(state, '2026-09-16T10:00:00.000Z')
    expect(html).toContain('Ana')
    expect(html).toContain('2 days ago')
    expect(html).toContain('60 min')
    // Today is Friday the 18th: the 15th, when study began, to Thursday had a goal, and only the 16th reached 30.
    expect(html).toContain('30 minutes reached on 1 of 3 days')
    // Mean of 30 and 90.
    expect(html).toContain('60%')
    expect(html).toContain('Across all 2')
  })

  it('names the topic that is going badly, as a control that opens its breakdown', () => {
    // Two attempts, because a skill needs more than one data point to be called weak.
    const state = { ...emptyState(), attempts: [quiz('surds', 30, '2026-09-14'), quiz('surds', 40, '2026-09-15')] }
    const html = render(state)
    // A button rather than a link: the answer to "how did that go" opens in place, and a
    // link would have sent the parent to the student's own topic page instead.
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('Surds')
    expect(html).toContain('40%')
    expect(html).toContain('Needs the most work')
    expect(html).toContain('rationalising denominators')
  })

  it('says plainly when there is nothing to worry about, rather than showing an empty list', () => {
    const state = { ...emptyState(), attempts: [quiz('surds', 95, '2026-09-15')] }
    const html = render(state)
    expect(html).toContain('Nothing is stuck')
  })

  /** An account with no activity must still render, and must not claim work was done. */
  it('survives an empty account', () => {
    const html = render(emptyState())
    expect(html).toContain('has not finished anything yet')
    expect(html).toContain('Nothing done yet')
    expect(html).not.toContain('NaN')
  })

  it('tells the parent what the page cannot see, and that it is read only', () => {
    const html = render(emptyState())
    expect(html).toContain('does not appear here until they sign in')
    expect(html).toContain('read it but not write it')
  })
})

const body = (tab: 'dashboard' | 'tasks', state?: ProgressState, subjectId?: string) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <FamilyBody child={{ email: 'kid@example.com', name: 'Ana Pandit', state }} tab={tab} onTab={() => {}} subjectId={subjectId} />
    </MemoryRouter>,
  )

/**
 * Reading the week and setting the next task are done at different moments, so they are
 * two tabs rather than one scroll. The form used to sit above the report, which meant a
 * parent opening the page to see how the week went met a subject picker first.
 */
describe('the family tabs', () => {
  const state = { ...emptyState(), attempts: [quiz('surds', 80, '2026-09-18')] }

  it('offers exactly Dashboard, Tasks and Reports, with one selected', () => {
    const html = body('dashboard', state)
    const tabs = [...html.matchAll(/role="tab"[^>]*>([^<]+)</g)].map((m) => m[1])
    expect(tabs).toEqual(['Dashboard', 'Tasks', 'Reports'])
    expect(html).toContain('role="tablist"')
    expect((html.match(/aria-selected="true"/g) ?? [])).toHaveLength(1)
  })

  it('shows the report on Dashboard and the task form on Tasks, never both at once', () => {
    const dashboard = body('dashboard', state)
    expect(dashboard).toContain('Worth a conversation')
    expect(dashboard).not.toContain('Set task')

    const tasks = body('tasks', state)
    expect(tasks).toContain('Set task')
    expect(tasks).toContain('Tasks for Ana')
    expect(tasks).not.toContain('Worth a conversation')
  })

  /** A tab has to say which panel it drives, or a screen reader announces two headings. */
  it('ties each tab to its panel', () => {
    const html = body('tasks', state)
    expect(html).toContain('id="familytab-tasks"')
    expect(html).toContain('aria-controls="familypanel-tasks"')
    expect(html).toContain('id="familypanel-tasks" aria-labelledby="familytab-tasks"')
    // Only the selected tab is in the tab order; the arrows reach the other one.
    expect(html).toMatch(/aria-selected="false" tabindex="-1"/)
  })

  /**
   * A child who has never signed in has no report, but tasks can still be set for them —
   * so the empty dashboard points at the tab that does work rather than dead-ending.
   */
  it('sends a parent with no synced child to the Tasks tab', () => {
    const html = body('dashboard', undefined)
    expect(html).toContain('has not signed in yet')
    expect(html).toContain('Tasks</button> tab')
    expect(body('tasks', undefined)).toContain('Set task')
  })

  /**
   * The point of the change: a parent who opens this after an evening of lessons,
   * flashcards and a cheat sheet should see that evening, not "Nothing done yet."
   */
  it('lists work of every kind in Recent work, marked or not', () => {
    const state: ProgressState = {
      ...emptyState(),
      attempts: [quiz('kinetic-and-gravitational-potential-energy', 80, '2026-09-14')],
      lessons: { 'kinetic-and-gravitational-potential-energy': { topicId: 'kinetic-and-gravitational-potential-energy', stepIndex: 3, updatedAt: '2026-09-15T09:00:00.000Z' } },
      activities: [
        { id: 'a1', topicId: 'kinetic-and-gravitational-potential-energy', subjectId: 'physics', kind: 'flashcards', at: '2026-09-16T19:00:00.000Z', cards: 12, turns: 15 },
        { id: 'a2', topicId: 'kinetic-and-gravitational-potential-energy', subjectId: 'physics', kind: 'cheat-sheet', at: '2026-09-17T19:30:00.000Z' },
        { id: 'a3', subjectId: 'physics', kind: 'exam-technique', at: '2026-09-18T20:00:00.000Z' },
      ],
    }
    const html = render(state)
    for (const label of ['Quiz', 'Lesson', 'Flashcards', 'Cheat sheet', 'Exam technique']) {
      expect(html, label).toContain(`>${label}</span>`)
    }
    expect(html).toContain('12 cards, 15 turns')
    expect(html).toContain('Step 4 of 8')
    expect(html).not.toContain('Nothing done yet')
  })

  /** Only a marked piece of work gets a percentage; a deck of cards never had one. */
  it('puts no score against work that was never marked', () => {
    const state: ProgressState = {
      ...emptyState(),
      activities: [{ id: 'a1', topicId: 'kinetic-and-gravitational-potential-energy', subjectId: 'physics', kind: 'flashcards', at: '2026-09-16T19:00:00.000Z', cards: 12, turns: 12 }],
    }
    const html = render(state)
    expect(html).toContain('12 cards, all known first time')
    expect(html).not.toMatch(/<strong class="shrink-0 tabular-nums">\d/)
  })

  /** The week's good deeds and the answers, once any deed has been seen; nothing before. */
  it('lists the week’s good deeds and what was said, once there are any', () => {
    expect(render(emptyState())).not.toContain('Good deeds')
    const state = {
      ...emptyState(),
      deeds: {
        '2026-09-18': { id: 'help-with-a-chore', seen: '2026-09-18T08:00:00.000Z' },
        '2026-09-17': { id: 'say-thank-you', seen: '2026-09-17T08:00:00.000Z', done: true, answeredAt: '2026-09-17T18:00:00.000Z' },
        '2026-09-15': { id: 'pick-up-litter', seen: '2026-09-15T08:00:00.000Z', done: false, answeredAt: '2026-09-15T18:00:00.000Z' },
      },
    }
    // The report reads the last seven days ending today; the section takes today from the clock,
    // so the fixed dates above are only in it when the test runs in that week. Its count is not.
    const html = render(state)
    expect(html).toContain('Good deeds · 1 done')
    expect(html).toContain('What Ana was asked this week')
    expect((html.match(/Not opened/g) ?? []).length).toBeGreaterThanOrEqual(4)
  })
})

/**
 * A parent asked to see, per subject, what exactly the time went on — flashcards against
 * quizzes, topic by topic. The dashboard counts topics across everything; this is the
 * subject opened up.
 */
describe('a subject opened from the dashboard', () => {
  const KE = 'kinetic-and-gravitational-potential-energy'
  const state: ProgressState = {
    ...emptyState(),
    attempts: [quiz(KE, 70, '2026-09-22')],
    lessons: { [KE]: { topicId: KE, stepIndex: 3, updatedAt: '2026-09-22T09:00:00.000Z' } },
    activities: [{ id: 'a1', topicId: KE, subjectId: 'physics', kind: 'flashcards', at: '2026-09-22T19:00:00.000Z', cards: 12, turns: 15 }],
    minutes: { '2026-09-19': 15, '2026-09-22': 38 },
    time: {
      [timeKey('2026-09-22', { subjectId: 'physics', topicId: KE, kind: 'quiz' })]: 9,
      [timeKey('2026-09-22', { subjectId: 'physics', topicId: KE, kind: 'lesson' })]: 22,
      [timeKey('2026-09-22', { subjectId: 'physics', topicId: KE, kind: 'flashcards' })]: 7,
    },
  }

  it('makes each subject row a link to its own detail, with its minutes', () => {
    const html = render(state)
    expect(html).toContain('href="/family?subject=physics"')
    expect(html).toContain('38 min')
    expect(html).toContain('1 of 34 started')
    // The row no longer sends a parent to the student's subject page, which has no progress on it.
    expect(html).not.toContain('href="/subjects/physics"')
  })

  it('shows the time by kind and what was done on each topic', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <FamilyBody child={{ email: 'kid@example.com', name: 'Ana Pandit', state }} tab="dashboard" onTab={() => {}} subjectId="physics" />
      </MemoryRouter>,
    )
    expect(html).toContain('Physics')
    expect(html).toContain('Where the time went')
    expect(html).toContain('38 min')
    expect(html).toContain('Lesson, step 4 of 8')
    expect(html).toContain('1 quiz, 70%')
    expect(html).toContain('Flashcards on 1 day, 12 cards')
    expect(html).toContain('Lesson 22 min · Quiz 9 min · Flashcards 7 min')
    // The 15 minutes on the 19th predate places, and the page says so rather than losing them.
    expect(html).toContain('15 min studied before that')
    expect(html).toContain('Not started yet')
    expect(html).toContain('href="/family"')
    expect(html).not.toContain('Worth a conversation')
    expect(html).not.toContain('NaN')
  })

  it('shows a subject with nothing done without inventing any', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <FamilyBody child={{ email: 'kid@example.com', name: 'Ana Pandit', state: emptyState() }} tab="dashboard" onTab={() => {}} subjectId="music" />
      </MemoryRouter>,
    )
    expect(html).toContain('Ana has not started Music yet')
    expect(html).toContain('No time recorded on Music yet')
    expect(html).not.toContain('NaN')
  })
})

/** Minutes on an unfinished deck leave no other record, and still mean the topic was begun. */
describe('a topic with only time on it', () => {
  it('counts as started on the dashboard, as it does on the subject page', () => {
    const state: ProgressState = {
      ...emptyState(),
      minutes: { '2026-09-18': 12 },
      time: { [timeKey('2026-09-18', { subjectId: 'maths', topicId: 'surds', kind: 'flashcards' })]: 12 },
    }
    const html = render(state)
    expect(html).toMatch(/1 of \d+ started · 12 min · last opened 18 Sept/)
  })
})

// This week against last (TRK-5). The test clock is Saturday 26 September 2026, so this
// week is 21 to 27 September and last week 14 to 20.
describe('this week and last', () => {
  it('shows each subject with last week → this week, and a next step beside a stuck topic', () => {
    const state: ProgressState = {
      ...emptyState(),
      time: { [timeKey('2026-09-15', { subjectId: 'maths', topicId: 'surds', kind: 'quiz' })]: 20, [timeKey('2026-09-22', { subjectId: 'maths', topicId: 'surds', kind: 'quiz' })]: 45 },
      attempts: [quiz('surds', 30, '2026-09-15'), quiz('surds', 40, '2026-09-22')],
    }
    const html = body('dashboard', state)
    expect(html).toContain('This week and last')
    expect(html).toContain('20 → 45')
    expect(html).toContain('30% → 40%')
    expect(html).toContain('Suggested next:')
  })

  it('leaves the section out for a fortnight with nothing done', () => {
    expect(body('dashboard', { ...emptyState(), attempts: [quiz('surds', 80, '2026-08-01')] })).not.toContain('This week and last')
  })
})

// The last eight weeks by subject (PAR-5), and the child's map (PAR-2).
describe('eight weeks and the map', () => {
  const state: ProgressState = {
    ...emptyState(),
    profile: { year: 10 },
    time: { [timeKey('2026-09-15', { subjectId: 'maths', topicId: 'surds', kind: 'quiz' })]: 20, [timeKey('2026-09-22', { subjectId: 'maths', topicId: 'surds', kind: 'quiz' })]: 45 },
    attempts: [quiz('surds', 30, '2026-09-15'), quiz('surds', 40, '2026-09-22')],
  }

  it('tables each subject week by week on the dashboard, minutes over the average mark', () => {
    const html = body('dashboard', state)
    expect(html).toContain('Last eight weeks, by subject')
    expect(html).toContain('3 Aug')
    expect(html).toContain('21 Sept')
    expect(html).toContain('<span class="font-bold">45</span><span class="text-xs text-ink-2">40%</span>')
  })

  it('draws each subject on the dashboard as the squares the child sees on Home', () => {
    const html = body('dashboard', state)
    expect(html).toMatch(/role="img" aria-label="Mathematics: 1 not secure, \d+ not started"/)
    expect(html).toMatch(/role="img" aria-label="Physics: \d+ not started"/)
  })

  it("shows the subject's map by unit, read only, opened on the child's year, and its eight weeks", () => {
    const html = body('dashboard', state, 'maths')
    expect(html).toContain('The map, as Ana sees it')
    expect(html).toMatch(/aria-pressed="true"[^>]*>Year 10<\/button>/)
    expect(html).toMatch(/role="img" aria-label="Surds, Year 10, Not secure"[^>]*>/)
    expect(html).not.toContain('aria-label="Factors, multiples and primes, Year 9')
    expect(html).toContain('Last eight weeks')
    expect(html).toContain('Minutes and average mark by week. week of 3 Aug: 0 min;')
    expect(html).toContain('week of 21 Sept: 45 min, average 40%')
    // Nothing on the map is a button: a parent reads it and cannot change it.
    expect(html.match(/<button[^>]*aria-label="Surds/)).toBeNull()
  })

  it('leaves the eight weeks out of a subject with nothing in them', () => {
    expect(body('dashboard', state, 'music')).not.toContain('Last eight weeks')
  })
})
