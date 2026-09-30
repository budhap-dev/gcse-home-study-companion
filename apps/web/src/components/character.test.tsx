import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DEEDS, QUOTES, THEMES, deedOfTheDay } from '@study/shared'
import { CHARACTER_ICON_NAMES, CharacterIcon } from './characterIcons.tsx'
import { DeedCard } from './GoodDeed.tsx'
import { ThoughtCard } from './Thought.tsx'
import { deedPrompt, recentDeeds } from '../progress/deeds.ts'

describe('the character icons', () => {
  it('has a drawing for every deed and every theme, each different', () => {
    for (const d of DEEDS) expect(CHARACTER_ICON_NAMES, d.id).toContain(d.icon)
    for (const t of Object.values(THEMES)) expect(CHARACTER_ICON_NAMES, t.label).toContain(t.icon)
    // A deed's icon is its own: two deeds sharing one would look like the same task.
    expect(new Set(DEEDS.map((d) => d.icon)).size).toBe(DEEDS.length)
  })

  it('draws every icon as a stroked path in a 24-unit box', () => {
    for (const name of CHARACTER_ICON_NAMES) {
      const html = renderToStaticMarkup(<CharacterIcon name={name} />)
      expect(html, name).toMatch(/viewBox="0 0 24 24"/)
      expect(html, name).toMatch(/stroke="currentColor"/)
      expect(html, name).toMatch(/<path d="M[^"]{20,}"/)
    }
  })
})

const morning = new Date(2026, 9, 5, 9, 0)
const deed = deedOfTheDay(morning)
const answered = { deeds: { '2026-10-05': { id: deed.id, seen: 's', done: true, answeredAt: 'a' } } }

describe('the good deed card', () => {
  const card = (state: { deeds: Record<string, { id: string; seen: string; done?: boolean; answeredAt?: string }> }, now: Date, count = 0) =>
    renderToStaticMarkup(<DeedCard prompt={deedPrompt(state, now)} count={count} days={recentDeeds(state, '2026-10-05')} onAnswer={() => {}} />)

  it('shows the deed in the morning, with a way to tick it off early', () => {
    const html = card({ deeds: {} }, morning)
    expect(html).toContain('Good deed for today')
    expect(html).toContain(deed.text)
    expect(html).toContain(`data-icon="${deed.icon}"`)
    expect(html).toContain('This evening the app will ask')
    expect(html).toContain('Done it already')
    expect(html).not.toContain('Yes, I did')
  })

  it('asks in the evening', () => {
    const html = card({ deeds: {} }, new Date(2026, 9, 5, 18, 0))
    expect(html).toContain('Did you do it today?')
    expect(html).toContain('Yes, I did')
    expect(html).toContain('Not today')
  })

  it('asks about yesterday first when that was left unanswered', () => {
    const html = card({ deeds: { '2026-10-04': { id: 'pick-up-litter', seen: 's' } } }, morning)
    expect(html).toContain('Yesterday’s good deed')
    expect(html).toContain('Pick up litter')
    expect(html).toContain('Did you manage it yesterday?')
    expect(html).toContain('Not that day')
  })

  it('reports the answer with the running count and the week’s dots', () => {
    const html = card(answered, new Date(2026, 9, 5, 20, 0), 4)
    expect(html).toContain('Done. Nice one.')
    expect(html).toContain('That makes 4.')
    expect(html).toContain('4 done')
    expect(html).toContain('aria-label="The last seven days"')
    expect((html.match(/<li /g) ?? []).length).toBe(7)
    const first = card({ deeds: answered.deeds }, new Date(2026, 9, 5, 20, 0), 1)
    expect(first).toContain('Your first good deed on record.')
    const not = card({ deeds: { '2026-10-05': { ...answered.deeds['2026-10-05'], done: false } } }, new Date(2026, 9, 5, 20, 0), 3)
    expect(not).toContain('Not this time.')
  })

  /** Every control on a phone is a full-height target. */
  it('gives every button a 44px height', () => {
    for (const now of [morning, new Date(2026, 9, 5, 18, 0)]) {
      const html = card({ deeds: {} }, now)
      for (const button of html.match(/<button[^>]*>/g) ?? []) expect(button).toMatch(/min-h-11/)
    }
  })
})

describe('the thought card', () => {
  it('shows the saying, who said it and where, under its theme', () => {
    const q = QUOTES.find((x) => x.by === 'Samuel Johnson')!
    const html = renderToStaticMarkup(<ThoughtCard quote={q} onAnother={() => {}} />)
    expect(html).toContain('Thought for today')
    expect(html).toContain(q.text)
    expect(html).toContain('Samuel Johnson')
    expect(html).toContain('Rasselas, 1759')
    expect(html).toContain(THEMES[q.theme].label)
    expect(html).toContain(`data-icon="${THEMES[q.theme].icon}"`)
    expect(html).toContain('Another one')
  })

  it('renders every quote without a raw escape showing', () => {
    for (const q of QUOTES) {
      const html = renderToStaticMarkup(<ThoughtCard quote={q} />)
      expect(html, q.text).not.toMatch(/\\u[0-9a-f]{4}/i)
      expect(html, q.text).not.toContain('Another one')
    }
  })
})
