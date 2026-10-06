import { describe, expect, it } from 'vitest'
import { emptyState, fromStored, goalDays, type ProgressState } from './store.ts'
import { mergeProgress } from './merge.ts'
import { earnedBadgeIds } from './xp.ts'
import { weeklyMinutes } from './charts.ts'

/**
 * The goal became daily on 6 October 2026: 180 minutes a week was not being reached, and 25
 * a day is a target a student can finish today. These hold the move from a weekly goal and
 * how a week is counted against the daily one.
 */
const state = (over: Partial<ProgressState>): ProgressState => ({ ...emptyState(), ...over })

describe('a weekly goal saved before the change', () => {
  it('becomes the new default when it was the old default', () => {
    expect(fromStored({ goalMinutes: 180 } as never).dailyGoalMinutes).toBe(25)
  })
  it('becomes a seventh of itself, to the nearest 5, when the student chose it', () => {
    expect(fromStored({ goalMinutes: 120 } as never).dailyGoalMinutes).toBe(15)
    expect(fromStored({ goalMinutes: 300 } as never).dailyGoalMinutes).toBe(45)
    // Never below ten minutes, however small the weekly goal was.
    expect(fromStored({ goalMinutes: 30 } as never).dailyGoalMinutes).toBe(10)
  })
  it('is dropped, so it cannot be read as a daily goal later', () => {
    expect('goalMinutes' in fromStored({ goalMinutes: 300 } as never)).toBe(false)
  })
  it('gives way to a daily goal already saved', () => {
    expect(fromStored({ goalMinutes: 300, dailyGoalMinutes: 20 } as never).dailyGoalMinutes).toBe(20)
    expect(fromStored({}).dailyGoalMinutes).toBe(25)
  })
  it('is moved the same way when the account copy is merged in', () => {
    expect(mergeProgress({}, { goalMinutes: 300 } as never).dailyGoalMinutes).toBe(45)
  })
})

describe('days on goal', () => {
  // 2026-09-18 is a Friday; its week runs Monday the 14th to Sunday the 20th.
  const s = state({
    dailyGoalMinutes: 25,
    minutes: { '2026-09-14': 30, '2026-09-15': 10, '2026-09-16': 25, '2026-09-18': 5 },
    daysOff: ['2026-09-17'],
  })

  it('counts the days before today that had a goal, and today only once it is met', () => {
    // Monday and Wednesday met; Tuesday missed; Thursday off; Friday not yet met.
    expect(goalDays(s, '2026-09-18')).toEqual({ met: 2, of: 3 })
    expect(goalDays(state({ ...s, minutes: { ...s.minutes, '2026-09-18': 25 } }), '2026-09-18')).toEqual({ met: 3, of: 4 })
  })

  it('counts a day off on which the goal was met anyway', () => {
    expect(goalDays(state({ ...s, minutes: { ...s.minutes, '2026-09-17': 40 } }), '2026-09-18')).toEqual({ met: 3, of: 4 })
  })

  it('is what each week of the chart carries', () => {
    const weeks = weeklyMinutes(s, 2, '2026-09-18')
    expect(weeks.map((w) => w.goal)).toEqual([{ met: 0, of: 0 }, { met: 2, of: 3 }])
  })

  /** Weeks before the app was first used must not chart as weeks missed. */
  it('starts on the first day any study was recorded', () => {
    const later = state({ dailyGoalMinutes: 25, minutes: { '2026-09-16': 30 } })
    expect(goalDays(later, '2026-09-18')).toEqual({ met: 1, of: 2 })
    expect(goalDays(emptyState(), '2026-09-18')).toEqual({ met: 0, of: 0 })
    // A week of study followed by none still counts every missed day after it.
    expect(weeklyMinutes(later, 2, '2026-09-25').map((w) => w.goal)).toEqual([{ met: 1, of: 5 }, { met: 0, of: 4 }])
  })
})

describe('the goal badges', () => {
  it('give Goal reached on the first day the goal is met', () => {
    expect(earnedBadgeIds(state({ minutes: { '2026-09-16': 24 } }), '2026-09-18')).not.toContain('goal-day')
    expect(earnedBadgeIds(state({ minutes: { '2026-09-16': 25 } }), '2026-09-18')).toContain('goal-day')
  })

  it('give Goal every day only once every day of the week is met or off', () => {
    const week = ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19']
    const minutes = Object.fromEntries(week.map((d) => [d, 30]))
    // Saturday: Sunday is still to come.
    expect(earnedBadgeIds(state({ minutes }), '2026-09-19')).not.toContain('goal-week')
    expect(earnedBadgeIds(state({ minutes: { ...minutes, '2026-09-20': 25 } }), '2026-09-20')).toContain('goal-week')
    // A day off stands in for a met day, but a missed one does not.
    expect(earnedBadgeIds(state({ minutes, daysOff: ['2026-09-20'] }), '2026-09-20')).toContain('goal-week')
    expect(earnedBadgeIds(state({ minutes }), '2026-09-20')).not.toContain('goal-week')
  })
})
