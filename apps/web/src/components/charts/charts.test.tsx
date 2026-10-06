import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SkillBars } from './SkillBars.tsx'
import { StatusDonut } from './StatusDonut.tsx'
import { WeeklyBars } from './WeeklyBars.tsx'
import type { StatusTotals } from '../../progress/charts.ts'

const totals = (over: Partial<StatusTotals> = {}): StatusTotals => ({
  counts: { 'not-secure': 2, developing: 3, secure: 4, 'grade-9-ready': 1 },
  notStarted: 40, started: 10, total: 50, ...over,
})

describe('StatusDonut', () => {
  it('puts the count of secure-or-better in the middle', () => {
    // 4 secure plus 1 mastered.
    expect(renderToStaticMarkup(<StatusDonut totals={totals()} />)).toContain('>5</text>')
  })

  it('describes itself for a screen reader, since a ring says nothing on its own', () => {
    expect(renderToStaticMarkup(<StatusDonut totals={totals()} />))
      .toContain('aria-label="5 of the 10 topics started are secure or better; 40 not started yet"')
  })

  /**
   * An arc whose start and end land on the same point collapses to nothing, so a single
   * slice covering the ring has to be drawn as a circle. A fresh account is exactly that
   * case: everything is "not started".
   */
  it('draws an empty ring rather than a blank square for a fresh account', () => {
    const html = renderToStaticMarkup(<StatusDonut totals={totals({ counts: { 'not-secure': 0, developing: 0, secure: 0, 'grade-9-ready': 0 }, notStarted: 50, started: 0 })} />)
    expect(html).toContain('<circle')
    expect(html).toContain('>0</text>')
  })

  it('lists every status in the legend even when its count is zero', () => {
    const html = renderToStaticMarkup(<StatusDonut totals={totals({ counts: { 'not-secure': 0, developing: 0, secure: 4, 'grade-9-ready': 0 }, started: 4 })} />)
    for (const label of ['Not secure', 'Developing', 'Secure', 'Mastered']) expect(html).toContain(label)
  })

  /**
   * The ring is about the topics that have been started. Eight subjects hold hundreds of
   * topics met over three years, so including the untouched ones drew a ring that was
   * almost entirely grey and said nothing.
   */
  it('leaves untouched topics out of the ring and reports them as a number', () => {
    const html = renderToStaticMarkup(<StatusDonut totals={totals()} />)
    expect(html).toContain('10 of 50 topics started')
    expect(html).toContain('40 still to come')
  })
})

describe('WeeklyBars', () => {
  const weeks = [
    { start: '2026-09-07', minutes: 0, goal: { met: 0, of: 7 }, label: '7 Sept' },
    { start: '2026-09-14', minutes: 240, goal: { met: 3, of: 6 }, label: '14 Sept' },
    { start: '2026-09-21', minutes: 175, goal: { met: 5, of: 5 }, label: '21 Sept' },
  ]

  it('says how many days met the goal, and the minutes in all', () => {
    expect(renderToStaticMarkup(<WeeklyBars weeks={weeks} goal={25} />)).toContain('25 minutes reached on 8 days over 3 weeks · 415 minutes in all')
  })

  /** The track is the days that had a goal; the bar is the share of them met. */
  it('draws each week as days met out of days with a goal', () => {
    const html = renderToStaticMarkup(<WeeklyBars weeks={weeks} goal={25} />)
    expect(html).toContain('3/6')
    expect(html).toContain(`height:${(100 * 6) / 7}%`)
    expect(html).toContain('height:50%')
    // A week with every goal day met is green even with two days off.
    expect(html).toMatch(/bg-status-secure" style="height:100%/)
  })

  /**
   * A percentage height resolves against the parent's height, so without h-full on the
   * column every bar computed to zero and the chart rendered as bare numbers.
   */
  it('gives each column a height for its bar to be a percentage of', () => {
    expect(renderToStaticMarkup(<WeeklyBars weeks={weeks} goal={25} />)).toContain('flex h-full')
  })

  it('still draws an empty week, because a gap is the point', () => {
    const html = renderToStaticMarkup(<WeeklyBars weeks={weeks} goal={25} />)
    expect(html).toContain('Week of 7 Sept: goal met on 0 of 7 days, 0 minutes in all')
    expect(html).toContain('0/7')
  })
})

describe('SkillBars', () => {
  const stat = (skill: string, pct: number, attempts = 3) => ({ skill, subjectId: 'maths', pct, attempts })

  it('prints the number beside every bar, so colour is never the only signal', () => {
    const html = renderToStaticMarkup(<SkillBars skills={[stat('surds', 42)]} empty="none" />)
    expect(html).toContain('42%')
    expect(html).toContain('3 questions')
    expect(html).toContain('Mathematics')
  })

  it('gives a zero-width bar something to show', () => {
    expect(renderToStaticMarkup(<SkillBars skills={[stat('surds', 0)]} empty="none" />)).toContain('width:2%')
  })

  it('says why it is empty rather than rendering an empty list', () => {
    expect(renderToStaticMarkup(<SkillBars skills={[]} empty="Not enough answers yet." />)).toContain('Not enough answers yet.')
  })
})
