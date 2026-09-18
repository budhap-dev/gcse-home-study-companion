import { SYLLABUS } from '@study/shared'
import { describe, expect, it } from 'vitest'
import { filterTopics, pickableTopics } from './TopicPicker.tsx'
import { emptyState } from '../../progress/store.ts'

const all = pickableTopics('maths', emptyState())
const y11 = pickableTopics('maths', emptyState(), 11)
const y10 = pickableTopics('maths', emptyState(), 10)

describe('pickableTopics', () => {
  /**
   * The numbering has to agree with the subject map, or "Y11 · 4" means two things. The
   * map lists every syllabus row including ones not written yet, so counting skips
   * nothing even though unwritten rows are then dropped.
   */
  it('numbers rows the way the subject map lists them', () => {
    const rows = (SYLLABUS.maths ?? []).filter((b) => b.year === 11).flatMap((b) => b.topics)
    const fourth = rows[3]!
    const found = y11.find((t) => t.number === 4)!
    expect(found.id).toBe(fourth.topicId)
    expect(found.label).toBe('Y11 · 4')
  })

  /**
   * The reason this comes from the syllabus rather than from each topic's own year:
   * Surds is authored as Year 10 but is also a Year 11 row, and a parent filtering to
   * Year 11 expects to find it.
   */
  it('includes a topic revisited in a later year under that later year', () => {
    expect(y10.map((t) => t.id)).toContain('surds')
    expect(y11.map((t) => t.id)).toContain('surds')
  })

  it('offers more Year 11 rows than there are topics authored for Year 11', () => {
    // 23 rows against 11 written-for-Year-11 topics: the difference is the revision rows.
    expect(y11.length).toBeGreaterThan(15)
  })

  it('drops rows with no topic behind them, since there is nothing to assign', () => {
    for (const t of all) expect(t.id).toBeTruthy()
    const music = pickableTopics('music', emptyState())
    const written = (SYLLABUS.music ?? []).flatMap((b) => b.topics).filter((e) => e.topicId)
    expect(music.length).toBeLessThanOrEqual(written.length)
  })

  it('keeps a repeated topic once, under its latest year, when no year is chosen', () => {
    const ids = all.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(all.find((t) => t.id === 'surds')!.year).toBe(11)
  })

  it('shows the written topic name when the row calls it something else', () => {
    const row = y11.find((t) => t.title === 'Trigonometric graphs')!
    expect(row.topicTitle).toBe('Graphs of sin, cos and tan')
  })
})

describe('filterTopics', () => {
  it('matches on the title, case and punctuation aside', () => {
    expect(filterTopics(all, 'surds').map((t) => t.title)).toContain('Surds')
    expect(filterTopics(all, 'ALGEBRAIC fractions').map((t) => t.title)).toContain('Algebraic fractions')
  })

  it('matches every word, not just one of them', () => {
    const hits = filterTopics(all, 'circle equation')
    expect(hits.map((t) => t.title)).toContain('Equation of a circle')
    expect(hits.map((t) => t.title)).not.toContain('Circle theorems')
  })

  it('finds a row by year and number, which is the point of the numbering', () => {
    const target = y11.find((t) => t.number === 4)!
    expect(filterTopics(y11, 'y11 4').map((t) => t.id)).toContain(target.id)
    expect(filterTopics(all, '11 4').map((t) => t.id)).toContain(target.id)
  })

  it('also matches the written topic name when it differs from the row', () => {
    expect(filterTopics(y11, 'sin cos tan').map((t) => t.title)).toContain('Trigonometric graphs')
  })

  it('searches only inside the year it was given', () => {
    expect(filterTopics(y10, 'surds').map((t) => t.title)).toEqual(['Surds'])
    expect(filterTopics(pickableTopics('maths', emptyState(), 9), 'algebraic fractions')).toEqual([])
  })

  it('returns everything for an empty query', () => {
    expect(filterTopics(all, '   ')).toHaveLength(all.length)
  })
})
