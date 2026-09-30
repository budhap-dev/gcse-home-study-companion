import { describe, expect, it } from 'vitest'
import { DEEDS, deedOfTheDay } from '@study/shared'
import { ASK_FROM_HOUR, deedPrompt, deedsDone, recentDeeds } from './deeds.ts'
import { mergeProgress } from './merge.ts'
import { emptyState } from './store.ts'

const morning = new Date(2026, 9, 5, 9, 30)
const evening = new Date(2026, 9, 5, 19, 0)
const todayId = deedOfTheDay(morning).id
const yesterdayId = deedOfTheDay(new Date(2026, 9, 4, 12)).id

describe('the deed card', () => {
  it('shows the day’s deed in the morning and asks about it in the evening', () => {
    expect(deedPrompt({ deeds: {} }, morning)).toMatchObject({ day: '2026-10-05', phase: 'show', yesterday: false, deed: { id: todayId } })
    expect(deedPrompt({ deeds: {} }, evening)).toMatchObject({ day: '2026-10-05', phase: 'ask', yesterday: false })
    expect(deedPrompt({ deeds: {} }, new Date(2026, 9, 5, ASK_FROM_HOUR, 0)).phase).toBe('ask')
  })

  it('reports the answer once it is in', () => {
    const deeds = { '2026-10-05': { id: todayId, seen: '2026-10-05T08:00:00.000Z', done: true, answeredAt: '2026-10-05T18:00:00.000Z' } }
    expect(deedPrompt({ deeds }, evening)).toMatchObject({ phase: 'answered', record: { done: true } })
    expect(deedsDone({ deeds })).toBe(1)
  })

  /** A deed shown yesterday and never answered is asked about first, before today's is shown. */
  it('asks about yesterday’s deed before showing today’s, only if it was shown', () => {
    const shown = { deeds: { '2026-10-04': { id: yesterdayId, seen: '2026-10-04T08:00:00.000Z' } } }
    expect(deedPrompt(shown, morning)).toMatchObject({ day: '2026-10-04', phase: 'ask', yesterday: true, deed: { id: yesterdayId } })
    // Answered yesterday, so today's deed shows.
    const answered = { deeds: { '2026-10-04': { ...shown.deeds['2026-10-04'], done: false, answeredAt: '2026-10-04T20:00:00.000Z' } } }
    expect(deedPrompt(answered, morning)).toMatchObject({ day: '2026-10-05', phase: 'show' })
    // Not opened yesterday: nothing to ask, today's deed shows.
    expect(deedPrompt({ deeds: { '2026-10-02': { id: DEEDS[0]!.id, seen: '2026-10-02T08:00:00.000Z' } } }, morning)).toMatchObject({ day: '2026-10-05', phase: 'show' })
  })

  /** A day's record names its deed, so the card keeps showing the one that was shown even if the list is reordered. */
  it('keeps to the deed that was shown, and falls back to the day’s deed for an id it no longer knows', () => {
    const deeds = { '2026-10-05': { id: 'pick-up-litter', seen: '2026-10-05T08:00:00.000Z' } }
    expect(deedPrompt({ deeds }, morning).deed.id).toBe('pick-up-litter')
    expect(deedPrompt({ deeds: { '2026-10-05': { id: 'gone', seen: '2026-10-05T08:00:00.000Z' } } }, morning).deed.id).toBe(todayId)
  })

  it('lists the last seven days, oldest first, with gaps for days the app was shut', () => {
    const deeds = {
      '2026-10-05': { id: todayId, seen: 's' },
      '2026-10-03': { id: 'say-thank-you', seen: 's', done: true, answeredAt: 'a' },
      '2026-10-01': { id: 'star', seen: 's', done: false, answeredAt: 'a' },
    }
    const days = recentDeeds({ deeds }, '2026-10-05')
    expect(days.map((d) => d.day)).toEqual(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'])
    expect(days.map((d) => d.done)).toEqual([undefined, undefined, false, undefined, true, undefined, undefined])
    expect(days[4]!.deed?.text).toBe('Say "thank you" to at least three people.')
    expect(days[6]!.deed?.id).toBe(todayId)
  })
})

describe('deeds across two devices', () => {
  it('keeps the earlier sighting and the later answer', () => {
    const a = { ...emptyState(), deeds: { '2026-10-05': { id: todayId, seen: '2026-10-05T08:00:00.000Z', done: false, answeredAt: '2026-10-05T17:30:00.000Z' } } }
    const b = { ...emptyState(), deeds: { '2026-10-05': { id: todayId, seen: '2026-10-05T09:00:00.000Z', done: true, answeredAt: '2026-10-05T21:00:00.000Z' }, '2026-10-04': { id: yesterdayId, seen: '2026-10-04T08:00:00.000Z' } } }
    const m = mergeProgress(a, b)
    expect(m.deeds['2026-10-05']).toEqual({ id: todayId, seen: '2026-10-05T08:00:00.000Z', done: true, answeredAt: '2026-10-05T21:00:00.000Z' })
    expect(m.deeds['2026-10-04']).toEqual(b.deeds['2026-10-04'])
    // An answer on one side beats none on the other, whichever side saw it first.
    const c = mergeProgress({ ...emptyState(), deeds: { '2026-10-05': { id: todayId, seen: '2026-10-05T07:00:00.000Z' } } }, a)
    expect(c.deeds['2026-10-05']).toEqual({ id: todayId, seen: '2026-10-05T07:00:00.000Z', done: false, answeredAt: '2026-10-05T17:30:00.000Z' })
  })

  it('copes with a copy saved before deeds existed', () => {
    const old = { ...emptyState() } as Partial<typeof a>
    delete (old as { deeds?: unknown }).deeds
    const a = { ...emptyState(), deeds: { '2026-10-05': { id: todayId, seen: 's' } } }
    expect(mergeProgress(old, a).deeds).toEqual(a.deeds)
    expect(mergeProgress(a, old).deeds).toEqual(a.deeds)
  })
})
